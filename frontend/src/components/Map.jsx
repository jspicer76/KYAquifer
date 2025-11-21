import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useProjectStore } from "../store/useProjectStore";
import L from "leaflet";
import { useState } from "react";

// Fix default marker icons (leaflet bug in bundlers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function AquiferMap() {
  const {
    wells,
    boundaries,
    addWell,
    addBoundaryPoint,
    boundaryMode,
  } = useProjectStore();

  const [tempBoundary, setTempBoundary] = useState([]);

  function MapClickHandler() {
    useMapEvents({
      click(e) {
        if (boundaryMode !== null) {
          // We're drawing a boundary
          setTempBoundary([...tempBoundary, e.latlng]);
          addBoundaryPoint(boundaryMode, e.latlng);
        } else {
          // Add a well
          addWell({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      },
    });
    return null;
  }

  return (
    <div style={{ height: "80vh", width: "100%" }}>
      <MapContainer
        center={[37.8, -85.9]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <MapClickHandler />

        {/* Wells */}
        {wells.map((w, idx) => (
          <Marker key={idx} position={[w.lat, w.lng]} />
        ))}

        {/* Boundaries */}
        {Object.keys(boundaries).map((type) =>
          boundaries[type].length > 1 ? (
            <Polyline
              key={type}
              positions={boundaries[type]}
              pathOptions={{
                color:
                  type === "constantHead"
                    ? "blue"
                    : type === "noFlow"
                    ? "red"
                    : "green",
                dashArray:
                  type === "constantHead" ? "6" : type === "noFlow" ? null : "3",
                weight: 3,
              }}
            />
          ) : null
        )}
      </MapContainer>
    </div>
  );
}
