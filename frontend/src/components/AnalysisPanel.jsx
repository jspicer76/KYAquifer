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

  // -----------------------------------------------
  // Convert any chart <canvas> elements to base64
  // -----------------------------------------------
  function getPlotBase64(id) {
    const el = document.getElementById(id);
    if (!el) return null;

    if (el.toDataURL) {
      return el.toDataURL("image/png");
    }
    return null;
  }

  // -----------------------------------------------
  // EXPORT KDOW PDF
  // -----------------------------------------------
  async function exportKDOWPDF() {
    // Capture Leaflet map
    const mapImage = await captureMapPng();

    const payload = {
      project_name: "Aquifer Project",
      pumping_rate_gpm: geometry.pumpingRate_gpm,
      wells: geometry.wells,
      boundaries: geometry.boundaries,
      whp: whp,
      analysis: analysis || {},

      // Pump test plots (chart canvases must have these IDs)
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
      console.error("PDF export error:", err);
      alert("PDF generation failed. Check backend logs.");
    }
  }

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

      <button onClick={runAnalysis}>Run Analysis</button>

      {analysis && (
        <>
          <h3>Results</h3>
          <pre
            style={{
              background: "#eee",
              padding: "0.5rem",
              maxHeight: "250px",
              overflowY: "scroll",
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
