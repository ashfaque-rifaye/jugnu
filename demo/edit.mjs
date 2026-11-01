// The edit: turns the recorded takes into a timeline (edit.json) and a sound mix (mix.wav), beside the takes.
// Waiting is sped up, speech plays at a brisk true pace, and the screen plays full-frame, like a Loom recording.
// During the agent's scenes a small panel lists the steps it really took, from its own trace log.
// The whole film, with the intro and outro, must stay under 3 minutes: this prints where it stands.
//   node demo/edit.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAKES = process.env.DEMO_TAKES ?? "E:/jugnu-takes";
const FPS = 30;
const LIMIT = 179; // seconds, intro and outro included
const TEMPO = 1.14; // speech in the agent scenes
const NARRATION_TEMPO = 1.06;
const lines = JSON.parse(readFileSync(join(ROOT, "demo/voice/lines.json"), "utf8"));

const clipFile = (name) => [".wav", ".m4a", ".mp3", ".ogg", ".aac", ".webm"].map((e) => join(ROOT, "demo/voice", name + e)).find(existsSync) ?? join(ROOT, "demo/voice/placeholder", name + ".mp3");
const length = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());
const spoken = (name) => length(clipFile(name)) / NARRATION_TEMPO;

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
const OVERLAP = 0.3;
const TRACES = existsSync(join(TAKES, "agent-traces.json")) ? JSON.parse(readFileSync(join(TAKES, "agent-traces.json"), "utf8")) : [];
const FRIENDLY = {
  find_schools: "Looked up schools",
  pilot_interviews: "Read the interviews",
  show_on_map: "Showed it on the map",
  go_to: "Opened the page",
  point_at: "Pointed it out",
  move_action: "Moved actions on the board",
  schedule_followup: "Put a follow-up on the clock",
  practice_evidence: "Checked the evidence",
  block_overview: "Checked the block",
  school_detail: "Read a school's record",
  action_board: "Checked the actions",
  list_followups: "Checked the clock",
  open_school: "Opened the school",
  dial_teacher: "Called the teacher",
  contrast_pairs: "Compared similar schools",
  what_if: "Estimated the effect",
  click: "Clicked on screen",
  fill: "Filled in a field",
};

/** The screen plays from a to b fitted to `dur` seconds (narration over a walk through the pages). */
function fit(t, a, b, dur, opts = {}) {
  const shot = { kind: "screen", take: t.name, start: now, dur, map: [[0, a, dur, b]], ...opts };
  shots.push(shot);
  now += dur - OVERLAP;
  return shot;
}

/**
 * Speech runs at a brisk pace: the officer's lines, and Jugnu's reply up to `replies[n]` seconds in whole sentences.
 * Everything else is sped up to land on `maxDur` seconds. Cuts between sentences fade, so nothing stops dead.
 */
