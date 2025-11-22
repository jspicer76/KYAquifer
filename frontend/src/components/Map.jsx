import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  Polygon,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import { useEffect, useState, useRef } from "react";
import { useAquiferStore } from "../store/aquiferStore";
import { feetToLat, feetToLng } from "../utils/ftToLatLng";
import { ensureMinimumRows, flattenManualSteps, MIN_POINTS } from "../utils/drawdown";
import "../styles/map.css";
import Papa from "papaparse";
import DataChartModal from "./DataChartModal";

// Map background options
const MAP_STYLES = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },
  hybrid: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri World Imagery",
  },
  topo: {
    url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
    attribution: "© USGS National Map",
  },
};

// ------------------------------------------------------------
// FIX DEFAULT MARKER ICONS
// ------------------------------------------------------------
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Pumping well icon
const pumpingWellIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/1828/1828884.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Observation well icon
const obsWellIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

// Polygon vertex icon
const vertexIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/32/32339.png",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const EARTH_RADIUS_FT = 20925524.9; // 6371000 meters converted to feet
const degToRad = (deg) => (deg * Math.PI) / 180;
function feetBetween(lat1, lng1, lat2, lng2) {
  const dLat = degToRad(lat2 - lat1);
  const dLng = degToRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degToRad(lat1)) *
      Math.cos(degToRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return EARTH_RADIUS_FT * c;
}

