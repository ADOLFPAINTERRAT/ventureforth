export type LatLng = { lat: number; lng: number };

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function distanceMeters(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearingDegrees(a: LatLng, b: LatLng) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function compassLabel(deg: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8] ?? "N";
}

export function destinationFrom(origin: LatLng, bearing: number, meters: number): LatLng {
  const br = toRad(bearing);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const dr = meters / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(br),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(dr) * Math.cos(lat1),
      Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDeg(lat2), lng: ((toDeg(lng2) + 540) % 360) - 180 };
}

/** Pick a fixed random destination 2-7 km away. */
export function rollDestination(origin: LatLng): LatLng {
  const bearing = Math.random() * 360;
  const meters = 2000 + Math.random() * 5000;
  return destinationFrom(origin, bearing, meters);
}

/** Fictional Minecraft-style exploration grid derived from real coordinates. */
export function gameCoords(p: LatLng) {
  // 1 grid unit = 1 metre, so the readout moves with every step.
  const x = Math.round(p.lng * 111320 * Math.cos(toRad(p.lat))) % 100000;
  const z = Math.round(-p.lat * 110540) % 100000;
  return { x, z };
}

export function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} M` : `${(m / 1000).toFixed(2)} KM`;
}

export const ARRIVAL_RADIUS = 40;

/** Human-readable sector code for the fictional grid, e.g. "K-14". */
export function sectorCode(p: LatLng) {
  const { x, z } = gameCoords(p);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const l = letters[Math.abs(Math.floor(x / 64)) % letters.length] ?? "A";
  const n = Math.abs(Math.floor(z / 64)) % 100;
  return `${l}-${String(n).padStart(2, "0")}`;
}

/** Rough walking time in minutes at ~4.8 km/h. */
export function walkMinutes(meters: number) {
  return Math.max(1, Math.round(meters / 80));
}
