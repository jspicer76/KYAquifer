import { Line } from "react-chartjs-2";

export default function CalibrationPlot({ curve }) {
  const data = {
    labels: curve.time_min,
    datasets: [
      {
        label: "Observed",
        data: curve.s_obs_ft,
        borderColor: "blue",
        borderWidth: 2,
      },
      {
        label: "Modeled",
        data: curve.s_mod_ft,
        borderColor: "red",
        borderWidth: 2,
      },
    ],
  };

  return (
    <div style={{ marginTop: "1rem", padding: "0.5rem", border: "1px solid #ccc" }}>
      <h5>
        Well (r = {curve.r_ft.toFixed(0)} ft) — RMSE: {curve.rmse.toFixed(3)}
      </h5>
      <Line data={data} />
    </div>
  );
}
