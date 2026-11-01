// The edit: turns the recorded takes into a timeline (edit.json) and a sound mix (mix.wav), beside the takes.
// Waiting is sped up, speech plays at its true speed, and the camera follows what the agent and the pointer touch.
//   node demo/edit.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAKES = process.env.DEMO_TAKES ?? "E:/jugnu-takes";
const FPS = 30;
const W = 1600;
const H = 900;
const lines = JSON.parse(readFileSync(join(ROOT, "demo/voice/lines.json"), "utf8"));

const clipFile = (name) => [".wav", ".m4a", ".mp3", ".ogg", ".aac", ".webm"].map((e) => join(ROOT, "demo/voice", name + e)).find(existsSync) ?? join(ROOT, "demo/voice/placeholder", name + ".mp3");
const length = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());

const cache = {};
function take(name) {
  if (cache[name]) return cache[name];
  const dir = join(TAKES, name);
  if (!existsSync(join(dir, "frames.json"))) return null;
  const frames = JSON.parse(readFileSync(join(dir, "frames.json"), "utf8"));
  const log = JSON.parse(readFileSync(join(dir, "events.json"), "utf8"));
  const marks = Object.fromEntries(log.events.filter((e) => e.kind === "mark").map((e) => [e.name, e.at]));
  // One seekable copy of the take's sound.
  const wav = join(dir, "audio.wav");
  if (existsSync(join(dir, "audio.webm")) && !existsSync(wav)) spawnSync("ffmpeg", ["-v", "error", "-y", "-i", join(dir, "audio.webm"), "-ar", "48000", "-ac", "2", wav]);
  cache[name] = { name, frames, marks, tapStarted: log.tapStarted, events: log.events, page: log.pageEvents ?? [], first: frames[0].at, last: frames.at(-1).at, wav };
  return cache[name];
}

// ---------------------------------------------------------------- the timeline
const shots = [];
const cues = [];
let now = 0;
const OVERLAP = 0.45;

function card(n, title) {
  shots.push({ kind: "card", start: now, dur: 1.5, n, title });
  now += 1.5 - OVERLAP;
}

/** Where the camera wants to be, from what was touched during this stretch of the take. */
function focusList(t, a, b, extra = []) {
  const hits = [
    ...t.events.filter((e) => e.kind === "focus"),
    ...t.page.filter((e) => e.kind === "light"),
    ...extra,
  ].filter((e) => e.at >= a && e.at <= b && e.w > 0);
  return hits.sort((x, y) => x.at - y.at);
}

/** The screen plays from a to b fitted to `dur` seconds (narration over a walk through the pages). */
function fit(t, a, b, dur, opts = {}) {
  const shot = { kind: "screen", take: t.name, start: now, dur, map: [[0, a, dur, b]], ...opts };
  shot.focus = focusList(t, a, b).map((e) => ({ t: ((e.at - a) / (b - a)) * dur, x: e.x, y: e.y, w: e.w, h: e.h }));
  shots.push(shot);
  now += dur - OVERLAP;
  return shot;
}

/** The screen plays at true speed while anyone speaks or the agent acts; waiting between is sped up. */
function live(t, a, b, opts = {}) {
  const busy = [];
  for (const e of t.page) {
    if (e.kind === "speak" || e.kind === "play") busy.push([e.at - 250, e.at + e.ms + 350]);
    if (e.kind === "light") busy.push([e.at - 500, e.at + 1700]);
  }
  for (const e of t.events) if (e.kind === "type") busy.push([e.at - 300, e.at + (e.text?.length ?? 0) * 42 + 1200]);
  const inside = busy.map(([x, y]) => [Math.max(a, x), Math.min(b, y)]).filter(([x, y]) => y > x).sort((p, q) => p[0] - q[0]);
  const merged = [];
  for (const r of inside) {
    if (merged.length && r[0] <= merged.at(-1)[1] + 400) merged.at(-1)[1] = Math.max(merged.at(-1)[1], r[1]);
    else merged.push([...r]);
  }
  const SPEED = opts.speed ?? 5;
  const map = [];
  const start = now;
  let tt = 0;
  let src = a;
  const step = (s0, s1, speed) => {
    const d = (s1 - s0) / 1000 / speed;
    if (d <= 0) return;
    map.push([tt, s0, tt + d, s1, speed]);
    tt += d;
  };
  for (const [x, y] of merged) {
    step(src, x, SPEED);
    if (t.tapStarted) cues.push({ file: t.wav, ss: (x - t.tapStarted) / 1000, dur: (y - x) / 1000, at: start + tt, vol: 1, fade: 0.08 });
    step(x, y, 1);
    src = y;
  }
  step(src, b, SPEED);
  const shot = { kind: "screen", take: t.name, start, dur: tt, map, ...opts };
  const inEdit = (at) => {
    const m = map.find((p) => at >= p[1] && at <= p[3]) ?? map.at(-1);
    return m[0] + ((at - m[1]) / (m[3] - m[1] || 1)) * (m[2] - m[0]);
  };
  shot.focus = focusList(t, a, b, opts.extraFocus ?? []).map((e) => ({ t: inEdit(e.at), x: e.x, y: e.y, w: e.w, h: e.h }));
  shots.push(shot);
  now += tt - OVERLAP;
  return shot;
}

