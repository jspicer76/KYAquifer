import { create } from "zustand";
import { api } from "../api/client";
import { v4 as uuidv4 } from "uuid";
import { ensureMinimumRows, flattenManualSteps } from "../utils/drawdown";

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const createDefaultTestData = () => ({
  selectedType: "constant",
  entryMode: "manual",
  manualRows: [],
  manualSteps: [],
  stepCount: 1,
  csvRows: [],
});

const createDefaultRecovery = () => ({
  entryMode: "manual",
  manualRows: [],
  csvRows: [],
});

export const useAquiferStore = create((set, get) => ({

  // ---------------------------------------------------
  // GLOBAL GEOMETRY / PARAMETERS
  // ---------------------------------------------------
  geometry: {
    wells: [],

    // UNIFIED POLYGON BOUNDARY SYSTEM
    boundaryPolygon: {
      vertices: [],        // {id, lat, lng}
      segments: [],        // {id, startId, endId, type}
      isClosed: false
    },
    boundaryMode: null,

    drawingBoundary: false,     // user is actively drawing polygon
    editingSegmentId: null,     // legacy (not used)
    wellPlacementMode: null,    // "pumping" | "observation" | null

    // Pumping reference well
    wellLat: 38.2,
    wellLng: -85.9,

    pumpingRate_gpm: 400,
    pumpingWellRadius_ft: 0.5,

    r_ft: 150,
    b_thick_ft: 50,

    T: 2000,
    S: 0.0003,
    Sy: 0.2,
    Ss: 1e-5,
    Kz_over_Kr: 0.1,
  },

  // ---------------------------------------------------
  // SEGMENT SELECTION (NEW)
  // ---------------------------------------------------
  selectedSegment: null,

  setSelectedSegment: (segmentObj) =>
    set({ selectedSegment: segmentObj }),

  clearSelectedSegment: () =>
    set({ selectedSegment: null }),

  history: [],
  lastHistoryTs: 0,
  isRestoring: false,

  pushHistory: () => {
    const { geometry, pumpTests, history, lastHistoryTs, isRestoring } = get();
    if (isRestoring) return;
    const now = Date.now();
    if (now - lastHistoryTs < 500) return;
    const snapshot = {
      geometry: deepClone(geometry),
      pumpTests: deepClone(pumpTests),
    };
    const trimmed = [...history, snapshot].slice(-25);
    set({ history: trimmed, lastHistoryTs: now });
  },

  undo: () => {
    const { history } = get();
    if (!history.length) return;
    const previous = history[history.length - 1];
    set({ isRestoring: true });
    set({
      geometry: previous.geometry,
      pumpTests: previous.pumpTests,
      history: history.slice(0, -1),
    });
    set({ isRestoring: false, lastHistoryTs: Date.now() });
  },

  //--------------------------------------------------------------------
  // WELL PLACEMENT MODES
  //--------------------------------------------------------------------
  setPlacementMode: (mode) =>
    set((state) => ({
      geometry: { ...state.geometry, wellPlacementMode: mode }
    })),

  clearPlacementMode: () =>
    set((state) => ({
      geometry: { ...state.geometry, wellPlacementMode: null }
    })),

  //--------------------------------------------------------------------
  // CSV IMPORT (unchanged)
  //--------------------------------------------------------------------
  importWellsFromCSV: (rows) => {
    const { geometry, pushHistory } = get();
    pushHistory();
    let existing = [...geometry.wells];

    const toNum = (v) =>
      v === undefined || v === null || v === "" ? null : Number(v);

    let obsCounter = existing.filter((w) => !w.isPumping).length;

    const imported = rows
      .map((row) => {
        const lat =
          toNum(row.lat) ??
          toNum(row.Lat) ??
          toNum(row.latitude) ??
          toNum(row.Latitude);

        const lng =
          toNum(row.lng) ??
          toNum(row.Lng) ??
          toNum(row.longitude) ??
          toNum(row.Longitude);

        if (lat === null || lng === null) return null;

        let name =
          row.name ||
          row.Name ||
          row.WellName ||
          row.well_name ||
          null;

        const typeRaw = (row.type || row.Type || "").toString().toLowerCase();
        const isPumping =
          typeRaw === "pw" ||
          typeRaw === "p" ||
          typeRaw === "pumping";

        if (!name) {
          if (isPumping && !existing.some((w) => w.isPumping)) {
            name = "PW-1";
          } else {
            obsCounter++;
            name = `OBS-${obsCounter}`;
          }
        }

        return {
          id: uuidv4(),
          lat,
          lng,
          name,
          isPumping,
          depth_ft: toNum(row.depth_ft ?? row.Depth ?? row.Depth_ft),
          screen_top_ft: toNum(
            row.screen_top_ft ?? row.ScreenTop ?? row.ScreenTop_ft
          ),
          screen_bottom_ft: toNum(
            row.screen_bottom_ft ?? row.ScreenBottom ?? row.ScreenBottom_ft
          ),
          casing_diameter_in: toNum(
            row.casing_diameter_in ?? row.CasingDiameter ?? row.CasingDiameter_in
          ),
          pump_depth_ft: toNum(
            row.pump_depth_ft ?? row.PumpDepth ?? row.PumpDepth_ft
          ),
          static_water_level_ft: toNum(
            row.static_water_level_ft ??
              row.StaticWaterLevel ??
              row.StaticWaterLevel_ft
          ),
          pump_test_notes: row.pump_test_notes ?? row.Notes ?? row.notes ?? "",
          pump_test: createDefaultTestData(),
          observation_test: createDefaultTestData(),
        };
      })
      .filter(Boolean);

    let merged = existing.concat(imported);

    // enforce single pumping well
    const pumpingList = merged.filter((w) => w.isPumping);
    if (pumpingList.length > 1) {
      pumpingList.slice(1).forEach((w) => (w.isPumping = false));
    }

    let pumping = merged.find((w) => w.isPumping);
    if (!pumping && merged.length > 0) {
      merged[0].isPumping = true;
      pumping = merged[0];
    }

    set({
      geometry: {
        ...geometry,
        wells: merged,
        wellLat: pumping.lat,
        wellLng: pumping.lng,
      },
    });
  },

  //--------------------------------------------------------------------
  // ADD WELL
  //--------------------------------------------------------------------
  addWell: ({ lat, lng }) => {
    const { geometry, pushHistory } = get();
    const mode = geometry.wellPlacementMode;

    if (!mode) return;
    pushHistory();

    const wells = geometry.wells;

    let name;
    let isPumping = false;

    if (mode === "pumping") {
      const count = wells.filter((w) => w.isPumping).length + 1;
      name = `PW-${count}`;
      isPumping = true;

      set({
        geometry: {
          ...geometry,
          wellLat: lat,
          wellLng: lng
        }
      });
    }

    if (mode === "observation") {
      const count = wells.filter((w) => !w.isPumping).length + 1;
      name = `OBS-${count}`;
      isPumping = false;
    }

    const newWell = {
      id: uuidv4(),
      lat, lng,
      name,
      isPumping,
      depth_ft: null,
      screen_top_ft: null,
      screen_bottom_ft: null,
      casing_diameter_in: null,
      pump_depth_ft: null,
      static_water_level_ft: null,
      pump_test_notes: "",
      pump_test: createDefaultTestData(),
      observation_test: createDefaultTestData(),
    };

    set({
      geometry: {
        ...geometry,
        wells: [...wells, newWell]
      }
    });
  },

  //--------------------------------------------------------------------
  // UPDATE WELL
  //--------------------------------------------------------------------
  updateWell: (id, updates) => {
    const { geometry, pushHistory } = get();
    pushHistory();
    let wells = geometry.wells.map((w) =>
      w.id === id ? { ...w, ...updates } : w
    );

    if (updates.isPumping) {
      wells = wells.map((w) =>
        w.id === id ? { ...w, isPumping: true } : { ...w, isPumping: false }
      );

      const pump = wells.find((w) => w.isPumping);
      set({
        geometry: {
          ...geometry,
          wells,
          wellLat: pump.lat,
          wellLng: pump.lng,
        }
      });
      return;
    }

    set({ geometry: { ...geometry, wells } });
  },

  //--------------------------------------------------------------------
  // DELETE WELL
  //--------------------------------------------------------------------
  deleteWell: (id) => {
    const { geometry, pushHistory } = get();
    pushHistory();
    let wells = geometry.wells.filter((w) => w.id !== id);

    if (!wells.some((w) => w.isPumping) && wells.length > 0) {
      wells[0].isPumping = true;

      set({
        geometry: {
          ...geometry,
          wells,
          wellLat: wells[0].lat,
          wellLng: wells[0].lng,
        }
      });
      return;
    }

    set({ geometry: { ...geometry, wells } });
  },

  // -------------------------------------------------------------------
  // UNIFIED BOUNDARY POLYGON CONTROLS
  // -------------------------------------------------------------------
  setBoundaryMode: (mode) =>
    set((state) => ({
      geometry: {
        ...state.geometry,
        boundaryMode: mode,
      },
    })),

  startBoundaryPolygon: () => {
    const { pushHistory } = get();
    pushHistory();
    set((state) => ({
      geometry: {
        ...state.geometry,
        drawingBoundary: true,
        boundaryPolygon: {
          vertices: [],
          segments: [],
          isClosed: false,
        }
      }
    }));
  },

  addPolygonVertex: (latlng) => {
    const { pushHistory } = get();
    pushHistory();
    set((state) => {
      const geom = state.geometry;
      const poly = geom.boundaryPolygon;

      if (poly.isClosed) return state;

      const id = uuidv4();
      const newVert = { id, lat: latlng.lat, lng: latlng.lng };

      const newVertices = [...poly.vertices, newVert];

      let newSegments = [...poly.segments];

      if (newVertices.length > 1) {
        const prev = newVertices[newVertices.length - 2];
        newSegments.push({
          id: uuidv4(),
          startId: prev.id,
          endId: newVert.id,
          type: "infinite",
        });
      }

      return {
        geometry: {
          ...geom,
          boundaryPolygon: {
            ...poly,
            vertices: newVertices,
            segments: newSegments,
          },
        },
      };
    });
  },

  closePolygon: () => {
    const { pushHistory } = get();
    pushHistory();
    set((state) => {
      const geom = state.geometry;
      const poly = geom.boundaryPolygon;

      if (poly.vertices.length < 3) return state;

      const v0 = poly.vertices[0];
      const vN = poly.vertices[poly.vertices.length - 1];

      const closingSeg = {
        id: uuidv4(),
        startId: vN.id,
        endId: v0.id,
        type: "infinite",
      };

      return {
        geometry: {
          ...geom,
          drawingBoundary: false,
          boundaryPolygon: {
            ...poly,
            segments: [...poly.segments, closingSeg],
            isClosed: true,
          },
        },
      };
    });
  },

  setSegmentType: (segmentId, type) => {
    const { pushHistory } = get();
    pushHistory();
    set((state) => {
      const geom = state.geometry;
      const poly = geom.boundaryPolygon;

      return {
        geometry: {
          ...geom,
          boundaryPolygon: {
            ...poly,
            segments: poly.segments.map((s) =>
              s.id === segmentId ? { ...s, type } : s
            ),
          },
        },
        selectedSegment: null,
      };
    });
  },

  insertVertexOnSegment: (segmentId, newLatLng) => {
    const { pushHistory } = get();
    pushHistory();
    set((state) => {
      const geom = state.geometry;
      const poly = geom.boundaryPolygon;

      const seg = poly.segments.find((s) => s.id === segmentId);
      if (!seg) return state;

      const newId = uuidv4();
      const newVert = { id: newId, lat: newLatLng.lat, lng: newLatLng.lng };

      const vStart = seg.startId;
      const vEnd = seg.endId;

      let newSegments = poly.segments.filter((s) => s.id !== segmentId);

      newSegments.push({
        id: uuidv4(),
        startId: vStart,
        endId: newId,
        type: seg.type,
      });

      newSegments.push({
        id: uuidv4(),
        startId: newId,
        endId: vEnd,
        type: seg.type,
      });

      return {
        geometry: {
          ...geom,
          boundaryPolygon: {
            ...poly,
            vertices: [...poly.vertices, newVert],
            segments: newSegments,
          },
        },
      };
    });
  },

  clearBoundaryPolygon: () => {
    const { pushHistory } = get();
    pushHistory();
    set((state) => ({
      geometry: {
        ...state.geometry,
        drawingBoundary: false,
        boundaryPolygon: {
          vertices: [],
          segments: [],
          isClosed: false,
        },
      },
    }));
  },

  clearBoundaries: () => {
    const { pushHistory } = get();
    pushHistory();
    set((state) => ({
      geometry: {
        ...state.geometry,
        boundaryPolygon: {
          vertices: [],
          segments: [],
          isClosed: false,
        },
        boundaryMode: null,
        drawingBoundary: false,
      },
      selectedSegment: null,
    }));
  },

  //--------------------------------------------------------------------
  // PUMP TEST DATA
  //--------------------------------------------------------------------
  pumpTests: {
    step: [],
    constant: [],
    recovery: [],
  },

  setPumpTestData: (type, data) => {
    const { pushHistory } = get();
    pushHistory();
    set((state) => ({
      pumpTests: { ...state.pumpTests, [type]: data },
    }));
  },

  //--------------------------------------------------------------------
  // WHP ZONES
  //--------------------------------------------------------------------
  whp: {
    zone1: null,
    zone2: [],
    zone3: [],
  },

  showWHP: false,

  toggleWHP: () =>
    set((state) => ({ showWHP: !state.showWHP })),

  computeWHP: async () => {
    const g = get().geometry;

    const payload = {
      Q_gpm: g.pumpingRate_gpm,
      T: g.T,
      Sy: g.Sy,
      b_ft: g.b_thick_ft,
      well_lat: g.wellLat,
      well_lng: g.wellLng,
      pumping_radius_ft: g.pumpingWellRadius_ft,
    };

    const res = await api.post("/whp/compute", payload);
    const data = res.data;

    set({
      whp: {
        zone1: data.zone1_ft,
        zone2: data.zone2_polygon_ft,
        zone3: data.zone3_polygon_ft,
      },
      showWHP: true,
    });
  },

  //--------------------------------------------------------------------
  // ANALYSIS
  //--------------------------------------------------------------------
  analysis: null,

  runAnalysis: async () => {
    const { geometry, pumpTests } = get();

    const pumpingWell = geometry.wells.find((w) => w.isPumping);
    const observationWells = geometry.wells.filter((w) => !w.isPumping);

    const pumpPayload = {};
    if (pumpingWell?.pump_test) {
      const test = pumpingWell.pump_test;
      if (test.selectedType === "step") {
        const rows =
          test.entryMode === "csv"
            ? test.csvRows || []
            : flattenManualSteps(test.manualSteps || []);
        const sanitized = ensureMinimumRows(rows, "time_min", "drawdown_ft");
        if (sanitized.length) {
          pumpPayload.step = sanitized;
        }
      } else {
        const source =
          test.entryMode === "csv" ? test.csvRows : test.manualRows;
        const sanitized = ensureMinimumRows(source || [], "time_hr", "drawdown_ft");
        if (sanitized.length) {
          pumpPayload.constant = sanitized;
        }
      }
    }

    ["step", "constant", "recovery"].forEach((key) => {
      if (
        !pumpPayload[key] &&
        Array.isArray(pumpTests[key]) &&
        pumpTests[key].length
      ) {
        pumpPayload[key] = pumpTests[key];
      }
    });

    const observationPayload = observationWells
      .map((well) => {
        const draw = well.observation_test;
        const recovery = well.observation_recovery;
        let drawdownRows = [];
        let testType = draw?.selectedType || "constant";

        if (draw) {
          if (draw.selectedType === "step") {
            const rows =
              draw.entryMode === "csv"
                ? draw.csvRows || []
                : flattenManualSteps(draw.manualSteps || []);
            drawdownRows = ensureMinimumRows(rows, "time_min", "drawdown_ft");
          } else {
            const source =
              draw.entryMode === "csv" ? draw.csvRows : draw.manualRows;
            drawdownRows = ensureMinimumRows(source || [], "time_hr", "drawdown_ft");
          }
        }

        let recoveryRows = [];
        if (recovery) {
          const source =
            recovery.entryMode === "csv"
              ? recovery.csvRows
              : recovery.manualRows;
          recoveryRows = ensureMinimumRows(
            source || [],
            "time_min",
            "residual_drawdown_ft"
          );
        }

        if (!drawdownRows.length && !recoveryRows.length) return null;

        return {
          id: well.id,
          name: well.name,
          lat: well.lat,
          lng: well.lng,
          test_type: testType,
          drawdown_rows: drawdownRows,
          recovery_rows: recoveryRows,
        };
      })
      .filter(Boolean);

    const payload = {
      model: geometry.model || "theis",
      Q_gpm: geometry.pumpingRate_gpm,
      r_ft: geometry.r_ft,
      T: geometry.T,
      S: geometry.S,
      Sy: geometry.Sy,
      Ss: geometry.Ss,
      b_thick_ft: geometry.b_thick_ft,
      Kz_over_Kr: geometry.Kz_over_Kr,
      pump_test: pumpPayload,
      observation_wells: observationPayload,
      time_series_min: [1, 2, 5, 10, 30, 60, 120, 300, 1000],
      safe_yield_request: {
        rw_ft: geometry.pumpingWellRadius_ft,
        unconfined: true,
        interference_drawdown_ft: 0.0,
        time_horizon_days: 365 * 20,
      },
      boundary_polygon: geometry.boundaryPolygon,
    };

    const res = await api.post("/analysis/run", payload);
    const data = res.data;

    if (data.whp) set({ whp: data.whp });

    set({
      analysis: data,
      showWHP: true,
    });

    return data;
  },

  //--------------------------------------------------------------------
  // PDF EXPORT
  //--------------------------------------------------------------------
  downloadReport: async (projectId = 1) => {
  try {
    const response = await api.get(`/report/kdow/${projectId}`, {
      responseType: "blob",
    });

    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `KDOW_Report_Project_${projectId}.pdf`;
    a.click();
  } catch (err) {
    console.error("PDF download failed:", err);
  }
},


}));
