// Jugnu — intro film (24 s). One teacher in 1,365 schools has cracked it; nobody knows; Jugnu calls,
// hears it, and carries it school to school. The audio (score.py) follows the same cue sheet.
import { W, H, C, FONT, clamp, lerp, prog, ease, window_, rng, loadFonts, loadImage, loadVideo, loadSchools, spreadOrder, camera, glowSprite, grainTile, finish, line, glass, cover, logoCard, mount } from "./lib.js";

const Q = await (await fetch(new URL("./assets/intro-cues.json", import.meta.url))).json();
const ENV = await (await fetch(new URL("./assets/env.json", import.meta.url))).json();

const JUGNU_LINES = [
  [0.43, 2.95, "नमस्ते सुनीता जी। मैं जुगनू हूँ।", "Namaste, Sunita ji. I'm Jugnu."],
  [3.09, 6.4, "आपके बच्चे अच्छा पढ़ने लगे हैं — आपने क्या अलग किया?", "Your children have started reading well — what did you do differently?"],
];
const TEACHER_LINES = [[0.37, 3.1, "हम अक्षरों से खेल बनाते हैं… रोज़ दस मिनट।", "We turn letters into a game… ten minutes, every day."]];

let S; // scene state

const scene = {
  duration: Q.duration,
  async setup() {
    await loadFonts();
    const { pts, hubs } = await loadSchools();
    let root = 0;
    pts.forEach((p, i) => Math.hypot(p.x + 0.04, p.y - 0.02) < Math.hypot(pts[root].x + 0.04, pts[root].y - 0.02) && (root = i));
    const { dist, parent } = spreadOrder(pts, root);
    const sorted = [...dist].sort((a, b) => a - b);
    const D = sorted[Math.floor(sorted.length * 0.6)];
    pts.forEach((p, i) => {
      p.lit = dist[i] <= D ? Q.spread + 0.25 + 2.3 * Math.pow(dist[i] / D, 0.85) : Infinity;
      p.parent = parent[i];
      p.r0 = Math.hypot(p.x, p.y);
    });
    pts[root].lit = Q.cracked + 0.1;
    const r = rng(11);
    const motes = Array.from({ length: 34 }, () => ({ x: r() * W, y: r() * H, z: 0.3 + r() * 0.7, ph: r() * 6.28, sp: 6 + r() * 14 }));
    S = {
      pts,
      hubs,
      root,
      motes,
      gold: glowSprite("250,204,21"),
      warm: glowSprite("253,224,71"),
      teal: glowSprite("45,212,191"),
      grain: grainTile(),
      logo: await loadImage("/icon-512.png"),
      film: await loadVideo("/film/jugnu-film.mp4"),
    };
  },

  async draw(ctx, t, frame) {
    ctx.save();
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    if (t >= Q.call && t < Q.spread) await footage(ctx, t);
    else map(ctx, t);
    if (t >= Q.logo - 0.01) logoCard(ctx, t, Q.logo, Q.flash, S.logo, S.gold, S.warm);
    words(ctx, t);
    finish(ctx, frame, S.grain, 0.06);
    // fade in from black / out to black
    const k = Math.max(1 - prog(t, 0, 0.5), prog(t, Q.duration - 0.6, Q.duration));
    if (k > 0) {
      ctx.fillStyle = `rgba(0,0,0,${k})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  },
};

// ---------------------------------------------------------------- the district
function cam(t) {
  const root = S.pts[S.root];
  const ox = 1250;
  if (t < Q.cracked) return camera(0, 0, 1 + 0.05 * prog(t, Q.schools, Q.cracked), 900, ox, 540);
  if (t < Q.call) {
    const k = ease.inOut(prog(t, Q.cracked, Q.cracked + 1.3));
    const z = lerp(1.05, 2.5, k) + 0.25 * prog(t, Q.cracked + 1.3, Q.call);
    return camera(lerp(0, root.x, k), lerp(0, root.y, k), z, 900, ox, 540);
  }
  // spread: pull back from the bright spot to the whole district
  const k = ease.inOut(prog(t, Q.spread, Q.logo - 0.2));
  return camera(lerp(root.x, 0, k), lerp(root.y, 0, k), lerp(3.2, 1.0, k), 900, ox, 540);
}

function map(ctx, t) {
  const cv = cam(t);
  const root = S.pts[S.root];
  const [rx, ry] = cv.at(root);

  motes(ctx, t, t < Q.logo ? 0.5 : 0.8);

  // opening: one firefly drifts in and lands where the district will bloom
  if (t < Q.schools + 0.2) {
    const k = ease.inOut(prog(t, 0, Q.schools));
    const x = lerp(260, 1250, k) + Math.sin(t * 5) * 18 * (1 - k);
    const y = lerp(820, 540, k) + Math.cos(t * 4) * 14 * (1 - k);
    const s = lerp(60, 120, k) * (1 - prog(t, Q.schools, Q.schools + 0.2));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(S.warm, x - s / 2, y - s / 2, s, s);
    ctx.restore();
  }
  if (t < Q.schools) return;

  // block officers: spokes from each block HQ to its schools
  const spokes = window_(t, Q.officers, Q.cracked + 0.6, 0.6, 0.6);
  if (spokes > 0) {
    ctx.save();
    ctx.lineWidth = 1;
    for (const p of S.pts) {
      const h = S.hubs[p.block];
      const [hx, hy] = cv.at(h);
      const [px, py] = cv.at(p);
      const grow = ease.out(clamp((t - Q.officers - p.jit * 0.3) / 0.55));
      if (grow <= 0) continue;
      ctx.strokeStyle = `rgba(250,204,21,${0.11 * spokes})`;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(lerp(hx, px, grow), lerp(hy, py, grow));
      ctx.stroke();
    }
    S.hubs.forEach((h, i) => {
      const [hx, hy] = cv.at(h);
      const a = spokes * ease.out(prog(t, Q.officers + i * 0.06, Q.officers + 0.4 + i * 0.06));
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(S.gold, hx - 30, hy - 30, 60, 60);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = C.y1;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, 12 + 3 * Math.sin(t * 6 + i), 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `600 19px ${FONT.sans}`;
      ctx.fillStyle = C.ink;
      ctx.textAlign = "left";
      ctx.fillText(h.name, hx + 22, hy - 4);
      ctx.font = `400 16px ${FONT.sans}`;
      ctx.fillStyle = C.ink3;
      ctx.fillText(`${h.n} schools`, hx + 22, hy + 16);
    });
    ctx.restore();
  }

  // dim everything except the bright spot once it is found; brighten again as Jugnu spreads it
  const dim = t < Q.call ? 1 - 0.55 * ease.inOut(prog(t, Q.cracked + 0.2, Q.nobody + 0.4)) : 0.45;
  const fadeOut = t >= Q.logo ? 1 - ease.inOut(prog(t, Q.logo, Q.logo + 0.9)) : 1;

  // arcs: the practice travelling from school to school
  if (t >= Q.spread) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of S.pts) {
      if (p.parent < 0 || p.lit === Infinity) continue;
      const k = (t - (p.lit - 0.32)) / 0.32;
      if (k < 0 || k > 2.2) continue;
      const q = S.pts[p.parent];
      const [ax, ay] = cv.at(q);
      const [bx, by] = cv.at(p);
      const mx = (ax + bx) / 2 - (by - ay) * 0.25;
      const my = (ay + by) / 2 + (bx - ax) * 0.25;
      const head = clamp(k);
      const tail = clamp(k - 0.6);
      const a = (1 - clamp(k - 1.2)) * fadeOut;
      ctx.strokeStyle = `rgba(253,224,71,${0.55 * a})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let s = tail; s <= head + 1e-6; s += 0.1) {
        const u = Math.min(s, head);
        const x = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * bx;
        const y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * by;
        s === tail ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // the schools
  ctx.save();
  for (const p of S.pts) {
    const born = Q.schools + 0.95 * p.r0 * 1.6 + p.jit * 0.12;
    const b = ease.out(prog(t, born, born + 0.35));
    if (b <= 0) continue;
    let [x, y] = cv.at(p);
    if (t >= Q.logo) {
      // fly into the logo
      const k = ease.in(prog(t, Q.logo + p.jit * 0.25, Q.logo + 0.55 + p.jit * 0.25));
      x = lerp(x, W / 2, k);
      y = lerp(y, 400, k);
    }
    const lit = t >= p.lit;
    if (lit) {
      const age = t - p.lit;
      const pop = age < 0.3 ? 1 + 1.6 * (1 - age / 0.3) : 1;
      const fl = 0.75 + 0.25 * Math.sin(t * p.freq + p.phase);
      const s = (p.i === S.root ? 190 : 24) * pop * fl * (t >= Q.logo ? 1 - 0.5 * prog(t, Q.logo, Q.logo + 0.8) : 1);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = fadeOut > 0 ? Math.max(fadeOut, t < Q.logo + 0.9 ? 1 : 0) : 0;
      ctx.drawImage(S.warm, x - s / 2, y - s / 2, s, s);
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.globalAlpha = b * dim * 0.6 * fadeOut;
      ctx.fillStyle = "rgb(190,215,255)";
      ctx.beginPath();
      ctx.arc(x, y, 2.8 * Math.min(cv.f / 900, 1.5) * (0.6 + 0.4 * b), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // the bright spot: shockwave when found, phone rings while Jugnu calls
  if (t >= Q.cracked && t < Q.call) {
    ctx.save();
    const sw = prog(t, Q.cracked + 0.1, Q.cracked + 1.1);
    if (sw > 0 && sw < 1) {
      ctx.strokeStyle = `rgba(253,224,71,${0.9 * (1 - sw)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(rx, ry, 20 + 320 * ease.out(sw), 0, Math.PI * 2);
      ctx.stroke();
    }
    const streak = 1 - prog(t, Q.cracked + 0.1, Q.cracked + 1.0);
    if (t >= Q.cracked + 0.1 && streak > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = streak;
      ctx.drawImage(S.warm, rx - 620, ry - 9, 1240, 18);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    for (const rt of [Q.ring, Q.ring + 0.6]) {
      const k = prog(t, rt, rt + 1.0);
      if (k <= 0 || k >= 1) continue;
      ctx.strokeStyle = `rgba(45,212,191,${0.8 * (1 - k)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(rx, ry, 30 + 180 * ease.out(k), 0, Math.PI * 2);
      ctx.stroke();
    }
    // "Jugnu calling…" pill beside the school
    const pa = window_(t, Q.ring - 0.1, Q.call + 0.05, 0.3, 0.12);
    if (pa > 0) {
      const px = rx + 46;
      const py = ry - 30;
      glass(ctx, px, py, 290, 60, 30, pa);
      ctx.globalAlpha = pa;
      ctx.drawImage(S.logo, px + 10, py + 10, 40, 40);
      ctx.font = `600 22px ${FONT.sans}`;
      ctx.fillStyle = C.ink;
      ctx.textAlign = "left";
      ctx.fillText("Jugnu", px + 62, py + 27);
      ctx.font = `400 18px ${FONT.sans}`;
      ctx.fillStyle = C.ink2;
      ctx.fillText(`calling Sunita ji${".".repeat(1 + (Math.floor(t * 3) % 3))}`, px + 62, py + 48);
    }
    ctx.restore();
  }
}

function motes(ctx, t, a) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const m of S.motes) {
    const x = (m.x + t * m.sp * m.z) % W;
    const y = m.y + Math.sin(t * 0.7 + m.ph) * 30 * m.z;
    const s = 10 + 40 * m.z;
    ctx.globalAlpha = a * (0.15 + 0.25 * m.z) * (0.6 + 0.4 * Math.sin(t * 1.7 + m.ph));
    ctx.drawImage(S.gold, x - s / 2, y - s / 2, s, s);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the call
async function footage(ctx, t) {
  const reply = t >= Q.reply;
  const ft = reply ? 52.6 + (t - Q.reply) : 45.0 + (t - Q.call);
  await S.film.seekTo(ft);
  ctx.save();
  ctx.filter = "brightness(0.82) contrast(1.06) saturate(1.05)";
  const z = reply ? lerp(1.04, 1.1, prog(t, Q.reply, Q.spread)) : lerp(1.05, 1.13, prog(t, Q.call, Q.reply));
  cover(ctx, S.film, z);
  ctx.filter = "none";
  const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
  g.addColorStop(0, "rgba(4,6,10,0)");
  g.addColorStop(1, "rgba(4,6,10,0.88)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createLinearGradient(0, 0, 0, 220);
  g2.addColorStop(0, "rgba(4,6,10,0.6)");
  g2.addColorStop(1, "rgba(4,6,10,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, 220);
  ctx.restore();

  // call bar
  const speaking = t >= Q.teacher ? "teacher" : "jugnu";
  const env = ENV[speaking];
  const vt = t - (speaking === "teacher" ? Q.teacher : Q.jugnu);
  const bw = 820;
  const bx = (W - bw) / 2;
  const by = 56;
  const a = ease.out(prog(t, Q.call, Q.call + 0.4));
  glass(ctx, bx, by, bw, 96, 48, a);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.drawImage(S.logo, bx + 14, by + 14, 68, 68);
  ctx.textAlign = "left";
  ctx.font = `600 30px ${FONT.sans}`;
  ctx.fillStyle = C.ink;
  ctx.fillText("Jugnu", bx + 100, by + 44);
  ctx.font = `400 22px ${FONT.sans}`;
  ctx.fillStyle = C.ink2;
  ctx.fillText("Sunita ji · Grade 3 teacher · Hindi", bx + 100, by + 74);
  const secs = Math.max(0, Math.floor(t - Q.call)) + 2;
  ctx.font = `500 26px ${FONT.sans}`;
  ctx.fillStyle = C.ink2;
  ctx.textAlign = "right";
  ctx.fillText(`00:${String(secs).padStart(2, "0")}`, bx + bw - 30, by + 58);
  // live waveform
  const nb = 22;
  for (let i = 0; i < nb; i++) {
    const f = Math.floor((vt - (nb - i) * 0.02) * 30);
    const v = vt > 0 && f >= 0 && f < env.length ? env[f] : 0;
    const wob = 0.6 + 0.4 * Math.sin(i * 1.7 + t * 9);
    const h = 6 + 46 * v * wob;
    const x = bx + 470 + i * 9;
    ctx.fillStyle = speaking === "teacher" ? C.teal : i % 3 === 0 ? C.lime : C.y2;
    ctx.beginPath();
    ctx.roundRect(x, by + 48 - h / 2, 5, h, 3);
    ctx.fill();
  }
  ctx.restore();

  // captions
  const lines = speaking === "teacher" || t >= Q.teacher - 0.1 ? TEACHER_LINES.map((l) => [l, Q.teacher]) : JUGNU_LINES.map((l) => [l, Q.jugnu]);
  for (const [[a0, a1, hi, en], base] of lines) {
    const k = window_(t, base + a0 - 0.1, base + a1, 0.25, 0.2);
    if (k <= 0) continue;
    const who = speaking === "teacher" ? "SUNITA JI · TEACHER" : "JUGNU";
    line(ctx, who, W / 2, 862, k, k, { size: 20, weight: 600, font: FONT.sans, align: "center", tracking: 5, color: speaking === "teacher" ? C.teal : C.y1, rise: 6, blur: 4 });
    line(ctx, hi, W / 2, 930, k, k, { size: 50, weight: 600, font: FONT.deva, align: "center", rise: 10, blur: 6 });
    line(ctx, en, W / 2, 985, k, k, { size: 30, weight: 400, font: FONT.sans, align: "center", color: C.ink2, rise: 8, blur: 4 });
  }

  // what Jugnu heard
  const hk = window_(t, Q.teacher + 1.5, Q.spread + 0.05, 0.45, 0.15);
  if (hk > 0) {
    const cw = 470;
    const cx = W - cw - 70 + (1 - ease.out(hk)) * 60;
    const cy = 300;
    glass(ctx, cx, cy, cw, 196, 28, hk);
    ctx.save();
    ctx.globalAlpha = hk;
    ctx.textAlign = "left";
    ctx.font = `600 18px ${FONT.sans}`;
    ctx.letterSpacing = "4px";
    ctx.fillStyle = C.y1;
    ctx.fillText("JUGNU HEARD A PRACTICE", cx + 30, cy + 46);
    ctx.letterSpacing = "0px";
    ctx.font = `600 40px ${FONT.display}`;
    ctx.fillStyle = C.ink;
    ctx.fillText("Letter-card games", cx + 30, cy + 102);
    ctx.font = `400 22px ${FONT.sans}`;
    ctx.fillStyle = C.ink2;
    ctx.fillText("10 minutes · every day · costs nothing", cx + 30, cy + 142);
    ctx.fillStyle = C.ink3;
    ctx.font = `400 18px ${FONT.sans}`;
    ctx.fillText("Grade 3 · reading · Hindi", cx + 30, cy + 172);
    ctx.restore();
  }

  ctx.save();
  ctx.font = `400 15px ${FONT.sans}`;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.textAlign = "right";
  ctx.fillText("AI-generated footage · dramatised call", W - 40, H - 30);
  ctx.restore();
}

// ---------------------------------------------------------------- headline words
function words(ctx, t) {
  const X = 150;
  // 1,365 schools
  {
    const a = window_(t, Q.schools, Q.officers, 0.3, 0.3);
    if (a > 0) {
      const n = Math.round(1365 * ease.out(prog(t, Q.schools, Q.schools + 0.9)));
      line(ctx, "DAMOH DISTRICT · MADHYA PRADESH", X, 395, prog(t, Q.schools, Q.schools + 0.4), a, { size: 22, weight: 600, font: FONT.sans, tracking: 6, color: C.ink3, rise: 8, blur: 4 });
      line(ctx, n.toLocaleString("en-IN"), X - 8, 600, prog(t, Q.schools, Q.schools + 0.3), a, { size: 220, weight: 700, grad: true, tracking: -6, glow: "rgba(250,204,21,0.35)" });
      line(ctx, "government schools.", X, 690, prog(t, Q.schools + 0.25, Q.schools + 0.65), a, { size: 66, weight: 500 });
      line(ctx, "1,365 सरकारी स्कूल", X, 752, prog(t, Q.schools + 0.4, Q.schools + 0.8), a, { size: 34, weight: 400, font: FONT.deva, color: C.ink3, rise: 10 });
    }
  }
  // 7 officers
  {
    const a = window_(t, Q.officers, Q.cracked, 0.3, 0.3);
    if (a > 0) {
      line(ctx, "WHO WATCHES OVER THEM", X, 395, prog(t, Q.officers, Q.officers + 0.4), a, { size: 22, weight: 600, font: FONT.sans, tracking: 6, color: C.ink3, rise: 8, blur: 4 });
      line(ctx, "7", X - 6, 600, prog(t, Q.officers, Q.officers + 0.3), a, { size: 220, weight: 700, grad: true, glow: "rgba(250,204,21,0.35)" });
      line(ctx, "block officers.", X, 690, prog(t, Q.officers + 0.2, Q.officers + 0.6), a, { size: 66, weight: 500 });
      line(ctx, "up to 324 schools each · 7 ब्लॉक शिक्षा अधिकारी", X, 752, prog(t, Q.officers + 0.35, Q.officers + 0.75), a, { size: 30, weight: 400, font: FONT.deva, color: C.ink3, rise: 10 });
    }
  }
  // one teacher has cracked it
  {
    const a = window_(t, Q.cracked + 0.15, Q.nobody, 0.3, 0.3);
    if (a > 0) {
      line(ctx, "One teacher", X, 540, prog(t, Q.cracked + 0.15, Q.cracked + 0.55), a, { size: 112, weight: 600 });
      line(ctx, "has cracked it.", X, 660, prog(t, Q.cracked + 0.35, Q.cracked + 0.75), a, { size: 112, weight: 600, grad: true, glow: "rgba(250,204,21,0.3)" });
      line(ctx, "एक शिक्षिका ने रास्ता ढूँढ़ लिया है।", X, 735, prog(t, Q.cracked + 0.5, Q.cracked + 0.9), a, { size: 34, weight: 400, font: FONT.deva, color: C.ink3, rise: 10 });
    }
  }
  // nobody else knows
  {
    const a = window_(t, Q.nobody, Q.call, 0.3, 0.15);
    if (a > 0) {
      line(ctx, "Nobody else", X, 540, prog(t, Q.nobody, Q.nobody + 0.4), a, { size: 112, weight: 600 });
      line(ctx, "knows.", X, 660, prog(t, Q.nobody + 0.2, Q.nobody + 0.6), a, { size: 112, weight: 600, color: "rgba(255,255,255,0.55)" });
      line(ctx, "पर और किसी को पता नहीं।", X, 735, prog(t, Q.nobody + 0.35, Q.nobody + 0.75), a, { size: 34, weight: 400, font: FONT.deva, color: C.ink3, rise: 10 });
    }
  }
  // finds and carries
  {
    const s1 = Q.spread + 0.15;
    const s2 = Q.spread + 1.45;
    const a1 = window_(t, s1, s2, 0.3, 0.25);
    if (a1 > 0) {
      line(ctx, "Jugnu finds", X, 540, prog(t, s1, s1 + 0.4), a1, { size: 112, weight: 600 });
      line(ctx, "what works.", X, 660, prog(t, s1 + 0.2, s1 + 0.6), a1, { size: 112, weight: 600, grad: true, glow: "rgba(250,204,21,0.3)" });
    }
    const a2 = window_(t, s2, Q.logo + 0.1, 0.3, 0.25);
    if (a2 > 0) {
      line(ctx, "And carries it,", X, 540, prog(t, s2, s2 + 0.4), a2, { size: 112, weight: 600 });
      line(ctx, "school to school.", X, 660, prog(t, s2 + 0.2, s2 + 0.6), a2, { size: 112, weight: 600, grad: true, glow: "rgba(250,204,21,0.3)" });
    }
  }
}

mount(scene);
