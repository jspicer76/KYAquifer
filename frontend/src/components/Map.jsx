import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  Polygon,
  Tooltip,
  useMapEvents
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAquiferStore } from "../store/aquiferStore";
import { feetToLat, feetToLng } from "../utils/ftToLatLng";
import { useEffect, useState } from "react";

// ------------------------------------------------------------
// FIX LEAFLET MARKER PATHS
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

// Boundary node icon
const boundaryNodeIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/32/32339.png",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function AquiferMap() {
  // Zustand state & actions
  const geometry = useAquiferStore((s) => s.geometry);
  const wells = geometry.wells;

  const addWell = useAquiferStore((s) => s.addWell);
  const updateWell = useAquiferStore((s) => s.updateWell);
  const addBoundaryPoint = useAquiferStore((s) => s.addBoundaryPoint);
  const setPlacementMode = useAquiferStore((s) => s.setPlacementMode);

  // Well placement mode ("pumping" | "observation" | null)
  const wellPlacementMode = geometry.wellPlacementMode;

  // Boundary mode ("constantHead" | "noFlow" | "infinite" | null)
  const boundaryMode = geometry.boundaryMode;

  // Temp boundary for preview (optional future use)
  const [tempBoundary, setTempBoundary] = useState([]);

  // ------------------------------------------------------------
  // ESC to exit placement mode
  // ------------------------------------------------------------
  useEffect(() => {
    function handleESC(e) {
      if (e.key === "Escape") {
        setPlacementMode(null);
        setTempBoundary([]);
      }
    }
    window.addEventListener("keydown", handleESC);
    return () => window.removeEventListener("keydown", handleESC);
  }, [setPlacementMode]);

  // ------------------------------------------------------------
  // SNAPPING ONTO EXISTING BOUNDARY NODES
  // ------------------------------------------------------------
  function snapToBoundary(latlng) {
    const allPoints = [
      ...geometry.boundaries.constantHead,
      ...geometry.boundaries.noFlow,
      ...geometry.boundaries.infinite,
    ];

    if (allPoints.length === 0) return latlng;

    let best = null;
    let bestDist = Infinity;

    allPoints.forEach((p) => {
      const d =
        Math.pow(p.lat - latlng.lat, 2) +
        Math.pow(p.lng - latlng.lng, 2);

      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    });

    // Snap if within ~15 ft (~0.00004 deg)
    return bestDist < 0.00004 ? best : latlng;
  }

  // ------------------------------------------------------------
  // MAP CLICK HANDLER
  // ------------------------------------------------------------
  function MapClickHandler() {
    useMapEvents({
      click(e) {
        const pt = e.latlng;

        // 1) WELL MODE
        if (wellPlacementMode === "pumping") {
          addWell({ lat: pt.lat, lng: pt.lng });
          return;
        }
        if (wellPlacementMode === "observation") {
          addWell({ lat: pt.lat, lng: pt.lng });
          return;
        }

        // 2) BOUNDARY MODE
        if (boundaryMode) {
          const snapped = snapToBoundary(pt);
          addBoundaryPoint(boundaryMode, snapped);
          setTempBoundary((prev) => [...prev, snapped]);
          return;
        }
      }
    });

    return null;
  }

  // ------------------------------------------------------------
  // WHP ZONE CONVERSION
  // ------------------------------------------------------------
  const whp = useAquiferStore((s) => s.whp);
  const showWHP = useAquiferStore((s) => s.showWHP);

  const wellLat = geometry.wellLat;
  const wellLng = geometry.wellLng;

  const zone2LatLng = whp.zone2.map(([xFt, yFt]) => [
    wellLat + feetToLat(yFt),
    wellLng + feetToLng(xFt, wellLat),
  ]);

  const zone3LatLng = whp.zone3.map(([xFt, yFt]) => [
    wellLat + feetToLat(yFt),
    wellLng + feetToLng(xFt, wellLat),
  ]);

  // ------------------------------------------------------------
  // RENDER MAP
  // ------------------------------------------------------------
  return (
    <div style={{ height: "80vh", width: "100%" }}>
      <MapContainer
        center={[geometry.wellLat, geometry.wellLng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />

        <MapClickHandler />

        {/* --------------------
            WELLS (DRAGGABLE)
        -------------------- */}
        {wells.map((w) => (
          <Marker
            key={w.id}
            position={[w.lat, w.lng]}
            draggable={true}
            icon={w.isPumping ? pumpingWellIcon : obsWellIcon}
            eventHandlers={{
              dragend: (e) => {
                updateWell(w.id, {
                  lat: e.target.getLatLng().lat,
                  lng: e.target.getLatLng().lng,
                });
              }
            }}
          >
            <Tooltip permanent direction="top">
              {w.name}
            </Tooltip>
          </Marker>
        ))}

        {/* --------------------
            BOUNDARIES + NODES
        -------------------- */}
        {Object.keys(geometry.boundaries).map((type) => {
          const pts = geometry.boundaries[type];
          if (pts.length < 2) return null;

          const color =
            type === "constantHead"
              ? "blue"
              : type === "noFlow"
              ? "red"
              : "green";

          const dash =
            type === "constantHead" ? "6" : type === "noFlow" ? null : "3";

          return (
            <>
              <Polyline
                key={`poly-${type}`}
                positions={pts}
                pathOptions={{ color, dashArray: dash, weight: 3 }}
              />

              {pts.map((p, i) => (
                <Marker
                  key={`node-${type}-${i}`}
                  position={[p.lat, p.lng]}
                  draggable={true}
                  icon={boundaryNodeIcon}
                  eventHandlers={{
                    dragend: (e) => {
                      const newLat = e.target.getLatLng().lat;
                      const newLng = e.target.getLatLng().lng;

                      const updated = { ...geometry.boundaries };
                      updated[type] = updated[type].map((n, idx) =>
                        idx === i ? { lat: newLat, lng: newLng } : n
                      );

                      useAquiferStore.setState({
                        geometry: { ...geometry, boundaries: updated },
                      });
                    }
                  }}
                />
              ))}
            </>
          );
        })}

        {/* --------------------
            WHP ZONES
        -------------------- */}
        {showWHP && (
          <>
            {whp.zone1 && (
              <Circle
                center={[wellLat, wellLng]}
                radius={whp.zone1 * 0.3048}
                pathOptions={{ color: "blue", dashArray: "4" }}
              />
            )}

            {zone2LatLng.length > 5 && (
              <Polygon
                positions={zone2LatLng}
                pathOptions={{ color: "green", dashArray: "6" }}
              />
            )}

            {zone3LatLng.length > 5 && (
              <Polygon
                positions={zone3LatLng}
                pathOptions={{ color: "red", dashArray: "6" }}
              />
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
}
