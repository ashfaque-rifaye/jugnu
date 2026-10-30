// Shared drawing kit for the intro and outro films: one 1920×1080 canvas, drawn as a pure function of
// time so the same page can play live (preview) or be stepped frame by frame (render.mjs).

export const W = 1920;
export const H = 1080;
export const C = { bg: "#04060a", y1: "#fde047", y2: "#facc15", lime: "#a3e635", teal: "#2dd4bf", ink: "rgba(255,255,255,0.95)", ink2: "rgba(255,255,255,0.72)", ink3: "rgba(255,255,255,0.5)" };
export const FONT = { display: '"Space Grotesk", "Inter", sans-serif', sans: '"Inter", sans-serif', deva: '"Noto Sans Devanagari", "Inter", sans-serif', mono: '"JetBrains Mono", ui-monospace, Consolas, monospace' };

// ---------------------------------------------------------------- time
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const ease = {
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  expo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  back: (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2),
};
/** 0→1 while entering [a, a+inDur], 1 while inside, 1→0 over [b-outDur, b]. */
export function window_(t, a, b, inDur = 0.35, outDur = 0.3) {
  if (t < a || t > b) return 0;
  return Math.min(ease.out(prog(t, a, a + inDur)), 1 - ease.in(prog(t, b - outDur, b)));
}

export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- assets
export async function loadFonts() {
  const specs = ['600 120px "Space Grotesk"', '700 120px "Space Grotesk"', '500 40px "Space Grotesk"', '400 40px "Inter"', '500 40px "Inter"', '600 40px "Inter"', '300 40px "Inter"', '400 40px "Noto Sans Devanagari"', '600 40px "Noto Sans Devanagari"'];
  await Promise.all(specs.map((s) => document.fonts.load(s, "Jugnu जुगनू 1,365")));
}

export function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/** A muted <video> that can be stepped: seek(t) resolves once that frame is decodable. */
export async function loadVideo(src) {
  const v = document.createElement("video");
  v.muted = true;
  v.preload = "auto";
  v.playsInline = true;
  v.src = src;
  await new Promise((res, rej) => {
    v.oncanplaythrough = res;
    v.onerror = rej;
  });
  v.seekTo = (time) =>
    new Promise((res) => {
      if (Math.abs(v.currentTime - time) < 0.001) return res();
      v.onseeked = () => res();
      v.currentTime = time;
    });
  return v;
}

// ---------------------------------------------------------------- schools map
export async function loadSchools() {
  const blocks = await (await fetch(new URL("./assets/schools.json", import.meta.url))).json();
  const pts = [];
  blocks.forEach((b, bi) => b.schools.forEach(([lat, lon, g3]) => pts.push({ lat, lon, g3, block: bi })));
  const lat0 = (Math.min(...pts.map((p) => p.lat)) + Math.max(...pts.map((p) => p.lat))) / 2;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p.lon * k);
  const ys = pts.map((p) => -p.lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // Map units: the district fits a 1 × (aspect) box centred on 0,0.
  const s = 1 / Math.max(x1 - x0, y1 - y0);
  pts.forEach((p, i) => {
    p.x = (xs[i] - (x0 + x1) / 2) * s;
    p.y = (ys[i] - (y0 + y1) / 2) * s;
    p.i = i;
  });
  const r = rng(7);
  pts.forEach((p) => {
    p.phase = r() * Math.PI * 2;
    p.freq = 1.2 + r() * 2.4;
    p.jit = r();
  });
  const hubs = blocks.map((b, bi) => {
    const mine = pts.filter((p) => p.block === bi);
    return { name: b.block, n: mine.length, x: mine.reduce((a, p) => a + p.x, 0) / mine.length, y: mine.reduce((a, p) => a + p.y, 0) / mine.length };
  });
  return { pts, hubs };
}

/** Shortest-path arrival distance from `root` over a k-nearest-neighbour graph (and each school's parent). */
export function spreadOrder(pts, root, k = 5) {
  const n = pts.length;
  const nb = pts.map((p) =>
    pts
      .map((q, j) => [Math.hypot(p.x - q.x, p.y - q.y), j])
      .sort((a, b) => a[0] - b[0])
      .slice(1, k + 1),
  );
  // make it symmetric so no island is unreachable
  nb.forEach((list, i) => list.forEach(([d, j]) => nb[j].some(([, x]) => x === i) || nb[j].push([d, i])));
  const dist = new Array(n).fill(Infinity);
  const parent = new Array(n).fill(-1);
  dist[root] = 0;
  const done = new Array(n).fill(false);
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    for (const [d, v] of nb[u]) if (dist[u] + d < dist[v]) (dist[v] = dist[u] + d), (parent[v] = u);
  }
  // islands (if any) hang off their nearest lit school
  for (let i = 0; i < n; i++) if (dist[i] === Infinity) (dist[i] = Math.hypot(pts[i].x - pts[root].x, pts[i].y - pts[root].y) * 1.5), (parent[i] = root);
  return { dist, parent };
}