function live(t, a, b, opts = {}) {
  const busy = [];
  const quietPlays = t.page.filter((e) => e.kind === "play" && e.at >= a && e.at <= b);
  const replies = [];
  for (const e of quietPlays) {
    const last = replies.at(-1);
    if (last && e.at - (last.at(-1).at + last.at(-1).ms) < 900) last.push(e);
    else replies.push([e]);
  }
  const keptPlays = [];
  replies.forEach((r, n) => {
    // Either chosen sentences, or as many as fit the budget.
    if (opts.keep) {
      for (const i of opts.keep[n] ?? [0]) {
        if (r[i]) {
          busy.push([r[i].at - 120, r[i].at + r[i].ms + 200]);
          keptPlays.push(r[i]);
        }
      }
      return;
    }
    const budget = (opts.replies?.[n] ?? opts.replies?.at?.(-1) ?? 6) * 1000;
    let used = 0;
    for (const e of r) {
      if (used && used + e.ms > budget) break;
      busy.push([e.at - 120, e.at + e.ms + 200]);
      keptPlays.push(e);
      used += e.ms;
    }
  });
  for (const e of t.page) {
    if (e.kind === "speak" && e.at >= a && e.at <= b) busy.push([e.at - 150, e.at + e.ms + 200]);
    if (e.kind === "light" && e.at >= a && e.at <= b) busy.push([e.at - 200, e.at + 800]);
  }
  const inside = busy.map(([x, y]) => [Math.max(a, x), Math.min(b, y)]).filter(([x, y]) => y > x).sort((p, q) => p[0] - q[0]);
  const merged = [];
  for (const r of inside) {
    if (merged.length && r[0] <= merged.at(-1)[1] + 250) merged.at(-1)[1] = Math.max(merged.at(-1)[1], r[1]);
    else merged.push([...r]);
  }
  const tempo = opts.tempo ?? TEMPO;
  const busySecs = merged.reduce((s, [x, y]) => s + (y - x) / 1000 / tempo, 0);
  const gapSecs = (b - a) / 1000 - merged.reduce((s, [x, y]) => s + (y - x) / 1000, 0);
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
    if (t.tapStarted) cues.push({ file: t.wav, ss: (x - t.tapStarted) / 1000, dur: (y - x) / 1000, at: start + tt, vol: 1, fade: 0.1, tempo });
    step(x, y, tempo);
    src = y;
  }
  step(src, b, SPEED);
  const shot = { kind: "screen", take: t.name, start, dur: tt, map, ...opts };
  const inEdit = (at) => {
    const m = map.find((p) => at >= p[1] && at <= p[3]) ?? map.at(-1);
    return m[0] + ((at - m[1]) / (m[3] - m[1] || 1)) * (m[2] - m[0]);
  };
  // For voice: a live pill saying what the agent is doing at each moment, from its own log.
  if (opts.pill) {
    const raw = [];
    for (const e of t.page) {
      if (e.kind === "speak" && e.at >= a && e.at <= b) {
        raw.push({ at: e.at, label: "Listening to the officer", sub: "Chirp 3 speech", wave: true });
        raw.push({ at: e.at + e.ms, label: "Understanding", sub: "Chirp 3 speech" });
      }
    }
    for (const tr of TRACES) {
      if (tr.at < a || tr.at > b || !tr.ok) continue;
      raw.push({ at: tr.at - tr.ms, label: "Claude is planning", sub: "Sonnet 5.5" });
      tr.tools.forEach((n, i) => FRIENDLY[n] && raw.push({ at: tr.at + i * 60, label: FRIENDLY[n], sub: n }));
    }
    for (const e of keptPlays) raw.push({ at: e.at, label: "Jugnu is speaking", sub: "Chirp 3 HD", wave: true });
    const list = raw.sort((x, y) => x.at - y.at).map((r) => ({ t: inEdit(r.at), label: r.label, sub: r.sub, wave: !!r.wave }));
    // Every step stays up long enough to read.
    for (let i = 1; i < list.length; i++) list[i].t = Math.max(list[i].t, list[i - 1].t + 0.6);
    shot.pill = list.filter((x) => x.t < tt);
  }
  // What the agent really did in this stretch.
  if (!opts.noFlow && !opts.pill) {
    const flow = [];
    for (const e of t.page) if (e.kind === "speak" && e.at >= a && e.at <= b) flow.push({ at: e.at + e.ms, label: "Heard the officer", tech: "Chirp 3 speech" });
    for (const e of t.events) if (e.kind === "type" && e.at >= a && e.at <= b) flow.push({ at: e.at + 800, label: "Read the message", tech: "chat" });
    for (const tr of [...TRACES].sort((p, q) => p.at - q.at)) {
      if (tr.at < a || tr.at > b || !tr.ok) continue;
      flow.push({ at: tr.at - tr.ms, label: "Claude planned the next step", tech: "claude" });
      tr.tools.forEach((n, i) => FRIENDLY[n] && flow.push({ at: tr.at + i * 60, label: FRIENDLY[n], tech: n }));
    }
    const firstReply = t.page.find((e) => e.kind === "play" && e.at >= a && e.at <= b);
    if (firstReply) flow.push({ at: firstReply.at, label: "Replied by voice", tech: "Chirp 3 HD" });
    const seen = new Set();
    shot.flow = flow
      .sort((x, y) => x.at - y.at)
      .filter((f, i, all) => (f.tech === "claude" ? all[i - 1]?.tech !== "claude" && all[i + 1]?.tech !== "claude" && FRIENDLY[all[i + 1]?.tech] : f.tech === "chat" || f.tech === "Chirp 3 speech" || !seen.has(f.tech)) && (seen.add(f.tech) || true))
      .map((f) => ({ t: inEdit(f.at), label: f.label, tech: f.tech === "claude" ? "Sonnet 5.5" : f.tech }));
  }
  shots.push(shot);
  now += tt - OVERLAP;
  return shot;
}

