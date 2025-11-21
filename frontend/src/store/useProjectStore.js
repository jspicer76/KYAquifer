import { create } from "zustand";

export const useProjectStore = create((set) => ({
  wells: [],
  boundaries: {
    constantHead: [],
    noFlow: [],
    infinite: [],
  },
  boundaryMode: null, // "constantHead" | "noFlow" | "infinite"

  addWell: (well) =>
    set((state) => ({
      wells: [...state.wells, well],
    })),

  setBoundaryMode: (mode) =>
    set(() => ({
      boundaryMode: mode,
    })),

  addBoundaryPoint: (type, latlng) =>
    set((state) => ({
      boundaries: {
        ...state.boundaries,
        [type]: [...state.boundaries[type], [latlng.lat, latlng.lng]],
      },
    })),

  clearBoundaries: () =>
    set(() => ({
      boundaries: {
        constantHead: [],
        noFlow: [],
        infinite: [],
      },
    })),
}));
