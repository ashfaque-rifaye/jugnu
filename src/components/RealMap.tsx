// The real map of a block: Google's photorealistic 3D earth when there is a Maps key, and
// OpenStreetMap / satellite basemaps (MapLibre, no key) otherwise or on request; the block and
// district outlines, every school where it stands coloured by status, who-learns-from-whom lines
// with their distances, a measuring tool, and a card for the school you pick.
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, StyleSpecification } from "maplibre-gl";
import type * as GeoJSON from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { AnimatePresence, motion } from "framer-motion";
import { Bike, Box, Crosshair, Footprints, Globe2, Layers, Link2, Map as MapIcon, Moon, Ruler, Satellite, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trip, type Trip } from "../engine/geo";
import type { School } from "../engine/types";
import { DAMOH_BLOCKS, DAMOH_DISTRICT } from "../lib/geo-shapes";
import { MAPS_KEY } from "../lib/gmaps";
import { usePrefs, useT } from "../lib/prefs";
import { STATUS_INFO, type SchoolStatus } from "../lib/status";
import { useTheme } from "../lib/theme";
import { Locator } from "./Locator";
import type { MapProps } from "./maps";
import { SchoolMapCard } from "./SchoolMapCard";
import { cx } from "./ui";
import type { Camera, CameraTarget, LatLon, PinStyle } from "./Earth3D";

const Earth3D = lazy(() => import("./Earth3D"));

maplibregl.setWorkerUrl(workerUrl);

// "earth" is Google's 3D map; the others are MapLibre basemaps.
type Base = "earth" | "map" | "satellite" | "night";
type FlatBase = Exclude<Base, "earth">;

// Dot colours per basemap: deep on the light street map, bright on satellite and night.
const DOTS: Record<"light" | "dark", Record<SchoolStatus, string>> = {
  light: { bright: "#d97706", check_due: "#0284c7", check_data: "#dc2626", revisit: "#ea580c", support: "#7c3aed", ok: "#64748b" },
  dark: { bright: "#fde047", check_due: "#7dd3fc", check_data: "#f87171", revisit: "#fb923c", support: "#c4b5fd", ok: "#cbd5e1" },
};

// OpenFreeMap (OpenStreetMap vector tiles, free, no key) for the street and night maps; Esri World
// Imagery for satellite, with the street map's labels laid over it.
const STYLE: Record<FlatBase, string> = {
  map: "https://tiles.openfreemap.org/styles/liberty",
  night: "https://tiles.openfreemap.org/styles/dark",
  satellite: "https://tiles.openfreemap.org/styles/liberty",
};
const FONT = ["Noto Sans Regular"];
const FONT_B = ["Noto Sans Bold"];
const ring = (r: [number, number][]) => ({ type: "Polygon" as const, coordinates: [r] });
type FC = GeoJSON.FeatureCollection;
const EMPTY: FC = { type: "FeatureCollection", features: [] };

