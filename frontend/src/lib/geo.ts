import type { LatLng } from "./types";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * A circle as a GeoJSON polygon ring. MapLibre has no native circle layer, and
 * geofences are overwhelmingly pin+radius (TEAM_PLAN: "90% only need the latter").
 */
export function circlePolygon(centre: LatLng, radiusM: number, steps = 64) {
  const coords: [number, number][] = [];
  const latRad = (centre.lat * Math.PI) / 180;
  const dLat = (radiusM / 1000 / EARTH_RADIUS_KM) * (180 / Math.PI);
  const dLng = dLat / Math.cos(latRad);
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    coords.push([
      centre.lng + dLng * Math.cos(theta),
      centre.lat + dLat * Math.sin(theta),
    ]);
  }
  return coords;
}

/** Bounding box of a set of points, as [west, south, east, north]. */
export function bounds(points: LatLng[]): [number, number, number, number] {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
}

/**
 * Geofence containment, matching the rule Member B implements server-side:
 * accept if the device's accuracy circle *intersects* the fence, rather than
 * demanding a perfect point-in-circle (TEAM_PLAN, Member B watch-outs).
 */
export function isWithinGeofence(
  device: LatLng,
  centre: LatLng,
  radiusM: number,
  accuracyM = 0,
) {
  return haversineKm(device, centre) * 1000 <= radiusM + accuracyM;
}

export function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
