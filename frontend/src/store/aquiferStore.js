import { create } from "zustand";
import { api } from "../api/client";
import { v4 as uuidv4 } from "uuid";

export const useAquiferStore = create((set, get) => ({
  // ---------------------------
  // GEOMETRY & AQUIFER PARAMETERS
  // ---------------------------
  geometry: {
    wells: [],                // full metadata now
    boundaries: {
      constantHead: [],
      noFlow: [],
      infinite: [],
    },
    boundaryMode: null,

    // Pumping well (center for WHP)
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

  // ---------------------------
  // PUMP TEST DATA
  // ---------------------------
  pumpTests: {
    step: [],
    constant: [],
    recovery: [],
  },

  // ---------------------------
  // WHP ZONES
  // ---------------------------
  whp: {
    zone1: null,
    zone2: [],
    zone3: [],
  },
  showWHP: true,

  // ---------------------------
  // ANALYSIS RESULTS
  // ---------------------------
  analysis: null,

  // ---------------------------
  // WELL EDITOR DRAWER UI STATE
  // ---------------------------
  isWellEditorOpen: false,
  editWellId: null,

  openWellEditor: (id) =>
    set({
      isWellEditorOpen: true,
      editWellId: id,
    }),

  closeWellEditor: () =>
    set({
      isWellEditorOpen: false,
      editWellId: null,
    }),

  // ---------------------------
  // ADD SINGLE WELL (click on map)
  // ---------------------------
  addWell: ({ lat, lng }) => {
    const { geometry } = get();
    const wells = geometry.wells;

    let newName;
    let isPumping = false;

    if (wells.length === 0) {
      newName = "PW-1";
      isPumping = true;

      // Set pumping well coordinates
      set({
        geometry: {
          ...geometry,
          wellLat: lat,
          wellLng: lng,
        },
      });
    } else {
      const obsCount = wells.filter((w) => !w.isPumping).length + 1;
      newName = `OBS-${obsCount}`;
    }

    const newWell = {
      id: uuidv4(),
      lat,
      lng,
      name: newName,
      isPumping,
      depth_ft: null,
      screen_top_ft: null,
      screen_bottom_ft: null,
      casing_diameter_in: null,
      pump_depth_ft: null,
      static_water_level_ft: null,
      pump_test_notes: "",
    };

    set({
      geometry: {
        ...geometry,
        wells: [...geometry.wells, newWell],
      },
    });
  },

  // ---------------------------
  // BULK IMPORT WELLS FROM CSV
  // ---------------------------
  importWellsFromCSV: (rows) => {
    const { geometry } = get();
    let existingWells = [...geometry.wells];

    // Helper to parse numeric safely
    const toNum = (v) =>
      v === undefined || v === null || v === "" ? null : Number(v);

    // Compute existing OBS count for naming when name is missing
    let obsCountExisting = existingWells.filter((w) => !w.isPumping).length;

    // Collect imported wells
    const imported = rows.map((row) => {
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

      if (lat === null || lng === null) {
        return null; // skip invalid
      }

      // Name (use provided or auto)
      let name =
        row.name ||
        row.Name ||
        row.WellName ||
        row.well_name ||
        null;

      // Type / Pumping flag
      const typeRaw = (row.type || row.Type || "").toString().toLowerCase();
      const isPumpingFromCSV =
        typeRaw === "pw" ||
        typeRaw === "p" ||
        typeRaw === "pumping" ||
        typeRaw === "pump";

      // If no name given, auto-assign
      if (!name) {
        if (isPumpingFromCSV && !existingWells.some((w) => w.isPumping)) {
          name = "PW-1";
        } else {
          obsCountExisting += 1;
          name = `OBS-${obsCountExisting}`;
        }
      }

      return {
        id: uuidv4(),
        lat,
        lng,
        name,
        isPumping: isPumpingFromCSV,
        depth_ft: toNum(row.depth_ft ?? row.Depth_ft ?? row.Depth),
        screen_top_ft: toNum(
          row.screen_top_ft ?? row.ScreenTop_ft ?? row.ScreenTop
        ),
        screen_bottom_ft: toNum(
          row.screen_bottom_ft ?? row.ScreenBottom_ft ?? row.ScreenBottom
        ),
        casing_diameter_in: toNum(
          row.casing_diameter_in ??
            row.CasingDiameter_in ??
            row.CasingDiameter
        ),
        pump_depth_ft: toNum(
          row.pump_depth_ft ?? row.PumpDepth_ft ?? row.PumpDepth
        ),
        static_water_level_ft: toNum(
          row.static_water_level_ft ??
            row.StaticWaterLevel_ft ??
            row.StaticWaterLevel
        ),
        pump_test_notes:
          row.pump_test_notes ??
          row.Notes ??
          row.notes ??
          "",
      };
    }).filter((w) => w !== null);

    // Merge existing + imported
    let merged = existingWells.concat(imported);

    // Ensure only one pumping well
    const pumpingWells = merged.filter((w) => w.isPumping);
    if (pumpingWells.length > 1) {
      // If multiple flagged as pumping, keep the first, demote others
      pumpingWells.slice(1).forEach((w) => {
        w.isPumping = false;
      });
    }

    let pumping = merged.find((w) => w.isPumping);

    // If still none pumping: keep old pumping if any
    if (!pumping) {
      pumping = existingWells.find((w) => w.isPumping) || null;
    }

    // If still none and we have wells, make the first pumping
    if (!pumping && merged.length > 0) {
      merged[0].isPumping = true;
      pumping = merged[0];
    }

    set({
      geometry: {
        ...geometry,
        wells: merged,
        wellLat: pumping ? pumping.lat : geometry.wellLat,
        wellLng: pumping ? pumping.lng : geometry.wellLng,
      },
    });
  },

  // ---------------------------
  // UPDATE WELL METADATA
  // ---------------------------
  updateWell: (id, updates) => {
    const { geometry } = get();
    let wells = geometry.wells.map((w) =>
      w.id === id ? { ...w, ...updates } : w
    );

    // If changing pumping well
    if (updates.isPumping) {
      wells = wells.map((w) =>
        w.id === id ? { ...w, isPumping: true } : { ...w, isPumping: false }
      );

      const pump = wells.find((w) => w.id === id);

      set({
        geometry: {
          ...geometry,
          wells,
          wellLat: pump.lat,
          wellLng: pump.lng,
        },
      });
    } else {
      set({
        geometry: {
          ...geometry,
          wells,
        },
      });
    }
  },

  // ---------------------------
  // DELETE WELL
  // ---------------------------
  deleteWell: (id) => {
    const { geometry } = get();
    let wells = geometry.wells.filter((w) => w.id !== id);

    // If pumping well deleted → choose first remaining as pumping
    if (!wells.some((w) => w.isPumping) && wells.length > 0) {
      wells[0].isPumping = true;
      set({
        geometry: {
          ...geometry,
          wells,
          wellLat: wells[0].lat,
          wellLng: wells[0].lng,
        },
      });
    } else {
      set({
        geometry: {
          ...geometry,
          wells,
        },
      });
    }
  },

  // ---------------------------
  // BOUNDARY SYSTEM
  // ---------------------------
  setGeometry: (updates) =>
    set((state) => ({
      geometry: { ...state.geometry, ...updates },
    })),

  addBoundaryPoint: (type, point) =>
    set((state) => ({
      geometry: {
        ...state.geometry,
        boundaries: {
          ...state.geometry.boundaries,
          [type]: [...state.geometry.boundaries[type], point],
        },
      },
    })),

  // ---------------------------
  // PUMP TEST SETTER
  // ---------------------------
  setPumpTestData: (type, data) =>
    set((state) => ({
      pumpTests: {
        ...state.pumpTests,
        [type]: data,
      },
    })),

  // ---------------------------
  // RUN ANALYSIS (FastAPI)
  // ---------------------------
  runAnalysis: async () => {
    const { geometry, pumpTests } = get();

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
      pump_test: pumpTests,

      time_series_min: [1, 2, 5, 10, 30, 60, 120, 300, 1000],

      safe_yield_request: {
        rw_ft: geometry.pumpingWellRadius_ft,
        unconfined: true,
        interference_drawdown_ft: 0.0,
        time_horizon_days: 365 * 20,
      },
    };

    const res = await api.post("/analysis/run", payload);
    const data = res.data;

    if (data.whp) set({ whp: data.whp });
    set({ showWHP: true });
    set({ analysis: data });

    return data;
  },

  // ---------------------------
  // PDF REPORT (legacy endpoint)
  // ---------------------------
  downloadReport: async (projectId = 1) => {
    const response = await api.get(`/report/kdow/${projectId}`, {
      responseType: "blob",
    });

    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `KDOW_Report_Project_${projectId}.pdf`;
    a.click();
  },
}));
