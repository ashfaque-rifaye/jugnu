// The block on Google's photorealistic 3D earth: every school a glowing pin standing on its real
// spot, the block outline draped over the ground, who-learns-from-whom and measuring lines, and a
// camera that flies to whatever is picked. Driven by RealMap, which keeps the card and the tools.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import type { School } from "../engine/types";
import { loadGoogleMaps, onMapsRejected } from "../lib/gmaps";

export type LatLon = [lat: number, lon: number];
// The camera aims at an absolute altitude; Damoh's plateau stands about 400 m above the sea.
const GROUND = 400;
export type CameraTarget = { kind: "fit"; points: LatLon[]; tilt?: number } | { kind: "school"; at: LatLon };
export type Camera = { key: number } & CameraTarget;

export interface PinStyle {
  color: string;
  ring: string;
  scale: number;
}

export interface Earth3DProps {
  schools: School[];
  pin: (s: School) => PinStyle;
  /** changes whenever any pin's look may have changed */
  pinKey: string;
  outline?: [number, number][]; // lon, lat
  links: [LatLon, LatLon][];
  measure: [LatLon, LatLon] | null;
  camera: Camera;
  language: string;
  onPick: (id: string) => void;
  onFail: (why: string) => void;
}

/** Where to stand to see all these points: their middle, and far enough back to fit them. */
function frame(points: LatLon[]) {
  if (!points.length) return { center: { lat: 23.6, lng: 79.45, altitude: GROUND }, range: 90000 }; // all of Damoh
  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const km = Math.max((Math.max(...lats) - Math.min(...lats)) * 110.57, (Math.max(...lons) - Math.min(...lons)) * 111.32 * Math.cos((lat * Math.PI) / 180), 1);
  return { center: { lat, lng: lon, altitude: GROUND }, range: km * 1000 * 1.4 };
}

export default function Earth3D({ schools, pin, pinKey, outline, links, measure, camera, language, onPick, onFail }: Earth3DProps) {
  const el = useRef<HTMLDivElement>(null);
  const lib = useRef<{ map: any; m3: any; mk: any } | null>(null);
  const markers = useRef(new Map<string, { m: any; look: string }>());
  const shapes = useRef<{ outline?: any; links: any[]; measure?: any }>({ links: [] });
  const cb = useRef({ onPick, onFail, pin });
  cb.current = { onPick, onFail, pin };
  const [ready, setReady] = useState(false);

  // ---- the 3D map, once
  useEffect(() => {
    let dead = false;
    let map: any;
    const off = onMapsRejected(() => !dead && cb.current.onFail("Google Maps rejected the key"));
    loadGoogleMaps(language)
      .then(async (g) => {
        const [m3, mk] = await Promise.all([g.importLibrary("maps3d"), g.importLibrary("marker")]);
        if (dead || !el.current) return;
        const start = camera.kind === "fit" ? frame(camera.points) : { center: { lat: camera.at[0], lng: camera.at[1], altitude: GROUND }, range: 2500 };
        map = new m3.Map3DElement({ ...start, tilt: 48, heading: 0, mode: "HYBRID", defaultUIHidden: true });
        map.style.width = map.style.height = "100%";
        el.current.append(map);
        lib.current = { map, m3, mk };
        setReady(true);
      })
      .catch((e) => !dead && cb.current.onFail(String(e?.message ?? e)));
    const placed = markers.current;
    return () => {
      dead = true;
      off();
      map?.remove();
      lib.current = null;
      placed.clear();
      shapes.current = { links: [] };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- a pin per school, standing on a thin stalk so it reads above trees and roofs
  useEffect(() => {
    const L = lib.current;
    if (!L || !ready) return;
    const keep = new Set(schools.map((s) => s.id));
    for (const [id, { m }] of markers.current) {
      if (keep.has(id)) continue;
      m.remove();
      markers.current.delete(id);
    }
    for (const s of schools) {
      if (s.lat == null || s.lon == null) continue;
      const st = cb.current.pin(s);
      const look = `${st.color}|${st.ring}|${st.scale}`;
      let entry = markers.current.get(s.id);
      if (!entry) {
        const m = new L.m3.Marker3DInteractiveElement({ position: { lat: s.lat, lng: s.lon, altitude: 45 }, altitudeMode: "RELATIVE_TO_GROUND", extruded: true, title: s.name });
        m.addEventListener("gmp-click", () => cb.current.onPick(s.id));
        L.map.append(m);
        entry = { m, look: "" };
        markers.current.set(s.id, entry);
      }
      if (entry.look !== look) {
        entry.m.replaceChildren(new L.mk.PinElement({ background: st.color, borderColor: st.ring, glyphColor: st.ring, scale: st.scale }));
        entry.look = look;
      }
    }
  }, [schools, pinKey, ready]);

  // ---- block outline, draped on the ground
  useEffect(() => {
    const L = lib.current;
    if (!L || !ready) return;
    shapes.current.outline?.remove();
    shapes.current.outline = undefined;
    if (!outline?.length) return;
    const p = new L.m3.Polyline3DElement({ altitudeMode: "CLAMP_TO_GROUND", strokeColor: "#f59e0b", strokeWidth: 6, outerColor: "rgba(15,23,42,0.6)", outerWidth: 0.4, drawsOccludedSegments: true });
    p.coordinates = outline.map(([lng, lat]) => ({ lat, lng }));
    L.map.append(p);
    shapes.current.outline = p;
  }, [outline, ready]);

  // ---- lines: who learns from whom, and the measuring line
  useEffect(() => {
    const L = lib.current;
    if (!L || !ready) return;
    for (const l of shapes.current.links) l.remove();
    shapes.current.links = links.map(([a, b]) => {
      const p = new L.m3.Polyline3DElement({ altitudeMode: "RELATIVE_TO_GROUND", strokeColor: "rgba(253,224,71,0.95)", strokeWidth: 5, drawsOccludedSegments: true });
      p.coordinates = arc(a, b, 45, 350);
      L.map.append(p);
      return p;
    });
  }, [links, ready]);
  useEffect(() => {
    const L = lib.current;
    if (!L || !ready) return;
    shapes.current.measure?.remove();
    shapes.current.measure = undefined;
    if (!measure) return;
    const p = new L.m3.Polyline3DElement({ altitudeMode: "RELATIVE_TO_GROUND", strokeColor: "#22d3ee", strokeWidth: 7, drawsOccludedSegments: true });
    p.coordinates = arc(measure[0], measure[1], 45, 250);
    L.map.append(p);
    shapes.current.measure = p;
  }, [measure, ready]);

  // ---- the camera
  useEffect(() => {
    const L = lib.current;
    if (!L || !ready) return;
    const end =
      camera.kind === "fit"
        ? { ...frame(camera.points), tilt: camera.tilt ?? 48, heading: 0 }
        : // aim a little south of the school (towards the camera) so it stands above the card
          { center: { lat: camera.at[0] - 0.004, lng: camera.at[1], altitude: GROUND }, range: 2000, tilt: 60, heading: 0 };
    L.map.flyCameraTo?.({ endCamera: end, durationMillis: 1600 });
  }, [camera.key, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} style={{ position: "absolute", inset: 0, background: "#0b1220" }} />;
}

/** A line between two schools that lifts off the ground in the middle, so it reads over terrain. */
function arc(a: LatLon, b: LatLon, base: number, lift: number) {
  return Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    return { lat: a[0] + (b[0] - a[0]) * t, lng: a[1] + (b[1] - a[1]) * t, altitude: base + Math.sin(Math.PI * t) * lift };
  });
}

