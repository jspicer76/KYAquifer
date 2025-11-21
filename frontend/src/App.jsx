import AquiferMap from "./components/Map";
import { useProjectStore } from "./store/useProjectStore";
import PumpTestUploader from "./components/PumpTestUploader";


export default function App() {
  const { setBoundaryMode, clearBoundaries } = useProjectStore();

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Aquifer Analysis Tool – Geometry Setup</h2>

      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setBoundaryMode("constantHead")}>
          Draw Constant Head Boundary (Blue Dashed)
        </button>
        <button onClick={() => setBoundaryMode("noFlow")}>
          Draw No-Flow Boundary (Solid Red)
        </button>
        <button onClick={() => setBoundaryMode("infinite")}>
          Draw Infinite Boundary (Green Dashed)
        </button>
        <button onClick={() => setBoundaryMode(null)}>
          Place Wells
        </button>

        <button onClick={() => clearBoundaries()} style={{ marginLeft: "1rem" }}>
          Clear Boundaries
        </button>
      </div>

      <AquiferMap />

      <PumpTestUploader />
    </div>
  );
}
