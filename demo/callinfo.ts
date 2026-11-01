// After the real call: gather its sound, timings and words for the edit into the call folder beside the takes.
//   npx tsx --env-file=.env demo/callinfo.ts [interviewId]
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { turnsOf } from "../server/interviews";

const dir = "data/runtime/calls";
const id = process.argv[2] ?? readdirSync(dir).filter((f) => f.endsWith(".json")).sort((a, b) => statSync(`${dir}/${b}`).mtimeMs - statSync(`${dir}/${a}`).mtimeMs)[0].replace(".json", "");
const tape = JSON.parse(readFileSync(`${dir}/${id}.json`, "utf8")) as { started: string; spoken: { atMs: number; ms: number; text: string }[] };
const turns = await turnsOf(id);
const teacher = turns.filter((t) => t.speaker === "teacher");
const captions: { atMs: number; ms: number; text: string; who: string }[] = [];
// Each thing Jugnu says is followed by one answer. English and Hindi share the first line; the caption keeps the English.
tape.spoken.forEach((s, i) => {
  const text = i === 0 || /Which language/.test(s.text) ? s.text.replace(/\s*नमस्ते.*$/s, "") : s.text;
  captions.push({ atMs: s.atMs, ms: s.ms, text, who: "Jugnu" });
  const next = tape.spoken[i + 1];
  const said = teacher[i];
  if (said && next) {
    const at = s.atMs + s.ms + 300;
    captions.push({ atMs: at, ms: Math.max(800, next.atMs - at - 1500), text: said.text, who: "Teacher" });
  }
});
const last = tape.spoken.at(-1)!;
const endMs = last.atMs + last.ms + 800;
const n = tape.spoken.length;
// The moments the film keeps: the language, the consent, two questions with answers, the last answer and the thanks.
const pick = n >= 7 ? [[0, 1], [1, 2], [2, 3], [3, 4], [n - 2, n - 1], [n - 1, null]] : tape.spoken.map((_, i) => [i, i + 1 < n ? i + 1 : null]);
const out = process.env.DEMO_TAKES ?? "E:/jugnu-takes";
mkdirSync(`${out}/call`, { recursive: true });
copyFileSync(`${dir}/${id}.wav`, `${out}/call/call.wav`);
writeFileSync(`${out}/call/call.json`, JSON.stringify({ id, started: tape.started, spoken: tape.spoken, endMs, pick, captions }, null, 1));
for (const c of captions) console.log(String(Math.round(c.atMs / 1000)).padStart(4), c.who.padEnd(8), c.text.slice(0, 110));
console.log(existsSync(`${out}/call/call.wav`) ? `call ${id}: ${n} lines, ${Math.round(endMs / 1000)} s` : "no sound");
process.exit(0);
