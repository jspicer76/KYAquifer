import { useAquiferStore } from "../store/aquiferStore";

export default function WellEditorDrawer() {
  const isOpen = useAquiferStore((s) => s.isWellEditorOpen);
  const editWellId = useAquiferStore((s) => s.editWellId);
  const wells = useAquiferStore((s) => s.geometry.wells);

  const updateWell = useAquiferStore((s) => s.updateWell);
  const deleteWell = useAquiferStore((s) => s.deleteWell);
  const closeDrawer = useAquiferStore((s) => s.closeWellEditor);

  if (!isOpen || !editWellId) return null;

  const well = wells.find((w) => w.id === editWellId);
  if (!well) return null;

  // Local handler for field updates
  const updateField = (field, value) => {
    updateWell(well.id, { [field]: value });
  };

  const drawerStyle = {
    position: "fixed",
    top: "0",
    right: "0",
    height: "100%",
    width: "400px",
    background: "white",
    borderLeft: "1px solid #ccc",
    boxShadow: "-3px 0 8px rgba(0,0,0,0.2)",
    zIndex: 1000,
    padding: "1.2rem",
    overflowY: "auto",
    transition: "all 0.25s ease-in-out",
  };

  return (
    <div style={drawerStyle}>
      <h2>Well Editor</h2>

      {/* Close Button */}
      <button
        onClick={closeDrawer}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "#ddd",
          border: "none",
          padding: "4px 10px",
        }}
      >
        ✕
      </button>

      <div style={{ marginTop: "1rem" }}>
        <label><strong>Well Name</strong></label>
        <input
          type="text"
          value={well.name}
          onChange={(e) => updateField("name", e.target.value)}
          style={{ width: "100%", marginBottom: "1rem" }}
        />

        <label><strong>Coordinates</strong></label>
        <div>
          Lat: {well.lat.toFixed(6)} <br />
          Lng: {well.lng.toFixed(6)}
        </div>

        <hr />

        <label><strong>Well Depth (ft)</strong></label>
        <input
          type="number"
          value={well.depth_ft ?? ""}
          onChange={(e) => updateField("depth_ft", Number(e.target.value))}
          style={{ width: "100%", marginBottom: "1rem" }}
        />

        <label><strong>Screen Top (ft)</strong></label>
        <input
          type="number"
          value={well.screen_top_ft ?? ""}
          onChange={(e) => updateField("screen_top_ft", Number(e.target.value))}
          style={{ width: "100%", marginBottom: "1rem" }}
        />

        <label><strong>Screen Bottom (ft)</strong></label>
        <input
          type="number"
          value={well.screen_bottom_ft ?? ""}
          onChange={(e) => updateField("screen_bottom_ft", Number(e.target.value))}
          style={{ width: "100%", marginBottom: "1rem" }}
        />

        <label><strong>Casing Diameter (in)</strong></label>
        <input
          type="number"
          value={well.casing_diameter_in ?? ""}
          onChange={(e) =>
            updateField("casing_diameter_in", Number(e.target.value))
          }
          style={{ width: "100%", marginBottom: "1rem" }}
        />

        <label><strong>Pump Depth (ft)</strong></label>
        <input
          type="number"
          value={well.pump_depth_ft ?? ""}
          onChange={(e) =>
            updateField("pump_depth_ft", Number(e.target.value))
          }
          style={{ width: "100%", marginBottom: "1rem" }}
        />

        <label><strong>Static Water Level (ft)</strong></label>
        <input
          type="number"
          value={well.static_water_level_ft ?? ""}
          onChange={(e) =>
            updateField("static_water_level_ft", Number(e.target.value))
          }
          style={{ width: "100%", marginBottom: "1rem" }}
        />

        <label><strong>Notes</strong></label>
        <textarea
          value={well.pump_test_notes ?? ""}
          onChange={(e) => updateField("pump_test_notes", e.target.value)}
          style={{ width: "100%", height: "80px", marginBottom: "1rem" }}
        />

        {/* SET AS PUMPING WELL */}
        <button
          onClick={() =>
            updateWell(well.id, { isPumping: true, lat: well.lat, lng: well.lng })
          }
          style={{
            width: "100%",
            padding: "0.4rem",
            background: well.isPumping ? "green" : "#ccc",
            color: well.isPumping ? "white" : "black",
            marginBottom: "0.8rem",
          }}
        >
          {well.isPumping ? "✓ Pumping Well" : "Set As Pumping Well"}
        </button>

        {/* DELETE WELL */}
        <button
          onClick={() => {
            deleteWell(well.id);
            closeDrawer();
          }}
          style={{
            width: "100%",
            padding: "0.4rem",
            background: "darkred",
            color: "white",
          }}
        >
          Delete Well
        </button>
      </div>
    </div>
  );
}
