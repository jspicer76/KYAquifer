import { useAquiferStore } from "../store/aquiferStore";
import React, { useMemo } from "react";

// Distance between lat/lng in feet (simple approximation)
function haversineFeet(lat1, lon1, lat2, lon2) {
  const R = 20925524.9; // Earth radius in feet
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function CrossSection() {
  const wells = useAquiferStore((s) => s.geometry.wells);
  const b = useAquiferStore((s) => s.geometry.b_thick_ft);

  // If no wells, nothing to plot
  if (wells.length === 0) {
    return <div>No wells defined.</div>;
  }

  // ------------------------------
  // COMPUTE HORIZONTAL DISTANCES
  // ------------------------------
  const distances = [];
  let totalDist = 0;

  for (let i = 0; i < wells.length - 1; i++) {
    const d = haversineFeet(
      wells[i].lat,
      wells[i].lng,
      wells[i + 1].lat,
      wells[i + 1].lng
    );
    distances.push(d);
    totalDist += d;
  }

  // Assign each well an x position (cumulative)
  const xPos = [0];
  distances.reduce((acc, d) => {
    const next = acc + d;
    xPos.push(next);
    return next;
  }, 0);

  // Vertical scale
  const maxDepth = Math.max(
    ...wells.map((w) => w.screen_bottom_ft ?? 0),
    b
  );
  const vScale = (d) => d * (300 / maxDepth); // SVG height scaling

  const width = 800;
  const height = 400;
  const leftPad = 80;
  const bottomPad = 40;

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2>Aquifer Cross Section</h2>

      <svg
        width={width}
        height={height}
        style={{ border: "1px solid #ccc", background: "#fafafa" }}
      >
        {/* Aquifer bottom */}
        <line
          x1={0}
          y1={height - bottomPad - vScale(b)}
          x2={width}
          y2={height - bottomPad - vScale(b)}
          stroke="sienna"
          strokeWidth="3"
        />

        {/* Wells */}
        {wells.map((w, i) => {
          const x = leftPad + (xPos[i] / totalDist) * (width - 2 * leftPad);

          const screenTop = w.screen_top_ft ?? 0;
          const screenBottom = w.screen_bottom_ft ?? 0;
          const swl = w.static_water_level_ft ?? 0;

          const yScreenTop = height - bottomPad - vScale(screenTop);
          const yScreenBottom = height - bottomPad - vScale(screenBottom);
          const ySWL = height - bottomPad - vScale(swl);

          return (
            <g key={w.id || i}>
              {/* Casing */}
              <line
                x1={x}
                y1={height - bottomPad}
                x2={x}
                y2={height - bottomPad - vScale(screenBottom)}
                stroke="gray"
                strokeWidth="6"
              />

              {/* Screen interval */}
              {screenBottom > 0 && (
                <line
                  x1={x}
                  y1={yScreenTop}
                  x2={x}
                  y2={yScreenBottom}
                  stroke="green"
                  strokeWidth="8"
                />
              )}

              {/* Static water level */}
              {swl > 0 && (
                <line
                  x1={x - 12}
                  y1={ySWL}
                  x2={x + 12}
                  y2={ySWL}
                  stroke="blue"
                  strokeWidth="3"
                />
              )}

              {/* Well label */}
              <text
                x={x}
                y={height - 5}
                fontSize="12"
                textAnchor="middle"
              >
                {w.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ marginTop: "1rem" }}>
        <strong>Legend:</strong>
        <ul>
          <li><span style={{ color: "gray" }}>Gray Line</span> = Casing</li>
          <li><span style={{ color: "green" }}>Green Line</span> = Screen Interval</li>
          <li><span style={{ color: "blue" }}>Blue Tick</span> = Static Water Level</li>
          <li><span style={{ color: "sienna" }}>Brown Line</span> = Aquifer Bottom</li>
        </ul>
      </div>
    </div>
  );
}
