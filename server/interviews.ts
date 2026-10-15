// One interview service behind both channels — the web voice call (teacher opens a link on a
// phone) and the phone line (IVR). Consent first; nothing is kept if the teacher says no.
import crypto from "node:crypto";
import type { Turn } from "../src/engine/types";
import { codeTranscript } from "./ai/coder";
import { scrubPII } from "./ai/guardrails";
import { clarifyTurn, closingTurn, nextTurn, type Lang, type LiveTurn, type NextTurn } from "./ai/interviewer";
import { db, now, type Stmt } from "./db";
import { later } from "./later";

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

export async function createInterview(args: { teacherName?: string; schoolName?: string; group?: Group; channel?: Channel; language?: Lang; phoneHash?: string }): Promise<InterviewRow> {
  const id = crypto.randomUUID();
  const t = now();
  await db.run(
    `INSERT INTO interviews (id, token, school_name, teacher_name, grp, channel, language, phone_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, token(), args.schoolName?.trim() || null, args.teacherName?.trim() || null, args.group ?? "live", args.channel ?? "web", args.language ?? "hi", args.phoneHash ?? null, t, t);
  return (await getById(id))!;
}

export const getById = (id: string) => db.get<InterviewRow>(`SELECT * FROM interviews WHERE id = ?`, id);
export const getByToken = (tok: string) => db.get<InterviewRow>(`SELECT * FROM interviews WHERE token = ?`, tok);
export const turnsOf = (id: string) => db.all<TurnRow>(`SELECT idx, speaker, text, text_en, kind, topic, source, confidence, created_at FROM turns WHERE interview_id = ? ORDER BY idx`, id);
export const codingsOf = (id: string) =>
  db.all<{
    practice: string | null;
    new_name: string | null;
    quote: string;
    specificity: number;
    grounded: number;
    coder: string;
    note: string | null;
  }>(`SELECT practice, new_name, quote, specificity, grounded, coder, note FROM codings WHERE interview_id = ? ORDER BY id`, id);

export async function listInterviews() {
  const rows = await db.all<InterviewRow & { turns: number }>(
    `SELECT i.*, (SELECT COUNT(*) FROM turns t WHERE t.interview_id = i.id AND t.speaker = 'teacher') AS turns FROM interviews i ORDER BY i.created_at DESC LIMIT 200`,
  );
  const coded = await db.all<{ interview_id: string; name: string | null }>(`SELECT interview_id, COALESCE(practice, new_name) name FROM codings WHERE grounded = 1 ORDER BY id`);
  return rows.map((r) => ({ ...r, practices: coded.filter((c) => c.interview_id === r.id).map((c) => c.name) }));
}

type NewTurn = { speaker: "jugnu" | "teacher"; text: string; text_en?: string | null; kind?: string | null; topic?: string | null; source?: string | null; confidence?: number | null };

/** A turn appended at the next index (computed inside the insert, so a batch of turns stays in order). */
const turn = (id: string, t: NewTurn): Stmt => ({
  sql: `INSERT INTO turns (interview_id, idx, speaker, text, text_en, kind, topic, source, confidence, created_at)
        SELECT ?, COALESCE(MAX(idx), -1) + 1, ?, ?, ?, ?, ?, ?, ?, ? FROM turns WHERE interview_id = ?`,
  args: [id, t.speaker, t.text, t.text_en ?? null, t.kind ?? null, t.topic ?? null, t.source ?? null, t.confidence ?? null, now(), id],
});

const touch = (id: string): Stmt => ({ sql: `UPDATE interviews SET updated_at = ? WHERE id = ?`, args: [now(), id] });

const setStatus = (id: string, status: InterviewRow["status"], consent?: boolean): Stmt => ({
  sql: `UPDATE interviews SET status = ?, consent = COALESCE(?, consent), updated_at = ? WHERE id = ?`,
  args: [status, consent === undefined ? null : consent ? 1 : 0, now(), id],
});

const addTurns = (id: string, ...turns: NewTurn[]) => db.batch([...turns.map((t) => turn(id, t)), touch(id)]);

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
export async function start(row: InterviewRow): Promise<TurnRow[]> {
  const turns = await turnsOf(row.id);
  if (turns.length) return turns;
  const [intro, consent] = openingLines(row);
  await db.batch([
    turn(row.id, { speaker: "jugnu", text: intro.say, text_en: intro.say_en, kind: "intro", source: "script" }),
    turn(row.id, { speaker: "jugnu", text: consent.say, text_en: consent.say_en, kind: "consent", source: "script" }),
    setStatus(row.id, "in_progress"),
  ]);
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
  const text = scrubPII(raw.trim()).text;
  const lastJugnu = [...(await start(row))].reverse().find((t) => t.speaker === "jugnu");

  // Silence or noise: ask again, don't store an empty answer.
  if (!text || text.length < 2) {
    const c = clarifyTurn(row.language);
    await addTurns(row.id, { speaker: "jugnu", text: c.say, text_en: c.say_en, kind: "clarify", source: "script" });
    return { reply: c, source: "script", status: row.status };
  }

  if (!row.consent && (lastJugnu?.kind === "consent" || lastJugnu?.kind === "clarify")) {
    const c = readConsent(text);
    if (c === "no") {
      // Declined: keep only the fact that the teacher declined — no transcript.
      await db.batch([{ sql: `DELETE FROM turns WHERE interview_id = ?`, args: [row.id] }, setStatus(row.id, "declined", false)]);
      const bye = row.language === "hi" ? "कोई बात नहीं, धन्यवाद! आपका दिन अच्छा रहे।" : "No problem — thank you, and have a good day.";
      return { reply: { say: bye, say_en: "No problem — thank you, and have a good day.", kind: "closing", topic: null, done: true }, source: "script", status: "declined" };
    }
    if (c === "unclear") {
      const again = row.language === "hi" ? "क्या हम बातचीत शुरू करें? कृपया हाँ या नहीं बोलिए।" : "Shall we start? Please say yes or no.";
      await addTurns(
        row.id,
        { speaker: "teacher", text, kind: "consent_reply", source: meta.source ?? "typed", confidence: meta.confidence ?? null },
        { speaker: "jugnu", text: again, text_en: "Shall we start? Please say yes or no.", kind: "consent", source: "script" },
      );
      return { reply: { say: again, say_en: "Shall we start? Please say yes or no.", kind: "clarify", topic: null, done: false }, source: "script", status: row.status };
    }
    await db.batch([setStatus(row.id, "in_progress", true), turn(row.id, { speaker: "teacher", text, kind: "consent_reply", source: meta.source ?? "typed", confidence: meta.confidence ?? null })]);
    row = { ...row, consent: 1, status: "in_progress" };
  } else {
    await addTurns(row.id, { speaker: "teacher", text, kind: "answer", topic: lastJugnu?.topic ?? null, source: meta.source ?? "typed", confidence: meta.confidence ?? null });
  }

  const convo: LiveTurn[] = (await turnsOf(row.id))
    .filter((t) => t.kind !== "intro" && t.kind !== "consent" && t.kind !== "consent_reply")
    .map((t) => ({ speaker: t.speaker, text: t.text, text_en: t.text_en, kind: t.kind, topic: t.topic }));
  const next = await nextTurn(convo, { lang: row.language, ref: row.id, group: row.grp, deadlineMs: meta.deadlineMs });
  const said = turn(row.id, { speaker: "jugnu", text: next.value.say, text_en: next.value.say_en, kind: next.value.kind, topic: next.value.topic, source: next.source });
  await db.batch(next.value.done ? [said, setStatus(row.id, "completed")] : [said, touch(row.id)]);
  if (next.value.done) later(codeAndStore(row.id)); // coding runs in the background; the teacher hears the thank-you now
  return { reply: next.value, source: next.source, status: next.value.done ? "completed" : "in_progress", warning: next.warning };
}

/** Code a transcript into practices and store the codings (replacing earlier ones). */
export async function codeAndStore(id: string) {
  const turns: Turn[] = (await turnsOf(id))
    .filter((t) => t.kind !== "intro" && t.kind !== "consent" && t.kind !== "consent_reply")
    .map((t) => ({ speaker: t.speaker, text: t.text, textEn: t.text_en ?? undefined }));
  const res = await codeTranscript(turns, id);
  await db.batch([
    { sql: `DELETE FROM codings WHERE interview_id = ?`, args: [id] },
    ...res.value.map((c) => ({
      sql: `INSERT INTO codings (interview_id, practice, new_name, quote, specificity, grounded, coder, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, c.practice, c.newName, c.quote, c.specificity, c.grounded ? 1 : 0, res.source, c.note, now()],
    })),
  ]);
  return res;
}

/** Erase an interview and everything said in it. */
export async function eraseInterview(id: string) {
  await db.batch([
    { sql: `DELETE FROM codings WHERE interview_id = ?`, args: [id] },
    { sql: `DELETE FROM turns WHERE interview_id = ?`, args: [id] },
    { sql: `DELETE FROM interviews WHERE id = ?`, args: [id] },
  ]);
}
