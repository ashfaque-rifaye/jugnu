// Jugnu demo film: the compositor. Draws each frame from the edit (edit.json) as a pure function of time,
// like a Loom recording: the whole screen, full-frame, with soft transitions, captions, a panel of the agent's real
// steps, one architecture picture, and the phone rising beside the live console during the call.
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
function drawWindow(img, box, alpha, r) {
  g.save();
  g.globalAlpha = alpha;
  g.shadowColor = "rgba(15,23,42,.22)";
  g.shadowBlur = 44;
  g.shadowOffsetY = 18;
  g.fillStyle = "#fff";
  rounded(box.x, box.y, box.w, box.h, r);
  g.fill();
  g.shadowColor = "transparent";
  rounded(box.x, box.y, box.w, box.h, r);
  g.clip();
  g.imageSmoothingQuality = "high";
  g.drawImage(img, box.x, box.y, box.w, box.h);
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
  // One long line reads better than a last line of one word.
  const one = wrap(c.text, font, 1560);
  const all = one.length === 1 ? one : wrap(c.text, font, 1180);
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
// In the empty part of the app's top bar, clear of the chat panel.
// (Left of the chat panel and of the sign-in page's own links, when those are on screen.)
const chipRight = (text) => (text === "Chat agent" || text === "Choose your role" || text === "The real call" ? 1390 : 1880);
function drawChip(text, a) {
  const CHIP_RIGHT = chipRight(text);
  if (!text || a <= 0) return;
  g.save();
  g.globalAlpha = a;
  const font = `600 21px ${FONT.display}`;
  g.font = font;
  const w = g.measureText(text).width + 56;
  g.shadowColor = "rgba(15,23,42,.14)";
  g.shadowBlur = 16;
  g.fillStyle = "rgba(255,255,255,.95)";
  rounded(CHIP_RIGHT - w, 22, w, 42, 21);
  g.fill();
  g.shadowColor = "transparent";
  g.fillStyle = "#f59e0b";
  g.beginPath();
  g.arc(CHIP_RIGHT - w + 24, 43, 6, 0, 7);
  g.fill();
  g.fillStyle = INK;
  g.fillText(text, CHIP_RIGHT - w + 40, 50);
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
/** The agent's real steps so far in this scene, ticking in as they happen. */
function drawFlow(s, k, fade) {
  const done = s.flow.filter((f) => f.t <= k);
  if (!done.length) return;
  const shown = done.slice(-5);
  const W2 = 320;
  const rowH = 40;
  const h = 58 + shown.length * rowH + 10;
  const x = 22;
  const y = H - 22 - h;
  g.save();
  g.globalAlpha = fade * easeOut(prog(k, done[0].t, done[0].t + 0.3));
  g.shadowColor = "rgba(15,23,42,.22)";
  g.shadowBlur = 26;
  g.shadowOffsetY = 8;
  g.fillStyle = "rgba(255,255,255,.97)";
  rounded(x, y, W2, h, 18);
  g.fill();
  g.shadowColor = "transparent";
  g.font = `700 20px ${FONT.display}`;
  g.fillStyle = "#b45309";
  g.fillText("Agent at work", x + 18, y + 36);
  shown.forEach((f, i) => {
    const a = easeOut(prog(k, f.t, f.t + 0.25));
    const yy = y + 58 + i * rowH;
    g.globalAlpha = fade * a;
    g.fillStyle = "#16a34a";
    g.font = `700 18px ${FONT.sans}`;
    g.fillText("✓", x + 18, yy + 19 - (1 - a) * 6);
    g.fillStyle = INK;
    g.font = `600 16px ${FONT.sans}`;
    g.fillText(f.label, x + 42, yy + 13 - (1 - a) * 6);
    g.fillStyle = INK2;
    g.font = `500 13px ${FONT.sans}`;
    g.fillText(f.tech, x + 42, yy + 31 - (1 - a) * 6);
  });
  g.restore();
}

/** The architecture in one picture: who talks to the agent, how it works, what it can touch, what keeps it safe. */
function drawArch(s, t) {
  const k = t - s.start;
  const out = 1 - prog(k, s.dur - OVERLAP, s.dur);
  const box = (x, y, w, h, title, lines, opts = {}) => {
    const a = easeOut(prog(k, opts.at ?? 0, (opts.at ?? 0) + 0.45));
    g.save();
    g.globalAlpha = a * out;
    const dy = (1 - a) * 18;
    g.shadowColor = "rgba(15,23,42,.13)";
    g.shadowBlur = 22;
    g.shadowOffsetY = 7;
    g.fillStyle = opts.fill ?? "#fff";
    rounded(x, y + dy, w, h, 20);
    g.fill();
    g.shadowColor = "transparent";
    if (opts.line) {
      g.strokeStyle = opts.line;
      g.lineWidth = 3;
      rounded(x, y + dy, w, h, 20);
      g.stroke();
    }
    g.fillStyle = opts.ink ?? INK;
    g.font = `700 ${opts.size ?? 27}px ${FONT.display}`;
    g.fillText(title, x + 24, y + dy + (opts.size ?? 27) + 16);
    g.font = `500 ${opts.small ?? 20}px ${FONT.sans}`;
    g.fillStyle = opts.ink2 ?? INK2;
    lines.forEach((l, i) => g.fillText(l, x + 24, y + dy + (opts.size ?? 27) + 50 + i * ((opts.small ?? 20) + 9)));
    g.restore();
  };
  const arrow = (x1, y1, x2, y2, at) => {
    const a = prog(k, at, at + 0.4);
    if (!a) return;
    const x = x1 + (x2 - x1) * easeOut(a);
    const y = y1 + (y2 - y1) * easeOut(a);
    g.save();
    g.globalAlpha = out;
    g.strokeStyle = "#d97706";
    g.fillStyle = "#d97706";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x, y);
    g.stroke();
    const ang = Math.atan2(y2 - y1, x2 - x1);
    g.beginPath();
    g.moveTo(x + Math.cos(ang) * 4, y + Math.sin(ang) * 4);
    g.lineTo(x - Math.cos(ang - 0.5) * 15, y - Math.sin(ang - 0.5) * 15);
    g.lineTo(x - Math.cos(ang + 0.5) * 15, y - Math.sin(ang + 0.5) * 15);
    g.closePath();
    g.fill();
    g.restore();
  };
  g.save();
  g.globalAlpha = easeOut(prog(k, 0, 0.3)) * out;
  g.drawImage(back, 0, 0);
  g.fillStyle = INK;
  g.font = `700 54px ${FONT.display}`;
  g.fillText("The agent behind Jugnu", 70, 92);
  g.restore();
  // Who talks to it
  box(70, 150, 340, 138, "Officer", ["Voice or chat, in", "Hindi or English"], { at: 0.05 });
  box(70, 306, 340, 138, "Coordinator", ["Visits, follow-ups,", "the shared board"], { at: 0.15 });
  box(70, 462, 340, 138, "Teacher", ["Any phone, no app,", "own language"], { at: 0.25 });
  arrow(418, 375, 492, 375, 0.5);
  // The loop
  box(500, 150, 520, 450, "Claude agent", [], { at: 0.35, fill: "#0f172a", ink: "#fff", size: 36 });
  const steps = ["Understand", "Plan", "Call tools", "Check, then reply"];
  const live = Math.floor(k * 2.4) % 4;
  steps.forEach((label, i) => {
    const a = easeOut(prog(k, 0.55 + i * 0.12, 0.85 + i * 0.12));
    g.save();
    g.globalAlpha = a * out;
    const y = 232 + i * 72;
    g.fillStyle = i === live ? "#facc15" : "rgba(255,255,255,.12)";
    rounded(528, y, 464, 58, 29);
    g.fill();
    g.fillStyle = i === live ? "#0f172a" : "#fff";
    g.font = `600 26px ${FONT.sans}`;
    g.fillText(`${i + 1}   ${label}`, 556, y + 38);
    g.restore();
  });
  g.save();
  g.globalAlpha = easeOut(prog(k, 0.9, 1.2)) * out;
  g.font = `500 18px ${FONT.sans}`;
  g.fillStyle = "#cbd5e1";
  g.fillText("Sonnet 5.5 for the agent · Haiku 5.5 for interviews", 528, 584);
  g.restore();
  arrow(1028, 375, 1102, 375, 0.8);
  // What it can touch
  box(1110, 150, 740, 138, "Reads the block", ["find_schools · school_detail · practice_evidence", "contrast_pairs · what_if · pilot_interviews"], { at: 0.9 });
  box(1110, 306, 740, 138, "Works the screen", ["go_to · open_school · show_on_map", "point_at · click · fill · record"], { at: 1.05 });
  box(1110, 462, 740, 138, "Acts for the officer", ["dial_teacher · move_action", "schedule_followup · escalate_to_beo"], { at: 1.2 });
  // What keeps it safe
  const safe = [["Guardrails", "check every answer"], ["Offline fallback", "if the AI is unavailable"], ["People approve", "what reaches teachers"], ["Every AI call", "traced and logged"]];
  safe.forEach(([a, b], i) => box(70 + i * 450, 626, 430, 112, a, [b], { at: 1.4 + i * 0.1, fill: "#fffbeb", line: "#fbbf24", size: 26, small: 20 }));
  // What it runs on
  const base = ["Google Chirp 3 speech", "Phone line: Plivo, Exotel", "Turso shared log", "UDISE+ real school data"];
  g.save();
  g.globalAlpha = easeOut(prog(k, 1.8, 2.2)) * out;
  base.forEach((b, i) => {
    g.fillStyle = "rgba(15,23,42,.06)";
    rounded(70 + i * 450, 764, 430, 64, 32);
    g.fill();
    g.fillStyle = INK;
    g.font = `600 22px ${FONT.sans}`;
    g.textAlign = "center";
    g.fillText(b, 70 + i * 450 + 215, 804);
    g.textAlign = "left";
  });
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
const FULL = { x: 0, y: 0, w: 1920, h: 1080 };
// Takes recorded before the orb changed show the app's current orb in its place.
const OLD_ORB = new Set(["dry1", "plan", "call-failed-no-balance", "line"]);
const src = await (await fetch("/src/components/Orb.tsx")).text();
const orbFrag = /const FRAG = `([\s\S]*?)`;/.exec(src)[1];
const orbCanvas = document.createElement("canvas");
orbCanvas.width = orbCanvas.height = 240;
const ogl = orbCanvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true });
{
  const p = ogl.createProgram();
  for (const [ty, s] of [[ogl.VERTEX_SHADER, "attribute vec2 q;void main(){gl_Position=vec4(q,0.,1.);}"], [ogl.FRAGMENT_SHADER, orbFrag]]) {
    const sh = ogl.createShader(ty);
    ogl.shaderSource(sh, s);
    ogl.compileShader(sh);
    ogl.attachShader(p, sh);
  }
  ogl.linkProgram(p);
  ogl.useProgram(p);
  ogl.bindBuffer(ogl.ARRAY_BUFFER, ogl.createBuffer());
  ogl.bufferData(ogl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), ogl.STATIC_DRAW);
  const l = ogl.getAttribLocation(p, "q");
  ogl.enableVertexAttribArray(l);
  ogl.vertexAttribPointer(l, 2, ogl.FLOAT, false, 0, 0);
  ogl.uniform2f(ogl.getUniformLocation(p, "uRes"), 240, 240);
  ogl.uniform3fv(ogl.getUniformLocation(p, "uC"), [0.99, 0.8, 0.1, 0.55, 0.85, 0.15, 0.1, 0.78, 0.7, 0.2, 0.6, 0.97]);
  ogl.clearColor(0, 0, 0, 0);
  window.__orbU = { t: ogl.getUniformLocation(p, "uT"), a: ogl.getUniformLocation(p, "uAmp") };
}
function drawOrbOver(t, box, alpha) {
  const k = box.w / 1600;
  const cx = box.x + 1550 * k;
  const cy = box.y + 850 * k;
  ogl.uniform1f(window.__orbU.t, t);
  ogl.uniform1f(window.__orbU.a, 0);
  ogl.clear(ogl.COLOR_BUFFER_BIT);
  ogl.drawArrays(ogl.TRIANGLE_STRIP, 0, 4);
  g.save();
  g.globalAlpha = alpha;
  // Soften the older orb underneath, then place the current one.
  const under = g.createRadialGradient(cx, cy, 20 * k, cx, cy, 40 * k);
  under.addColorStop(0, "rgba(247,250,246,1)");
  under.addColorStop(0.75, "rgba(247,250,246,.95)");
  under.addColorStop(1, "rgba(247,250,246,0)");
  g.fillStyle = under;
  g.beginPath();
  g.arc(cx, cy, 40 * k, 0, 7);
  g.fill();
  const size = 82 * k;
  g.drawImage(orbCanvas, cx - size / 2, cy - size / 2, size, size);
  g.restore();
}
function drawPatch(shot, srcAt, img, box, alpha) {
  if (!shot.patch || srcAt > shot.patch.until || !img) return;
  const k = img.width / 1600;
  const K = box.w / 1600;
  g.save();
  g.globalAlpha = alpha;
  for (const [x, y, w, h] of shot.patch.rects) g.drawImage(img, x * k, y * k, w * k, h * k, box.x + x * K, box.y + y * K, w * K, h * K);
  g.restore();
}
/** How the note reaches a teacher on WhatsApp. A simulation, and marked as one. */
function drawWhatsApp(s, t) {
  const k = t - s.start;
  const out = 1 - prog(k, s.dur - OVERLAP, s.dur);
  const inn = easeOut(prog(k, 0, 0.4));
  g.save();
  g.globalAlpha = inn * out;
  g.drawImage(back, 0, 0);
  // The words beside it
  g.fillStyle = INK;
  g.font = `700 60px ${FONT.display}`;
  g.fillText("Reaches every teacher", 130, 372);
  g.fillText("on WhatsApp", 130, 444);
  g.font = `500 28px ${FONT.sans}`;
  g.fillStyle = INK2;
  g.fillText("A 60-second voice note from a nearby teacher,", 130, 512);
  g.fillText("in the teacher's own language.", 130, 552);
  g.fillText("Their reply moves the task on the shared board.", 130, 592);
  g.fillStyle = "#fef3c7";
  rounded(130, 632, 610, 56, 28);
  g.fill();
  g.strokeStyle = "#f59e0b";
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = "#92400e";
  g.font = `600 24px ${FONT.sans}`;
  g.fillText("Simulated: built, connection in progress", 160, 668);
  // The phone
  const W2 = 410;
  const H2 = 860;
  const rise = spring(prog(k, 0.05, 1.1));
  const px = 1230;
  const py = 110 + (1 - rise) * 800;
  g.shadowColor = "rgba(15,23,42,.35)";
  g.shadowBlur = 50;
  g.shadowOffsetY = 22;
  g.fillStyle = "#0b0f14";
  rounded(px, py, W2, H2, 56);
  g.fill();
  g.shadowColor = "transparent";
  g.save();
  rounded(px + 12, py + 12, W2 - 24, H2 - 24, 46);
  g.clip();
  g.fillStyle = "#ece5dd";
  g.fillRect(px, py, W2, H2);
  g.fillStyle = "#075e54";
  g.fillRect(px, py, W2, 118);
  g.fillStyle = "#fff";
  g.font = `600 23px ${FONT.sans}`;
  g.fillText("Kailash Kurmi", px + 40, py + 76);
  g.font = `400 16px ${FONT.sans}`;
  g.fillStyle = "rgba(255,255,255,.85)";
  g.fillText("Teacher, GPS Pipariya Sunar", px + 40, py + 100);
  const bubble = (x, y, w, h, fill, at) => {
    const a = easeOut(prog(k, at, at + 0.35));
    if (!a) return 0;
    g.globalAlpha = a * inn * out;
    g.fillStyle = fill;
    rounded(x, y + (1 - a) * 14, w, h, 14);
    g.fill();
    return a;
  };
  // The voice note
  const vy = py + 150;
  if (bubble(px + 28, vy, 320, 96, "#fff", 0.9)) {
    g.fillStyle = "#075e54";
    g.beginPath();
    g.moveTo(px + 50, vy + 32);
    g.lineTo(px + 50, vy + 64);
    g.lineTo(px + 76, vy + 48);
    g.closePath();
    g.fill();
    const played = clamp((k - 1.2) / 2.6);
    for (let i = 0; i < 26; i++) {
      const h = 8 + 24 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6));
      g.fillStyle = i / 26 < played ? "#075e54" : "#b6c2bd";
      g.fillRect(px + 92 + i * 9, vy + 48 - h / 2, 5, h);
    }
    g.fillStyle = INK2;
    g.font = `400 15px ${FONT.sans}`;
    g.fillText("Voice note · 0:58", px + 92, vy + 86);
  }
  // Its words
  if (bubble(px + 28, vy + 110, 320, 150, "#fff", 1.5)) {
    g.fillStyle = INK;
    g.font = `400 18px ${FONT.sans}`;
    ["“Every day for the first 45", "minutes, we group children by", "level, not class. Devendra Singh", "ji will bring you to see it.”"].forEach((l, i) => g.fillText(l, px + 44, vy + 146 + i * 27));
  }
  // The teacher's reply
  if (bubble(px + 92, vy + 276, 280, 62, "#dcf8c6", 2.8)) {
    g.fillStyle = INK;
    g.font = `400 18px ${FONT.sans}`;
    g.fillText("Tried it today, it's working 👍", px + 108, vy + 314);
  }
  // The board moves
  if (bubble(px + 36, vy + 356, 338, 52, "rgba(7,94,84,.92)", 3.8)) {
    g.fillStyle = "#fff";
    g.font = `600 17px ${FONT.sans}`;
    g.fillText("✓ Board updated: Trying it", px + 70, vy + 389);
  }
  g.restore();
  g.restore();
}
const SPLIT = { x: 44, y: 150, w: 1364, h: 767 };
async function draw(i) {
  const t = i / FPS;
  const live = edit.shots.filter((s) => t >= s.start && t <= s.start + s.dur);
  const screens = live.filter((s) => s.kind === "screen");
  const images = await Promise.all(screens.map((s) => bitmap(frameAt(s.take, sourceAt(s, t - s.start)))));
  const patches = await Promise.all(screens.map((s) => (s.patch && sourceAt(s, t - s.start) <= s.patch.until ? bitmap(s.patch.img) : null)));
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
    const scale = 1;
    const base = {
      x: FULL.x + (SPLIT.x - FULL.x) * split,
      y: FULL.y + (SPLIT.y - FULL.y) * split,
      w: FULL.w + (SPLIT.w - FULL.w) * split,
      h: FULL.h + (SPLIT.h - FULL.h) * split,
    };
    const box = { x: base.x + (base.w * (1 - scale)) / 2, y: base.y + (base.h * (1 - scale)) / 2, w: base.w * scale, h: base.h * scale };
    drawWindow(images[n], box, fade, 18 * split);
    drawPatch(s, sourceAt(s, k), patches[n], box, fade);
    if (OLD_ORB.has(s.take)) drawOrbOver(t, box, fade);
    if (s.flow?.length) drawFlow(s, k, fade);
    if (s.phone) {
      const rise = spring(prog(k, 0.5, 1.9));
      const out = easeInOut(prog(k, s.dur - 1, s.dur - 0.2));
      const float = Math.sin(k * 1.1) * 5;
      drawPhone(phoneImg, 1458, 120 + (1 - rise) * 900 + out * 900 + float, (1 - rise) * 0.12 + Math.sin(k * 0.7) * 0.006, fade);
    }
    drawChip(s.chapter, fade * clamp((k - 0.2) / 0.3));
  });
  for (const s of live) if (s.kind === "arch") drawArch(s, t);
  for (const s of live) if (s.kind === "whatsapp") drawWhatsApp(s, t);
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