/** Jugnu's own sources and layers, laid over whichever basemap is showing. */
function overlay(base: FlatBase, data: Record<"schools" | "links" | "measure" | "clusters", FC>) {
  const dark = base !== "map";
  const ink = dark ? "#f8fafc" : "#0f172a";
  const halo = dark ? "rgba(2,6,23,0.85)" : "rgba(255,255,255,0.92)";
  const sources: StyleSpecification["sources"] = {
    district: { type: "geojson", data: { type: "Feature", properties: {}, geometry: ring(DAMOH_DISTRICT) } },
    blocks: { type: "geojson", data: { type: "FeatureCollection", features: Object.entries(DAMOH_BLOCKS).map(([name, r]) => ({ type: "Feature", properties: { name }, geometry: ring(r) })) } },
    links: { type: "geojson", data: data.links },
    measure: { type: "geojson", data: data.measure },
    schools: { type: "geojson", data: data.schools },
    clusters: { type: "geojson", data: data.clusters },
  };
  const none = ["==", ["get", "name"], ""] as maplibregl.FilterSpecification;
  const layers: maplibregl.LayerSpecification[] = [
    { id: "j-blocks-line", type: "line", source: "blocks", paint: { "line-color": dark ? "#94a3b8" : "#475569", "line-width": 1, "line-opacity": 0.6, "line-dasharray": [2, 2] } },
    { id: "j-block-fill", type: "fill", source: "blocks", filter: none, paint: { "fill-color": "#f59e0b", "fill-opacity": base === "satellite" ? 0.04 : 0.07 } },
    { id: "j-block-line", type: "line", source: "blocks", filter: none, paint: { "line-color": "#f59e0b", "line-width": 2.6, "line-opacity": 0.95 } },
    { id: "j-district-line", type: "line", source: "district", paint: { "line-color": dark ? "#cbd5e1" : "#334155", "line-width": 1.6, "line-opacity": 0.75 } },
    { id: "j-links", type: "line", source: "links", layout: { "line-cap": "round", visibility: "none" }, paint: { "line-color": "#f59e0b", "line-width": 2.2, "line-opacity": 0.9, "line-dasharray": [1.4, 1.4] } },
    {
      id: "j-link-labels",
      type: "symbol",
      source: "links",
      minzoom: 10.5,
      layout: { visibility: "none", "symbol-placement": "line-center", "text-field": ["get", "label"], "text-font": FONT_B, "text-size": 11 },
      paint: { "text-color": dark ? "#fde68a" : "#92400e", "text-halo-color": halo, "text-halo-width": 1.6 },
    },
    { id: "j-measure", type: "line", source: "measure", layout: { "line-cap": "round" }, paint: { "line-color": "#06b6d4", "line-width": 3.2 } },
    { id: "j-schools-glow", type: "circle", source: "schools", filter: ["==", ["get", "status"], "bright"], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 10, 13, 26], "circle-color": "#fde047", "circle-blur": 1, "circle-opacity": dark ? 0.55 : 0.45 } },
    {
      id: "j-schools",
      type: "circle",
      source: "schools",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, ["case", ["==", ["get", "status"], "ok"], 2.8, 4.4], 13, ["case", ["==", ["get", "status"], "ok"], 6, 9]],
        "circle-color": ["get", "color"],
        "circle-opacity": ["case", ["get", "dim"], 0.2, 1],
        "circle-stroke-color": ["case", ["get", "sel"], "#06b6d4", dark ? "rgba(2,6,23,0.9)" : "#ffffff"],
        "circle-stroke-width": ["case", ["get", "sel"], 3.4, 1.2],
      },
    },
    {
      id: "j-school-labels",
      type: "symbol",
      source: "schools",
      minzoom: 11.5,
      layout: { "text-field": ["get", "label"], "text-font": FONT, "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true },
      paint: { "text-color": ink, "text-halo-color": halo, "text-halo-width": 1.4 },
    },
    {
      id: "j-cluster-labels",
      type: "symbol",
      source: "clusters",
      maxzoom: 11.5,
      layout: { "text-field": ["get", "label"], "text-font": FONT_B, "text-size": 11, "text-letter-spacing": 0.12, "text-transform": "uppercase" },
      paint: { "text-color": ink, "text-opacity": 0.8, "text-halo-color": halo, "text-halo-width": 1.6 },
    },
  ];
  return { sources, layers };
}

export interface RealMapProps extends MapProps {
  block?: string; // e.g. "Tendukheda"
  card?: boolean; // show the picked school's card inside the map
  onOpen?: (id: string) => void;
  focusId?: string | null;
  /** start with the who-learns-from-whom lines on */
  showLinks?: boolean;
  onBlock?: (name: string) => void;
}

