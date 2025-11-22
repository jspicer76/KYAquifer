// Capture Leaflet map as a PNG using leaflet-easyPrint fallback

export async function captureMapPng() {
  const mapEl = document.querySelector(".leaflet-container");
  if (!mapEl) return null;

  try {
    const canvas = await html2canvas(mapEl, {
      useCORS: true,
      logging: false,
    });

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("Map snapshot error:", err);
    return null;
  }
}
