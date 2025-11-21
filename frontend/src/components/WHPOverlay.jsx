import { useAquiferStore } from "../store/aquiferStore";
import { Polygon, Circle } from "react-leaflet";
import { feetToLat, feetToLng } from "../utils/ftToLatLng";

export default function WHPOverlay({ wellLat, wellLng }) {
  const whp = useAquiferStore((s) => s.whp);
  const showWHP = useAquiferStore((s) => s.showWHP);

  if (!showWHP) return null;
  if (!whp.zone1) return null;

  // ---------------------------
  // Zone I (Circle)
  // ---------------------------
  const zone1 = (
    <Circle
      center={[wellLat, wellLng]}
      radius={whp.zone1 * 0.3048} // ft → meters
      pathOptions={{ color: "blue", dashArray: "4" }}
    />
  );

  // ---------------------------
  // Zone II (Polygon)
  // ---------------------------
  const zone2Points = whp.zone2.map((p) => {
    const dLat = feetToLat(p[1]);
    const dLng = feetToLng(p[0], wellLat);
    return [wellLat + dLat, wellLng + dLng];
  });

  const zone2 = (
    <Polygon
      positions={zone2Points}
      pathOptions={{ color: "green", dashArray: "5" }}
    />
  );

  // ---------------------------
  // Zone III (Polygon)
  // ---------------------------
  const zone3Points = whp.zone3.map((p) => {
    const dLat = feetToLat(p[1]);
    const dLng = feetToLng(p[0], wellLat);
    return [wellLat + dLat, wellLng + dLng];
  });

  const zone3 = (
    <Polygon
      positions={zone3Points}
      pathOptions={{ color: "red", dashArray: "5" }}
    />
  );

  return (
    <>
      {zone1}
      {whp.zone2.length > 0 && zone2}
      {whp.zone3.length > 0 && zone3}
    </>
  );
}
