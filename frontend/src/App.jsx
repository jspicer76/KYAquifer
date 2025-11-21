import AquiferMap from "./components/Map";
import PumpTestUploader from "./components/PumpTestUploader";
import AnalysisPanel from "./components/AnalysisPanel";
import WellEditorDrawer from "./components/WellEditorDrawer";
import WellCSVImporter from "./components/WellCSVImporter";
import TimeSeriesViewer from "./components/TimeSeriesViewer";
import { useAquiferStore } from "./store/aquiferStore";
import CalibrationPanel from "./components/CalibrationPanel";


export default function App() {
  const geometry = useAquiferStore((s) => s.geometry);
  const setGeometry = useAquiferStore((s) => s.setGeometry);
  const toggleWHP = useAquiferStore((s) => s.toggleWHP);
  const showWHP = useAquiferStore((s) => s.showWHP);
  const wells = geometry.wells;
  const setPumping = useAquiferStore((s) => s.updateWell);

  const setBoundaryMode = (mode) =>
    setGeometry({ boundaryMode: mode });

  const clearBoundaries = () =>
    setGeometry({
      boundaries: {
        constantHead: [],
        noFlow: [],
        infinite: [],
      },
    });

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* LEFT PANEL */}
      <div
        style={{
          width: "330px",
          borderRight: "1px solid #ccc",
          padding: "1rem",
          overflowY: "auto",
          background: "#fafafa",
        }}
      >
        <h2>Aquifer Analysis Tool</h2>

        <h3>Boundary Tools</h3>
        <button onClick={() => setBoundaryMode("constantHead")} style={{ width: "100%" }}>
          Draw Constant Head Boundary (Blue Dashed)
        </button>
        <button onClick={() => setBoundaryMode("noFlow")} style={{ width: "100%", marginTop: "0.3rem" }}>
          Draw No-Flow Boundary (Red)
        </button>
        <button onClick={() => setBoundaryMode("infinite")} style={{ width: "100%", marginTop: "0.3rem" }}>
          Draw Infinite Boundary (Green)
        </button>
        <button onClick={() => setBoundaryMode(null)} style={{ width: "100%", marginTop: "0.3rem" }}>
          Place / Move Wells
        </button>
        <button onClick={computeWHPZones} style={{ width: "100%" }}>
          Compute WHP Zones
        </button>

        <button
          onClick={clearBoundaries}
          style={{
            width: "100%",
            marginTop: "0.6rem",
            background: "#ddd",
            padding: "0.4rem",
          }}
        >
          Clear Boundaries
        </button>

        <hr />

        <h3>Wells</h3>
        {wells.length === 0 ? <p>No wells yet. Click map or import CSV.</p> : null}

        {wells.map((w) => (
          <div
            key={w.id}
            style={{
              border: "1px solid #ddd",
              padding: "0.45rem",
              marginBottom: "0.5rem",
              background: "#fff",
            }}
          >
            <strong>{w.name}</strong>
            <br />
            Lat: {w.lat.toFixed(6)} <br />
            Lng: {w.lng.toFixed(6)} <br />
            <button
              onClick={() => setPumping(w.id, { isPumping: true })}
              style={{
                marginTop: "0.3rem",
                width: "100%",
                background: w.isPumping ? "green" : "#ddd",
                color: w.isPumping ? "white" : "black",
              }}
            >
              {w.isPumping ? "✓ Pumping Well" : "Set as Pumping Well"}
            </button>
          </div>
        ))}

        {/* CSV importer */}
        <WellCSVImporter />

        <hr />

        <button onClick={toggleWHP} style={{ width: "100%" }}>
          {showWHP ? "Hide WHP Zones" : "Show WHP Zones"}
        </button>

        <hr />

        <h3>Pump Test Data</h3>
        <PumpTestUploader />

        {/* NEW: Time-series viewer */}
        <TimeSeriesViewer />
        <hr />
       <CalibrationPanel />
        <hr />

        <AnalysisPanel />
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flexGrow: 1, position: "relative" }}>
        <AquiferMap />
        <WellEditorDrawer />
      </div>
    </div>
  );
}
