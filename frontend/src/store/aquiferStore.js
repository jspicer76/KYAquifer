import { create } from "zustand";
import { api } from "../api/client";
import { v4 as uuidv4 } from "uuid";

export const useAquiferStore = create((set, get) => ({

  // ---------------------------------------------------
  // GEOMETRY & PARAMETERS
  // ---------------------------------------------------
  geometry: {
    wells: [],

    boundaries: {
      constantHead: [],
      noFlow: [],
      infinite: [],
    },

    boundaryMode: null,         // "constantHead" | "noFlow" | "infinite" | null
    wellPlacementMode: null,    // "pumping" | "observation" | null

    // Pumping well reference point
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
  // WELL PLACEMENT MODE CONTROL (Unified)
  // ---------------------------------------------------
  setPlacementMode: (mode) =>
    set((state) => ({
      geometry: { ...state.geometry, wellPlacementMode: mode },
    })),

  clearPlacementMode: () =>
    set((state) => ({
      geometry: { ...state.geometry, wellPlacementMode: null },
    })),

  // ---------------------------------------------------
  // PUMP TEST DATA
  // ---------------------------------------------------
  pumpTests: {
    step: [],
    constant: [],
    recovery: [],
  },

  setPumpTestData: (type, data) =>
    set((state) => ({
      pumpTests: { ...state.pumpTests, [type]: data },
    })),

  // ---------------------------------------------------
  // WHP ZONES
  // ---------------------------------------------------
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

    set({
      whp: {
        zone1: res.data.zone1_ft,
        zone2: res.data.zone2_polygon_ft,
        zone3: res.data.zone3_polygon_ft,
      },
      showWHP: true,
    });
  },

  // ---------------------------------------------------
  // WELL EDITOR
  // ---------------------------------------------------
  isWellEditorOpen: false,
  editWellId: null,

  openWellEditor: (id) =>
    set({ isWellEditorOpen: true, editWellId: id }),

  closeWellEditor: () =>
    set({ isWellEditorOpen: false, editWellId: null }),

  // ---------------------------------------------------
  // ADD WELL (Using placement modes)
  // ---------------------------------------------------
  addWell: ({ lat, lng }) => {
    const { geometry } = get();

    // Prevent accidental placement
    if (!geometry.wellPlacementMode) return;

    const wells = geometry.wells;
    let name;
    let isPumping = false;

    if (geometry.wellPlacementMode === "pumping") {
      const pwCount = wells.filter((w) => w.isPumping).length + 1;
      name = `PW-${pwCount}`;
      isPumping = true;

      // Update reference point
      set({
        geometry: { ...geometry, wellLat: lat, wellLng: lng },
      });
    }

    if (geometry.wellPlacementMode === "observation") {
      const obsCount = wells.filter((w) => !w.isPumping).length + 1;
      name = `OBS-${obsCount}`;
      isPumping = false;
    }

    const newWell = {
      id: uuidv4(),
      lat,
      lng,
      name,
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
      geometry: { ...geometry, wells: [...wells, newWell] },
    });
  },

  // ---------------------------------------------------
  // UPDATE WELL
  // ---------------------------------------------------
  updateWell: (id, updates) => {
    const { geometry } = get();

    let wells = geometry.wells.map((w) =>
      w.id === id ? { ...w, ...updates } : w
    );

    // If making a pumping well, all others demote
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
      return;
    }

    set({ geometry: { ...geometry, wells } });
  },

  // ---------------------------------------------------
  // DELETE WELL
  // ---------------------------------------------------
  deleteWell: (id) => {
    const { geometry } = get();

    let wells = geometry.wells.filter((w) => w.id !== id);

    // If pumping well removed → promote first
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
      return;
    }

    set({ geometry: { ...geometry, wells } });
  },

  // ---------------------------------------------------
  // BOUNDARIES
  // ---------------------------------------------------
  setGeometry: (updates) =>
    set((state) => ({
      geometry: { ...state.geometry, ...updates },
    })),

  addBoundaryPoint: (type, point) =>
    set((state) => {
      const geom = state.geometry;
      return {
        geometry: {
          ...geom,
          boundaries: {
            ...geom.boundaries,
            [type]: [...geom.boundaries[type], point],
          },
        },
      };
    }),

  clearBoundaries: () =>
    set((state) => ({
      geometry: {
        ...state.geometry,
        boundaries: {
          constantHead: [],
          noFlow: [],
          infinite: [],
        },
      },
    })),

  // ---------------------------------------------------
  // ANALYSIS
  // ---------------------------------------------------
  analysis: null,

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

  // ---------------------------------------------------
  // PDF EXPORT
  // ---------------------------------------------------
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
