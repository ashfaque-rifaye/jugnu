// Jugnu demo film: the compositor. Draws each frame from the edit (edit.json) as a pure function of time,
// in a light, Loom-style frame: the screen in a rounded window, the camera gliding to what is being touched,
// soft transitions, chapter cards, captions, and the phone rising beside the live console during the call.
const edit = await (await fetch("/takes/edit.json")).json();
const FPS = edit.fps;
const W = 1920;
const H = 1080;
const canvas = document.getElementById("c");
const g = canvas.getContext("2d", { alpha: false });
const INK = "#0f172a";
const INK2 = "#475569";
const OVERLAP = 0.45;
const FONT = { display: '"Space Grotesk", "Inter", sans-serif', sans: '"Inter", "Noto Sans Devanagari", sans-serif' };

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** A soft spring settling at 1, for things that rise into place. */
const spring = (x) => (x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(9 * x));

// ---------------------------------------------------------------- frames
const pad = (n) => String(n).padStart(6, "0");
const bitmaps = new Map();
async function bitmap(url) {
  // Most recently used last, so a screen held still is never closed while it is being drawn.
  const hit = bitmaps.get(url) ?? fetch(url).then((r) => r.blob()).then((b) => createImageBitmap(b));
  bitmaps.delete(url);
  bitmaps.set(url, hit);
  if (bitmaps.size > 12) {
    const old = bitmaps.keys().next().value;
    const p = bitmaps.get(old);
    bitmaps.delete(old);
    p.then((x) => x.close()).catch(() => {});
  }
  return hit;
}
function frameAt(take, at) {
  const times = edit.frameTimes[take];
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= at) lo = mid;
    else hi = mid - 1;
  }
  return `/takes/${take}/frames/${pad(lo)}.jpg`;
}
function sourceAt(shot, t) {
  const m = shot.map.find((p) => t >= p[0] && t <= p[2]) ?? (t < shot.map[0][0] ? shot.map[0] : shot.map.at(-1));
  return m[1] + (clamp((t - m[0]) / (m[2] - m[0] || 1)) * (m[3] - m[1]));
}

// ---------------------------------------------------------------- background
const back = document.createElement("canvas");
back.width = W;
back.height = H;
{
  const b = back.getContext("2d");
  b.fillStyle = "#f6f8f4";
  b.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [[260, 120, 900, "rgba(167,243,208,.55)"], [1720, 180, 900, "rgba(253,230,138,.6)"], [1500, 1040, 900, "rgba(153,246,228,.4)"], [160, 1040, 760, "rgba(254,240,138,.32)"]]) {
    const gr = b.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, c);
    gr.addColorStop(1, "rgba(255,255,255,0)");
    b.fillStyle = gr;
    b.fillRect(0, 0, W, H);
  }
}

const rounded = (x, y, w, h, r) => {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
};

/** The screen, in its window, seen through the camera. */
function drawWindow(img, cam, box, alpha) {
  const [cx, cy, z] = cam;
  g.save();
  g.globalAlpha = alpha;
  g.shadowColor = "rgba(15,23,42,.22)";
  g.shadowBlur = 44;
  g.shadowOffsetY = 18;
  g.fillStyle = "#fff";
  rounded(box.x, box.y, box.w, box.h, 18);
  g.fill();
  g.shadowColor = "transparent";
  rounded(box.x, box.y, box.w, box.h, 18);
  g.clip();
  // The camera is in page pixels (1600x900); source frames are a multiple of that.
  const r = img.width / 1600;
  const sw = (1600 / z) * r;
  const sh = (900 / z) * r;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, (cx - 800 / z) * r, (cy - 450 / z) * r, sw, sh, box.x, box.y, box.w, box.h);
  g.restore();
}

// ---------------------------------------------------------------- the phone
const PHONE = { w: 396, h: 840 };
function drawPhone(img, x, y, rot, alpha) {
  g.save();
  g.globalAlpha = alpha;
  g.translate(x + PHONE.w / 2, y + PHONE.h / 2);
  g.rotate(rot);
  g.translate(-PHONE.w / 2, -PHONE.h / 2);
  g.shadowColor = "rgba(15,23,42,.38)";
  g.shadowBlur = 60;
  g.shadowOffsetY = 26;
  g.fillStyle = "#0b0f14";
  rounded(0, 0, PHONE.w, PHONE.h, 58);
  g.fill();
  g.shadowColor = "transparent";
  rounded(12, 12, PHONE.w - 24, PHONE.h - 24, 47);
  g.clip();
  if (img) {
    const a = img.width / img.height;
    const sw = PHONE.w - 24;
    const sh = PHONE.h - 24;
    const dw = a > sw / sh ? sh * a : sw;
    const dh = a > sw / sh ? sh : sw / a;
    g.drawImage(img, 12 + (sw - dw) / 2, 12 + (sh - dh) / 2, dw, dh);
  } else {
    // Until the owner's recording is in: a plain stand-in, marked as such.
    g.fillStyle = "#111827";
    g.fillRect(0, 0, PHONE.w, PHONE.h);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.font = `600 30px ${FONT.sans}`;
    g.fillText("Your phone recording", PHONE.w / 2, PHONE.h / 2 - 16);
    g.font = `400 22px ${FONT.sans}`;
    g.fillStyle = "#94a3b8";
    g.fillText("goes here", PHONE.w / 2, PHONE.h / 2 + 22);
    g.textAlign = "left";
  }
  g.restore();
}

