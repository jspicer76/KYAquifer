import { useState } from "react";
import Papa from "papaparse";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export default function PumpTestUploader() {
  const [stepData, setStepData] = useState(null);
  const [constantData, setConstantData] = useState(null);
  const [recoveryData, setRecoveryData] = useState(null);

  // generic CSV loader
  function loadCSV(e, setter) {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (result) => setter(result.data),
    });
  }

  function makeChartData(data, xKey, yKey, label) {
    return {
      labels: data.map((row) => row[xKey]),
      datasets: [
        {
          label: label,
          data: data.map((row) => row[yKey]),
          borderColor: "blue",
          borderWidth: 2,
          pointRadius: 3,
        },
      ],
    };
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2>Pump Test Analysis</h2>

      {/* STEP TEST */}
      <div style={{ marginTop: "1rem" }}>
        <h3>Step-Drawdown Test</h3>
        <p>Upload a CSV with: time_min, drawdown_ft, rate_gpm</p>
        <input type="file" accept=".csv" onChange={(e) => loadCSV(e, setStepData)} />

        {stepData && (
          <>
            <h4>Step Test Plot (Drawdown vs Time)</h4>
            <Line
              data={makeChartData(stepData, "time_min", "drawdown_ft", "Step Test")}
            />
          </>
        )}
      </div>

      {/* CONSTANT RATE TEST */}
      <div style={{ marginTop: "2rem" }}>
        <h3>Constant-Rate Test (72-Hour)</h3>
        <p>Upload a CSV with: time_hr, drawdown_ft</p>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => loadCSV(e, setConstantData)}
        />

        {constantData && (
          <>
            <h4>Constant Rate Plot (Drawdown vs Log Time)</h4>
            <Line
              data={{
                labels: constantData.map((row) => Math.log10(row.time_hr)),
                datasets: [
                  {
                    label: "Constant-Rate Drawdown",
                    data: constantData.map((row) => row.drawdown_ft),
                    borderColor: "red",
                    borderWidth: 2,
                  },
                ],
              }}
            />
          </>
        )}
      </div>

      {/* RECOVERY TEST */}
      <div style={{ marginTop: "2rem" }}>
        <h3>Recovery Test</h3>
        <p>Upload a CSV with: time_min, residual_drawdown_ft</p>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => loadCSV(e, setRecoveryData)}
        />

        {recoveryData && (
          <>
            <h4>Recovery Plot (Residual vs Time)</h4>
            <Line
              data={makeChartData(
                recoveryData,
                "time_min",
                "residual_drawdown_ft",
                "Recovery"
              )}
            />
          </>
        )}
      </div>
    </div>
  );
}
