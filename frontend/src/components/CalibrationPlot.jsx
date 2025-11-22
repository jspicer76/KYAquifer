// frontend/src/components/CalibrationPlot.jsx
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useMemo } from "react";

// Register chart.js components (required for Vite + react-chartjs-2)
ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export default function CalibrationPlot({ curve }) {
  if (!curve) return null;

  // ---------------------------
  // SAFE DATA EXTRACTION
  // ---------------------------
  const t = Array.isArray(curve.time_min) ? curve.time_min : [];
  const sObs = Array.isArray(curve.s_obs_ft) ? curve.s_obs_ft : [];
  const sMod = Array.isArray(curve.s_mod_ft) ? curve.s_mod_ft : [];

  const minLen = Math.min(t.length, sObs.length, sMod.length);

  const tUse = t.slice(0, minLen);
  const sObsUse = sObs.slice(0, minLen);
  const sModUse = sMod.slice(0, minLen);

  // ---------------------------
  // UNIQUE CANVAS ID (for PDF export later)
  // ---------------------------
  const canvasId = `calib-${curve.r_ft}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  // ---------------------------
  // CHART DATA
  // ---------------------------
  const data = useMemo(
    () => ({
      labels: tUse,
      datasets: [
        {
          label: "Observed Drawdown",
          data: sObsUse,
          borderColor: "blue",
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: "Modeled Drawdown",
          data: sModUse,
          borderColor: "red",
          borderWidth: 2,
          pointRadius: 2,
        },
      ],
    }),
    [tUse, sObsUse, sModUse]
  );

  // ---------------------------
  // CHART OPTIONS
  // ---------------------------
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: false },
    scales: {
      x: {
        title: { display: true, text: "Time (min)" },
      },
      y: {
        title: { display: true, text: "Drawdown (ft)" },
      },
    },
    plugins: {
      legend: { position: "top" },
      tooltip: { enabled: true },
    },
  };

  return (
    <div
      style={{
        marginTop: "1rem",
        padding: "0.75rem",
        border: "1px solid #ccc",
        background: "#fafafa",
      }}
    >
      <h5 style={{ marginBottom: "0.5rem" }}>
        Observation Well (r = {curve.r_ft.toFixed(0)} ft) — RMSE:{" "}
        {curve.rmse?.toFixed(3)}
      </h5>

      <div style={{ width: "100%", height: "260px" }}>
        <Line id={canvasId} data={data} options={options} />
      </div>
    </div>
  );
}
