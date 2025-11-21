import { useState } from "react";
import { api } from "../api/client";
import { useAquiferStore } from "../store/aquiferStore";
import CalibrationPlot from "./CalibrationPlot";

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

  async function runCalibration() {
    const obsWells = geometry.wells
      .filter((w) => !w.isPumping)
      .map((w) => ({
        r_ft: Math.sqrt(
          (w.lat - geometry.wellLat) ** 2 +
            (w.lng - geometry.wellLng) ** 2
        ) * 364000, // deg → ft approx
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

    const res = await api.post("/analysis/calibrate", payload);
    setResults(res.data);
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>Calibration</h3>

      <label>Model:</label>
      <select value={model} onChange={(e) => setModel(e.target.value)}>
        <option value="theis">Theis</option>
        <option value="cj">Cooper-Jacob</option>
        <option value="neuman">Neuman (unconfined)</option>
        <option value="hantush">Hantush-Jacob</option>
      </select>

      <div style={{ marginTop: "0.5rem" }}>
        <button onClick={runCalibration} style={{ width: "100%" }}>
          Run Auto-Calibration
        </button>
      </div>

      {results && (
        <div style={{ marginTop: "1rem" }}>
          <h4>Best-Fit Parameters</h4>
          <pre>{JSON.stringify(results.best_params, null, 2)}</pre>

          <h4>Observation Wells</h4>
          {results.curves.map((c, i) => (
            <CalibrationPlot key={i} curve={c} />
          ))}
        </div>
      )}
    </div>
  );
}