function say(name, at, text = lines[name]) {
  const file = clipFile(name);
  const dur = length(file);
  cues.push({ file, at, ss: 0, dur, vol: 1, narration: true });
  return { t0: at, t1: at + dur, text };
}
const caps = [];
const narrate = (name, at) => {
  const c = say(name, at);
  caps.push(c);
  return c.t1 - c.t0;
};
/** Lines spoken into the app are in its sound already: they only need a caption. */
function voiceCaptions(t, shot, names) {
  const spoken = t.page.filter((e) => e.kind === "speak");
  spoken.forEach((e, i) => {
    if (!names[i]) return;
    const m = shot.map.find((p) => e.at >= p[1] && e.at <= p[3]);
    if (!m) return;
    const t0 = shot.start + m[0] + ((e.at - m[1]) / (m[3] - m[1])) * (m[2] - m[0]);
    caps.push({ t0, t1: t0 + e.ms / 1000, text: `“${lines[names[i]]}”`, who: "Officer" });
  });
}

const tour = take("tour");
const voice = take("call") ?? take("dry1");
const plan = take("plan");
const m = tour?.marks;

if (tour) {
  // 1. The idea
  card(1, "The idea");
  let d = length(clipFile("N1")) + 0.5;
  narrate("N1", now + 0.3);
  fit(tour, m.home, m.find, d, { chapter: "The idea", zoomless: true });
  // 2. How it finds them
  card(2, "How it finds schools");
  d = length(clipFile("N2")) + 0.6;
  narrate("N2", now + 0.3);
  fit(tour, m.find, m.rollout, d, { chapter: "How it finds schools" });
}
if (voice) {
  // 3. Ask by voice
  card(3, "Ask by voice");
  const vm = voice.marks;
  const d = length(clipFile("N3")) + 0.5;
  narrate("N3", now + 0.25);
  fit(voice, voice.first, Math.min(voice.first + 900, vm.v1), d, { chapter: "Ask by voice" });
  const s = live(voice, vm.v1, vm.ringing ?? vm.end, { chapter: "Ask by voice" });
  voiceCaptions(voice, s, ["V1", "V2", "V3"]);
}
const callInfo = voice?.marks.ringing && existsSync(join(TAKES, "call/call.json")) ? JSON.parse(readFileSync(join(TAKES, "call/call.json"), "utf8")) : null;
if (callInfo) {
  // 4. The real call: the live console beside the phone, cut to the best moments.
  card(4, "The real call");
  const start = now;
  const t0Call = Date.parse(callInfo.started);
  const ring = voice.marks.ringing;
  const windows = callInfo.pick.map(([i, j]) => [t0Call + callInfo.spoken[i].atMs - 150, t0Call + (callInfo.spoken[j]?.atMs ?? callInfo.endMs) - 100]);
  const map = [];
  let tt = 0;
  const ringTo = Math.min(t0Call, ring + 6000);
  // The phone rises and rings under the narration, ahead of the first words.
  tt = length(clipFile("N4")) + 0.5;
  map.push([0, ring, tt, ringTo, 1]);
  narrate("N4", start + 0.3);
  for (const [a, b] of windows) {
    cues.push({ file: join(TAKES, "call/call.wav"), ss: (a - t0Call) / 1000, dur: (b - a) / 1000, at: start + tt, vol: 1.4, fade: 0.08 });
    for (const c of callInfo.captions ?? []) {
      const at = t0Call + c.atMs;
      if (at >= a && at < b) caps.push({ t0: start + tt + (at - a) / 1000, t1: start + tt + Math.min((b - at) / 1000, c.ms / 1000), text: c.text, who: c.who });
    }
    map.push([tt, a, tt + (b - a) / 1000, b, 1]);
    tt += (b - a) / 1000;
  }
  const tail = [voice.marks.end - 7000, voice.marks.end];
  map.push([tt, tail[0], tt + 3, tail[1], 2.3]);
  tt += 3;
  shots.push({ kind: "screen", take: voice.name, start, dur: tt, map, focus: [], chapter: "The real call", phone: true });
  now += tt - OVERLAP;
}
if (plan) {
  const pm = plan.marks;
  // 5. What it learned
  card(5, "What it learned");
  const s5 = live(plan, pm.v4, pm.chat, { chapter: "What it learned", speed: 6 });
  voiceCaptions(plan, s5, ["V4"]);
  const d5 = length(clipFile("N5")) + 0.5;
  narrate("N5", now + 0.25);
  fit(plan, pm.chat - 2500, pm.chat, d5, { chapter: "What it learned", speedHold: true });
  // 6. The action plan: chat agent first
  card(6, "The action plan");
  live(plan, pm.chat, pm.close, { chapter: "The action plan", speed: 6, extraFocus: [{ at: pm.chat + 1500, x: 1165, y: 15, w: 420, h: 800 }] });
}
if (tour) {
  const d6 = length(clipFile("N6")) + 0.6;
  narrate("N6", now + 0.25);
  fit(tour, m.rollout, m.board, d6, { chapter: "The action plan" });
  card(7, "Working together");
  const d7 = length(clipFile("N7")) + 0.6;
  narrate("N7", now + 0.25);
  fit(tour, m.board, m.district, d7, { chapter: "Working together" });
}
if (plan) {
  card(8, "Across blocks");
  const s8 = live(plan, plan.marks.v5, plan.marks.end, { chapter: "Across blocks", speed: 6 });
  voiceCaptions(plan, s8, ["V5"]);
} else if (tour) card(8, "Across blocks");
if (tour) {
  const d8 = length(clipFile("N8")) + 0.6;
  narrate("N8", now + 0.25);
  fit(tour, m.district, m.end, d8, { chapter: "Across blocks" });
  // Close
  const d9 = length(clipFile("N9")) + 1.2;
  narrate("N9", now + 0.7);
  shots.push({ kind: "end", start: now, dur: d9 + OVERLAP });
  now += d9 + OVERLAP;
}
const duration = now;