export default function AquiferMap({ mapStyle }) {
  const geometry = useAquiferStore((s) => s.geometry);

  // Well actions
  const addWell = useAquiferStore((s) => s.addWell);
  const updateWell = useAquiferStore((s) => s.updateWell);

  // Polygon actions
  const startBoundaryPolygon = useAquiferStore((s) => s.startBoundaryPolygon);
  const addPolygonVertex = useAquiferStore((s) => s.addPolygonVertex);
  const closePolygon = useAquiferStore((s) => s.closePolygon);
  const insertVertexOnSegment = useAquiferStore((s) => s.insertVertexOnSegment);
  const setSegmentType = useAquiferStore((s) => s.setSegmentType);
  const clearBoundaryPolygon = useAquiferStore((s) => s.clearBoundaryPolygon);

  const clearPlacementMode = useAquiferStore((s) => s.clearPlacementMode);

  const wells = geometry.wells;
  const poly = geometry.boundaryPolygon;

  const wellMode = geometry.wellPlacementMode;

  const mapWrapperRef = useRef(null);
  const PANEL_WIDTH = 360;

  // UI state
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [activeWellId, setActiveWellId] = useState(null);
  const [panelPos, setPanelPos] = useState({ x: 420, y: 60 });
  const [draggingPanel, setDraggingPanel] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [chartConfig, setChartConfig] = useState(null);
  const [boundaryInfo, setBoundaryInfo] = useState(null);

  const activeWell = wells.find((w) => w.id === activeWellId);
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const startPanelDrag = (e) => {
    e.preventDefault();
    if (!mapWrapperRef.current) return;
    const rect = mapWrapperRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left - panelPos.x,
      y: e.clientY - rect.top - panelPos.y,
    };
    setDraggingPanel(true);
  };

  const openWellPanel = (leafletEvent, wellId) => {
    const original = leafletEvent.originalEvent;
    if (original) {
      original.preventDefault();
      if (mapWrapperRef.current) {
        const rect = mapWrapperRef.current.getBoundingClientRect();
        const proposedX = original.clientX - rect.left + 12;
        const proposedY = original.clientY - rect.top + 12;
        setPanelPos({
          x: clamp(proposedX, 16, rect.width - PANEL_WIDTH - 16),
          y: clamp(proposedY, 16, rect.height - 220),
        });
      }
    }
    setActiveWellId(wellId);
  };


  // ------------------------------------------------------------
  // ESC exits well placement mode
  // ------------------------------------------------------------
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") {
        clearPlacementMode();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [clearPlacementMode]);

  useEffect(() => {
    if (!draggingPanel) return;

    function onMove(e) {
      if (!mapWrapperRef.current) return;
      const rect = mapWrapperRef.current.getBoundingClientRect();
      const nextX = e.clientX - rect.left - dragOffsetRef.current.x;
      const nextY = e.clientY - rect.top - dragOffsetRef.current.y;
      setPanelPos({
        x: clamp(nextX, 16, rect.width - PANEL_WIDTH - 16),
        y: clamp(nextY, 16, rect.height - 220),
      });
    }

    function onUp() {
      setDraggingPanel(false);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingPanel, PANEL_WIDTH]);


  // ------------------------------------------------------------
  // SNAP TO NEAREST VERTEX
  // ------------------------------------------------------------
  function snapToVertex(latlng) {
    if (poly.vertices.length === 0) return latlng;

    const DEG_TO_FT = 364000; // rough conversion used elsewhere in map helpers
    let best = null;
    let bestDistFt = Infinity;

    poly.vertices.forEach((v) => {
      const dLat = v.lat - latlng.lat;
      const dLng = v.lng - latlng.lng;
      const distFt = Math.sqrt(dLat * dLat + dLng * dLng) * DEG_TO_FT;
      if (distFt < bestDistFt) {
        bestDistFt = distFt;
        best = v;
      }
    });

    // Only snap if the user clicked very close to an existing vertex (<30 ft).
    return bestDistFt < 30 ? { lat: best.lat, lng: best.lng } : latlng;
  }


  // ------------------------------------------------------------
  // MAP CLICK EVENTS
  // ------------------------------------------------------------
  function MapClickHandler() {
    useMapEvents({
      click(e) {
        const pt = e.latlng;
        setBoundaryInfo(null);

        // WELL MODE
        if (wellMode === "pumping" || wellMode === "observation") {
          addWell({ lat: pt.lat, lng: pt.lng });
          return;
        }

        // POLYGON DRAWING
        if (geometry.drawingBoundary) {
          const snapped = snapToVertex(pt);
          addPolygonVertex(snapped);
          return;
        }

        // CLICKING SEGMENTS TO SELECT
        let clickedSeg = null;
        for (const seg of poly.segments) {
          const start = poly.vertices.find((v) => v.id === seg.startId);
          const end = poly.vertices.find((v) => v.id === seg.endId);
          if (!start || !end) continue;

          const dist = pointToSegmentDistance(pt, start, end);
          if (dist < 8) {
            clickedSeg = seg.id;
            break;
          }
        }

        setSelectedSegmentId(clickedSeg);
      },

      dblclick() {
        if (geometry.drawingBoundary && poly.vertices.length >= 3) {
          closePolygon();
        }
      },
    });

    return null;
  }


  // ------------------------------------------------------------
  // HELPER — Distance from point to a polyline segment
  // ------------------------------------------------------------
  function pointToSegmentDistance(pt, v1, v2) {
    const x = pt.lng,  y = pt.lat;
    const x1 = v1.lng, y1 = v1.lat;
    const x2 = v2.lng, y2 = v2.lat;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    return Math.sqrt((x - xx) ** 2 + (y - yy) ** 2) * 364000; // deg → ft approx
  }


  // ------------------------------------------------------------
  // STYLES FOR SEGMENTS
  // ------------------------------------------------------------
  function styleForSegment(type, isSelected) {
    const base = { weight: isSelected ? 5 : 3 };

    switch (type) {
      case "constantHead":
        return { ...base, color: "blue", dashArray: "6" };
      case "noFlow":
        return { ...base, color: "red" };
      case "infinite":
        return { ...base, color: "green", dashArray: "4" };
      default:
        return { ...base, color: "black" };
    }
  }


  // ------------------------------------------------------------
  // RENDER MAP
  // ------------------------------------------------------------
  return (
    <div
      ref={mapWrapperRef}
      style={{ height: "100%", width: "100%", position: "relative" }}
    >
      <MapContainer
        center={[geometry.wellLat, geometry.wellLng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url={MAP_STYLES[mapStyle]?.url || MAP_STYLES.street.url}
          attribution={MAP_STYLES[mapStyle]?.attribution || MAP_STYLES.street.attribution}
        />

        <MapClickHandler />

        {/* WELLS */}
        {wells.map((w) => (
          <Marker
            key={w.id}
            position={[w.lat, w.lng]}
            draggable={true}
            icon={w.isPumping ? pumpingWellIcon : obsWellIcon}
            eventHandlers={{
              dragend: (e) => {
                const newPos = e.target.getLatLng();
                updateWell(w.id, { lat: newPos.lat, lng: newPos.lng });
              },
              contextmenu: (e) => openWellPanel(e, w.id),
            }}
          >
            <Tooltip
              permanent
              direction="right"
              offset={[18, -12]}
              className="well-label"
              opacity={1}
            >
              {w.name}
            </Tooltip>
          </Marker>
        ))}

        {/* POLYGON VERTICES */}
        {poly.vertices.map((v) => (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={vertexIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                // NOT full vertex drag logic yet — coming next phase
              },
            }}
          />
        ))}

        {/* POLYGON SEGMENTS */}
        {poly.segments.map((s) => {
          const start = poly.vertices.find((v) => v.id === s.startId);
          const end = poly.vertices.find((v) => v.id === s.endId);
          if (!start || !end) return null;

          return (
            <Polyline
              key={s.id}
              positions={[
                [start.lat, start.lng],
                [end.lat, end.lng],
              ]}
              pathOptions={styleForSegment(
                s.type,
                selectedSegmentId === s.id
              )}
              eventHandlers={{
                contextmenu: (event) => {
                  if (!mapWrapperRef.current) return;
                  event.originalEvent?.preventDefault();
                  const rect = mapWrapperRef.current.getBoundingClientRect();
                  const typeLabel =
                    s.type === "constantHead"
                      ? "Constant Head"
                      : s.type === "noFlow"
                      ? "No-Flow"
                      : "Infinite";
                  const lengthFt = feetBetween(
                    start.lat,
                    start.lng,
                    end.lat,
                    end.lng
                  );
                  setBoundaryInfo({
                    type: typeLabel,
                    length: lengthFt,
                    position: {
                      x: event.originalEvent.clientX - rect.left + 10,
                      y: event.originalEvent.clientY - rect.top + 10,
                    },
                  });
                },
              }}
            />
          );
        })}

        {/* WHP ZONES */}
        {geometry.showWHP && (
          <>
            {geometry.whp.zone1 && (
              <Circle
                center={[geometry.wellLat, geometry.wellLng]}
                radius={geometry.whp.zone1 * 0.3048}
                pathOptions={{ color: "blue", dashArray: "4" }}
              />
            )}

            {geometry.whp.zone2.length > 5 && (
              <Polygon
                positions={geometry.whp.zone2.map(([x, y]) => [
                  geometry.wellLat + feetToLat(y),
                  geometry.wellLng + feetToLng(x, geometry.wellLat),
                ])}
                pathOptions={{ color: "green", dashArray: "6" }}
              />
            )}

            {geometry.whp.zone3.length > 5 && (
              <Polygon
                positions={geometry.whp.zone3.map(([x, y]) => [
                  geometry.wellLat + feetToLat(y),
                  geometry.wellLng + feetToLng(x, geometry.wellLat),
                ])}
                pathOptions={{ color: "red", dashArray: "6" }}
              />
            )}
          </>
        )}
      </MapContainer>

      {activeWell && (
        <div
          className="well-panel"
          style={{
            top: panelPos.y,
            left: panelPos.x,
            width: PANEL_WIDTH,
          }}
        >
          <WellPopupForm
            wellId={activeWell.id}
            onClose={() => setActiveWellId(null)}
            onStartDrag={startPanelDrag}
            onPreview={setChartConfig}
          />
        </div>
      )}

      {boundaryInfo && (
        <div
          className="boundary-popup"
          style={{
            top: boundaryInfo.position.y,
            left: boundaryInfo.position.x,
          }}
        >
          <strong>{boundaryInfo.type}</strong>
          <div>Length: {boundaryInfo.length.toFixed(1)} ft</div>
          <button
            style={{
              marginTop: "0.3rem",
              border: "none",
              background: "#eee",
              padding: "0.2rem 0.5rem",
              cursor: "pointer",
            }}
            onClick={() => setBoundaryInfo(null)}
          >
            Close
          </button>
        </div>
      )}

      {chartConfig && (
        <DataChartModal config={chartConfig} onClose={() => setChartConfig(null)} />
      )}

      {/* ------------------------------------------------------------
          SEGMENT EDITOR (BOTTOM-CENTER FLOAT PANEL)
      ------------------------------------------------------------ */}
      {selectedSegmentId && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255,255,255,0.95)",
            padding: "10px 15px",
            borderRadius: "8px",
            boxShadow: "0 0 6px rgba(0,0,0,0.25)",
            display: "flex",
            gap: "8px",
            zIndex: 5000,
          }}
        >
          {/* SET TYPES */}
          <button onClick={() => setSegmentType(selectedSegmentId, "constantHead")}>
            Constant
          </button>
          <button onClick={() => setSegmentType(selectedSegmentId, "noFlow")}>
            No-Flow
          </button>
          <button onClick={() => setSegmentType(selectedSegmentId, "infinite")}>
            Infinite
          </button>

          {/* MIDPOINT */}
          <button
            onClick={() => {
              const seg = poly.segments.find((s) => s.id === selectedSegmentId);
              const v1 = poly.vertices.find((v) => v.id === seg.startId);
              const v2 = poly.vertices.find((v) => v.id === seg.endId);

              const mid = {
                lat: (v1.lat + v2.lat) / 2,
                lng: (v1.lng + v2.lng) / 2,
              };

              insertVertexOnSegment(selectedSegmentId, mid);
              setSelectedSegmentId(null);
            }}
          >
            + Mid
          </button>

          {/* DESELECT */}
          <button
            onClick={() => setSelectedSegmentId(null)}
            style={{ background: "#eee" }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

function WellPopupForm({ wellId, onClose, onStartDrag, onPreview }) {
  const wells = useAquiferStore((s) => s.geometry.wells);
  const updateWell = useAquiferStore((s) => s.updateWell);
  const deleteWell = useAquiferStore((s) => s.deleteWell);

  const well = wells.find((w) => w.id === wellId);
  const [activePumpStep, setActivePumpStep] = useState(0);
  const [activeObsStep, setActiveObsStep] = useState(0);
  const [savedStepTag, setSavedStepTag] = useState(null);

  useEffect(() => {
    setSavedStepTag(null);
  }, [wellId]);

  if (!well) return null;

  const inputStyle = {
    width: "100%",
    marginBottom: "0.5rem",
    padding: "0.3rem",
    boxSizing: "border-box",
  };

  const normalizeTestData = (data) => {
    const normalized = {
      selectedType: data?.selectedType || "constant",
      entryMode: data?.entryMode || "manual",
      manualRows: Array.isArray(data?.manualRows) ? data.manualRows : [],
      csvRows: Array.isArray(data?.csvRows) ? data.csvRows : [],
      manualSteps: Array.isArray(data?.manualSteps)
        ? data.manualSteps.map((step) => ({
            rate_gpm: step?.rate_gpm ?? null,
            rows: Array.isArray(step?.rows) ? step.rows : [],
          }))
        : [],
      stepCount: data?.stepCount || 1,
    };
    normalized.stepCount = Math.min(Math.max(normalized.stepCount, 1), 5);
    while (normalized.manualSteps.length < normalized.stepCount) {
      normalized.manualSteps.push({ rate_gpm: null, rows: [] });
    }
    if (normalized.manualSteps.length > normalized.stepCount) {
      normalized.manualSteps = normalized.manualSteps.slice(
        0,
        normalized.stepCount
      );
    }
    return normalized;
  };

  const normalizeRecovery = (data) => ({
    entryMode: data?.entryMode || "manual",
    manualRows: Array.isArray(data?.manualRows) ? data.manualRows : [],
    csvRows: Array.isArray(data?.csvRows) ? data.csvRows : [],
  });

  const pumpTest = normalizeTestData(well.pump_test);
  const obsTest = normalizeTestData(well.observation_test);
  const recoveryData = normalizeRecovery(well.observation_recovery);

  useEffect(() => {
    setActivePumpStep((idx) => Math.min(idx, pumpTest.stepCount - 1));
  }, [pumpTest.stepCount]);

  useEffect(() => {
    setActiveObsStep((idx) => Math.min(idx, obsTest.stepCount - 1));
  }, [obsTest.stepCount]);

  const testForRole = (role) => (role === "pump" ? pumpTest : obsTest);
  const stepIndexForRole = (role) =>
    role === "pump" ? activePumpStep : activeObsStep;
  const setStepIndexForRole = (role, value) => {
    if (role === "pump") setActivePumpStep(value);
    else setActiveObsStep(value);
  };

  const hasExistingData = (test) =>
    test.manualRows.length > 0 ||
    test.csvRows.length > 0 ||
    test.manualSteps.some((step) => step.rows.length > 0);

  const saveTestData = (role, updates) => {
    const current = testForRole(role);
    const fieldName = role === "pump" ? "pump_test" : "observation_test";
    const merged = {
      ...current,
      ...updates,
    };
    updateWell(well.id, { [fieldName]: merged });
  };

  const saveRecovery = (updates) => {
    updateWell(well.id, {
      observation_recovery: {
        ...recoveryData,
        ...updates,
      },
    });
  };

  const confirmOverride = (test) => {
    if (!hasExistingData(test)) return true;
    return window.confirm(
      "Existing drawdown data will be replaced. Continue?"
    );
  };

  const handleTypeChange = (role, value) => {
    const test = testForRole(role);
    if (!confirmOverride(test)) return;
    saveTestData(role, {
      selectedType: value,
      manualRows: value === "constant" ? test.manualRows.slice(0, 1) : [],
      manualSteps:
        value === "step" ? test.manualSteps : [{ rate_gpm: null, rows: [] }],
      csvRows: [],
      stepCount: value === "step" ? Math.min(test.stepCount || 1, 5) : test.stepCount,
    });
  };

  const handleEntryModeChange = (role, mode) => {
    const test = testForRole(role);
    if (mode !== test.entryMode && !confirmOverride(test)) return;
    const updates = { entryMode: mode };
    if (mode === "manual") {
      if (test.selectedType === "step" && test.manualSteps.length === 0) {
        updates.manualSteps = [{ rate_gpm: null, rows: [] }];
      }
      if (test.selectedType === "constant" && test.manualRows.length === 0) {
        updates.manualRows = [createRowTemplate(role, test.selectedType)];
      }
    }
    saveTestData(role, updates);
  };

  const handleStepCountChange = (role, count) => {
    const test = testForRole(role);
    if (!confirmOverride(test)) return;
    const newSteps = Array.from({ length: count }, (_, idx) => {
      if (test.manualSteps[idx]) return test.manualSteps[idx];
      return { rate_gpm: null, rows: [] };
    });
    saveTestData(role, { stepCount: count, manualSteps: newSteps });
    setStepIndexForRole(role, 0);
  };

  const handleStepRateChange = (role, stepIdx, value) => {
    const test = testForRole(role);
    const steps = test.manualSteps.map((step, idx) =>
      idx === stepIdx ? { ...step, rate_gpm: value === "" ? null : Number(value) } : step
    );
    saveTestData(role, { manualSteps: steps });
  };

  const handleStepRowChange = (role, stepIdx, rowIdx, field, raw) => {
    const test = testForRole(role);
    const steps = test.manualSteps.map((step, idx) => {
      if (idx !== stepIdx) return step;
      const rows = step.rows.map((row, rIdx) =>
        rIdx === rowIdx
          ? { ...row, [field]: raw === "" ? null : Number(raw) }
          : row
      );
      return { ...step, rows };
    });
    saveTestData(role, { manualSteps: steps });
  };

  const addStepRow = (role, stepIdx) => {
    const test = testForRole(role);
    const steps = test.manualSteps.map((step, idx) => {
      if (idx !== stepIdx) return step;
      return {
        ...step,
        rows: [
          ...step.rows,
          { time_min: null, drawdown_ft: null },
        ],
      };
    });
    saveTestData(role, { manualSteps: steps });
  };

  const removeStepRow = (role, stepIdx, rowIdx) => {
    const test = testForRole(role);
    const steps = test.manualSteps.map((step, idx) => {
      if (idx !== stepIdx) return step;
      return {
        ...step,
        rows: step.rows.filter((_, rIdx) => rIdx !== rowIdx),
      };
    });
    saveTestData(role, { manualSteps: steps });
  };

  const createRowTemplate = (role, type) => {
    const columns = getCsvColumns(role, type);
    const template = {};
    columns.forEach((col) => {
      template[col] = null;
    });
    return template;
  };

  const handleManualChange = (role, rowIdx, field, raw) => {
    const test = testForRole(role);
    const rows = test.manualRows.map((row, idx) =>
      idx === rowIdx
        ? { ...row, [field]: raw === "" ? null : Number(raw) }
        : row
    );
    saveTestData(role, { manualRows: rows });
  };

  const addManualRow = (role) => {
    const test = testForRole(role);
    const rows = [
      ...test.manualRows,
      createRowTemplate(role, test.selectedType),
    ];
    saveTestData(role, { manualRows: rows });
  };

  const removeManualRow = (role, idx) => {
    const test = testForRole(role);
    const rows = test.manualRows.filter((_, rIdx) => rIdx !== idx);
    saveTestData(role, { manualRows: rows });
  };

  const handleCsvUpload = (role, event) => {
    const file = event.target.files[0];
    if (!file) return;

    const test = testForRole(role);
    const requiredCols = getCsvColumns(role, test.selectedType);

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cleaned = result.data
          .filter((row) =>
            requiredCols.every(
              (col) => row[col] !== undefined && row[col] !== null && row[col] !== ""
            )
          )
          .map((row) => {
            const filtered = {};
            requiredCols.forEach((col) => {
              filtered[col] = row[col];
            });
            return filtered;
          });

        saveTestData(role, { entryMode: "csv", csvRows: cleaned });
      },
    });

    event.target.value = "";
  };

  const handleRecoveryCsv = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cleaned = result.data
          .filter(
            (row) =>
              row.time_min !== undefined &&
              row.residual_drawdown_ft !== undefined &&
              row.time_min !== "" &&
              row.residual_drawdown_ft !== ""
          )
          .map((row) => ({
            time_min: row.time_min,
            residual_drawdown_ft: row.residual_drawdown_ft,
          }));
        saveRecovery({ entryMode: "csv", csvRows: cleaned });
      },
    });
    event.target.value = "";
  };

  const handleRecoveryManualChange = (rowIdx, field, raw) => {
    const rows = recoveryData.manualRows.map((row, idx) =>
      idx === rowIdx
        ? { ...row, [field]: raw === "" ? null : Number(raw) }
        : row
    );
    saveRecovery({ manualRows: rows });
  };

  const addRecoveryRow = () => {
    saveRecovery({
      manualRows: [
        ...recoveryData.manualRows,
        { time_min: null, residual_drawdown_ft: null },
      ],
    });
  };

  const removeRecoveryRow = (rowIdx) => {
    saveRecovery({
      manualRows: recoveryData.manualRows.filter((_, idx) => idx !== rowIdx),
    });
  };

  const buildDrawdownDataset = (role) => {
    const test = testForRole(role);
    if (test.selectedType === "step") {
      const rows =
        test.entryMode === "csv"
          ? test.csvRows
          : flattenManualSteps(test.manualSteps);
      const sanitized = ensureMinimumRows(rows, "time_min", "drawdown_ft");
      return {
        type: "step",
        rows: sanitized,
        xKey: "time_min",
        yKey: "drawdown_ft",
      };
    }
    const source =
      test.entryMode === "csv" ? test.csvRows : test.manualRows;
    const sanitized = ensureMinimumRows(source, "time_hr", "drawdown_ft");
    return {
      type: "constant",
      rows: sanitized,
      xKey: "time_hr",
      yKey: "drawdown_ft",
    };
  };

  const buildRecoveryDataset = () => {
    const source =
      recoveryData.entryMode === "csv"
        ? recoveryData.csvRows
        : recoveryData.manualRows;
    const sanitized = ensureMinimumRows(
      source,
      "time_min",
      "residual_drawdown_ft"
    );
    return {
      rows: sanitized,
      xKey: "time_min",
      yKey: "residual_drawdown_ft",
    };
  };

  const previewDataset = (role, kind = "drawdown") => {
    if (!onPreview) return;
    if (kind === "recovery") {
      const data = buildRecoveryDataset();
      if (data.rows.length === 0) {
        alert("Add recovery data first.");
        return;
      }
      onPreview({
        title: "Observation Recovery",
        datasets: [
          {
            label: "Residual Drawdown",
            borderColor: "#0b7285",
            data: data.rows.map((row) => ({
              x: row[data.xKey],
              y: row[data.yKey],
            })),
          },
        ],
        xLabel: "Time (min)",
        yLabel: "Residual Drawdown (ft)",
      });
      return;
    }
    const dataset = buildDrawdownDataset(role);
    if (dataset.rows.length === 0) {
      alert("Add drawdown data first.");
      return;
    }
    if (dataset.type === "step") {
      const grouped = {};
      dataset.rows.forEach((row) => {
        const key = row.rate_gpm ?? "Step";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ x: row.time_min, y: row.drawdown_ft });
      });
      const colorPalette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"];
      const datasets = Object.keys(grouped).map((key, idx) => ({
        label: `Step (${key} gpm)`,
        borderColor: colorPalette[idx % colorPalette.length],
        data: grouped[key],
      }));
      onPreview({
        title: role === "pump" ? "Pumping Step Test" : "Observation Step Test",
        datasets,
        xLabel: "Time (min)",
        yLabel: "Drawdown (ft)",
      });
    } else {
      const multiplier = dataset.xKey === "time_hr" ? 60 : 1;
      onPreview({
        title:
          role === "pump"
            ? "Pumping Constant-Rate Test"
            : "Observation Drawdown",
        datasets: [
          {
            label: "Drawdown",
            borderColor: "#c92a2a",
            data: dataset.rows.map((row) => ({
              x: row[dataset.xKey] * multiplier,
              y: row[dataset.yKey],
            })),
          },
        ],
        xLabel:
          dataset.xKey === "time_hr" ? "Time (minutes)" : "Time (minutes)",
        yLabel: "Drawdown (ft)",
      });
    }
  };

  const renderManualRows = (role, test) => {
    const columns = getCsvColumns(role, test.selectedType);
    if (test.manualRows.length === 0) {
      return (
        <div style={{ marginBottom: "0.4rem" }}>
          <em>No rows yet.</em>{" "}
          <button onClick={() => addManualRow(role)}>Add first row</button>
        </div>
      );
    }
    return (
      <>
        {test.manualRows.map((row, idx) => (
          <div
            key={`${role}-manual-${idx}`}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns.length}, 1fr) auto`,
              gap: "0.3rem",
              marginBottom: "0.3rem",
            }}
          >
            {columns.map((col) => (
              <input
                key={col}
                type="number"
                placeholder={col.replace("_", " ")}
                value={row[col] ?? ""}
                onChange={(e) => handleManualChange(role, idx, col, e.target.value)}
                style={{ padding: "0.3rem" }}
              />
            ))}
            <button
              onClick={() => removeManualRow(role, idx)}
              style={{ padding: "0.2rem 0.4rem" }}
            >
              ✕
            </button>
          </div>
        ))}
        <button onClick={() => addManualRow(role)}>+ Add Row</button>
      </>
    );
  };

  const renderStepManual = (role, test) => {
    const activeIndex = stepIndexForRole(role);
    const activeStep = test.manualSteps[activeIndex] || {
      rate_gpm: null,
      rows: [],
    };
    return (
      <div style={{ marginTop: "0.5rem" }}>
        <label style={{ fontSize: "0.85rem" }}>Number of Steps (max 5)</label>
        <select
          value={test.stepCount}
          onChange={(e) => handleStepCountChange(role, Number(e.target.value))}
          style={{ ...inputStyle, marginBottom: "0.4rem" }}
        >
          {[1, 2, 3, 4, 5].map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          {Array.from({ length: test.stepCount }, (_, idx) => (
            <button
              key={`step-${idx}`}
              onClick={() => setStepIndexForRole(role, idx)}
              style={{
                padding: "0.25rem 0.6rem",
                background: idx === activeIndex ? "#0b7285" : "#ddd",
                color: idx === activeIndex ? "white" : "black",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Step {idx + 1}
            </button>
          ))}
        </div>

        <div style={{ marginTop: "0.5rem" }}>
          <label style={{ fontSize: "0.85rem" }}>
            Step {activeIndex + 1} Rate (gpm)
          </label>
          <input
            type="number"
            value={activeStep.rate_gpm ?? ""}
            onChange={(e) =>
              handleStepRateChange(role, activeIndex, e.target.value)
            }
            style={inputStyle}
          />
          <p style={{ fontSize: "0.75rem", marginBottom: "0.3rem" }}>
            Enter at least {MIN_POINTS} measurement rows per step.
          </p>
          {activeStep.rows.length === 0 ? (
            <div style={{ marginBottom: "0.4rem" }}>
              <em>No rows yet.</em>{" "}
              <button onClick={() => addStepRow(role, activeIndex)}>
                Add first row
              </button>
            </div>
          ) : (
            activeStep.rows.map((row, idx) => (
              <div
                key={`step-${activeIndex}-row-${idx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr) auto",
                  gap: "0.3rem",
                  marginBottom: "0.3rem",
                }}
              >
                <input
                  type="number"
                  placeholder="Time (min)"
                  value={row.time_min ?? ""}
                  onChange={(e) =>
                    handleStepRowChange(
                      role,
                      activeIndex,
                      idx,
                      "time_min",
                      e.target.value
                    )
                  }
                  style={{ padding: "0.3rem" }}
                />
                <input
                  type="number"
                  placeholder="Drawdown (ft)"
                  value={row.drawdown_ft ?? ""}
                  onChange={(e) =>
                    handleStepRowChange(
                      role,
                      activeIndex,
                      idx,
                      "drawdown_ft",
                      e.target.value
                    )
                  }
                  style={{ padding: "0.3rem" }}
                />
                <button
                  onClick={() => removeStepRow(role, activeIndex, idx)}
                  style={{ padding: "0.2rem 0.4rem" }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
          <button onClick={() => addStepRow(role, activeIndex)}>
            + Add Row
          </button>
          <button
            style={{ marginLeft: "0.4rem" }}
            onClick={() => setSavedStepTag(`${role}-${activeIndex}`)}
          >
            Save Step
          </button>
          {savedStepTag === `${role}-${activeIndex}` && (
            <span style={{ marginLeft: "0.4rem", color: "green" }}>Saved ✓</span>
          )}
        </div>
      </div>
    );
  };

  const renderCsvPreview = (rows, columns) => {
    if (rows.length === 0) {
      return <em>No CSV uploaded yet.</em>;
    }
    const preview = rows.slice(0, 5);
    return (
      <div style={{ maxHeight: "150px", overflowY: "auto", marginTop: "0.4rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, idx) => (
              <tr key={`preview-${idx}`}>
                {columns.map((col) => (
                  <td key={col} style={{ padding: "0.2rem 0", fontSize: "0.85rem" }}>
                    {row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > preview.length && (
          <div style={{ fontSize: "0.75rem", marginTop: "0.2rem" }}>
            Showing first {preview.length} of {rows.length} rows.
          </div>
        )}
      </div>
    );
  };

  const renderTestSection = (role, title, description) => {
    const test = testForRole(role);
    const csvColumns = getCsvColumns(role, test.selectedType);
    const isStep = test.selectedType === "step";
    const dataset = buildDrawdownDataset(role);
    const hasMinRows = dataset.rows.length >= MIN_POINTS;

    return (
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "6px",
          padding: "0.6rem",
          marginTop: "0.8rem",
          background: "#fdfdfd",
        }}
      >
        <strong>{title}</strong>
        <p style={{ fontSize: "0.8rem", color: "#555" }}>{description}</p>

        <label style={{ fontSize: "0.85rem" }}>Test Type</label>
        <select
          value={test.selectedType}
          onChange={(e) => handleTypeChange(role, e.target.value)}
          style={inputStyle}
        >
          <option value="constant">Constant Rate</option>
          <option value="step">Step-Drawdown</option>
        </select>

        <div style={{ marginBottom: "0.4rem", fontSize: "0.85rem" }}>
          Input Method:
          <label style={{ marginLeft: "0.4rem" }}>
            <input
              type="radio"
              value="manual"
              checked={test.entryMode === "manual"}
              onChange={() => handleEntryModeChange(role, "manual")}
            />{" "}
            Manual
          </label>
          <label style={{ marginLeft: "0.4rem" }}>
            <input
              type="radio"
              value="csv"
              checked={test.entryMode === "csv"}
              onChange={() => handleEntryModeChange(role, "csv")}
            />{" "}
            CSV Upload
          </label>
        </div>

        {test.entryMode === "manual" ? (
          isStep ? (
            renderStepManual(role, test)
          ) : (
            <div>
              <p style={{ fontSize: "0.75rem", marginBottom: "0.3rem" }}>
                Required columns: {csvColumns.join(", ")} (minimum {MIN_POINTS} rows)
              </p>
              {renderManualRows(role, test)}
            </div>
          )
        ) : (
          <div>
            <p style={{ fontSize: "0.75rem", marginBottom: "0.3rem" }}>
              Upload CSV with columns: {csvColumns.join(", ")}
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleCsvUpload(role, e)}
            />
            {renderCsvPreview(test.csvRows, csvColumns)}
          </div>
        )}

        <div style={{ marginTop: "0.5rem" }}>
          <button
            onClick={() => previewDataset(role)}
            disabled={!hasMinRows}
            style={{
              opacity: hasMinRows ? 1 : 0.6,
              cursor: hasMinRows ? "pointer" : "not-allowed",
            }}
          >
            Preview Graph
          </button>
          {!hasMinRows && (
            <div style={{ fontSize: "0.75rem", color: "#c92a2a" }}>
              Enter at least {MIN_POINTS} data rows to preview.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRecoverySection = () => {
    const dataset = buildRecoveryDataset();
    const hasMin = dataset.rows.length >= MIN_POINTS;
    return (
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "6px",
          padding: "0.6rem",
          marginTop: "0.8rem",
          background: "#fdfdfd",
        }}
      >
        <strong>Observation Recovery Data</strong>
        <p style={{ fontSize: "0.8rem", color: "#555" }}>
          Provide recovery measurements (time vs residual drawdown).
        </p>

        <div style={{ marginBottom: "0.4rem", fontSize: "0.85rem" }}>
          Input Method:
          <label style={{ marginLeft: "0.4rem" }}>
            <input
              type="radio"
              value="manual"
              checked={recoveryData.entryMode === "manual"}
              onChange={() => saveRecovery({ entryMode: "manual" })}
            />{" "}
            Manual
          </label>
          <label style={{ marginLeft: "0.4rem" }}>
            <input
              type="radio"
              value="csv"
              checked={recoveryData.entryMode === "csv"}
              onChange={() => saveRecovery({ entryMode: "csv" })}
            />{" "}
            CSV Upload
          </label>
        </div>

        {recoveryData.entryMode === "manual" ? (
          <div>
            {recoveryData.manualRows.length === 0 ? (
              <div style={{ marginBottom: "0.4rem" }}>
                <em>No rows yet.</em>{" "}
                <button onClick={addRecoveryRow}>Add first row</button>
              </div>
            ) : (
              recoveryData.manualRows.map((row, idx) => (
                <div
                  key={`recovery-row-${idx}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr) auto",
                    gap: "0.3rem",
                    marginBottom: "0.3rem",
                  }}
                >
                  <input
                    type="number"
                    placeholder="Time (min)"
                    value={row.time_min ?? ""}
                    onChange={(e) =>
                      handleRecoveryManualChange(idx, "time_min", e.target.value)
                    }
                    style={{ padding: "0.3rem" }}
                  />
                  <input
                    type="number"
                    placeholder="Residual Drawdown (ft)"
                    value={row.residual_drawdown_ft ?? ""}
                    onChange={(e) =>
                      handleRecoveryManualChange(
                        idx,
                        "residual_drawdown_ft",
                        e.target.value
                      )
                    }
                    style={{ padding: "0.3rem" }}
                  />
                  <button
                    onClick={() => removeRecoveryRow(idx)}
                    style={{ padding: "0.2rem 0.4rem" }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
            <button onClick={addRecoveryRow}>+ Add Row</button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: "0.75rem", marginBottom: "0.3rem" }}>
              Upload CSV with columns: time_min, residual_drawdown_ft
            </p>
            <input type="file" accept=".csv" onChange={handleRecoveryCsv} />
            {renderCsvPreview(recoveryData.csvRows, [
              "time_min",
              "residual_drawdown_ft",
            ])}
          </div>
        )}

        <div style={{ marginTop: "0.5rem" }}>
          <button
            onClick={() => previewDataset("observation", "recovery")}
            disabled={!hasMin}
            style={{
              opacity: hasMin ? 1 : 0.6,
              cursor: hasMin ? "pointer" : "not-allowed",
            }}
          >
            Preview Recovery Graph
          </button>
          {!hasMin && (
            <div style={{ fontSize: "0.75rem", color: "#c92a2a" }}>
              Enter at least {MIN_POINTS} recovery rows to preview.
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleNumberChange = (field) => (e) => {
    const value = e.target.value;
    updateWell(well.id, {
      [field]: value === "" ? null : Number(value),
    });
  };

  const handleTextChange = (field) => (e) =>
    updateWell(well.id, { [field]: e.target.value });

  const handleTypeToggle = (e) => {
    const isPumping = e.target.value === "PW";
    updateWell(well.id, { isPumping });
  };

  const isPumpingWell = !!well.isPumping;

  return (
    <div>
      <div
        className="well-panel__header"
        onMouseDown={(e) => onStartDrag && onStartDrag(e)}
        role="presentation"
      >
        <strong>Edit Well</strong>
        <button
          onClick={onClose}
          className="well-panel__close"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: "0.8rem", marginBottom: "0.5rem" }}>
        Lat: {well.lat.toFixed(6)} <br />
        Lng: {well.lng.toFixed(6)}
      </div>

      <label style={{ fontSize: "0.85rem" }}>Name</label>
      <input
        type="text"
        value={well.name}
        onChange={handleTextChange("name")}
        style={inputStyle}
      />

      <label style={{ fontSize: "0.85rem" }}>Type</label>
      <select
        value={isPumpingWell ? "PW" : "OBS"}
        onChange={handleTypeToggle}
        style={inputStyle}
      >
        <option value="PW">Pumping Well</option>
        <option value="OBS">Observation Well</option>
      </select>

      <label style={{ fontSize: "0.85rem" }}>Depth (ft)</label>
      <input
        type="number"
        value={well.depth_ft ?? ""}
        onChange={handleNumberChange("depth_ft")}
        style={inputStyle}
      />

      <label style={{ fontSize: "0.85rem" }}>Screen Top (ft)</label>
      <input
        type="number"
        value={well.screen_top_ft ?? ""}
        onChange={handleNumberChange("screen_top_ft")}
        style={inputStyle}
      />

      <label style={{ fontSize: "0.85rem" }}>Screen Bottom (ft)</label>
      <input
        type="number"
        value={well.screen_bottom_ft ?? ""}
        onChange={handleNumberChange("screen_bottom_ft")}
        style={inputStyle}
      />

      <label style={{ fontSize: "0.85rem" }}>Casing Diameter (in)</label>
      <input
        type="number"
        value={well.casing_diameter_in ?? ""}
        onChange={handleNumberChange("casing_diameter_in")}
        style={inputStyle}
      />

      <label style={{ fontSize: "0.85rem" }}>Pump Depth (ft)</label>
      <input
        type="number"
        value={well.pump_depth_ft ?? ""}
        onChange={handleNumberChange("pump_depth_ft")}
        style={inputStyle}
      />

      <label style={{ fontSize: "0.85rem" }}>Static Water Level (ft)</label>
      <input
        type="number"
        value={well.static_water_level_ft ?? ""}
        onChange={handleNumberChange("static_water_level_ft")}
        style={inputStyle}
      />

      <label style={{ fontSize: "0.85rem" }}>Notes</label>
      <textarea
        value={well.pump_test_notes ?? ""}
        onChange={handleTextChange("pump_test_notes")}
        style={{ ...inputStyle, height: "60px", resize: "vertical" }}
      />

      {isPumpingWell
        ? renderTestSection(
            "pump",
            "Pumping Test Data",
            "Constant or step test data for this pumping well."
          )
        : (
          <>
            {renderTestSection(
              "observation",
              "Observation Drawdown Data",
              "Measurements collected at this observation well."
            )}
            {renderRecoverySection()}
          </>
        )}

      <button
        onClick={() => {
          deleteWell(well.id);
          onClose();
        }}
        style={{
          width: "100%",
          padding: "0.4rem",
          background: "darkred",
          color: "white",
          border: "none",
          borderRadius: "4px",
          marginTop: "0.8rem",
        }}
      >
        Delete Well
      </button>
    </div>
  );
}

const csvColumnMap = {
  pump: {
    constant: ["time_hr", "drawdown_ft"],
    step: ["time_min", "drawdown_ft", "rate_gpm"],
  },
  observation: {
    constant: ["time_hr", "drawdown_ft"],
    step: ["time_min", "drawdown_ft"],
  },
};

function getCsvColumns(role, type) {
  const roleKey = role === "pump" ? "pump" : "observation";
  return csvColumnMap[roleKey][type] || csvColumnMap[roleKey].constant;
}