const narrate = (name, at) => {
  const file = clipFile(name);
  const dur = length(file);
  cues.push({ file, at, ss: 0, dur, vol: 1, tempo: NARRATION_TEMPO });
  caps.push({ t0: at, t1: at + dur / NARRATION_TEMPO, text: lines[name] });
  return dur / NARRATION_TEMPO;
};
/** Lines spoken into the app are in its sound already: they only need a caption. */
function voiceCaptions(t, shot, names) {
  t.page.filter((e) => e.kind === "speak").forEach((e, i) => {
    const m = shot.map.find((p) => e.at >= p[1] && e.at <= p[3]);
    if (!names[i] || !m) return;
    const t0 = shot.start + m[0] + ((e.at - m[1]) / (m[3] - m[1])) * (m[2] - m[0]);
    caps.push({ t0, t1: t0 + e.ms / 1000 / TEMPO, text: `“${lines[names[i]]}”`, who: "Officer" });
  });
}

const home = take("home");
const tour = take("tour");
const voice = take("dry1");
const plan = take("plan");
const v3Take = take("call-failed-no-balance");
const lineTake = take("line");
const m = tour.marks;
const callInfo = JSON.parse(readFileSync(join(TAKES, "call/call.json"), "utf8"));

// What the USP is, on the whole homepage
{
  const d = spoken("N1") + 1.9; // a little longer than the words, so the whole homepage is seen
  narrate("N1", now + 0.15);
  fit(home, home.marks.home, home.marks.doors, d, { chapter: "The idea" });
}
// Signing in: the roles, then the Block Education Officer
{
  const d = spoken("N10") + 1.9; // time to see each role
  narrate("N10", now + 0.15);
  fit(home, home.marks.doors, home.marks.beo, d, { chapter: "Choose your role" });
}
// Jugnu says hello as the officer's screen opens
{
  const hello = home.page.find((e) => e.kind === "play" && e.at > home.marks.beo);
  const last = home.page.filter((e) => e.kind === "play" && e.at > home.marks.beo).at(-1);
  const s = live(home, home.marks.beo - 300, Math.min(home.marks.end, last.at + last.ms + 500), { chapter: "Block Education Officer", replies: [20], tempo: 1.05, noFlow: true });
  const mh = s.map.find((p) => hello.at >= p[1] && hello.at <= p[3]);
  const t0 = s.start + mh[0] + (hello.at - mh[1]) / 1000 / (mh[4] ?? 1);
  caps.push({ t0, t1: s.start + s.dur - 0.1, text: "Namaste! I'm Jugnu. I can brief you, find a school, or make a plan. What can I do for you today?", who: "Jugnu" });
}
// How it works: every school and its metrics
{
  const d = spoken("N2") + 0.35;
  narrate("N2", now + 0.15);
  fit(tour, m.find, m.methods, d, { chapter: "How it works" });
}
// The architecture, as one clear picture
{
  const dur = Math.max(5, spoken("N9") + 0.3);
  narrate("N9", now + 0.15);
  shots.push({ kind: "arch", start: now, dur });
  now += dur - OVERLAP;
}
// All the agent work in one flow: chat builds the plan, voice asks across blocks, finds the next school, and calls.
{
  const pm = plan.marks;
  const c = spoken("N12") + 0.4;
  narrate("N12", now + 0.15);
  live(plan, pm.chat, pm.close, { chapter: "Chat agent", maxDur: c });
  const vm = voice.marks;
  // Jugnu's newer label, for the moments the old Today screen is in view.
  const onMap = TRACES.filter((tr) => tr.at >= vm.v2 && tr.at <= vm.end && tr.tools.includes("show_on_map")).map((tr) => tr.at)[0] ?? vm.v2 + 3000;
  const beoFrame = home.frames[home.frames.findIndex((f) => f.at >= home.marks.beo + 6000)].file;
  // Jugnu names the school, shows it, and offers to call: the story runs straight to the call.
  const s = live(voice, vm.v1, vm.end, { chapter: "Voice agent", keep: [[0], [0, 2]], pill: true, maxDur: 13, patch: { img: `/takes/home/frames/${beoFrame}`, until: onMap, rects: [[316, 292, 612, 54], [310, 718, 402, 48]] } });
  voiceCaptions(voice, s, ["V1", "V2"]);
  // The officer's answer, in the owner's own voice from the call.
  const yes = clipFile("V6");
  const yd = length(yes) + 0.5;
  cues.push({ file: yes, at: now + 0.15, ss: 0, dur: length(yes), vol: 1 });
  caps.push({ t0: now + 0.15, t1: now + 0.15 + length(yes), text: "“Yeah, please go ahead.”", who: "Officer" });
  fit(voice, vm.end - 1200, vm.end - 200, yd, { chapter: "Voice agent", pill: [{ t: 0, label: "Listening to the officer", sub: "Chirp 3 speech", wave: true }] });
  const at = v3Take.marks.v3;
  const said = v3Take.page.find((e) => e.kind === "speak" && e.at >= at);
  const reply = v3Take.page.find((e) => e.kind === "play" && e.at > said.at + said.ms);
  // The bubble in this take quotes the earlier wording; the film's card shows what is heard here.
  live(v3Take, said.at + said.ms + 100, reply.at - 250, { chapter: "Voice agent", pill: true, maxDur: 3.2, say: "Yeah, please go ahead." });
}
// The real call: the live console beside the phone, its important moments at a brisker pace.
{
  const start = now;
  const t0Call = Date.parse(callInfo.started);
  const ring = lineTake.marks.ringing;
  const CALL_TEMPO = 1.4;
  const map = [];
  let tt = spoken("N4") + 0.3;
  map.push([0, ring, tt, t0Call, 1]);
  narrate("N4", start + 0.15);
  for (const [wa, wb] of callInfo.windows) {
    const a = t0Call + wa;
    const b = t0Call + wb;
    cues.push({ file: join(TAKES, "call/call.wav"), ss: wa / 1000, dur: (b - a) / 1000, at: start + tt, vol: 1.4, fade: 0.1, tempo: CALL_TEMPO });
    for (const c of callInfo.captions ?? []) {
      const at = t0Call + c.atMs;
      const from = Math.max(at, a);
      if (at + c.ms > a && at < b) {
        // Only the sentences that are actually heard in this moment.
        const heardMs = Math.min(at + c.ms, b) - from;
        let text = "";
        for (const part of c.text.split(/(?<=[.!?])\s+/)) {
          if (text && (text.length + part.length) / 15 > heardMs / 1000) break;
          text = text ? `${text} ${part}` : part;
        }
        caps.push({ t0: start + tt + (from - a) / 1000 / CALL_TEMPO, t1: start + tt + (Math.min(at + c.ms, b) - a) / 1000 / CALL_TEMPO, text, who: c.who });
      }
    }
    map.push([tt, a, tt + (b - a) / 1000 / CALL_TEMPO, b, CALL_TEMPO]);
    tt += (b - a) / 1000 / CALL_TEMPO;
  }
  shots.push({ kind: "screen", take: lineTake.name, start, dur: tt, map, chapter: "The real call", phone: true });
  now += tt - OVERLAP;
}
// The outcome: the call becomes insights
{
  const d = spoken("N5") + 0.35;
  narrate("N5", now + 0.15);
  const ins = take("insight");
  fit(ins, ins.marks.coded - 1800, ins.marks.end, d * 0.6 + 1, { chapter: "From the call to insight" });
  fit(tour, m.methods, m.rollout, d * 0.4 + OVERLAP + 0.7, { chapter: "From the call to insight" });
}
// How the plan reaches teachers: WhatsApp, simulated and marked so
{
  const dur = spoken("N11") + 0.4;
  narrate("N11", now + 0.15);
  shots.push({ kind: "whatsapp", start: now, dur, chapter: "Reaching teachers" });
  now += dur - OVERLAP;
}
// How it cascades, how people work together, and across blocks
{
  // Unhurried: a moment of quiet around each thought, so the screens can be read.
  const n6 = spoken("N6");
  narrate("N6", now + 0.3);
  fit(tour, m.rollout, m.approvals, n6 * 0.6 + 0.6, { chapter: "The action plan" });
  fit(tour, m.approvals, m.board, n6 * 0.4 + 0.7, { chapter: "The action plan" });
  const d7 = spoken("N7") + 0.8;
  narrate("N7", now + 0.3);
  fit(tour, m.board, m.district, d7, { chapter: "Working together" });
  const n8 = spoken("N8");
  narrate("N8", now + 0.3);
  fit(tour, m.district, m.term, n8 * 0.55 + 0.5, { chapter: "Across blocks" });
  fit(tour, m.results + 1800, m.end, n8 * 0.45 + 0.8, { chapter: "Across blocks" });
}
const duration = now + OVERLAP;

