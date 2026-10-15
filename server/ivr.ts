// The phone line: teachers on basic phones are interviewed by the same Jugnu interviewer over an
// ordinary call. Twilio speaks each turn (Hindi TTS) and transcribes the answer (hi-IN speech
// recognition); every webhook is signature-checked. Without Twilio credentials the identical flow
// runs in the browser simulator, which also shows the TwiML each step would return.
import crypto from "node:crypto";
import express, { type Request, type Response } from "express";
import type { Lang, NextTurn } from "./ai/interviewer";
import { requireOfficer } from "./auth";
import { db } from "./db";
import { answer, createInterview, getById, getByToken, start, type Group, type InterviewRow } from "./interviews";

const env = () => ({
  sid: process.env.TWILIO_ACCOUNT_SID ?? "",
  token: process.env.TWILIO_AUTH_TOKEN ?? "",
  from: process.env.TWILIO_FROM ?? "",
  base: (process.env.PUBLIC_URL ?? "").replace(/\/$/, ""),
});

export const ivrConfigured = () => {
  const e = env();
  return Boolean(e.sid && e.token && e.from && e.base);
};

const VOICE: Record<Lang, { voice: string; language: string }> = {
  hi: { voice: "Polly.Aditi", language: "hi-IN" },
  en: { voice: "Polly.Aditi", language: "en-IN" },
};

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
const say = (lines: string[], lang: Lang) => lines.map((l) => `<Say voice="${VOICE[lang].voice}" language="${VOICE[lang].language}">${esc(l)}</Say>`).join("");

export function twimlAsk(lines: string[], lang: Lang, action: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" language="${VOICE[lang].language}" speechTimeout="auto" timeout="7" action="${esc(action)}" method="POST" actionOnEmptyResult="true">${say(lines, lang)}</Gather>${say([lang === "hi" ? "आवाज़ नहीं आई। हम बाद में फिर फ़ोन करेंगे। धन्यवाद!" : "We couldn't hear you. We'll call again later. Thank you!"], lang)}<Hangup/></Response>`;
}

