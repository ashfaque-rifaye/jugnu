// Jugnu — outro film (19 s). Four cuts of the real console, the thesis, every school lit, the name.
import { W, H, C, FONT, lerp, prog, ease, window_, rng, loadFonts, loadImage, loadSchools, camera, glowSprite, grainTile, finish, line, logoCard, mount } from "./lib.js";

const Q = await (await fetch(new URL("./assets/outro-cues.json", import.meta.url))).json();

// crop = source rectangle in the 2000×1250 screenshots, past the menu (the phone crop stops above the line details).
const PANELS = [
  { img: "phone", crop: [345, 90, 1280, 800], tag: "TALK TO TEACHERS", a: "Calls any phone.", b: "Speaks Hindi.", hi: "किसी भी फ़ोन पर, हिंदी में।" },
  { img: "practices", crop: [345, 90, 1640, 1025], tag: "METHODS THAT WORK", a: "Hears what", b: "actually works.", hi: "जो सच में काम करता है, वो सुनता है।" },
  { img: "plan", crop: [345, 90, 1640, 1025], tag: "SHARE WITH SCHOOLS", a: "Tells each officer", b: "what to do next.", hi: "हर अधिकारी को अगला कदम।" },
  { img: "results-sim", crop: [345, 90, 1640, 1025], tag: "CHECK PROGRESS", a: "Calls back", b: "on day 14.", hi: "14वें दिन फिर फ़ोन।" },
];

let S;

