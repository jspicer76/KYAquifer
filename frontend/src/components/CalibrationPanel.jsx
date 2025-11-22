import { useState } from "react";
import { api } from "../api/client";
import { useAquiferStore } from "../store/aquiferStore";
import CalibrationPlot from "./CalibrationPlot";

// ----------------------------------------------
// Utility: haversine (lat/lng → feet)
// ----------------------------------------------
function haversineFeet(lat1, lon1, lat2, lon2) {
  const R = 20925524.9; // Earth radius in feet
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function CalibrationPanel() {
  const geometry = useAquiferStore((s) => s.geometry);
  const pumpTests = useAquiferStore((s) => s.pumpTests);

  const [results, setResults] = useState(null);
  const [model, setModel] = useState("theis");

  const [bounds, setBounds] = useState({
    T: [200, 5000],
    S: [1e-6, 1e-3],
    Ss: [1e-6, 1e-3],
    Sy: [0.05, 0.35],
  });

  // ----------------------------------------------
  // Run Calibration
  // ----------------------------------------------
  async function runCalibration() {
    // Safety: need constant-rate test data
    if (!pumpTests.constant || pumpTests.constant.length === 0) {
      alert("No constant-rate pump test data available.");
      return;
    }

    // Safety: need observation wells
    const observationWells = geometry.wells.filter((w) => !w.isPumping);
    if (observationWells.length === 0) {
      alert("No observation wells found. Add at least one OBS well.");
      return;
    }

    // Build observation well inputs
    const obsWells = observationWells.map((w) => ({
      r_ft: haversineFeet(w.lat, w.lng, geometry.wellLat, geometry.wellLng),

      t_min: pumpTests.constant.map((r) => r.time_min),
      s_obs_ft: pumpTests.constant.map((r) => r.drawdown_ft),
    }));

    const payload = {
      model,
      Q_gpm: geometry.pumpingRate_gpm,
      wells: obsWells,
      bounds,
      Kz_over_Kr: geometry.Kz_over_Kr,
      b: geometry.b_thick_ft,
    };

    try {
      const res = await api.post("/analysis/calibrate", payload);
      setResults(res.data);
    } catch (err) {
      console.error("Calibration error:", err);
      alert("Calibration failed. Check backend logs.");
    }
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>Calibration</h3>

      <label>Model:</label>
      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        style={{ width: "100%", marginBottom: "0.5rem" }}
      >
        <option value="theis">Theis</option>
        <option value="cj">Cooper-Jacob</option>
        <option value="neuman">Neuman (Unconfined)</option>
        <option value="hantush">Hantush-Jacob</option>
      </select>

      <button onClick={runCalibration} style={{ width: "100%" }}>
        Run Auto-Calibration
      </button>

      {results && (
        <div style={{ marginTop: "1rem" }}>
          <h4>Best-Fit Parameters</h4>
          <pre style={{ background: "#eee", padding: "0.5rem" }}>
            {JSON.stringify(results.best_params, null, 2)}
          </pre>

          <h4>Observation Wells</h4>
          {results.curves.map((curve, i) => (
            <CalibrationPlot key={i} curve={curve} />
          ))}
        </div>
      )}
    </div>
  );
}