// ---------------------------------------------------------------- the camera: a smooth path through each shot
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
for (const s of shots) {
  if (s.kind !== "screen") continue;
  const n = Math.ceil(s.dur * FPS) + 1;
  const path = [];
  const focus = s.zoomless ? [] : s.focus ?? [];
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    const here = [...focus].reverse().find((f) => f.t <= t + 0.25 && t - f.t < 2.6);
    if (here) {
      const z = clamp(Math.min((W * 0.62) / Math.max(here.w, 60), (H * 0.62) / Math.max(here.h, 60)), 1.2, 1.75);
      path.push([here.x + here.w / 2, here.y + here.h / 2, z]);
    } else path.push([W / 2, H / 2, 1]);
  }
  // Glide: smooth forwards and backwards, so moves ease in and out with no lag.
  const k = 1 - Math.exp(-1 / (FPS * 0.32));
  for (let pass = 0; pass < 2; pass++) {
    for (const dir of [1, -1]) {
      const cur = [...path[dir > 0 ? 0 : n - 1]];
      for (let j = 0; j < n; j++) {
        const i = dir > 0 ? j : n - 1 - j;
        for (const c of [0, 1, 2]) {
          cur[c] += (path[i][c] - cur[c]) * k;
          path[i][c] = cur[c];
        }
      }
    }
  }
  s.cam = path.map(([x, y, z]) => {
    const hw = W / 2 / z;
    const hh = H / 2 / z;
    return [Math.round(clamp(x, hw, W - hw) * 10) / 10, Math.round(clamp(y, hh, H - hh) * 10) / 10, Math.round(z * 1000) / 1000];
  });
}

// Which frames each take needs is decided by the page; it gets each take's frame times.
const frameTimes = {};
for (const s of shots) if (s.take && !frameTimes[s.take]) frameTimes[s.take] = take(s.take).frames.map((f) => f.at);
writeFileSync(join(TAKES, "edit.json"), JSON.stringify({ fps: FPS, duration, shots, caps, frameTimes, phone: existsSync(join(TAKES, "phone/frames.json")) ? JSON.parse(readFileSync(join(TAKES, "phone/frames.json"), "utf8")) : null }));
console.log(`duration ${duration.toFixed(1)} s, ${shots.length} shots, ${cues.length} sound cues`);
for (const s of shots) console.log(s.start.toFixed(1).padStart(7), s.kind.padEnd(7), s.dur.toFixed(1).padStart(6), s.title ?? s.chapter ?? "", s.take ?? "", s.focus?.length ? `${s.focus.length} zooms` : "");

// ---------------------------------------------------------------- the sound
const ok = cues.filter((c) => existsSync(c.file) && c.dur > 0.05);
const args = ["-v", "error", "-y"];
const parts = [];
ok.forEach((c, i) => {
  args.push("-ss", String(Math.max(0, c.ss)), "-t", String(c.dur), "-i", c.file);
  const fade = c.fade ? `,afade=t=in:d=${c.fade},afade=t=out:st=${Math.max(0, c.dur - c.fade)}:d=${c.fade}` : "";
  parts.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${c.vol}${fade},adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`);
});
const bed = join(TAKES, "bed.wav");
let labels = ok.map((_, i) => `[a${i}]`).join("");
let count = ok.length;
if (existsSync(bed)) {
  args.push("-stream_loop", "-1", "-t", String(duration), "-i", bed);
  parts.push(`[${ok.length}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.11,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, duration - 3)}:d=3[bed]`);
  labels += "[bed]";
  count++;
}
const graph = `${parts.join(";")};${labels}amix=inputs=${count}:normalize=0:duration=longest,alimiter=limit=0.95,apad=whole_dur=${duration}[out]`;
args.push("-filter_complex", graph, "-map", "[out]", "-t", String(duration), "-ar", "48000", join(TAKES, "mix.wav"));
const r = spawnSync("ffmpeg", args, { encoding: "utf8", maxBuffer: 1 << 26 });
console.log(r.status === 0 ? "mix ok" : `mix failed: ${r.stderr.slice(0, 500)}`);
