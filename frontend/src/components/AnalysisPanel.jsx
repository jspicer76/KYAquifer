import { useAquiferStore } from "../store/aquiferStore";
import { captureMapPng } from "../utils/mapSnapshot";
import { api } from "../api/client";

export default function AnalysisPanel() {
  const runAnalysis = useAquiferStore((s) => s.runAnalysis);
  const analysis = useAquiferStore((s) => s.analysis);

  const geometry = useAquiferStore((s) => s.geometry);
  const whp = useAquiferStore((s) => s.whp);

  const stepData = useAquiferStore((s) => s.pumpTests.step);
  const constantData = useAquiferStore((s) => s.pumpTests.constant);
  const recoveryData = useAquiferStore((s) => s.pumpTests.recovery);

  // -----------------------------------------------------
  // Utility: convert a chart <canvas> to a PNG base64
  // -----------------------------------------------------
  function getPlotBase64(id) {
    const el = document.getElementById(id);
    if (!el || !el.toDataURL) return null;
    try {
      return el.toDataURL("image/png");
    } catch (err) {
      console.warn("Error capturing chart:", id, err);
      return null;
    }
  }

  // -----------------------------------------------------
  // KDOW PDF Generator
  // -----------------------------------------------------
  async function exportKDOWPDF() {
    let mapImage = null;

    try {
      mapImage = await captureMapPng();
    } catch (err) {
      console.warn("Map capture failed:", err);
    }

    const payload = {
      project_name: "Aquifer Project",
      pumping_rate_gpm: geometry.pumpingRate_gpm,
      wells: geometry.wells,
      boundaries: geometry.boundaries,
      whp: whp,
      analysis: analysis || {},

      map_image_base64: mapImage,
      step_plot_base64: getPlotBase64("step-chart"),
      constant_plot_base64: getPlotBase64("constant-chart"),
      recovery_plot_base64: getPlotBase64("recovery-chart"),
    };

    try {
      const res = await api.post("/report/kdow/export", payload, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "KDOW_Aquifer_Report.pdf";
      a.click();
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("PDF generation failed. Check backend logs.");
    }
  }

  // -----------------------------------------------------
  // Render
  // -----------------------------------------------------
  return (
    <div
      style={{
        marginTop: "1rem",
        padding: "1rem",
        border: "1px solid gray",
        background: "white",
      }}
    >
      <h2>Analysis</h2>

      <button onClick={runAnalysis} style={{ width: "100%" }}>
        Run Analysis
      </button>

      {analysis && (
        <>
          <h3>Results</h3>
          <pre
            style={{
              background: "#eee",
              padding: "0.5rem",
              maxHeight: "250px",
              overflowY: "scroll",
              fontSize: "0.85rem",
            }}
          >
            {JSON.stringify(analysis, null, 2)}
          </pre>

          <button
            onClick={exportKDOWPDF}
            style={{
              marginTop: "0.5rem",
              background: "#0055aa",
              color: "white",
              padding: "0.5rem",
              width: "100%",
            }}
          >
            Generate KDOW PDF Report
          </button>
        </>
      )}
    </div>
  );
}