// ---------------------------------------------------------------- words
function wrap(text, font, maxW) {
  g.font = font;
  const out = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
function drawCaption(c, t) {
  const a = Math.min(easeOut(prog(t, c.t0, c.t0 + 0.2)), 1 - prog(t, c.t1 - 0.05, c.t1 + 0.2));
  if (a <= 0) return;
  const font = `500 30px ${FONT.sans}`;
  // Long narration shows a phrase at a time, paced through its length.
  const all = wrap(c.text, font, 1180);
  const per = (c.t1 - c.t0) / all.length;
  let idx = Math.floor(clamp((t - c.t0) / per, 0, all.length - 0.001) / 2) * 2;
  if (idx && all.length % 2 && idx === all.length - 1 && all[idx].length < 24) idx -= 2;
  const rows = all.slice(idx, idx + (idx + 3 === all.length && all[idx + 2].length < 24 ? 3 : 2));
  const lh = 42;
  const label = c.who ? c.who.toUpperCase() : null;
  const h = rows.length * lh + 30 + (label ? 24 : 0);
  g.font = font;
  const w = Math.max(...rows.map((r) => g.measureText(r).width)) + 64;
  const x = (W - w) / 2;
  const y = H - 44 - h + (1 - a) * 10;
  g.save();
  g.globalAlpha = a;
  g.shadowColor = "rgba(15,23,42,.18)";
  g.shadowBlur = 26;
  g.shadowOffsetY = 8;
  g.fillStyle = "rgba(255,255,255,.96)";
  rounded(x, y, w, h, 20);
  g.fill();
  g.shadowColor = "transparent";
  g.textAlign = "center";
  let yy = y + 44;
  if (label) {
    g.font = `600 15px ${FONT.sans}`;
    g.fillStyle = "#b45309";
    g.fillText(label, W / 2, y + 28);
    yy += 22;
  }
  g.font = font;
  g.fillStyle = INK;
  rows.forEach((r, i) => g.fillText(r, W / 2, yy + i * lh));
  g.textAlign = "left";
  g.restore();
}
function drawChip(text, a) {
  if (!text || a <= 0) return;
  g.save();
  g.globalAlpha = a;
  const font = `600 21px ${FONT.display}`;
  g.font = font;
  const w = g.measureText(text).width + 56;
  g.shadowColor = "rgba(15,23,42,.14)";
  g.shadowBlur = 16;
  g.fillStyle = "rgba(255,255,255,.95)";
  rounded(1920 - 110 - w, 12, w, 42, 21);
  g.fill();
  g.shadowColor = "transparent";
  g.fillStyle = "#f59e0b";
  g.beginPath();
  g.arc(1920 - 110 - w + 24, 33, 6, 0, 7);
  g.fill();
  g.fillStyle = INK;
  g.fillText(text, 1920 - 110 - w + 40, 40);
  g.restore();
}
function drawCard(s, t) {
  const k = t - s.start;
  const a = Math.min(easeOut(prog(k, 0, 0.35)), 1 - prog(k, s.dur - OVERLAP, s.dur));
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  g.drawImage(back, 0, 0);
  const rise = (1 - easeOut(prog(k, 0, 0.6))) * 36;
  g.textAlign = "center";
  g.font = `600 30px ${FONT.display}`;
  g.fillStyle = "#b45309";
  g.fillText(`${s.n} of 8`, W / 2, H / 2 - 62 + rise);
  g.font = `700 92px ${FONT.display}`;
  g.fillStyle = INK;
  g.fillText(s.title, W / 2, H / 2 + 34 + rise * 0.6);
  const bar = easeInOut(prog(k, 0.15, 0.95)) * 240;
  const gr = g.createLinearGradient(W / 2 - 120, 0, W / 2 + 120, 0);
  for (const [o, c] of [[0, "#fde047"], [0.5, "#a3e635"], [1, "#2dd4bf"]]) gr.addColorStop(o, c);
  g.fillStyle = gr;
  rounded(W / 2 - bar / 2, H / 2 + 66 + rise * 0.4, bar, 7, 4);
  g.fill();
  g.textAlign = "left";
  g.restore();
}
function drawEnd(s, t) {
  const k = t - s.start;
  const a = easeOut(prog(k, 0.1, 0.7));
  g.drawImage(back, 0, 0);
  g.save();
  g.globalAlpha = a;
  g.textAlign = "center";
  g.font = `700 150px ${FONT.display}`;
  g.fillStyle = INK;
  g.fillText("Jugnu", W / 2, H / 2 - 10 + (1 - a) * 24);
  g.font = `500 40px ${FONT.sans}`;
  g.fillStyle = INK2;
  g.fillText("The answer to a block's learning gap is often already in the block.", W / 2, H / 2 + 66 + (1 - a) * 16);
  g.textAlign = "left";
  g.restore();
}

// ---------------------------------------------------------------- one frame
const FULL = { x: 110, y: 66, w: 1700, h: 956 };
const SPLIT = { x: 44, y: 150, w: 1364, h: 767 };
async function draw(i) {
  const t = i / FPS;
  const live = edit.shots.filter((s) => t >= s.start && t <= s.start + s.dur);
  const screens = live.filter((s) => s.kind === "screen");
  const images = await Promise.all(screens.map((s) => bitmap(frameAt(s.take, sourceAt(s, t - s.start)))));
  const phoneShot = screens.find((s) => s.phone);
  let phoneImg = null;
  if (phoneShot && edit.phone) {
    const k = sourceAt(phoneShot, t - phoneShot.start);
    const list = edit.phone.times;
    let lo = 0;
    let hi = list.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (list[mid] <= k) lo = mid;
      else hi = mid - 1;
    }
    phoneImg = await bitmap(`/takes/phone/frames/${pad(lo)}.jpg`);
  }
  g.globalAlpha = 1;
  g.drawImage(back, 0, 0);
  screens.forEach((s, n) => {
    const k = t - s.start;
    const fade = Math.min(easeOut(prog(k, 0, OVERLAP)), 1 - easeInOut(prog(k, s.dur - OVERLAP, s.dur)));
    const lift = 1 - easeOut(prog(k, 0, 0.6));
    const leave = easeInOut(prog(k, s.dur - OVERLAP, s.dur));
    const split = s.phone ? easeInOut(prog(k, 0.3, 1.2)) * (1 - easeInOut(prog(k, s.dur - 1, s.dur - 0.2))) : 0;
    const scale = (1 - lift * 0.035) * (1 - leave * 0.02);
    const base = {
      x: FULL.x + (SPLIT.x - FULL.x) * split,
      y: FULL.y + (SPLIT.y - FULL.y) * split,
      w: FULL.w + (SPLIT.w - FULL.w) * split,
      h: FULL.h + (SPLIT.h - FULL.h) * split,
    };
    const box = { x: base.x + (base.w * (1 - scale)) / 2, y: base.y + (base.h * (1 - scale)) / 2 + lift * 26, w: base.w * scale, h: base.h * scale };
    const cam = s.cam[clamp(Math.round(k * FPS), 0, s.cam.length - 1)];
    drawWindow(images[n], cam, box, fade);
    if (s.phone) {
      const rise = spring(prog(k, 0.5, 1.9));
      const out = easeInOut(prog(k, s.dur - 1, s.dur - 0.2));
      const float = Math.sin(k * 1.1) * 5;
      drawPhone(phoneImg, 1458, 120 + (1 - rise) * 900 + out * 900 + float, (1 - rise) * 0.12 + Math.sin(k * 0.7) * 0.006, fade);
    }
    drawChip(s.chapter, fade * clamp((k - 0.2) / 0.3));
  });
  for (const s of live) if (s.kind === "card") drawCard(s, t);
  for (const s of live) if (s.kind === "end") drawEnd(s, t);
  for (const c of edit.caps) if (t >= c.t0 && t <= c.t1 + 0.2) drawCaption(c, t);
}

await Promise.all(['600 92px "Space Grotesk"', '700 92px "Space Grotesk"', '500 30px "Inter"', '600 15px "Inter"'].map((f) => document.fonts.load(f, "Jugnu 123")));
await document.fonts.ready;
window.__fps = FPS;
window.__duration = edit.duration;
/** Draw a frame and hand it back as a JPEG (base64), for the render. */
window.__frame = async (i) => {
  await draw(i);
  return canvas.toDataURL("image/jpeg", 0.96).split(",")[1];
};
window.__ready = true;
