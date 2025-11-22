import { useState } from "react";

import AquiferMap from "./components/Map";
import PumpTestUploader from "./components/PumpTestUploader";
import AnalysisPanel from "./components/AnalysisPanel";
import WellEditorDrawer from "./components/WellEditorDrawer";
import WellCSVImporter from "./components/WellCSVImporter";
import TimeSeriesViewer from "./components/TimeSeriesViewer";
import CalibrationPanel from "./components/CalibrationPanel";
import CrossSection from "./components/CrossSection";

import { useAquiferStore } from "./store/aquiferStore";

export default function App() {
  const geometry = useAquiferStore((s) => s.geometry);
  const setGeometry = useAquiferStore((s) => s.setGeometry);

  const toggleWHP = useAquiferStore((s) => s.toggleWHP);
  const computeWHP = useAquiferStore((s) => s.computeWHP);
  const showWHP = useAquiferStore((s) => s.showWHP);

  const wells = geometry.wells;

  const setPumping = useAquiferStore((s) => s.updateWell);

  // NEW — unified well placement mode
  const setPlacementMode = useAquiferStore((s) => s.setPlacementMode);

  const [showXsec, setShowXsec] = useState(false);

  // Boundary mode
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
        <h2>Tools</h2>

        {/* WELL PLACEMENT */}
        <h3>Well Tools</h3>

        <button
          onClick={() => {
            setPlacementMode("pumping");
            setBoundaryMode(null);
          }}
          style={{ width: "100%" }}
        >
          ➕ Add Pumping Wells
        </button>

        <button
          onClick={() => {
            setPlacementMode("observation");
            setBoundaryMode(null);
          }}
          style={{ width: "100%", marginTop: "0.3rem" }}
        >
          ➕ Add Observation Wells
        </button>

        <div style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
          <em>Press ESC to finish placing wells.</em>
        </div>

        <hr />

        {/* BOUNDARY TOOLS */}
        <h3>Boundary Tools</h3>

        <button
          onClick={() => {
            setPlacementMode("none");
            setBoundaryMode("constantHead");
          }}
          style={{ width: "100%" }}
        >
          Draw Constant Head (Blue)
        </button>

        <button
          onClick={() => {
            setPlacementMode("none");
            setBoundaryMode("noFlow");
          }}
          style={{ width: "100%", marginTop: "0.3rem" }}
        >
          Draw No-Flow (Red)
        </button>

        <button
          onClick={() => {
            setPlacementMode("none");
            setBoundaryMode("infinite");
          }}
          style={{ width: "100%", marginTop: "0.3rem" }}
        >
          Draw Infinite (Green)
        </button>

        <div style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
          <em>Press ESC to finish drawing boundaries.</em>
        </div>

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

        <button
          onClick={computeWHP}
          style={{ width: "100%", marginTop: "0.5rem" }}
        >
          Compute WHP Zones
        </button>

        <hr />

        {/* WELL LIST */}
        <h3>Wells</h3>

        {wells.length === 0 ? (
          <p>No wells yet. Use tools above or import CSV.</p>
        ) : null}

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
            Lng: {w.lng.toFixed(6)}

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

        <WellCSVImporter />

        <hr />

        {/* WHP Toggle */}
        <button onClick={toggleWHP} style={{ width: "100%" }}>
          {showWHP ? "Hide WHP Zones" : "Show WHP Zones"}
        </button>

        <hr />

        {/* PUMP TEST DATA */}
        <h3>Pump Test Data</h3>
        <PumpTestUploader />

        <TimeSeriesViewer />

        <hr />
        <CalibrationPanel />

        <hr />
        <AnalysisPanel />

        <hr />

        <button
          onClick={() => setShowXsec(!showXsec)}
          style={{ width: "100%" }}
        >
          {showXsec ? "Hide Cross Section" : "Show Cross Section"}
        </button>

        {showXsec && (
          <div style={{ marginTop: "1rem" }}>
            <CrossSection />
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flexGrow: 1, position: "relative" }}>
        <AquiferMap />
        <WellEditorDrawer />
      </div>
    </div>
  );
}