export function camera(cx, cy, zoom, scale = 900, ox = W / 2, oy = H / 2) {
  const f = zoom * scale;
  return { f, at: (p) => [ox + (p.x - cx) * f, oy + (p.y - cy) * f] };
}

// ---------------------------------------------------------------- sprites
export function glowSprite(rgb, size = 96) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, `rgba(255,255,240,1)`);
  grd.addColorStop(0.08, `rgba(${rgb},0.95)`);
  grd.addColorStop(0.25, `rgba(${rgb},0.35)`);
  grd.addColorStop(0.6, `rgba(${rgb},0.08)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

export function grainTile(seed = 3, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  const r = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Film grain + vignette, drawn last on every frame. */
export function finish(ctx, frame, grain, amount = 0.05) {
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = amount;
  const r = rng(frame + 1);
  const ox = -Math.floor(r() * 256);
  const oy = -Math.floor(r() * 256);
  for (let x = ox; x < W; x += 256) for (let y = oy; y < H; y += 256) ctx.drawImage(grain, x, y);
  ctx.restore();
  ctx.save();
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------------------------------------------------------------- type
export function gradText(ctx, x, w) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, C.y1);
  g.addColorStop(0.35, C.y2);
  g.addColorStop(0.7, C.lime);
  g.addColorStop(1, C.teal);
  return g;
}

/**
 * One line of type that rises out of blur. `p` is 0→1 (in) and the caller fades it out with `alpha`.
 * opts: { size, weight, font, color, align, tracking, grad }
 */
export function line(ctx, text, x, y, p, alpha = 1, o = {}) {
  if (p <= 0 || alpha <= 0) return 0;
  const size = o.size ?? 100;
  ctx.save();
  ctx.font = `${o.weight ?? 600} ${size}px ${o.font ?? FONT.display}`;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "alphabetic";
  if (o.tracking) ctx.letterSpacing = `${o.tracking}px`;
  const e = ease.out(p);
  ctx.globalAlpha = alpha * e;
  const blur = (1 - e) * (o.blur ?? 14);
  if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  const dy = (1 - e) * (o.rise ?? size * 0.35);
  const w = ctx.measureText(text).width;
  const left = ctx.textAlign === "center" ? x - w / 2 : ctx.textAlign === "right" ? x - w : x;
  ctx.fillStyle = o.grad ? gradText(ctx, left, w) : (o.color ?? C.ink);
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = o.glowBlur ?? 40;
  }
  ctx.fillText(text, x, y + dy);
  ctx.restore();
  return w;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A frosted-glass panel over whatever is already on the canvas. */
export function glass(ctx, x, y, w, h, r, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.filter = "blur(18px) saturate(1.4)";
  ctx.drawImage(ctx.canvas, x - 30, y - 30, w + 60, h + 60, x - 30, y - 30, w + 60, h + 60);
  ctx.filter = "none";
  ctx.fillStyle = "rgba(14,18,28,0.42)";
  ctx.fillRect(x, y, w, h);
  const sheen = ctx.createLinearGradient(x, y, x, y + h);
  sheen.addColorStop(0, "rgba(255,255,255,0.10)");
  sheen.addColorStop(1, "rgba(255,255,255,0.02)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** Video frame drawn to cover the canvas, with a slow push-in. */
export function cover(ctx, v, zoom = 1, ox = 0, oy = 0) {
  const s = Math.max(W / v.videoWidth, H / v.videoHeight) * zoom;
  const w = v.videoWidth * s;
  const h = v.videoHeight * s;
  ctx.drawImage(v, (W - w) / 2 + ox, (H - h) / 2 + oy, w, h);
}

// ---------------------------------------------------------------- logo
/** The closing card: the swarm gathers (from `start`), flashes at `f`, and the mark and name resolve. */
export function logoCard(ctx, t, start, f, logoImg, gold, warm) {
  ctx.save();
  // the swarm's light gathering, then the flash
  const gather = ease.in(prog(t, start, f));
  const flash = prog(t, f, f + 1.4);
  const R = 120 + 900 * ease.out(flash);
  const glowA = gather * 0.7 * (1 - flash) + 0.35 * ease.out(prog(t, f, f + 0.6));
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = clamp(glowA);
  ctx.drawImage(gold, W / 2 - R / 2, 400 - R / 2, R, R);
  if (flash > 0 && flash < 1) {
    ctx.globalAlpha = 0.4 * Math.pow(1 - prog(t, f, f + 0.55), 2);
    ctx.fillStyle = "rgb(255,214,120)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1 - flash;
    ctx.drawImage(warm, -200, 400 - 14, W + 400, 28);
  }
  ctx.restore();

  const k = ease.back(prog(t, f, f + 0.7));
  if (k > 0) {
    ctx.save();
    // soft halo behind the mark
    const br = 0.85 + 0.15 * Math.sin((t - f) * 2.2);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.55 * clamp(k) * br;
    ctx.drawImage(gold, W / 2 - 330, 400 - 330, 660, 660);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = clamp(k * 1.3);
    const s = 230 * (0.8 + 0.2 * k);
    ctx.shadowColor = "rgba(250,204,21,0.45)";
    ctx.shadowBlur = 60;
    ctx.beginPath();
    ctx.roundRect(W / 2 - s / 2, 400 - s / 2, s, s, s * 0.22);
    ctx.clip();
    ctx.drawImage(logoImg, W / 2 - s / 2, 400 - s / 2, s, s);
    ctx.restore();
  }

  // wordmark: "Jugnu" + "जुगनू"
  const w1 = prog(t, f + 0.35, f + 0.95);
  if (w1 > 0) {
    ctx.save();
    ctx.font = `600 150px ${FONT.display}`;
    const wa = ctx.measureText("Jugnu").width;
    ctx.font = `600 104px ${FONT.deva}`;
    const wb = ctx.measureText("जुगनू").width;
    const gap = 44;
    const x0 = W / 2 - (wa + gap + wb) / 2;
    ctx.restore();
    line(ctx, "Jugnu", x0, 680, w1, 1, { size: 150, weight: 600, tracking: -2 });
    // the gradient slides across the Hindi name
    ctx.save();
    const e = ease.out(w1);
    ctx.globalAlpha = e;
    ctx.font = `600 104px ${FONT.deva}`;
    const sweep = (t - f) * 260;
    const g = ctx.createLinearGradient(x0 + wa + gap - 300 + sweep % 600, 0, x0 + wa + gap + wb + 300 + sweep % 600, 0);
    g.addColorStop(0, C.teal);
    g.addColorStop(0.3, C.y1);
    g.addColorStop(0.55, C.y2);
    g.addColorStop(0.8, C.lime);
    g.addColorStop(1, C.teal);
    ctx.fillStyle = g;
    if (e < 1) ctx.filter = `blur(${((1 - e) * 12).toFixed(1)}px)`;
    ctx.fillText("जुगनू", x0 + wa + gap, 676 + (1 - e) * 30);
    ctx.restore();
  }
  line(ctx, "Find what works. Carry it, school to school.", W / 2, 772, prog(t, f + 0.8, f + 1.3), 1, { size: 42, weight: 400, font: FONT.sans, align: "center", color: C.ink2, rise: 12, blur: 6 });
  line(ctx, "जो काम करता है, उसे ढूँढ़ें — और स्कूल-दर-स्कूल पहुँचाएँ।", W / 2, 830, prog(t, f + 1.0, f + 1.5), 1, { size: 32, weight: 400, font: FONT.deva, align: "center", color: C.ink3, rise: 10, blur: 6 });
  line(ctx, "AI FOR FOUNDATIONAL LEARNING  ·  CHALLENGE 4 · DATA TO ACTION", W / 2, 1000, prog(t, f + 1.4, f + 1.9), 1, { size: 18, weight: 600, font: FONT.sans, align: "center", tracking: 5, color: "rgba(255,255,255,0.42)", rise: 6, blur: 4 });
}

// ---------------------------------------------------------------- player
/**
 * Wires a scene to the page. ?render: the renderer calls window.__frame(i) and screenshots.
 * Otherwise it plays live (looping), with a scrubber, for previews.
 */
export async function mount(scene) {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  await scene.setup(ctx);
  const fps = 30;
  window.__duration = scene.duration;
  window.__fps = fps;
  window.__frame = async (i) => {
    await scene.draw(ctx, i / fps, i);
    return true;
  };
  window.__ready = true;
  if (new URLSearchParams(location.search).has("render")) return;
  const bar = document.getElementById("bar");
  let t0 = performance.now();
  let busy = false;
  const params = new URLSearchParams(location.search);
  if (params.has("t")) t0 -= Number(params.get("t")) * 1000;
  const tick = async () => {
    if (!busy) {
      busy = true;
      const t = ((performance.now() - t0) / 1000) % scene.duration;
      await scene.draw(ctx, t, Math.floor(t * fps));
      if (bar) bar.style.width = `${(t / scene.duration) * 100}%`;
      busy = false;
    }
    requestAnimationFrame(tick);
  };
  tick();
}
