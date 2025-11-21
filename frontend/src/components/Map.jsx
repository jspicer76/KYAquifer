import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  Polygon,
  Tooltip,
  useMapEvents
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAquiferStore } from "../store/aquiferStore";
import { feetToLat, feetToLng } from "../utils/ftToLatLng";
import { useState } from "react";

// Fix default marker paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Pumping well icon
const pumpingWellIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/1828/1828884.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Boundary node icon
const boundaryNodeIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/32/32339.png",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function AquiferMap() {
  // Zustand store access
  const geometry = useAquiferStore((s) => s.geometry);
  const whp = useAquiferStore((s) => s.whp);
  const showWHP = useAquiferStore((s) => s.showWHP);

  const wells = geometry.wells;
  const addWell = useAquiferStore((s) => s.addWell);
  const updateWell = useAquiferStore((s) => s.updateWell);
  const addBoundaryPoint = useAquiferStore((s) => s.addBoundaryPoint);
  const openWellEditor = useAquiferStore((s) => s.openWellEditor);

  // Track temporary polyline when drawing boundaries
  const [tempBoundary, setTempBoundary] = useState([]);

  // ---------------------------
  // Map click and event handling
  // ---------------------------
  function MapClickHandler() {
    useMapEvents({
      click(e) {
        const boundaryMode = geometry.boundaryMode;

        if (boundaryMode) {
          // Add boundary point
          addBoundaryPoint(boundaryMode, e.latlng);
          setTempBoundary((prev) => [...prev, e.latlng]);
        } else {
          // Add a new well
          addWell({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      },

      dblclick(e) {
        // Double-click promotes the nearest well to pumping well
        const { lat, lng } = e.latlng;
        const nearest = wells.find(
          (w) =>
            Math.abs(w.lat - lat) < 0.0001 && Math.abs(w.lng - lng) < 0.0001
        );
        if (nearest) {
          updateWell(nearest.id, { isPumping: true });
        }
      },
    });
    return null;
  }

  // ---------------------------
  // WHP Zone Conversion
  // ---------------------------
  const wellLat = geometry.wellLat;
  const wellLng = geometry.wellLng;

  const zone2LatLng = whp.zone2.map(([xFt, yFt]) => [
    wellLat + feetToLat(yFt),
    wellLng + feetToLng(xFt, wellLat),
  ]);

  const zone3LatLng = whp.zone3.map(([xFt, yFt]) => [
    wellLat + feetToLat(yFt),
    wellLng + feetToLng(xFt, wellLat),
  ]);

  // ---------------------------
  // Render Component
  // ---------------------------
  return (
    <div style={{ height: "80vh", width: "100%" }}>
      <MapContainer
        center={[geometry.wellLat, geometry.wellLng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <MapClickHandler />

        {/* ---------------------------
            WELLS (DRAGGABLE + LABELS)
           ---------------------------
        */}
        {wells.map((w, i) => (
          <Marker
            key={w.id}
            position={[w.lat, w.lng]}
            draggable={true}
            icon={w.isPumping ? pumpingWellIcon : undefined}
            eventHandlers={{
              dragend: (e) => {
                const newLat = e.target.getLatLng().lat;
                const newLng = e.target.getLatLng().lng;
                updateWell(w.id, { lat: newLat, lng: newLng });
              },
              click: () => {
                openWellEditor(w.id);
              },
            }}
          >
            {/* ALWAYS SHOW LABEL */}
            <Tooltip permanent direction="top" offset={[0, -10]}>
              <span
                style={{
                  fontWeight: w.isPumping ? "bold" : "normal",
                  color: w.isPumping ? "green" : "black",
                }}
              >
                {w.name}
              </span>
            </Tooltip>
          </Marker>
        ))}

        {/* ---------------------------
            DRAGGABLE BOUNDARY NODES
           ---------------------------
        */}
        {Object.keys(geometry.boundaries).map((type) => {
          const pts = geometry.boundaries[type];
          if (pts.length <= 1) return null;

          const color =
            type === "constantHead"
              ? "blue"
              : type === "noFlow"
              ? "red"
              : "green";

          const dash =
            type === "constantHead" ? "6" : type === "noFlow" ? null : "3";

          return (
            <>
              <Polyline
                key={`${type}-poly`}
                positions={pts}
                pathOptions={{
                  color,
                  dashArray: dash,
                  weight: 3,
                }}
              />

              {pts.map((p, idx) => (
                <Marker
                  key={`${type}-node-${idx}`}
                  position={[p.lat, p.lng]}
                  draggable={true}
                  icon={boundaryNodeIcon}
                  eventHandlers={{
                    dragend: (e) => {
                      const newLat = e.target.getLatLng().lat;
                      const newLng = e.target.getLatLng().lng;

                      const newPts = [...pts];
                      newPts[idx] = { lat: newLat, lng: newLng };

                      const updated = { ...geometry.boundaries };
                      updated[type] = newPts;

                      useAquiferStore.setState({
                        geometry: { ...geometry, boundaries: updated },
                      });
                    },
                  }}
                />
              ))}
            </>
          );
        })}

                {/* WHP ZONES */}
        {showWHP && (
          <>
            {/* Zone I */}
            {whp.zone1 && (
              <Circle
                center={[wellLat, wellLng]}
                radius={whp.zone1 * 0.3048}
                pathOptions={{ color: "blue", dashArray: "4" }}
              />
            )}

            {/* Zone II */}
            {whp.zone2.length > 10 && (
              <Polygon
                positions={whp.zone2.map(([x, y]) => {
                  const dLat = feetToLat(y);
                  const dLng = feetToLng(x, wellLat);
                  return [wellLat + dLat, wellLng + dLng];
                })}
                pathOptions={{ color: "green", dashArray: "8" }}
              />
            )}

            {/* Zone III */}
            {whp.zone3.length > 10 && (
              <Polygon
                positions={whp.zone3.map(([x, y]) => {
                  const dLat = feetToLat(y);
                  const dLng = feetToLng(x, wellLat);
                  return [wellLat + dLat, wellLng + dLng];
                })}
                pathOptions={{ color: "red", dashArray: "8" }}
              />
            )}
          </>
        )}

      </MapContainer>
    </div>
  );
}