const frameTimes = {};
for (const s of shots) if (s.take && !frameTimes[s.take]) frameTimes[s.take] = take(s.take).frames.map((f) => f.at);
writeFileSync(join(TAKES, "edit.json"), JSON.stringify({ fps: FPS, duration, shots, caps, frameTimes, phone: existsSync(join(TAKES, "phone/frames.json")) ? JSON.parse(readFileSync(join(TAKES, "phone/frames.json"), "utf8")) : null }));
for (const s of shots) console.log(s.start.toFixed(1).padStart(7), s.dur.toFixed(1).padStart(6), (s.chapter ?? s.kind).padEnd(24), s.take ?? "", s.flow?.length ? `${s.flow.length} agent steps` : "");
const bumpers = ["intro", "outro"].map((n) => length(join(ROOT, `video/out/jugnu-${n}.mp4`)));
const total = duration + bumpers[0] + bumpers[1] - 2.6; // less the two crossfades (see assemble.mjs)
console.log(`demo ${duration.toFixed(1)} s + intro and outro = ${total.toFixed(1)} s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}) ${total > LIMIT ? "OVER THE LIMIT" : "under the limit"}`);

// ---------------------------------------------------------------- the sound
const ok = cues.filter((c) => existsSync(c.file) && c.dur > 0.05);
const args = ["-v", "error", "-y"];
const parts = [];
ok.forEach((c, i) => {
  args.push("-ss", String(Math.max(0, c.ss)), "-t", String(c.dur), "-i", c.file);
  const fade = c.fade ? `,afade=t=in:d=${c.fade},afade=t=out:st=${Math.max(0, c.dur - c.fade)}:d=${c.fade}` : "";
  const tempo = c.tempo && c.tempo !== 1 ? `,atempo=${c.tempo}` : "";
  parts.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${c.vol}${fade}${tempo},adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`);
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
