// One interview service behind both channels — the web voice call (teacher opens a link on a
// phone) and the phone line (IVR). Consent first; nothing is kept if the teacher says no.
import crypto from "node:crypto";
import type { Turn } from "../src/engine/types";
import { codeTranscript } from "./ai/coder";
import { scrubPII } from "./ai/guardrails";
import { clarifyTurn, closingTurn, nextTurn, type Lang, type LiveTurn, type NextTurn } from "./ai/interviewer";
import { db, now } from "./db";

export type Channel = "web" | "phone" | "phone-sim";
export type Group = "bright" | "comparison" | "live";

export interface InterviewRow {
  id: string;
  token: string;
  school_name: string | null;
  teacher_name: string | null;
  grp: Group;
  channel: Channel;
  language: Lang;
  consent: number;
  status: "invited" | "in_progress" | "completed" | "declined";
  call_sid: string | null;
  created_at: string;
  updated_at: string;
}

export interface TurnRow {
  idx: number;
  speaker: "jugnu" | "teacher";
  text: string;
  text_en: string | null;
  kind: string | null;
  topic: string | null;
  source: string | null;
  confidence: number | null;
  created_at: string;
}

const token = () => crypto.randomBytes(9).toString("base64url");

export function createInterview(args: { teacherName?: string; schoolName?: string; group?: Group; channel?: Channel; language?: Lang; phoneHash?: string }): InterviewRow {
  const id = crypto.randomUUID();
  const t = now();
  db.prepare(`INSERT INTO interviews (id, token, school_name, teacher_name, grp, channel, language, phone_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, token(), args.schoolName?.trim() || null, args.teacherName?.trim() || null, args.group ?? "live", args.channel ?? "web", args.language ?? "hi", args.phoneHash ?? null, t, t);
  return getById(id)!;
}

export const getById = (id: string) => db.prepare(`SELECT * FROM interviews WHERE id = ?`).get(id) as InterviewRow | undefined;
export const getByToken = (tok: string) => db.prepare(`SELECT * FROM interviews WHERE token = ?`).get(tok) as InterviewRow | undefined;
export const turnsOf = (id: string) => db.prepare(`SELECT idx, speaker, text, text_en, kind, topic, source, confidence, created_at FROM turns WHERE interview_id = ? ORDER BY idx`).all(id) as unknown as TurnRow[];
export const codingsOf = (id: string) =>
  db.prepare(`SELECT practice, new_name, quote, specificity, grounded, coder, note FROM codings WHERE interview_id = ? ORDER BY id`).all(id) as {
    practice: string | null;
    new_name: string | null;
    quote: string;
    specificity: number;
    grounded: number;
    coder: string;
    note: string | null;
  }[];

export function listInterviews() {
  return (db.prepare(`SELECT * FROM interviews ORDER BY created_at DESC LIMIT 200`).all() as unknown as InterviewRow[]).map((r) => ({
    ...r,
    turns: (db.prepare(`SELECT COUNT(*) n FROM turns WHERE interview_id = ? AND speaker = 'teacher'`).get(r.id) as { n: number }).n,
    practices: codingsOf(r.id).filter((c) => c.grounded).map((c) => c.practice ?? c.new_name),
  }));
}

function addTurn(id: string, t: { speaker: "jugnu" | "teacher"; text: string; text_en?: string | null; kind?: string | null; topic?: string | null; source?: string | null; confidence?: number | null }) {
  const idx = (db.prepare(`SELECT COALESCE(MAX(idx), -1) + 1 n FROM turns WHERE interview_id = ?`).get(id) as { n: number }).n;
  db.prepare(`INSERT INTO turns (interview_id, idx, speaker, text, text_en, kind, topic, source, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, idx, t.speaker, t.text, t.text_en ?? null, t.kind ?? null, t.topic ?? null, t.source ?? null, t.confidence ?? null, now());
  db.prepare(`UPDATE interviews SET updated_at = ? WHERE id = ?`).run(now(), id);
}

const setStatus = (id: string, status: InterviewRow["status"], consent?: boolean) =>
  db.prepare(`UPDATE interviews SET status = ?, consent = COALESCE(?, consent), updated_at = ? WHERE id = ?`).run(status, consent === undefined ? null : consent ? 1 : 0, now(), id);

export function openingLines(row: InterviewRow): NextTurn[] {
  const hi = row.language === "hi";
  const name = row.teacher_name ? (hi ? `${row.teacher_name} जी` : row.teacher_name) : hi ? "जी" : "";
  const intro =
    row.grp === "bright"
      ? hi
        ? `नमस्ते ${name}। मैं जुगनू हूँ, ब्लॉक शिक्षा कार्यालय की ओर से। आपके स्कूल के बच्चे अच्छा सीख रहे हैं — हम आपसे सीखना चाहते हैं। बातचीत लगभग 12 मिनट की है।`
        : `Namaste ${name}. I'm Jugnu, calling for the Block Education Office. Children in your school are learning well — we'd like to learn from you. It takes about 12 minutes.`
      : hi
        ? `नमस्ते ${name}। मैं जुगनू हूँ, ब्लॉक शिक्षा कार्यालय की ओर से। हम ब्लॉक के स्कूलों से रोज़ के कक्षा-कार्य के बारे में सीख रहे हैं। बातचीत लगभग 12 मिनट की है।`
        : `Namaste ${name}. I'm Jugnu, from the Block Education Office. We're learning from schools across the block about daily classroom routines. It takes about 12 minutes.`;
  const consent = hi
    ? "आपकी बात लिखकर रखी जाएगी ताकि दूसरे शिक्षक सीख सकें। आपका नाम आपकी अनुमति के बिना किसी को नहीं बताया जाएगा, और आप कभी भी बातचीत रोक सकते हैं। क्या हम शुरू करें? हाँ या नहीं बोलिए।"
    : "What you say will be written down so other teachers can learn. Your name won't be shared without your permission, and you can stop at any time. Shall we begin? Please say yes or no.";
  return [
    { say: intro, say_en: intro, kind: "question", topic: null, done: false },
    { say: consent, say_en: "Your words will be written down so other teachers can learn; your name won't be shared without permission; you can stop anytime. Shall we begin? Yes or no.", kind: "question", topic: null, done: false },
  ];
}

const YES = /हाँ|हां|हा\b|जी|ठीक|बिल्कुल|ज़रूर|जरूर|चलिए|शुरू|yes|yeah|ok|okay|sure|haan|ha\b/i;
const NO = /नहीं|नही|ना\b|मत|no\b|nahi|nahin|not now/i;

export function readConsent(text: string): "yes" | "no" | "unclear" {
  if (NO.test(text)) return "no";
  if (YES.test(text)) return "yes";
  return "unclear";
}

/** Start (or resume) an interview: the intro and consent question are spoken once. */
export function start(row: InterviewRow): TurnRow[] {
  if (turnsOf(row.id).length === 0) {
    const [intro, consent] = openingLines(row);
    addTurn(row.id, { speaker: "jugnu", text: intro.say, text_en: intro.say_en, kind: "intro", source: "script" });
    addTurn(row.id, { speaker: "jugnu", text: consent.say, text_en: consent.say_en, kind: "consent", source: "script" });
    setStatus(row.id, "in_progress");
  }
  return turnsOf(row.id);
}

export interface AnswerResult {
  reply: NextTurn;
  source: "claude" | "offline" | "script";
  status: InterviewRow["status"];
  warning?: string;
}

/** The teacher said something; store it (PII scrubbed) and produce Jugnu's next turn. */
export async function answer(row: InterviewRow, raw: string, meta: { source?: "asr" | "typed"; confidence?: number | null; deadlineMs?: number } = {}): Promise<AnswerResult> {
  if (row.status === "completed" || row.status === "declined") return { reply: closingTurn(row.language), source: "script", status: row.status };
  if (turnsOf(row.id).length === 0) start(row);
  const text = scrubPII(raw.trim()).text;
  const lastJugnu = [...turnsOf(row.id)].reverse().find((t) => t.speaker === "jugnu");

  // Silence or noise: ask again, don't store an empty answer.
  if (!text || text.length < 2) {
    const c = clarifyTurn(row.language);
    addTurn(row.id, { speaker: "jugnu", text: c.say, text_en: c.say_en, kind: "clarify", source: "script" });
    return { reply: c, source: "script", status: row.status };
  }

  if (!row.consent && (lastJugnu?.kind === "consent" || lastJugnu?.kind === "clarify")) {
    const c = readConsent(text);
    if (c === "no") {
      // Declined: keep only the fact that the teacher declined — no transcript.
      db.prepare(`DELETE FROM turns WHERE interview_id = ?`).run(row.id);
      setStatus(row.id, "declined", false);
      const bye = row.language === "hi" ? "कोई बात नहीं, धन्यवाद! आपका दिन अच्छा रहे।" : "No problem — thank you, and have a good day.";
      return { reply: { say: bye, say_en: "No problem — thank you, and have a good day.", kind: "closing", topic: null, done: true }, source: "script", status: "declined" };
    }
    if (c === "unclear") {
      const again = row.language === "hi" ? "क्या हम बातचीत शुरू करें? कृपया हाँ या नहीं बोलिए।" : "Shall we start? Please say yes or no.";
      addTurn(row.id, { speaker: "teacher", text, kind: "consent_reply", source: meta.source ?? "typed", confidence: meta.confidence ?? null });
      addTurn(row.id, { speaker: "jugnu", text: again, text_en: "Shall we start? Please say yes or no.", kind: "consent", source: "script" });
      return { reply: { say: again, say_en: "Shall we start? Please say yes or no.", kind: "clarify", topic: null, done: false }, source: "script", status: row.status };
    }
    setStatus(row.id, "in_progress", true);
    row = getById(row.id)!;
    addTurn(row.id, { speaker: "teacher", text, kind: "consent_reply", source: meta.source ?? "typed", confidence: meta.confidence ?? null });
  } else {
    addTurn(row.id, { speaker: "teacher", text, kind: "answer", topic: lastJugnu?.topic ?? null, source: meta.source ?? "typed", confidence: meta.confidence ?? null });
  }

  const convo: LiveTurn[] = turnsOf(row.id)
    .filter((t) => t.kind !== "intro" && t.kind !== "consent" && t.kind !== "consent_reply")
    .map((t) => ({ speaker: t.speaker, text: t.text, text_en: t.text_en, kind: t.kind, topic: t.topic }));
  const next = await nextTurn(convo, { lang: row.language, ref: row.id, group: row.grp, deadlineMs: meta.deadlineMs });
  addTurn(row.id, { speaker: "jugnu", text: next.value.say, text_en: next.value.say_en, kind: next.value.kind, topic: next.value.topic, source: next.source });
  if (next.value.done) {
    setStatus(row.id, "completed");
    void codeAndStore(row.id); // coding runs in the background; the teacher hears the thank-you now
  }
  return { reply: next.value, source: next.source, status: next.value.done ? "completed" : "in_progress", warning: next.warning };
}

/** Code a transcript into practices and store the codings (replacing earlier ones). */
export async function codeAndStore(id: string) {
  const turns: Turn[] = turnsOf(id)
    .filter((t) => t.kind !== "intro" && t.kind !== "consent" && t.kind !== "consent_reply")
    .map((t) => ({ speaker: t.speaker, text: t.text, textEn: t.text_en ?? undefined }));
  const res = await codeTranscript(turns, id);
  db.prepare(`DELETE FROM codings WHERE interview_id = ?`).run(id);
  for (const c of res.value)
    db.prepare(`INSERT INTO codings (interview_id, practice, new_name, quote, specificity, grounded, coder, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, c.practice, c.newName, c.quote, c.specificity, c.grounded ? 1 : 0, res.source, c.note, now());
  return res;
}

export function eraseInterview(id: string) {
  db.prepare(`DELETE FROM interviews WHERE id = ?`).run(id);
}
