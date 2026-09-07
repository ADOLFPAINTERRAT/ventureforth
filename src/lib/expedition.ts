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
  // 1 grid unit = 1 metre, measured from a fixed local anchor (the
  // 0.5° grid cell you're in). No wrapping and no huge numbers: two
  // nearby places always get small, nearby numbers, so the difference
  // between your X/Z and the target's X/Z is a real distance in metres.
  const anchorLat = Math.floor(p.lat * 2) / 2;
  const anchorLng = Math.floor(p.lng * 2) / 2;
  const x = Math.round((p.lng - anchorLng) * 111320 * Math.cos(toRad(p.lat)));
  const z = Math.round(-(p.lat - anchorLat) * 110540);
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
  const l = letters[Math.abs(Math.floor(x / 512)) % letters.length] ?? "A";
  const n = Math.abs(Math.floor(z / 512)) % 100;
  return `${l}-${String(n).padStart(2, "0")}`;
}

/** Rough walking time in minutes at ~4.8 km/h. */
export function walkMinutes(meters: number) {
  return Math.max(1, Math.round(meters / 80));
}

/** How much map (in metres) the player reveals around themselves as they walk. */
export const REVEAL_RADIUS = 70;

/** Has this point been uncovered by the player's exploration trail? */
export function isDiscovered(p: LatLng, trail: LatLng[], radius = REVEAL_RADIUS) {
  return trail.some((t) => distanceMeters(t, p) <= radius);
}

export type Cone = {
  /** centre bearing of the cone, degrees from north */
  bearing: number;
  /** half angle of the cone in degrees */
  halfWidth: number;
  /** furthest allowed distance in metres */
  length: number;
};

/** Random point inside a directional cone anchored at the player. */
export function randomPointInCone(origin: LatLng, cone: Cone): LatLng {
  const minM = Math.max(400, cone.length * 0.35);
  const maxM = Math.max(minM + 200, cone.length);
  // sqrt keeps the picks area-uniform instead of clustering near the player
  const meters = Math.sqrt(minM * minM + Math.random() * (maxM * maxM - minM * minM));
  const bearing = cone.bearing + (Math.random() * 2 - 1) * cone.halfWidth;
  return destinationFrom(origin, bearing, meters);
}

const BAD_CLASS = new Set(["water", "waterway", "military", "aeroway", "railway"]);
const BAD_TYPE = new Set([
  "water", "bay", "strait", "sea", "ocean", "reservoir", "river", "lake",
  "motorway", "motorway_link", "trunk", "trunk_link", "runway", "quarry",
]);

/** Cheap OSM sanity check — rejects water, motorways and restricted land. */
async function looksReachable(p: LatLng): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${p.lat}&lon=${p.lng}`,
      { signal: ctrl.signal, headers: { Accept: "application/json" } },
    );
    clearTimeout(t);
    if (!res.ok) return true;
    const j = (await res.json()) as { class?: string; type?: string; error?: string };
    if (j.error) return false; // nothing mapped here at all — usually open water
    if (j.class && BAD_CLASS.has(j.class)) return false;
    if (j.type && BAD_TYPE.has(j.type)) return false;
    return true;
  } catch {
    return true; // offline / rate-limited: don't block the game
  }
}

/** Pick a random, plausibly reachable destination inside the chosen zone. */
export async function pickDestinationInCone(origin: LatLng, cone: Cone): Promise<LatLng> {
  let first: LatLng | null = null;
  for (let i = 0; i < 5; i++) {
    const cand = randomPointInCone(origin, cone);
    if (!first) first = cand;
    if (await looksReachable(cand)) return cand;
  }
  return first ?? randomPointInCone(origin, cone);
}

export const DEFAULT_CONE: Cone = { bearing: 0, halfWidth: 25, length: 4000 };