const scene = {
  duration: Q.duration,
  async setup() {
    await loadFonts();
    const { pts } = await loadSchools();
    const r = rng(23);
    const seeds = Array.from({ length: 12 }, () => pts[Math.floor(r() * pts.length)]);
    pts.forEach((p) => {
      p.d = Math.min(...seeds.map((s) => Math.hypot(p.x - s.x, p.y - s.y)));
    });
    const dmax = Math.max(...pts.map((p) => p.d));
    pts.forEach((p) => (p.lit = Q.thesis + 0.45 + 2.3 * Math.pow(p.d / dmax, 0.8) + p.jit * 0.1));
    const imgs = {};
    for (const p of PANELS) {
      const im = await loadImage(new URL(`./assets/ui/${p.img}.png`, import.meta.url).href);
      const c = document.createElement("canvas");
      c.width = im.width;
      c.height = im.height;
      const g = c.getContext("2d");
      g.filter = "brightness(1.25) contrast(1.05)";
      g.drawImage(im, 0, 0);
      imgs[p.img] = c;
    }
    const soft = (rgb) => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d");
      const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, `rgba(${rgb},1)`);
      grd.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
      return c;
    };
    S = { pts, imgs, softGold: soft("250,204,21"), softTeal: soft("45,212,191"), gold: glowSprite("250,204,21"), warm: glowSprite("253,224,71"), teal: glowSprite("45,212,191"), grain: grainTile(), logo: await loadImage("/icon-512.png") };
  },
  async draw(ctx, t, frame) {
    ctx.save();
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    aurora(ctx, t);
    PANELS.forEach((p, i) => panel(ctx, p, Q.panels[i], t));
    if (t >= Q.thesis) district(ctx, t);
    if (t >= Q.logo - 0.01) logoCard(ctx, t, Q.logo, Q.flash, S.logo, S.gold, S.warm);
    closing(ctx, t);
    finish(ctx, frame, S.grain, 0.06);
    const k = Math.max(1 - prog(t, 0, 0.4), prog(t, Q.duration - 1, Q.duration));
    if (k > 0) {
      ctx.fillStyle = `rgba(0,0,0,${k})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  },
};

function aurora(ctx, t) {
  const a = 1 - prog(t, Q.thesis - 0.2, Q.thesis + 0.4);
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.16 * a;
  ctx.drawImage(S.softGold, -300 + Math.sin(t * 0.5) * 120, 200 + Math.cos(t * 0.4) * 80, 1500, 1500);
  ctx.globalAlpha = 0.14 * a;
  ctx.drawImage(S.softTeal, 1000 + Math.cos(t * 0.45) * 140, -500 + Math.sin(t * 0.6) * 90, 1500, 1500);
  ctx.restore();
}

/** A screenshot turned slightly away from the viewer, drawn as vertical slices (canvas has no 3D). */
function tilted(ctx, img, [sx, sy, sw, sh], x, y, w, h, tilt) {
  const N = 72;
  for (let i = 0; i < N; i++) {
    const u = i / N;
    const hs = h * (1 + tilt * (u - 0.5));
    ctx.drawImage(img, sx + u * sw, sy, sw / N + 1, sh, x + u * w, y + (h - hs) / 2, w / N + 1, hs);
  }
  const hl = h * (1 - tilt / 2);
  const hr = h * (1 + tilt / 2);
  ctx.beginPath();
  ctx.moveTo(x, y + (h - hl) / 2);
  ctx.lineTo(x + w, y + (h - hr) / 2);
  ctx.lineTo(x + w, y + (h + hr) / 2);
  ctx.lineTo(x, y + (h + hl) / 2);
  ctx.closePath();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function panel(ctx, p, start, t) {
  const end = start + Q.panelLen;
  if (t < start || t >= end) return;
  const k = ease.expo(prog(t, start, start + 0.55));
  const out = ease.in(prog(t, end - 0.2, end));
  const u = prog(t, start, end);

  // slow push into the screen
  const [cx, cy, cw, ch] = p.crop;
  const z = lerp(1, 0.9, u);
  const crop = [cx, cy + (ch * (1 - z)) / 3, cw * z, ch * z];
  const w = 1120;
  const h = (w * ch) / cw;
  const x = 760 + (1 - k) * 320 - out * 90;
  const y = (H - h) / 2 - 10;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.14 * k * (1 - out);
  ctx.drawImage(S.softGold, x - 220, y - 220, w + 440, h + 440);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = k * (1 - out);
  tilted(ctx, S.imgs[p.img], crop, x, y, w, h, lerp(-0.13, -0.07, ease.out(u)));
  ctx.restore();

  const X = 110;
  const a = 1 - out;
  line(ctx, p.tag, X, 400, prog(t, start, start + 0.3), a, { size: 22, weight: 600, font: FONT.sans, tracking: 6, color: C.y1, rise: 8, blur: 4 });
  line(ctx, p.a, X, 500, prog(t, start + 0.04, start + 0.4), a, { size: 76, weight: 600 });
  line(ctx, p.b, X, 590, prog(t, start + 0.14, start + 0.5), a, { size: 76, weight: 600, grad: true, glow: "rgba(250,204,21,0.25)" });
  line(ctx, p.hi, X, 650, prog(t, start + 0.26, start + 0.6), a, { size: 32, weight: 400, font: FONT.deva, color: C.ink3, rise: 10 });
  line(ctx, "The real console · real UDISE+ schools · learning results simulated", W - 60, H - 40, prog(t, start, start + 0.3), a * 0.8, { size: 16, weight: 400, font: FONT.sans, align: "right", color: "rgba(255,255,255,0.45)", rise: 0, blur: 0 });
}

function district(ctx, t) {
  const cv = camera(0, 0, lerp(0.94, 1.02, prog(t, Q.thesis, Q.logo)), 900, 1250, 540);
  const fade = t >= Q.logo ? 1 - ease.inOut(prog(t, Q.logo, Q.logo + 0.9)) : 1;
  const born = ease.out(prog(t, Q.thesis, Q.thesis + 0.5));
  ctx.save();
  for (const p of S.pts) {
    let [x, y] = cv.at(p);
    if (t >= Q.logo) {
      const k = ease.in(prog(t, Q.logo + p.jit * 0.25, Q.logo + 0.55 + p.jit * 0.25));
      x = lerp(x, W / 2, k);
      y = lerp(y, 400, k);
    }
    if (t >= p.lit) {
      const age = t - p.lit;
      const pop = age < 0.3 ? 1 + 1.6 * (1 - age / 0.3) : 1;
      const s = 22 * pop * (0.75 + 0.25 * Math.sin(t * p.freq + p.phase));
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = t < Q.logo + 0.9 ? 1 : 0;
      ctx.drawImage(S.warm, x - s / 2, y - s / 2, s, s);
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.globalAlpha = born * 0.35 * fade;
      ctx.fillStyle = "rgb(190,215,255)";
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  const X = 150;
  const a = window_(t, Q.thesis, Q.logo + 0.15, 0.3, 0.3);
  line(ctx, "The answer", X, 430, prog(t, Q.thesis + 0.1, Q.thesis + 0.5), a, { size: 108, weight: 600 });
  line(ctx, "is already", X, 548, prog(t, Q.thesis + 0.3, Q.thesis + 0.7), a, { size: 108, weight: 600 });
  line(ctx, "in the district.", X, 666, prog(t, Q.thesis + 0.5, Q.thesis + 0.9), a, { size: 108, weight: 600, grad: true, glow: "rgba(250,204,21,0.3)" });
  line(ctx, "जवाब पहले से ज़िले में है।", X, 738, prog(t, Q.thesis + 0.7, Q.thesis + 1.1), a, { size: 36, weight: 400, font: FONT.deva, color: C.ink3, rise: 10 });
}

function closing(ctx, t) {
  line(ctx, "Schools: real (UDISE+)  ·  Phone interviews: live  ·  Learning results: simulated", W / 2, 925, prog(t, Q.flash + 1.8, Q.flash + 2.3), 1, { size: 20, weight: 400, font: FONT.sans, align: "center", color: "rgba(255,255,255,0.5)", rise: 6, blur: 4 });
}

mount(scene);
