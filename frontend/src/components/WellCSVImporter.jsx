import Papa from "papaparse";
import { useAquiferStore } from "../store/aquiferStore";

export default function WellCSVImporter() {
  const importWellsFromCSV = useAquiferStore((s) => s.importWellsFromCSV);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data.filter(
          (row) =>
            row &&
            Object.keys(row).length > 0 &&
            !Object.values(row).every((v) => v === "" || v === null)
        );
        importWellsFromCSV(rows);
        alert(`Imported ${rows.length} wells from CSV.`);
      },
    });
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <h4>Import Wells from CSV</h4>
      <p style={{ fontSize: "0.8rem" }}>
        Required columns: <b>lat</b>, <b>lng</b>  
        Optional: <b>name</b>, <b>type</b> (PW / OBS), <b>depth_ft</b>,{" "}
        <b>screen_top_ft</b>, <b>screen_bottom_ft</b>,{" "}
        <b>casing_diameter_in</b>, <b>pump_depth_ft</b>,{" "}
        <b>static_water_level_ft</b>, <b>pump_test_notes</b>.
      </p>
      <input type="file" accept=".csv" onChange={handleFile} />
    </div>
  );
}
