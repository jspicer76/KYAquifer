import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

export default function DataChartModal({ config, onClose }) {
  if (!config) return null;

  const data = useMemo(() => {
    return {
      datasets: config.datasets.map((ds) => ({
        ...ds,
        fill: false,
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 3,
      })),
    };
  }, [config]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: "nearest", intersect: false },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: config.xLabel || "Time" },
        },
        y: {
          title: { display: true, text: config.yLabel || "Drawdown (ft)" },
        },
      },
      plugins: {
        legend: { position: "top" },
        title: { display: !!config.title, text: config.title },
      },
    }),
    [config]
  );

  return (
    <div className="chart-modal">
      <div className="chart-modal__content">
        <button className="chart-modal__close" onClick={onClose}>
          ✕
        </button>
        <div style={{ width: "100%", height: "320px" }}>
          <Line data={data} options={options} />
        </div>
      </div>
    </div>
  );
}
