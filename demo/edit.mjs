// The edit: turns the recorded takes into a timeline (edit.json) and a sound mix (mix.wav), beside the takes.
// Waiting is sped up, speech plays at its true speed, and the camera follows what the agent and the pointer touch.
// The whole film, with the intro and outro, must stay under 3 minutes: this prints where it stands.
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
const LIMIT = 178; // seconds, intro and outro included
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
  if (existsSync(join(dir, "audio.webm"))) spawnSync("ffmpeg", ["-v", "error", "-y", "-i", join(dir, "audio.webm"), "-ar", "48000", "-ac", "2", wav]);
  cache[name] = { name, frames, marks, tapStarted: log.tapStarted, events: log.events, page: log.pageEvents ?? [], first: frames[0].at, last: frames.at(-1).at, wav };
  return cache[name];
}

// ---------------------------------------------------------------- the timeline
const shots = [];
const cues = [];
const caps = [];
let now = 0;
const OVERLAP = 0.35;

/** Where the camera wants to be, from what was touched during this stretch of the take. */
function focusList(t, a, b, extra = []) {
  const hits = [...t.events.filter((e) => e.kind === "focus"), ...t.page.filter((e) => e.kind === "light"), ...extra].filter((e) => e.at >= a && e.at <= b && e.w > 0);
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

/**
 * True speed while the officer speaks, Jugnu's first sentences are spoken (up to `replies[n]` seconds, whole
 * sentences only) or the agent lights something up; everything else is sped up to land on `maxDur` seconds.
 */
function live(t, a, b, opts = {}) {
  const busy = [];
  const quietPlays = t.page.filter((e) => e.kind === "play" && e.at >= a && e.at <= b);
  // Sentences close together belong to one reply.
  const replies = [];
  for (const e of quietPlays) {
    const last = replies.at(-1);
    if (last && e.at - (last.at(-1).at + last.at(-1).ms) < 900) last.push(e);
    else replies.push([e]);
  }
  replies.forEach((r, n) => {
    const budget = (opts.replies?.[n] ?? opts.replies?.at?.(-1) ?? 6) * 1000;
    let used = 0;
    for (const e of r) {
      if (used && used + e.ms > budget) break;
      busy.push([e.at - 120, e.at + e.ms + 150]);
      used += e.ms;
    }
  });
  for (const e of t.page) {
    if (e.kind === "speak" && e.at >= a && e.at <= b) busy.push([e.at - 150, e.at + e.ms + 200]);
    if (e.kind === "light" && e.at >= a && e.at <= b) busy.push([e.at - 250, e.at + 900]);
  }
  const inside = busy.map(([x, y]) => [Math.max(a, x), Math.min(b, y)]).filter(([x, y]) => y > x).sort((p, q) => p[0] - q[0]);
  const merged = [];
  for (const r of inside) {
    if (merged.length && r[0] <= merged.at(-1)[1] + 250) merged.at(-1)[1] = Math.max(merged.at(-1)[1], r[1]);
    else merged.push([...r]);
  }
  const busySecs = merged.reduce((s, [x, y]) => s + (y - x) / 1000, 0);
  const gapSecs = (b - a) / 1000 - busySecs;
  const room = Math.max(0.6, (opts.maxDur ?? busySecs + gapSecs / 8) - busySecs);
  const SPEED = Math.max(2, gapSecs / room);
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
    if (t.tapStarted) cues.push({ file: t.wav, ss: (x - t.tapStarted) / 1000, dur: (y - x) / 1000, at: start + tt, vol: 1, fade: 0.06 });
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

const narrate = (name, at) => {
  const file = clipFile(name);
  const dur = length(file);
  cues.push({ file, at, ss: 0, dur, vol: 1 });
  caps.push({ t0: at, t1: at + dur, text: lines[name] });
  return dur;
};
/** Lines spoken into the app are in its sound already: they only need a caption. */
function voiceCaptions(t, shot, names) {
  t.page.filter((e) => e.kind === "speak").forEach((e, i) => {
    const m = shot.map.find((p) => e.at >= p[1] && e.at <= p[3]);
    if (!names[i] || !m) return;
    const t0 = shot.start + m[0] + ((e.at - m[1]) / (m[3] - m[1])) * (m[2] - m[0]);
    caps.push({ t0, t1: t0 + e.ms / 1000, text: `“${lines[names[i]]}”`, who: "Officer" });
  });
}

const tour = take("tour");
const voice = take("call") ?? take("dry1");
// Claude's limit stopped the agent before it could place the kept call, so V3 comes from the take where it dialled
// (that dial was refused for lack of balance; the shot ends before its reply) and the call from the phone line take.
const v3Take = voice?.marks.v3 ? null : take("call-failed-no-balance");
const lineTake = take("line");
const plan = take("plan");
const m = tour?.marks;
const callInfo = existsSync(join(TAKES, "call/call.json")) ? JSON.parse(readFileSync(join(TAKES, "call/call.json"), "utf8")) : null;

if (tour) {
  // What the USP is
  let d = length(clipFile("N1")) + 0.35;
  narrate("N1", now + 0.15);
  fit(tour, m.home, m.find, d, { chapter: "The idea", zoomless: true });
  // How it works
  d = length(clipFile("N2")) + 0.35;
  narrate("N2", now + 0.15);
  fit(tour, m.find, m.rollout, d, { chapter: "How it works" });
}
if (voice) {
  // The voice agent acting on screen
  const vm = voice.marks;
  const d = length(clipFile("N3")) + 0.25;
  narrate("N3", now + 0.1);
  fit(voice, voice.first, Math.min(voice.first + 900, vm.v1), d, { chapter: "Voice agent" });
  const s = live(voice, vm.v1, vm.ringing ?? vm.end, { chapter: "Voice agent", replies: [6, 3, 3], maxDur: vm.ringing ? 26 : 19 });
  voiceCaptions(voice, s, ["V1", "V2", "V3"]);
  if (v3Take) {
    const at = v3Take.marks.v3;
    const said = v3Take.page.find((e) => e.kind === "speak" && e.at >= at);
    const reply = v3Take.page.find((e) => e.kind === "play" && e.at > said.at + said.ms);
    const s3 = live(v3Take, at, reply.at - 250, { chapter: "Voice agent", maxDur: 6 });
    const m3 = s3.map.find((p) => said.at >= p[1] && said.at <= p[3]);
    const t3 = s3.start + m3[0] + (said.at - m3[1]) / 1000 / (m3[4] ?? 1);
    caps.push({ t0: t3, t1: t3 + said.ms / 1000, text: `“${lines.V3}”`, who: "Officer" });
  }
}
if (callInfo) {
  // The real call: the live console beside the phone, cut to the best moments.
  const start = now;
  const t0Call = Date.parse(callInfo.started);
  const callTake = lineTake ?? voice;
  const ring = callTake.marks.ringing;
  const windows = callInfo.windows.map(([a, b]) => [t0Call + a, t0Call + b]);
  const map = [];
  let tt = length(clipFile("N4")) + 0.3;
  map.push([0, ring, tt, t0Call, 1]);
  narrate("N4", start + 0.15);
  for (const [a, b] of windows) {
    cues.push({ file: join(TAKES, "call/call.wav"), ss: (a - t0Call) / 1000, dur: (b - a) / 1000, at: start + tt, vol: 1.4, fade: 0.06 });
    for (const c of callInfo.captions ?? []) {
      const at = t0Call + c.atMs;
      const from = Math.max(at, a);
      if (at + c.ms > a && at < b) caps.push({ t0: start + tt + (from - a) / 1000, t1: start + tt + (Math.min(at + c.ms, b) - a) / 1000, text: c.text, who: c.who });
    }
    map.push([tt, a, tt + (b - a) / 1000, b, 1]);
    tt += (b - a) / 1000;
  }
  shots.push({ kind: "screen", take: callTake.name, start, dur: tt, map, focus: [], chapter: "The real call", phone: true });
  now += tt - OVERLAP;
}
if (plan) {
  // What was learned
  const pm = plan.marks;
  const s5 = live(plan, pm.v4, pm.chat - 1500, { chapter: "What it learned", replies: [5], maxDur: 8.5 });
  voiceCaptions(plan, s5, ["V4"]);
  const d5 = length(clipFile("N5")) + 0.25;
  narrate("N5", now + 0.1);
  fit(plan, pm.chat - 1500, pm.chat, d5, { chapter: "What it learned", zoomless: true });
  // The chat agent building the plan
  live(plan, pm.chat, pm.close, { chapter: "Chat agent", maxDur: 11, extraFocus: [{ at: pm.chat + 1200, x: 1165, y: 15, w: 420, h: 800 }] });
}
if (tour) {
  // How the plan reaches teachers, and how it cascades
  const n6 = length(clipFile("N6"));
  narrate("N6", now + 0.15);
  fit(tour, m.rollout, m.approvals, n6 * 0.6 + 0.2, { chapter: "The action plan" });
  fit(tour, m.approvals, m.board, n6 * 0.4 + 0.55, { chapter: "The action plan" });
  // How they work together
  const d7 = length(clipFile("N7")) + 0.35;
  narrate("N7", now + 0.15);
  fit(tour, m.board, m.district, d7, { chapter: "Working together" });
}
if (plan) {
  // Across blocks, by voice
  const s8 = live(plan, plan.marks.v5, plan.marks.end, { chapter: "Across blocks", replies: [4], maxDur: 8.5 });
  voiceCaptions(plan, s8, ["V5"]);
}
if (tour) {
  const n8 = length(clipFile("N8"));
  narrate("N8", now + 0.15);
  fit(tour, m.district, m.term, n8 * 0.55 + 0.2, { chapter: "Across blocks" });
  fit(tour, m.results, m.end, n8 * 0.45 + 0.6, { chapter: "Across blocks", zoomless: true });
}
const duration = now + OVERLAP;

// ---------------------------------------------------------------- the camera: a smooth path through each shot
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
for (const s of shots) {
  const n = Math.ceil(s.dur * FPS) + 1;
  const path = [];
  const focus = s.zoomless ? [] : s.focus ?? [];
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    const here = [...focus].reverse().find((f) => f.t <= t + 0.25 && t - f.t < 2.2);
    if (here) {
      const z = clamp(Math.min((W * 0.62) / Math.max(here.w, 60), (H * 0.62) / Math.max(here.h, 60)), 1.15, 1.5);
      path.push([here.x + here.w / 2, here.y + here.h / 2, z]);
    } else path.push([W / 2, H / 2, 1]);
  }
  // Glide: smooth forwards and backwards, so moves ease in and out with no lag.
  const k = 1 - Math.exp(-1 / (FPS * 0.3));
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

const frameTimes = {};
for (const s of shots) if (s.take && !frameTimes[s.take]) frameTimes[s.take] = take(s.take).frames.map((f) => f.at);
writeFileSync(join(TAKES, "edit.json"), JSON.stringify({ fps: FPS, duration, shots, caps, frameTimes, phone: existsSync(join(TAKES, "phone/frames.json")) ? JSON.parse(readFileSync(join(TAKES, "phone/frames.json"), "utf8")) : null }));
for (const s of shots) console.log(s.start.toFixed(1).padStart(7), s.dur.toFixed(1).padStart(6), (s.chapter ?? "").padEnd(18), s.take ?? "", s.focus?.length ? `${s.focus.length} zooms` : "");
const bumpers = ["intro", "outro"].map((n) => length(join(ROOT, `video/out/jugnu-${n}.mp4`)));
const total = duration + bumpers[0] + bumpers[1] - 1;
console.log(`demo ${duration.toFixed(1)} s + intro and outro = ${total.toFixed(1)} s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}) ${total > LIMIT ? "OVER THE LIMIT" : "under the limit"}${callInfo ? "" : ", call not in yet"}`);

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
  parts.push(`[${ok.length}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.1,afade=t=in:d=1,afade=t=out:st=${Math.max(0, duration - 1.5)}:d=1.5[bed]`);
  labels += "[bed]";
  count++;
}
const graph = `${parts.join(";")};${labels}amix=inputs=${count}:normalize=0:duration=longest,alimiter=limit=0.95,apad=whole_dur=${duration}[out]`;
args.push("-filter_complex", graph, "-map", "[out]", "-t", String(duration), "-ar", "48000", join(TAKES, "mix.wav"));
const r = spawnSync("ffmpeg", args, { encoding: "utf8", maxBuffer: 1 << 26 });
console.log(r.status === 0 ? "mix ok" : `mix failed: ${r.stderr.slice(0, 500)}`);
