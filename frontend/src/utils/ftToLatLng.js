// Convert feet to approximate degrees latitude
export function feetToLat(ft) {
  // 1 degree latitude ≈ 364,000 ft
  return ft / 364000;
}

// Convert feet to approximate degrees longitude at given latitude
export function feetToLng(ft, lat) {
  // cos(lat) adjusts for horizontal scaling
  const ftPerDeg = 364000 * Math.cos((lat * Math.PI) / 180);
  return ft / ftPerDeg;
}
