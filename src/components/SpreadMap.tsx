// How the light travels: real satellite ground under the block's real schools. The camera flies to one
// teacher at a time, and an arc of light rises from their school to each school learning from them.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { PRACTICES } from "../engine/practices";
import type { School } from "../engine/types";
import { clamp01, easeOut, glowSprite } from "../lib/glow";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";
import { cx } from "./ui";

const AMBER = "255 205 92";
const LIME = "201 242 107";
const IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
type Located = School & { lat: number; lon: number };
const located = (s?: School): s is Located => !!s && s.lat != null && s.lon != null;

interface Arc {
  id: string;
  to: Located;
  km: number;
  launch: number;
  shown: number;
}

export function SpreadMap({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const { lang, lite } = usePrefs();
  const { state } = usePipeline();
  const hi = lang === "hi" && "font-deva";
  const schools = state.block.schools;
  const byId = useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);
  const teachers = useMemo(() => {
    const m = new Map<string, typeof state.recs>();
    for (const r of state.recs) m.set(r.demonstratorId, [...(m.get(r.demonstratorId) ?? []), r]);
    return [...m.entries()]
      .filter(([id]) => located(byId.get(id)))
      .map(([id, recs]) => ({ id, recs: [...recs].sort((a, b) => a.distanceKm - b.distanceKm) }))
      .sort((a, b) => b.recs.length - a.recs.length);
  }, [state, byId]);
  const nameOf = (s: School) => (lang === "hi" && s.nameHi ? s.nameHi : s.name);
  const names = useRef(nameOf);
  names.current = nameOf;

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  /** No map on low-data mode, or where the device cannot draw one: the words and the list still say it all. */
  const [plain, setPlain] = useState(lite);
  useEffect(() => setPlain(lite), [lite]);
  const hover = useRef<string | null>(null);
  const live = useRef({ i: 0, paused: false });
  live.current = { i, paused };
  const fill = useRef<HTMLElement | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const ground = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  // The store hands over new objects every time it syncs. Rebuild the map only if the schools or the pairs change.
  const sig = `${schools.length}#${teachers.map((x) => `${x.id}:${x.recs.map((r) => r.schoolId).join()}`).join("|")}`;
  const data = useRef({ sig, teachers, schools, byId });
  if (data.current.sig !== sig) data.current = { sig, teachers, schools, byId };

  useEffect(() => {
    const { teachers, schools, byId } = data.current;
    const box = stage.current;
    const hold = ground.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (plain || !box || !hold || !cv || !ctx || !teachers.length) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const points = schools.filter(located);
    const amber = glowSprite(AMBER, 128);
    const lime = glowSprite(LIME, 96);
    const font = `${lang === "hi" ? '"Noto Sans Devanagari", ' : ""}Inter, system-ui, sans-serif`;
    let map: MapLibreMap | null = null;
    let cancelled = false;
    let raf = 0;
    let visible = false;
    let last = 0;
    let W = 0;
    let H = 0;
    let wide = false;
    let shown = -1;
    let from: Located = byId.get(teachers[0].id) as Located;
    let arcs: Arc[] = [];
    let elapsed = -0.6;
    let dwell = 9;
    let waited = 0;
    let flying = false;
    let baseBearing = -14;
    let ft = 0;

    const pad = () => (wide ? { left: Math.min(430, W * 0.31), right: Math.min(360, W * 0.26), top: 190, bottom: 96 } : { left: 30, right: 30, top: 110, bottom: 34 });

    const begin = (idx: number) => {
      const now = teachers[Math.min(idx, teachers.length - 1)];
      shown = idx;
      from = byId.get(now.id) as Located;
      arcs = now.recs
        .map((r, k) => ({ r, k, to: byId.get(r.schoolId) }))
        .filter((x): x is typeof x & { to: Located } => located(x.to))
        .map(({ r, k, to }) => ({ id: r.schoolId, to, km: r.distanceKm, launch: (still ? 0 : 2.1) + k * 0.13, shown: 0 }));
      elapsed = still ? 99 : 0;
      waited = 0;
      dwell = 3 + arcs.length * 0.13 + 6;
      baseBearing = idx % 2 ? 16 : -14;
      if (!map) return;
      const lons = [from.lon, ...arcs.map((a) => a.to.lon)];
      const lats = [from.lat, ...arcs.map((a) => a.to.lat)];
      const pitch = wide ? 54 : 42;
      const cam = map.cameraForBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: pad(), bearing: baseBearing, pitch, maxZoom: 13 },
      );
      if (!cam) return;
      if (still) map.jumpTo({ ...cam, pitch, bearing: baseBearing });
      else {
        flying = true;
        map.flyTo({ ...cam, pitch, bearing: baseBearing, duration: 2600, curve: 1.25, essential: true });
        map.once("moveend", () => {
          flying = false;
        });
      }
    };

    const beam = (x: number, y: number, h: number, w: number, rgb: string) => {
      const g = ctx.createLinearGradient(0, y, 0, y - h);
      g.addColorStop(0, `rgb(${rgb} / 0.55)`);
      g.addColorStop(1, `rgb(${rgb} / 0)`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.lineTo(x - w * 0.3, y - h);
      ctx.lineTo(x + w * 0.3, y - h);
      ctx.lineTo(x + w, y);
      ctx.closePath();
      ctx.fill();
    };

    const draw = (dt: number) => {
      if (!map) return;
      const m = map;
      ft += dt;
      if (shown !== live.current.i) begin(live.current.i);
      if (!still) {
        elapsed += dt;
        if (!flying) m.setBearing(m.getBearing() + dt * 0.55);
      }
      const squash = Math.cos((m.getPitch() * Math.PI) / 180);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";

      // every other school, a small steady light on the ground
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.62;
      ctx.beginPath();
      for (const s of points) {
        const p = m.project([s.lon, s.lat]);
        if (p.x < -4 || p.y < -4 || p.x > W + 4 || p.y > H + 4) continue;
        ctx.moveTo(p.x + 1.8, p.y);
        ctx.arc(p.x, p.y, 1.8, 0, 6.29);
      }
      ctx.fill();

      const home = m.project([from.lon, from.lat]);
      const prog = arcs.map((a) => ({ a, p: easeOut((elapsed - a.launch) / 1.05), to: m.project([a.to.lon, a.to.lat]) }));

      // the shadow each arc casts on the ground, which is what makes it read as rising
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgb(0 0 0)";
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.34;
      ctx.beginPath();
      for (const { p, to } of prog) {
        if (p <= 0) continue;
        ctx.moveTo(home.x, home.y);
        ctx.lineTo(home.x + (to.x - home.x) * p, home.y + (to.y - home.y) * p);
      }
      ctx.stroke();

      ctx.globalCompositeOperation = "lighter";
      const at = (x1: number, y1: number, lift: number, q: number) => ({ x: home.x + (x1 - home.x) * q, y: home.y + (y1 - home.y) * q - Math.sin(q * Math.PI) * lift });
      for (const { a, p, to } of prog) {
        if (p <= 0) continue;
        const on = hover.current === a.id;
        const lift = Math.min(wide ? 240 : 110, Math.hypot(to.x - home.x, to.y - home.y) * 0.46);
        const steps = 30;
        ctx.beginPath();
        for (let n = 0; n <= steps; n++) {
          const pt = at(to.x, to.y, lift, (n / steps) * p);
          if (n === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        const grad = ctx.createLinearGradient(home.x, home.y, to.x, to.y);
        grad.addColorStop(0, `rgb(${AMBER})`);
        grad.addColorStop(1, `rgb(${LIME})`);
        ctx.strokeStyle = grad;
        ctx.globalAlpha = on ? 0.32 : 0.15;
        ctx.lineWidth = on ? 9 : 6;
        ctx.stroke();
        ctx.globalAlpha = on ? 1 : 0.9;
        ctx.lineWidth = on ? 2.6 : 1.5;
        ctx.stroke();
        if (p < 1) {
          const h = at(to.x, to.y, lift, p);
          ctx.globalAlpha = 1;
          ctx.drawImage(amber, h.x - 24, h.y - 24, 48, 48);
        } else if (!still) {
          const q = ((elapsed - a.launch) * 0.24 + a.launch * 1.7) % 1;
          const h = at(to.x, to.y, lift, q);
          ctx.globalAlpha = Math.sin(q * Math.PI);
          ctx.drawImage(amber, h.x - 13, h.y - 13, 26, 26);
        }
      }

      // where each arc lands
      for (const { a, to } of prog) {
        const arrive = (elapsed - a.launch - 0.85) / 0.5;
        if (arrive <= 0) continue;
        const b = easeOut(arrive);
        const on = hover.current === a.id;
        ctx.globalCompositeOperation = "lighter";
        beam(to.x, to.y, (wide ? 34 : 20) * b, 3, LIME);
        ctx.globalAlpha = b * 0.9;
        const halo = (on ? 34 : 24) * (wide ? 1 : 0.6);
        ctx.drawImage(lime, to.x - halo, to.y - halo * squash, halo * 2, halo * 2 * squash);
        if (!still && arrive < 3) {
          ctx.globalAlpha = (1 - arrive / 3) * 0.85;
          ctx.strokeStyle = `rgb(${LIME})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(to.x, to.y, 5 + arrive * 16, (5 + arrive * 16) * squash, 0, 0, 6.29);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = b;
        ctx.fillStyle = `rgb(${LIME})`;
        ctx.beginPath();
        ctx.ellipse(to.x, to.y, on ? 6 : 4.5, (on ? 6 : 4.5) * squash, 0, 0, 6.29);
        ctx.fill();
      }

      // the teacher: a column of light standing on their school
      const ignite = easeOut((elapsed - 1.5) / 0.7);
      if (ignite > 0) {
        const pulse = still ? 1 : 1 + 0.07 * Math.sin(ft * 2);
        ctx.globalCompositeOperation = "lighter";
        beam(home.x, home.y, (wide ? 120 : 64) * ignite, 7, AMBER);
        const r = (wide ? 60 : 38) * pulse * ignite;
        ctx.globalAlpha = 1;
        ctx.drawImage(amber, home.x - r, home.y - r * squash, r * 2, r * 2 * squash);
        if (!still) {
          const q = (ft * 0.36) % 1;
          ctx.globalAlpha = (1 - q) * 0.7 * ignite;
          ctx.strokeStyle = `rgb(${AMBER})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(home.x, home.y, 10 + q * 58, (10 + q * 58) * squash, 0, 0, 6.29);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = ignite;
        ctx.fillStyle = "#fff4cc";
        ctx.beginPath();
        ctx.ellipse(home.x, home.y, 7, 7 * squash, 0, 0, 6.29);
        ctx.fill();
      }

      // names last, nearest first, and only where they fit; each fades in rather than popping
      ctx.globalCompositeOperation = "source-over";
      ctx.textBaseline = "middle";
      const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];
      if (ignite > 0) {
        const own = names.current(from);
        ctx.font = `600 13px ${font}`;
        const w = ctx.measureText(own).width + 20;
        const top = home.y - (wide ? 150 : 92);
        ctx.globalAlpha = ignite;
        ctx.fillStyle = "rgb(7 10 15 / 0.86)";
        ctx.beginPath();
        ctx.roundRect(home.x - w / 2, top, w, 25, 8);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffe9a8";
        ctx.fillText(own, home.x, top + 13);
        taken.push({ x0: home.x - w / 2 - 4, y0: top - 4, x1: home.x + w / 2 + 4, y1: top + 29 });
      }
      for (const { to } of prog) taken.push({ x0: to.x - 7, y0: to.y - 7, x1: to.x + 7, y1: to.y + 7 });
      const pads = pad();
      ctx.font = `500 12px ${font}`;
      let room = wide ? 8 : 3;
      for (const { a, to } of prog) {
        const arrive = (elapsed - a.launch - 0.95) / 0.5;
        let spot = false;
        if (arrive > 0 && room > 0) {
          const raw = names.current(a.to);
          const name = raw.length > 27 ? `${raw.slice(0, 26)}…` : raw;
          const km = `${a.km.toFixed(1)} ${lang === "hi" ? "किमी" : "km"}`;
          const w = ctx.measureText(name).width + ctx.measureText(km).width + 28;
          for (const [dx, dy] of [
            [12, -12],
            [-12 - w, -12],
            [-w / 2, -44],
            [-w / 2, 12],
          ]) {
            const r = { x0: to.x + dx - 3, y0: to.y + dy - 3, x1: to.x + dx + w + 3, y1: to.y + dy + 26 };
            if (r.x0 < (wide ? pads.left - 60 : 6) || r.x1 > W - (wide ? pads.right - 50 : 6) || r.y0 < 66 || r.y1 > H - (wide ? 108 : 6)) continue;
            if (taken.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0)) continue;
            taken.push(r);
            room--;
            spot = true;
            const on = hover.current === a.id;
            a.shown += (1 - a.shown) * (still ? 1 : 1 - Math.exp(-dt * 7));
            ctx.globalAlpha = a.shown;
            ctx.fillStyle = on ? "rgb(40 46 54 / 0.95)" : "rgb(7 10 15 / 0.82)";
            ctx.beginPath();
            ctx.roundRect(to.x + dx, to.y + dy, w, 23, 8);
            ctx.fill();
            ctx.textAlign = "left";
            ctx.fillStyle = "rgb(255 255 255 / 0.96)";
            ctx.fillText(name, to.x + dx + 9, to.y + dy + 12);
            ctx.textAlign = "right";
            ctx.fillStyle = `rgb(${LIME})`;
            ctx.fillText(km, to.x + dx + w - 9, to.y + dy + 12);
            break;
          }
        }
        if (!spot) a.shown = Math.max(0, a.shown - dt * 4);
      }
      ctx.globalAlpha = 1;

      if (!still && !live.current.paused && elapsed > 0) {
        waited += dt;
        if (waited > dwell && teachers.length > 1) {
          const next = (shown + 1) % teachers.length;
          live.current.i = next;
          setI(next);
          waited = 0;
        }
      }
      if (fill.current) fill.current.style.transform = `scaleX(${still ? 1 : clamp01(waited / dwell)})`;
    };

    const measure = () => {
      const b = box.getBoundingClientRect();
      if (!b.width || !b.height) return;
      W = b.width;
      H = b.height;
      wide = W >= 1024;
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      map?.resize();
    };
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      if (map && shown >= 0) begin(shown);
    });
    ro.observe(box);

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || cancelled) return;
      const dt = last ? Math.min(0.25, (now - last) / 1000) : 0.016;
      last = now;
      draw(dt);
      if (!still) raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf && visible && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    const hit = (e: MouseEvent) => {
      if (!map) return null;
      const b = cv.getBoundingClientRect();
      const x = e.clientX - b.left;
      const y = e.clientY - b.top;
      let best: string | null = null;
      let near = 24;
      for (const s of [from, ...arcs.map((a) => a.to)]) {
        const p = map.project([s.lon, s.lat]);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < near) {
          near = d;
          best = s.id;
        }
      }
      return best;
    };
    const onMove = (e: PointerEvent) => {
      const h = hit(e);
      if (h === hover.current) return;
      hover.current = h;
      cv.style.cursor = h ? "pointer" : "";
      if (still) wake();
    };
    const onClick = (e: MouseEvent) => {
      const h = hit(e);
      if (h) openRef.current(h);
    };
    const onRepaint = () => {
      if (still) wake();
    };
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("click", onClick);
    box.addEventListener("jugnu:repaint", onRepaint);
    document.addEventListener("visibilitychange", wake);

    // The map and its imagery load only when the section is nearly on screen.
    const start = async () => {
      try {
        const [maplibre, worker] = await Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"), import("maplibre-gl/dist/maplibre-gl.css")]);
        if (cancelled) return;
        maplibre.setWorkerUrl(worker.default);
        const lons = points.map((s) => s.lon);
        const lats = points.map((s) => s.lat);
        const made = new maplibre.Map({
          container: hold,
          style: {
            version: 8,
            sources: { earth: { type: "raster", tiles: [IMAGERY], tileSize: 256, maxzoom: 15 } },
            layers: [
              { id: "bg", type: "background", paint: { "background-color": "#0b1116" } },
              { id: "earth", type: "raster", source: "earth", paint: { "raster-saturation": -0.22, "raster-contrast": 0.18, "raster-brightness-max": 0.8, "raster-fade-duration": 500 } },
            ],
          },
          bounds: [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          fitBoundsOptions: { padding: 60 },
          interactive: false,
          attributionControl: false,
        });
        map = made;
        made.on("load", () => {
          made.resize();
          wake();
        });
        made.on("idle", () => {
          if (still) wake();
        });
        made.on("error", () => {});
      } catch {
        if (!cancelled) setPlain(true);
      }
    };
    let started = false;
    const near = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started) {
          started = true;
          void start();
        }
      },
      { rootMargin: "500px" },
    );
    near.observe(box);
    const seen = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        wake();
      },
      { threshold: 0.2 },
    );
    seen.observe(box);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      near.disconnect();
      seen.disconnect();
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("click", onClick);
      box.removeEventListener("jugnu:repaint", onRepaint);
      document.removeEventListener("visibilitychange", wake);
      map?.remove();
    };
  }, [sig, plain, lang]);

  // With reduced motion nothing runs on its own, so a change has to ask for a repaint.
  useEffect(() => {
    stage.current?.dispatchEvent(new Event("jugnu:repaint"));
  }, [i]);
  const mark = (id: string | null) => {
    hover.current = id;
    stage.current?.dispatchEvent(new Event("jugnu:repaint"));
  };

  const now = teachers[Math.min(i, teachers.length - 1)];
  if (!now) return null;
  const d = byId.get(now.id)!;
  const method = PRACTICES[now.recs[0].practice];
  const avg = now.recs.reduce((a, r) => a + r.distanceKm, 0) / now.recs.length;
  const reached = teachers.reduce((a, x) => a + x.recs.length, 0);
  const ROWS = 6;
  const go = (n: number) => setI((n + teachers.length) % teachers.length);
  const over = !plain;

  return (
    <section className={cx("spread on-dark flex flex-col text-white", over ? "lg:block lg:h-[min(92svh,840px)] lg:min-h-[660px]" : "lg:grid lg:grid-cols-2 lg:gap-x-8 lg:p-4")} aria-label={t("How a method travels between real schools", "एक तरीका असली स्कूलों के बीच कैसे पहुँचता है")}>
      {over && (
        <div ref={stage} className="spread-stage relative h-[400px] sm:h-[480px] lg:absolute lg:inset-0 lg:h-auto">
          <div ref={ground} style={{ position: "absolute", inset: 0 }} aria-hidden />
          <div className="spread-tone absolute inset-0" aria-hidden />
          <canvas
            ref={canvas}
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={t(`${state.block.name}: ${schools.length} real schools. ${d.teacher} at ${d.name} is showing ${now.recs.length} of them a method.`, `${state.block.name}: ${schools.length} असली स्कूल। ${d.name} के ${d.teacher}, ${now.recs.length} स्कूलों को एक तरीका दिखा रहे हैं।`)}
          />
        </div>
      )}
      {over && <div className="spread-side left-0 hidden bg-gradient-to-r from-[#05070b] via-[#05070b]/75 to-transparent lg:block" aria-hidden />}
      {over && <div className="spread-side right-0 hidden bg-gradient-to-l from-[#05070b] via-[#05070b]/75 to-transparent lg:block" aria-hidden />}
      {over && <div className="spread-foot hidden lg:block" aria-hidden />}

      {/* the words */}
      <div className={cx("relative order-first px-5 pt-6", over && "lg:absolute lg:left-9 lg:top-9 lg:w-[360px] lg:p-0")}>
        <div className={cx("text-[13px] font-semibold text-[#ffcd5c]", hi)}>{t("How the light travels", "रोशनी कैसे पहुँचती है")}</div>
        <p className={cx("mt-1 text-[13px] text-white/70", hi)}>{t("Real schools on real ground. The term shown is simulated.", "असली स्कूल, असली ज़मीन। दिखाया गया सत्र सिम्युलेटेड है।")}</p>
        <AnimatePresence mode="wait">
          <motion.div key={now.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }} className="mt-5 lg:mt-8">
            <h3 className={cx("display-xl text-[2.5rem] !leading-[1.04] lg:text-[3.4rem]", hi && "!leading-[1.25]")}>{d.teacher}</h3>
            <p className={cx("mt-3 text-[16px] leading-snug text-white/85", hi)}>
              {t(`is showing ${now.recs.length} ${now.recs.length === 1 ? "school" : "schools"} how to run`, `${now.recs.length} ${now.recs.length === 1 ? "स्कूल" : "स्कूलों"} को सिखा रहे हैं`)}
            </p>
            <p className={cx("mt-1 text-[1.65rem] leading-[1.15] text-[#ffcd5c] lg:text-[1.95rem]", lang === "hi" ? "font-deva font-semibold" : "italic")} style={lang === "hi" ? undefined : { fontFamily: "var(--font-serif)" }}>
              {lang === "hi" ? method.labelHi : method.label}
            </p>
            <p className={cx("mt-4 text-[13.5px] text-white/70", hi)}>
              {nameOf(d)} · {t(`on average ${avg.toFixed(1)} km away`, `औसतन ${avg.toFixed(1)} किमी दूर`)}
            </p>
            <button className={cx("tap-link mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-[#ffcd5c]", hi)} onClick={() => onOpen(now.id)}>
              {t("Open this school", "यह स्कूल खोलें")} <ArrowRight size={14} />
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* the schools, also the way in for keyboards and screen readers */}
      <div className={cx("relative px-5 pt-3", over && "lg:absolute lg:right-9 lg:top-9 lg:w-[300px] lg:p-0")}>
        <div className={cx("mb-1.5 text-[13px] text-white/70", hi)}>{t("Learning from them", "इनसे सीख रहे हैं")}</div>
        <AnimatePresence mode="wait">
          <motion.ul key={now.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {now.recs.slice(0, ROWS).map((r) => {
              const s = byId.get(r.schoolId)!;
              return (
                <li key={r.schoolId}>
                  <button className={cx("spread-row", hi)} onClick={() => onOpen(s.id)} onMouseEnter={() => mark(s.id)} onMouseLeave={() => mark(null)} onFocus={() => mark(s.id)} onBlur={() => mark(null)}>
                    <span className="min-w-0 truncate">{nameOf(s)}</span>
                    <span className="shrink-0 tabular-nums text-[#c9f26b]">{r.distanceKm.toFixed(1)} {t("km", "किमी")}</span>
                  </button>
                </li>
              );
            })}
            {now.recs.length > ROWS && <li className={cx("pt-1 text-[12.5px] text-white/60", hi)}>{t(`and ${now.recs.length - ROWS} more`, `और ${now.recs.length - ROWS}`)}</li>}
          </motion.ul>
        </AnimatePresence>
      </div>

      {/* one mark per teacher */}
      <div className={cx("relative px-5 pb-5 pt-4", over ? "lg:absolute lg:inset-x-9 lg:bottom-5 lg:p-0" : "lg:col-span-2")}>
        <div className="flex gap-1.5" role="group" aria-label={t("Teachers", "शिक्षक")}>
          {teachers.map((x, k) => {
            const name = byId.get(x.id)!.teacher;
            return (
              <button key={x.id} className="spread-seg" onClick={() => setI(k)} title={name} aria-label={t(`Show ${name}`, `${name} दिखाएँ`)} aria-current={k === i}>
                <span>
                  <i ref={k === i ? (el) => { fill.current = el; } : undefined} style={{ transform: k < i || plain ? "scaleX(1)" : k === i ? undefined : "scaleX(0)" }} />
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <span className="flex items-center gap-1">
            {over && (
              <button className="btn btn-glass btn-icon !p-1.5" onClick={() => setPaused((p) => !p)} aria-label={paused ? t("Play", "चलाएँ") : t("Pause", "रोकें")}>
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            )}
            <button className="btn btn-glass btn-icon !p-1.5" onClick={() => go(i - 1)} aria-label={t("Previous teacher", "पिछले शिक्षक")}>
              <ChevronLeft size={15} />
            </button>
            <button className="btn btn-glass btn-icon !p-1.5" onClick={() => go(i + 1)} aria-label={t("Next teacher", "अगले शिक्षक")}>
              <ChevronRight size={15} />
            </button>
            <span className="ml-1.5 text-xs tabular-nums text-white/70">{i + 1} / {teachers.length}</span>
          </span>
          {over && (
            <span className={cx("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/75", hi)}>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#ffe9a8] shadow-[0_0_8px_2px_rgb(255_205_92/0.7)]" /> {t("Teacher showing the method", "तरीका दिखाने वाले शिक्षक")}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#c9f26b]" /> {t("School learning it", "सीखने वाला स्कूल")}</span>
            </span>
          )}
          <span className={cx("text-xs text-white/70", hi)}>
            {t(`${teachers.length} teachers, ${reached} schools`, `${teachers.length} शिक्षक, ${reached} स्कूल`)}
            {over && <span className="ml-3 text-white/50">{t("Imagery: Esri", "चित्र: Esri")}</span>}
          </span>
        </div>
      </div>
    </section>
  );
}
