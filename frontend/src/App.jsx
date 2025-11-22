import { useState, useEffect } from "react";

import AquiferMap from "./components/Map";
import PumpTestUploader from "./components/PumpTestUploader";
import AnalysisPanel from "./components/AnalysisPanel";
import TimeSeriesViewer from "./components/TimeSeriesViewer";
import CalibrationPanel from "./components/CalibrationPanel";
import CrossSection from "./components/CrossSection";

import { useAquiferStore } from "./store/aquiferStore";

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
  const setBoundaryMode = useAquiferStore((s) => s.setBoundaryMode);

  const [showXsec, setShowXsec] = useState(false);
  const [mapStyle, setMapStyle] = useState("street");

  // Boundary mode
  const startBoundaryPolygon = useAquiferStore((s) => s.startBoundaryPolygon);
  const closePolygon = useAquiferStore((s) => s.closePolygon);
  const clearBoundaryPolygon = useAquiferStore((s) => s.clearBoundaryPolygon);
  const clearBoundaries = useAquiferStore((s) => s.clearBoundaries);
  const undo = useAquiferStore((s) => s.undo);

  useEffect(() => {
    function handleUndo(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", handleUndo);
    return () => window.removeEventListener("keydown", handleUndo);
  }, [undo]);

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
            setPlacementMode(null);
            startBoundaryPolygon();
          }}
          style={{ width: "100%" }}
        >
          ➕ Begin Drawing Boundary Polygon
        </button>

        <button
          onClick={closePolygon}
          style={{ width: "100%", marginTop: "0.3rem" }}
        >
          ✔️ Close Polygon
        </button>

        <button
          onClick={clearBoundaryPolygon}
          style={{
            width: "100%",
            marginTop: "0.6rem",
            background: "#ddd",
            padding: "0.4rem"
          }}
        >
          Clear Boundary Polygon
        </button>

        <div style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
          <em>Click on map to add vertices.  
          Double-click to close polygon.  
          After drawing, click segments to assign types.</em>
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

        {/* MAP BACKGROUND */}
        <h3>Map Background</h3>
        <button
          onClick={() => setMapStyle("street")}
          style={{
            width: "100%",
            background: mapStyle === "street" ? "#0b7285" : "#ddd",
            color: mapStyle === "street" ? "white" : "black",
          }}
        >
          Street Map
        </button>
        <button
          onClick={() => setMapStyle("hybrid")}
          style={{
            width: "100%",
            marginTop: "0.3rem",
            background: mapStyle === "hybrid" ? "#0b7285" : "#ddd",
            color: mapStyle === "hybrid" ? "white" : "black",
          }}
        >
          Hybrid/Aerial
        </button>
        <button
          onClick={() => setMapStyle("topo")}
          style={{
            width: "100%",
            marginTop: "0.3rem",
            background: mapStyle === "topo" ? "#0b7285" : "#ddd",
            color: mapStyle === "topo" ? "white" : "black",
          }}
        >
          USGS Topographic
        </button>

        <hr />

        {/* WELL LIST */}
        <h3>Wells</h3>

        {wells.length === 0 ? (
          <p>No wells yet. Use the buttons above to add them, then right-click a well on the map to edit its data.</p>
        ) : (
          <p style={{ fontSize: "0.85rem", color: "#555" }}>
            Right-click any well on the map to edit depths, screens, casing, and pump data.
          </p>
        )}

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
        <AquiferMap mapStyle={mapStyle} />
      </div>
    </div>
  );
}
