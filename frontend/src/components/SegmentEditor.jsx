// frontend/src/components/SegmentEditor.jsx
import { useEffect } from "react";
import { useAquiferStore } from "../store/aquiferStore";

export default function SegmentEditor() {
  const selectedSegment = useAquiferStore((s) => s.selectedSegment);
  const setSegmentType = useAquiferStore((s) => s.setSegmentType);
  const clearSelectedSegment = useAquiferStore((s) => s.clearSelectedSegment);

  // ESC closes editor
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === "Escape") clearSelectedSegment();
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [clearSelectedSegment]);

  if (!selectedSegment) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: "20px",
        top: "80px",
        width: "260px",
        padding: "1rem",
        background: "white",
        border: "1px solid #bbb",
        borderRadius: "6px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        zIndex: 5000,
      }}
    >
      <h4 style={{ marginTop: 0 }}>Segment Properties</h4>

      <div style={{ marginTop: "0.5rem" }}>
        <strong>Segment ID:</strong> {selectedSegment.id}
      </div>

      <div style={{ marginTop: "0.8rem" }}>
        <button
          style={{ width: "100%", marginBottom: "0.4rem" }}
          onClick={() => setSegmentType(selectedSegment.id, "constantHead")}
        >
          Constant Head (Blue Dashed)
        </button>

        <button
          style={{ width: "100%", marginBottom: "0.4rem" }}
          onClick={() => setSegmentType(selectedSegment.id, "noFlow")}
        >
          No-Flow (Red)
        </button>

        <button
          style={{ width: "100%", marginBottom: "0.4rem" }}
          onClick={() => setSegmentType(selectedSegment.id, "infinite")}
        >
          Infinite (Green Dashed)
        </button>
      </div>

      <button
        onClick={clearSelectedSegment}
        style={{
          width: "100%",
          marginTop: "0.5rem",
          background: "#ddd",
          padding: "0.4rem",
        }}
      >
        Close
      </button>
    </div>
  );
}