export function twimlBye(lines: string[], lang: Lang): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${say(lines, lang)}<Hangup/></Response>`;
}

/** Twilio request signature: base64(HMAC-SHA1(authToken, url + sorted key/value pairs)). */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

function verified(req: Request): boolean {
  const { token, base } = env();
  if (!token) return false;
  const expected = twilioSignature(token, base + req.originalUrl, (req.body ?? {}) as Record<string, string>);
  const got = req.get("x-twilio-signature") ?? "";
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

const phoneHash = (n: string) => crypto.createHash("sha256").update(`${process.env.PHONE_SALT ?? "jugnu"}:${n.replace(/\D/g, "").slice(-10)}`).digest("hex").slice(0, 24);
const gatherUrl = (row: InterviewRow) => `${env().base}/api/ivr/twilio/gather?t=${row.token}`;

async function openingTwiml(row: InterviewRow, action: string) {
  const turns = await start(row);
  return twimlAsk(turns.filter((t) => t.speaker === "jugnu").map((t) => t.text), row.language, action);
}

function replyTwiml(row: InterviewRow, reply: NextTurn, action: string) {
  return reply.done ? twimlBye([reply.say], row.language) : twimlAsk([reply.say], row.language, action);
}

export const ivr = express.Router();
ivr.use(express.urlencoded({ extended: false }));

// Officer starts an outbound call to a teacher.
ivr.post("/call", requireOfficer, async (req: Request, res: Response) => {
  if (!ivrConfigured()) return res.status(503).json({ error: "Phone line not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM and PUBLIC_URL. Use the simulator meanwhile." });
  const { to, teacherName, schoolName, group, interviewId } = req.body as { to: string; teacherName?: string; schoolName?: string; group?: Group; interviewId?: string };
  if (!/^\+?\d{10,13}$/.test((to ?? "").replace(/[\s-]/g, ""))) return res.status(400).json({ error: "Enter the phone number with country code, e.g. +91 98xxxxxxxx" });
  const row = (interviewId && (await getById(interviewId))) || (await createInterview({ teacherName, schoolName, group, channel: "phone", phoneHash: phoneHash(to) }));
  const e = env();
  const body = new URLSearchParams({ To: to.replace(/[\s-]/g, ""), From: e.from, Url: `${e.base}/api/ivr/twilio/voice?t=${row.token}`, StatusCallback: `${e.base}/api/ivr/twilio/status?t=${row.token}`, Method: "POST" });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${e.sid}/Calls.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${e.sid}:${e.token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await r.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!r.ok) return res.status(502).json({ error: `Twilio: ${data.message ?? r.statusText}` });
  await db.run(`UPDATE interviews SET call_sid = ?, channel = 'phone' WHERE id = ?`, data.sid ?? null, row.id);
  res.json({ interview: await getById(row.id), callSid: data.sid });
});

// Twilio webhooks.
ivr.post("/twilio/voice", async (req, res) => {
  if (!verified(req)) return res.status(403).send("bad signature");
  const row = await getByToken(String(req.query.t ?? ""));
  if (!row) return res.type("text/xml").send(twimlBye(["Sorry, this call link is not valid."], "en"));
  res.type("text/xml").send(await openingTwiml(row, gatherUrl(row)));
});

ivr.post("/twilio/incoming", async (req, res) => {
  if (!verified(req)) return res.status(403).send("bad signature");
  const row = await createInterview({ channel: "phone", phoneHash: phoneHash(String(req.body.From ?? "")) });
  res.type("text/xml").send(await openingTwiml(row, gatherUrl(row)));
});

ivr.post("/twilio/gather", async (req, res) => {
  if (!verified(req)) return res.status(403).send("bad signature");
  const row = await getByToken(String(req.query.t ?? ""));
  if (!row) return res.type("text/xml").send(twimlBye(["Sorry, this call link is not valid."], "en"));
  // Twilio waits ~15 s for a webhook; give Claude 8 s, then the offline interviewer answers.
  const out = await answer(row, String(req.body.SpeechResult ?? ""), { source: "asr", confidence: Number(req.body.Confidence ?? 0) || null, deadlineMs: 8000 });
  res.type("text/xml").send(replyTwiml((await getById(row.id))!, out.reply, gatherUrl(row)));
});

ivr.post("/twilio/status", async (req, res) => {
  if (!verified(req)) return res.status(403).send("bad signature");
  const status = String(req.body.CallStatus ?? "");
  const row = await getByToken(String(req.query.t ?? ""));
  if (row && ["no-answer", "busy", "failed"].includes(status) && row.status === "in_progress")
    await db.run(`UPDATE interviews SET status = 'invited' WHERE id = ?`, row.id);
  res.sendStatus(204);
});

// Browser simulator: same interview service, returns the TwiML Twilio would receive.
ivr.post("/sim/:token/start", async (req, res) => {
  const row = await getByToken(String(req.params.token));
  if (!row) return res.status(404).json({ error: "Unknown interview" });
  await db.run(`UPDATE interviews SET channel = 'phone-sim' WHERE id = ? AND channel = 'web'`, row.id);
  const twiml = await openingTwiml(row, "/api/ivr/twilio/gather?t=" + row.token);
  res.json({ twiml, lines: (await start(row)).filter((t) => t.speaker === "jugnu").map((t) => t.text) });
});

ivr.post("/sim/:token/say", express.json(), async (req, res) => {
  const row = await getByToken(String(req.params.token));
  if (!row) return res.status(404).json({ error: "Unknown interview" });
  const out = await answer(row, String(req.body.text ?? ""), { source: "asr", confidence: req.body.confidence ?? null, deadlineMs: 8000 });
  res.json({ ...out, twiml: replyTwiml((await getById(row.id))!, out.reply, "/api/ivr/twilio/gather?t=" + row.token) });
});
