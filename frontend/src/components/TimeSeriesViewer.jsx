import { Line } from "react-chartjs-2";
import { useAquiferStore } from "../store/aquiferStore";
import zoomPlugin from "chartjs-plugin-zoom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  TimeScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  zoomPlugin
);

export default function TimeSeriesViewer() {
  const pumpTests = useAquiferStore((s) => s.pumpTests);

  // Consolidate curves
  const datasets = [];

  if (pumpTests.step.length > 0) {
    datasets.push({
      label: "Step Test (pumping well)",
      data: pumpTests.step.map((r) => ({ x: r.time_min, y: r.drawdown_ft })),
      borderColor: "blue",
      borderWidth: 2,
    });
  }

  if (pumpTests.constant.length > 0) {
    datasets.push({
      label: "Constant-Rate Test",
      data: pumpTests.constant.map((r) => ({ x: r.time_hr * 60, y: r.drawdown_ft })),
      borderColor: "red",
      borderWidth: 2,
    });
  }

  if (pumpTests.recovery.length > 0) {
    datasets.push({
      label: "Recovery Test",
      data: pumpTests.recovery.map((r) => ({ x: r.time_min, y: r.residual_drawdown_ft })),
      borderColor: "green",
      borderWidth: 2,
    });
  }

  if (datasets.length === 0) {
    return <p>No time-series data available yet. Upload pump test CSVs.</p>;
  }

  const data = { datasets };

  const options = {
    scales: {
      x: {
        type: "linear",
        title: { text: "Time (minutes)", display: true },
      },
      y: {
        title: { text: "Drawdown (ft)", display: true },
      },
    },

    plugins: {
      zoom: {
        zoom: {
          wheel: { enabled: true },
          mode: "xy",
        },
        pan: {
          enabled: true,
          mode: "xy",
        },
      },
    },

    maintainAspectRatio: false,
  };

  return (
    <div style={{ height: "300px", marginTop: "1rem" }}>
      <h3>Time-Series Drawdown Viewer</h3>
      <Line data={data} options={options} />
      <p style={{ fontSize: "0.8rem" }}>
        Scroll to zoom, click+drag to pan.
      </p>
    </div>
  );
}