export default function RealMap({ schools, status, selected, onSelect, links = [], highlight, height = 520, className, block, card = true, onOpen, focusId, showLinks = false, onBlock }: RealMapProps) {
  const t = useT();
  const { lang } = usePrefs();
  const { mode } = useTheme();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [styleRev, setStyleRev] = useState(0); // bumps each time a basemap finishes loading
  const ready = styleRev > 0;
  const flatDefault: FlatBase = mode === "dark" ? "night" : "map";
  const [base, setBase] = useState<Base>(MAPS_KEY ? "earth" : flatDefault);
  // MapLibre keeps running under the 3D earth, so falling back is instant.
  const flat: FlatBase = base === "earth" ? flatDefault : base;
  const earth = base === "earth";
  const [cam, setCam] = useState<Camera>({ key: 0, kind: "fit", points: [] });
  const fly = useCallback((c: CameraTarget) => setCam({ ...c, key: Date.now() }), []);
  const [tilt, setTilt] = useState(false);
  const [linksOn, setLinksOn] = useState(showLinks);
  const [measure, setMeasure] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(selected ?? null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const byId = useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);
  const located = useMemo(() => schools.filter((s) => s.lat != null && s.lon != null), [schools]);
  const palette = DOTS[flat === "map" ? "light" : "dark"];
  const cb = useRef({ onSelect, measure, setPicks, setPicked });
  cb.current = { onSelect, measure, setPicks, setPicked };
  const data = useRef<Record<"schools" | "links" | "measure" | "clusters", FC>>({ schools: EMPTY, links: EMPTY, measure: EMPTY, clusters: EMPTY });
  const put = (key: keyof typeof data.current, fc: FC) => {
    data.current[key] = fc;
    (map.current?.getSource(key) as GeoJSONSource | undefined)?.setData(fc);
  };

  // ---- create the map once
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#0b1220" } }] },
      center: [79.54, 23.4],
      zoom: 9,
      attributionControl: { compact: true },
      maxPitch: 60,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-left");
    m.on("style.load", () => setStyleRev((r) => r + 1));
    m.on("mousemove", "j-schools", (e) => {
      m.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (f) setHover({ id: String(f.properties.id), x: e.point.x, y: e.point.y });
    });
    m.on("mouseleave", "j-schools", () => {
      m.getCanvas().style.cursor = "";
      setHover(null);
    });
    m.on("click", "j-schools", (e) => {
      const id = String(e.features?.[0]?.properties.id ?? "");
      if (!id) return;
      if (cb.current.measure) cb.current.setPicks((p) => (p.length >= 2 ? [id] : p.includes(id) ? p : [...p, id]));
      else {
        cb.current.setPicked(id);
        cb.current.onSelect?.(id);
      }
    });
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // ---- basemap: load the style, then lay Jugnu's layers over it
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.setStyle(STYLE[flat], {
      transformStyle: (_prev, next) => {
        const mine = overlay(flat, data.current);
        let layers = next.layers;
        const sources = { ...next.sources, ...mine.sources };
        if (flat === "satellite") {
          sources.sat = { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" };
          layers = [
            { id: "sat", type: "raster", source: "sat" },
            ...next.layers
              .filter((l) => l.type === "symbol" && !/poi|housenumber|highway-shield/.test(l.id))
              .map((l) => ({ ...l, paint: { ...(l as maplibregl.SymbolLayerSpecification).paint, "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,0.75)", "text-halo-width": 1.4 } }) as maplibregl.LayerSpecification),
          ];
        }
        return { ...next, sources, layers: [...layers, ...mine.layers] };
      },
    });
  }, [flat]);

  // ---- the current block, highlighted; fit to it once
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const f = ["==", ["get", "name"], block ?? ""] as maplibregl.FilterSpecification;
    for (const id of ["j-block-fill", "j-block-line"]) if (m.getLayer(id)) m.setFilter(id, f);
    if (fitted.current === (block ?? "") || !located.length) return;
    fitted.current = block ?? "";
    const b = new maplibregl.LngLatBounds();
    for (const s of located) b.extend([s.lon!, s.lat!]);
    m.fitBounds(b, { padding: 36, duration: 0 });
    fly({ kind: "fit", points: located.map((s) => [s.lat!, s.lon!]) });
  }, [block, styleRev, located, fly]);

  // ---- schools and cluster names
  useEffect(() => {
    const sel = picked ?? selected;
    put("schools", {
      type: "FeatureCollection",
      features: located.map((s) => {
        const st = status.get(s.id) ?? "ok";
        return {
          type: "Feature",
          properties: { id: s.id, status: st, color: palette[st], dim: !!highlight && !highlight.has(s.id), sel: s.id === sel || picks.includes(s.id), label: lang === "hi" && s.nameHi ? s.nameHi : s.name },
          geometry: { type: "Point", coordinates: [s.lon!, s.lat!] },
        };
      }),
    });
    const groups = new Map<string, School[]>();
    for (const s of located) groups.set(s.clusterName, [...(groups.get(s.clusterName) ?? []), s]);
    put("clusters", {
      type: "FeatureCollection",
      features: [...groups].map(([name, ss]) => ({
        type: "Feature",
        properties: { label: lang === "hi" ? (ss.find((x) => x.village === name)?.nameHi ?? name) : name },
        geometry: { type: "Point", coordinates: [ss.reduce((a, x) => a + x.lon!, 0) / ss.length, ss.reduce((a, x) => a + x.lat!, 0) / ss.length] },
      })),
    });
  }, [located, status, palette, highlight, picked, selected, picks, lang, styleRev]);

  // ---- who learns from whom
  useEffect(() => {
    const m = map.current;
    if (m && ready) for (const id of ["j-links", "j-link-labels"]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", linksOn ? "visible" : "none");
    put("links", {
      type: "FeatureCollection",
      features: links.flatMap((l) => {
        const a = byId.get(l.from);
        const b = byId.get(l.to);
        if (!a?.lat || !b?.lat) return [];
        return [{ type: "Feature" as const, properties: { label: `${trip(a, b).km} km` }, geometry: { type: "LineString" as const, coordinates: [[a.lon!, a.lat], [b.lon!, b.lat]] } }];
      }),
    });
  }, [links, linksOn, byId, styleRev]);

  // ---- measuring
  const measured: { a: School; b: School; trip: Trip } | null = useMemo(() => {
    if (picks.length !== 2) return null;
    const a = byId.get(picks[0]);
    const b = byId.get(picks[1]);
    return a && b ? { a, b, trip: trip(a, b) } : null;
  }, [picks, byId]);
  useEffect(() => {
    put("measure", {
      type: "FeatureCollection",
      features: measured ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[measured.a.lon!, measured.a.lat!], [measured.b.lon!, measured.b.lat!]] } }] : [],
    });
  }, [measured, styleRev]);
  useEffect(() => {
    if (!measure) setPicks([]);
  }, [measure]);

  // ---- tilt
  useEffect(() => {
    map.current?.easeTo({ pitch: tilt ? 55 : 0, bearing: tilt ? -15 : 0, duration: 900 });
  }, [tilt]);

  // ---- fly to a school asked for from outside (search, the assistant)
  useEffect(() => {
    const s = focusId ? byId.get(focusId) : null;
    if (!s?.lat || !map.current || !ready) return;
    setPicked(s.id);
    map.current.flyTo({ center: [s.lon!, s.lat], zoom: 13, duration: 1400 });
    fly({ kind: "school", at: [s.lat, s.lon!] });
  }, [focusId, byId, ready, fly]);
  useEffect(() => {
    if (selected) setPicked(selected);
  }, [selected]);

  const showRoute = (from: string, to: string) => {
    setMeasure(true);
    setPicks([from, to]);
    const a = byId.get(from);
    const b = byId.get(to);
    if (a?.lat && b?.lat && map.current) {
      const bb = new maplibregl.LngLatBounds([a.lon!, a.lat], [a.lon!, a.lat]).extend([b.lon!, b.lat]);
      map.current.fitBounds(bb, { padding: 90, maxZoom: 13, duration: 900 });
      fly({ kind: "fit", points: [[a.lat, a.lon!], [b.lat, b.lon!]], tilt: 50 });
    }
  };

  // ---- the 3D earth's view of the same state
  const sel3 = picked ?? selected;
  const pin = (s: School): PinStyle => {
    const st = status.get(s.id) ?? "ok";
    const isSel = s.id === sel3 || picks.includes(s.id);
    if (isSel) return { color: DOTS.dark[st], ring: "#22d3ee", scale: 1.35 };
    if (highlight && !highlight.has(s.id)) return { color: "#475569", ring: "#1e293b", scale: 0.6 };
    return { color: DOTS.dark[st], ring: st === "bright" ? "#fff7d6" : "#0f172a", scale: st === "ok" ? 0.5 : st === "bright" ? 1.2 : 0.9 };
  };
  const pinKey = `${sel3}|${picks.join(",")}|${highlight ? [...highlight].join(",") : ""}|${located.map((s) => status.get(s.id) ?? "ok").join("")}`;
  const lines3 = useMemo(
    () =>
      linksOn
        ? links.flatMap((l): [LatLon, LatLon][] => {
            const a = byId.get(l.from);
            const b = byId.get(l.to);
            return a?.lat && b?.lat ? [[[a.lat, a.lon!], [b.lat, b.lon!]]] : [];
          })
        : [],
    [links, linksOn, byId],
  );
  const measure3: [LatLon, LatLon] | null = useMemo(() => (measured ? [[measured.a.lat!, measured.a.lon!], [measured.b.lat!, measured.b.lon!]] : null), [measured]);
  const pick3 = (id: string) => {
    if (measure) setPicks((p) => (p.length >= 2 ? [id] : p.includes(id) ? p : [...p, id]));
    else {
      setPicked(id);
      onSelect?.(id);
      const s = byId.get(id);
      if (s?.lat) fly({ kind: "school", at: [s.lat, s.lon!] });
    }
  };

  const hs = hover ? byId.get(hover.id) : null;
  const card_ = card && picked ? byId.get(picked) : null;
  const tool = "map-tool grid h-9 w-9 place-items-center rounded-full transition hover:bg-[var(--hover)]";
  const on = "bg-[var(--seg-on,rgba(250,204,21,0.18))] text-[var(--st-bright)]";

  return (
    <div className={cx("real-map relative overflow-hidden rounded-[1.4rem]", className)} style={{ height }}>
      {/* inline: maplibre-gl.css sets .maplibregl-map { position: relative }, which would beat a class */}
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {earth && (
        <Suspense fallback={<div className="skeleton absolute inset-0" />}>
          <Earth3D
            schools={located}
            pin={pin}
            pinKey={pinKey}
            outline={block ? DAMOH_BLOCKS[block] : undefined}
            links={lines3}
            measure={measure3}
            camera={cam}
            language={lang}
            onPick={pick3}
            onFail={(why) => {
              console.warn("3D map unavailable:", why);
              setBase(flatDefault);
            }}
          />
        </Suspense>
      )}
      {/* basemap */}
      <div className="chrome absolute left-3 top-3 z-10 flex items-center gap-0.5 rounded-full p-1 text-xs font-semibold">
        {(
          [
            ...(MAPS_KEY ? ([["earth", Globe2, t("3D", "3D")]] as const) : []),
            ["map", MapIcon, t("Map", "नक्शा")],
            ["satellite", Satellite, t("Satellite", "सैटेलाइट")],
            ["night", Moon, t("Night", "रात")],
          ] as const
        ).map(([k, Icon, label]) => (
          <button key={k} className={cx("map-pill flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition", base === k ? on : "text-[var(--color-ink-2)] hover:bg-[var(--hover)]")} onClick={() => setBase(k)} aria-pressed={base === k}>
            <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
      {/* tools */}
      <div className="chrome absolute right-3 top-3 z-10 flex flex-col gap-0.5 rounded-full p-1">
        <button className={cx(tool, measure && on)} onClick={() => setMeasure(!measure)} title={t("Measure distance between two schools", "दो स्कूलों की दूरी नापें")} aria-pressed={measure}>
          <Ruler size={16} />
        </button>
        {links.length > 0 && (
          <button className={cx(tool, linksOn && on)} onClick={() => setLinksOn(!linksOn)} title={t("Who learns from whom", "कौन किससे सीखता है")} aria-pressed={linksOn}>
            <Link2 size={16} />
          </button>
        )}
        {!earth && (
          <button className={cx(tool, tilt && on)} onClick={() => setTilt(!tilt)} title={t("Tilt the map (3D)", "नक्शा झुकाएँ (3D)")} aria-pressed={tilt}>
            <Box size={16} />
          </button>
        )}
        <button
          className={tool}
          onClick={() => {
            fitted.current = null;
            const b = new maplibregl.LngLatBounds();
            for (const s of located) b.extend([s.lon!, s.lat!]);
            map.current?.fitBounds(b, { padding: 36, duration: 800 });
            fly({ kind: "fit", points: located.map((s) => [s.lat!, s.lon!]) });
          }}
          title={t("Show the whole block", "पूरा ब्लॉक दिखाएँ")}
        >
          <Crosshair size={16} />
        </button>
      </div>
      {/* where this is */}
      <div className="chrome absolute bottom-9 left-3 z-10 hidden items-center gap-2 rounded-2xl px-2.5 py-1.5 sm:flex">
        <Locator block={block} onBlock={onBlock} size={0.8} />
        <div className="text-[11px] leading-tight">
          <div className="font-semibold">{t(`${block ?? ""} block`, `${block ?? ""} ब्लॉक`)}</div>
          <div className="text-[var(--color-ink-3)]">{t("Damoh · Madhya Pradesh", "दमोह · मध्य प्रदेश")}</div>
        </div>
      </div>
      {/* measuring */}
      <AnimatePresence>
        {measure && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="chrome absolute left-1/2 top-16 z-10 w-[min(92%,420px)] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-sm">
            <div className="flex items-start gap-2">
              <Ruler size={15} className="mt-0.5 shrink-0 text-[#22d3ee]" />
              {measured ? (
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {measured.a.name} → {measured.b.name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[var(--color-ink-2)]">
                    <span>
                      <b className="tabular-nums text-[var(--color-ink)]">{measured.trip.km} km</b> {t("straight", "सीधी")}
                    </span>
                    <span>
                      <Footprints size={12} className="mr-0.5 inline" />~<b className="tabular-nums text-[var(--color-ink)]">{measured.trip.roadKm} km</b> {t("by road", "सड़क से")}
                    </span>
                    <span>
                      <Bike size={12} className="mr-0.5 inline" />~<b className="tabular-nums text-[var(--color-ink)]">{measured.trip.minutes} min</b>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 text-[var(--color-ink-2)]">{picks.length ? t("Now tap the second school.", "अब दूसरा स्कूल छुएँ।") : t("Tap two schools to measure the distance.", "दूरी नापने के लिए दो स्कूल छुएँ।")}</div>
              )}
              <button className="shrink-0 text-[var(--color-ink-3)] hover:text-[var(--color-ink)]" onClick={() => setMeasure(false)} aria-label={t("Stop measuring", "नापना बंद करें")}>
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* hover */}
      {hs && !card_ && (
        <div className="pointer-events-none absolute z-10 rounded-xl bg-black/80 px-2.5 py-1.5 text-xs text-white backdrop-blur" style={{ left: hover!.x + 12, top: hover!.y + 12 }}>
          <span className="font-semibold">{lang === "hi" && hs.nameHi ? hs.nameHi : hs.name}</span> · {t(STATUS_INFO[status.get(hs.id) ?? "ok"].en, STATUS_INFO[status.get(hs.id) ?? "ok"].hi)}
        </div>
      )}
      {hs && card_ && hs.id !== card_.id && (
        <div className="pointer-events-none absolute z-10 rounded-xl bg-black/80 px-2.5 py-1.5 text-xs text-white" style={{ left: hover!.x + 12, top: hover!.y + 12 }}>
          {lang === "hi" && hs.nameHi ? hs.nameHi : hs.name}
        </div>
      )}
      {/* the picked school */}
      <AnimatePresence>
        {card_ && !measure && (
          <SchoolMapCard
            key={card_.id}
            school={card_}
            status={status.get(card_.id) ?? "ok"}
            schools={schools}
            statuses={status}
            links={links}
            onClose={() => setPicked(null)}
            onOpen={onOpen}
            onRoute={showRoute}
            onPick={(id) => {
              setPicked(id);
              const s = byId.get(id);
              if (s?.lat) map.current?.flyTo({ center: [s.lon!, s.lat], zoom: Math.max(map.current.getZoom(), 12), duration: 900 });
              if (s?.lat) fly({ kind: "school", at: [s.lat, s.lon!] });
            }}
          />
        )}
      </AnimatePresence>
      {!located.length && <div className="absolute inset-0 grid place-items-center text-sm text-[var(--color-ink-2)]"><Layers className="mr-2 inline" size={16} />{t("This block has no map positions.", "इस ब्लॉक की जगहें नक्शे पर नहीं हैं।")}</div>}
    </div>
  );
}
