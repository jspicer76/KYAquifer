import { useAquiferStore } from "../store/aquiferStore";
import Papa from "papaparse";
import { Line } from "react-chartjs-2";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export default function PumpTestUploader() {
  const setPumpTestData = useAquiferStore((s) => s.setPumpTestData);
  const pumpTests = useAquiferStore((s) => s.pumpTests);

  // ---------------------------------------------
  // CSV UPLOADER
  // ---------------------------------------------
  function uploadCSV(e, key) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cleaned = result.data.filter(
          (row) =>
            row !== null &&
            row !== undefined &&
            Object.keys(row).length > 0 &&
            !Object.values(row).some((v) => v === "" || v === null)
        );

        setPumpTestData(key, cleaned);
      },
    });
  }

  // ---------------------------------------------
  // BUILD CHART DATA
  // ---------------------------------------------
  function makeChartData(data, xKey, yKey, label, color = "blue") {
    return {
      labels: data.map((r) => r[xKey]),
      datasets: [
        {
          label,
          data: data.map((r) => r[yKey]),
          borderColor: color,
          borderWidth: 2,
          pointRadius: 3,
        },
      ],
    };
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2>Pump Test Analysis</h2>

      {/* ======================================================
         STEP TEST
      ======================================================= */}
      <div style={{ marginTop: "1rem" }}>
        <h3>Step-Drawdown Test</h3>
        <p>CSV columns required: <b>time_min</b>, <b>drawdown_ft</b>, <b>rate_gpm</b></p>

        <input type="file" accept=".csv" onChange={(e) => uploadCSV(e, "step")} />

        {pumpTests.step.length > 0 && (
          <>
            <h4>Drawdown vs Time</h4>
            <Line
              id="step-chart"
              data={makeChartData(
                pumpTests.step,
                "time_min",
                "drawdown_ft",
                "Step Test",
                "blue"
              )}
            />
          </>
        )}
      </div>

      {/* ======================================================
         CONSTANT RATE TEST
      ======================================================= */}
      <div style={{ marginTop: "2rem" }}>
        <h3>Constant-Rate Test (72-Hour)</h3>
        <p>CSV columns required: <b>time_hr</b>, <b>drawdown_ft</b></p>

        <input
          type="file"
          accept=".csv"
          onChange={(e) => uploadCSV(e, "constant")}
        />

        {pumpTests.constant.length > 0 && (
          <>
            <h4>Drawdown vs Log(Time)</h4>
            <Line
              id="constant-chart"
              data={{
                labels: pumpTests.constant.map((r) =>
                  r.time_hr > 0 ? Math.log10(r.time_hr) : 0
                ),
                datasets: [
                  {
                    label: "Constant-Rate Drawdown",
                    data: pumpTests.constant.map((r) => r.drawdown_ft),
                    borderColor: "red",
                    borderWidth: 2,
                    pointRadius: 3,
                  },
                ],
              }}
              options={{
                scales: {
                  x: {
                    title: { display: true, text: "log10(time_hr)" },
                  },
                  y: {
                    title: { display: true, text: "Drawdown (ft)" },
                  },
                },
              }}
            />
          </>
        )}
      </div>

      {/* ======================================================
         RECOVERY TEST
      ======================================================= */}
      <div style={{ marginTop: "2rem" }}>
        <h3>Recovery Test</h3>
        <p>CSV columns required: <b>time_min</b>, <b>residual_drawdown_ft</b></p>

        <input
          type="file"
          accept=".csv"
          onChange={(e) => uploadCSV(e, "recovery")}
        />

        {pumpTests.recovery.length > 0 && (
          <>
            <h4>Residual Drawdown vs Time</h4>
            <Line
              id="recovery-chart"
              data={makeChartData(
                pumpTests.recovery,
                "time_min",
                "residual_drawdown_ft",
                "Recovery Test",
                "green"
              )}
            />
          </>
        )}
      </div>
    </div>
  );
}
