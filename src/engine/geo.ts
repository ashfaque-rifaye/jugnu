// Distances between schools on the ground. Straight-line distance comes from the real village
// coordinates (haversine) when a block is real, otherwise from the simulator's km grid. Rural
// roads wind: across Indian village networks the road distance runs about 1.3–1.4× the straight
// line, and a CRP on a motorbike averages ~25 km/h on them — good enough to plan a visit, and
// always shown as an estimate.
import type { School } from "./types";

export const ROAD_FACTOR = 1.35;
export const BIKE_KMH = 25;

export function straightKm(a: Pick<School, "x" | "y" | "lat" | "lon">, b: Pick<School, "x" | "y" | "lat" | "lon">): number {
  if (a.lat != null && a.lon != null && b.lat != null && b.lon != null) {
    const R = 6371;
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
  }
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 10) / 10;
}

export interface Trip {
  km: number; // straight line
  roadKm: number; // estimated by road
  minutes: number; // estimated by motorbike
}

export function trip(a: School, b: School): Trip {
  const km = straightKm(a, b);
  const roadKm = Math.round(km * ROAD_FACTOR * 10) / 10;
  return { km, roadKm, minutes: Math.max(2, Math.round((roadKm / BIKE_KMH) * 60)) };
}

/** The nearest of `among` to school `s` (excluding itself), with the trip to it. */
export function nearest(s: School, among: School[]): { school: School; trip: Trip } | null {
  let best: { school: School; trip: Trip } | null = null;
  for (const o of among) {
    if (o.id === s.id) continue;
    const t = trip(s, o);
    if (!best || t.km < best.trip.km) best = { school: o, trip: t };
  }
  return best;
}
