import { create } from "zustand";
import { api } from "../api/client";
import { v4 as uuidv4 } from "uuid";

export const useAquiferStore = create((set, get) => ({
  // ---------------------------
  // GEOMETRY & AQUIFER PARAMETERS
  // ---------------------------
  geometry: {
    wells: [],
    boundaries: {
      constantHead: [],
      noFlow: [],
      infinite: [],
    },
    boundaryMode: null,

    // Pumping well (reference for WHP)
    wellLat: 38.2,
    wellLng: -85.9,

    pumpingRate_gpm: 400,
    pumpingWellRadius_ft: 0.5,
    r_ft: 150,
    b_thick_ft: 50, // aquifer saturated thickness
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
  // WHP ZONES (NEW)
  // ---------------------------
  whp: {
    zone1: null, // ft
    zone2: [],   // [[x,y],...]
    zone3: [],   // [[x,y],...]
  },

  showWHP: false,

  toggleWHP: () =>
    set((state) => ({
      showWHP: !state.showWHP,
    })),

  // WHP computation via backend
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

    set({
      whp: {
        zone1: res.data.zone1_ft,
        zone2: res.data.zone2_polygon_ft,
        zone3: res.data.zone3_polygon_ft,
      },
      showWHP: true,
    });
  },

  // ---------------------------
  // ANALYSIS RESULTS
  // ---------------------------
  analysis: null,

  // ---------------------------
  // WELL EDITOR
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
  // CLICK-ADD WELL
  // ---------------------------
  addWell: ({ lat, lng }) => {
    const { geometry } = get();
    const wells = geometry.wells;

    let newName;
    let isPumping = false;

    if (wells.length === 0) {
      newName = "PW-1";
      isPumping = true;

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
  // CSV IMPORT WELLS
  // ---------------------------
  importWellsFromCSV: (rows) => {
    const { geometry } = get();
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
            row.screen_top_ft ??
              row.ScreenTop ??
              row.ScreenTop_ft
          ),
          screen_bottom_ft: toNum(
            row.screen_bottom_ft ??
              row.ScreenBottom ??
              row.ScreenBottom_ft
          ),
          casing_diameter_in: toNum(
            row.casing_diameter_in ??
              row.CasingDiameter ??
              row.CasingDiameter_in
          ),
          pump_depth_ft: toNum(
            row.pump_depth_ft ??
              row.PumpDepth ??
              row.PumpDepth_ft
          ),
          static_water_level_ft: toNum(
            row.static_water_level_ft ??
              row.StaticWaterLevel ??
              row.StaticWaterLevel_ft
          ),
          pump_test_notes:
            row.pump_test_notes ??
            row.Notes ??
            row.notes ??
            "",
        };
      })
      .filter(Boolean);

    let merged = existing.concat(imported);

    // Ensure single pumping well
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

  // ---------------------------
  // UPDATE WELL
  // ---------------------------
  updateWell: (id, updates) => {
    const { geometry } = get();
    let wells = geometry.wells.map((w) =>
      w.id === id ? { ...w, ...updates } : w
    );

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
  // BOUNDARIES
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
  // PUMP TEST DATA UPDATE
  // ---------------------------
  setPumpTestData: (type, data) =>
    set((state) => ({
      pumpTests: {
        ...state.pumpTests,
        [type]: data,
      },
    })),

  // ---------------------------
  // RUN AQUIFER ANALYSIS
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
  // PDF REPORT (legacy)
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
