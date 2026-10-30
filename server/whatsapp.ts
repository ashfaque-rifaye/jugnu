// WhatsApp, where teachers already are (Meta WhatsApp Cloud API). Jugnu sends the day-1 peer voice
// note as a real voice message, asks the day-14 "did you try it?" question, and reads the teacher's
// answer — typed or spoken — exactly like the follow-up call: the outcome lands on the plan board and a
// barrier becomes an escalation. Without credentials WhatsApp is simply off; nothing is simulated.
//
// Business-initiated messages outside WhatsApp's 24-hour window need an approved template
// (WHATSAPP_TEMPLATE, one body variable); inside the window plain text and audio are sent.
import { createHmac, timingSafeEqual } from "node:crypto";
import express, { Router } from "express";
import { z } from "zod";
import { readFollowUp } from "./ai/followup";
import { rateLimit, requireOfficer } from "./auth";
import { db, now } from "./db";
import { BlockKey, writeEvent } from "./eventlog";
import { enqueue } from "./scheduler";
import { normaliseIndianNumber, phoneHash } from "./telephony";
import { synthesize, transcribe, voiceConfigured } from "./voice";

const env = (k: string) => (process.env[k] ?? "").trim();
const cfg = () => ({
  token: env("WHATSAPP_TOKEN"),
  phoneId: env("WHATSAPP_PHONE_NUMBER_ID"),
  verify: env("WHATSAPP_VERIFY_TOKEN"),
  secret: env("WHATSAPP_APP_SECRET"),
  template: env("WHATSAPP_TEMPLATE"),
  templateLang: env("WHATSAPP_TEMPLATE_LANG") || "hi",
  version: env("WHATSAPP_API_VERSION") || "v23.0",
});
const GRAPH = "https://graph.facebook.com";
const ACTOR = "Jugnu AI";

export const whatsappConfigured = () => {
  const c = cfg();
  return Boolean(c.token && c.phoneId);
};
export const whatsappStatus = () => ({ configured: whatsappConfigured(), webhook: Boolean(cfg().verify), template: cfg().template || null });

export class WhatsAppError extends Error {
  constructor(message: string, public status = 502, public code?: number) {
    super(message);
  }
}

/** "+91 98765 43210" → "919876543210" (the Cloud API wants digits with the country code). */
export function waNumber(raw: string): string | null {
  const n = normaliseIndianNumber(raw);
  return n ? n.replace(/\D/g, "") : null;
}

async function graph<T>(path: string, init: RequestInit): Promise<T> {
  const c = cfg();
  const res = await fetch(`${GRAPH}/${c.version}/${path}`, { ...init, headers: { Authorization: `Bearer ${c.token}`, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000) });
  const d = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } };
  if (!res.ok || d.error) throw new WhatsAppError(d.error?.message ?? `WhatsApp ${res.status}`, res.status >= 500 ? 502 : 400, d.error?.code);
  return d;
}

type Sent = { messages?: { id: string }[] };
const OUTSIDE_WINDOW = new Set([131047, 470]); // re-engagement needed: only a template may open the chat

async function send(to: string, message: Record<string, unknown>, templateText?: string): Promise<string> {
  const c = cfg();
  try {
    const d = await graph<Sent>(`${c.phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...message }),
    });
    return d.messages?.[0]?.id ?? "";
  } catch (e) {
    const err = e as WhatsAppError;
    if (!(err.code && OUTSIDE_WINDOW.has(err.code) && c.template && templateText)) throw err;
    const d = await graph<Sent>(`${c.phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: c.template, language: { code: c.templateLang }, components: [{ type: "body", parameters: [{ type: "text", text: templateText.slice(0, 1000) }] }] },
      }),
    });
    return d.messages?.[0]?.id ?? "";
  }
}

export async function sendText(rawTo: string, text: string): Promise<string> {
  if (!whatsappConfigured()) throw new WhatsAppError("WhatsApp is off: WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not set.", 503);
  const to = waNumber(rawTo);
  if (!to) throw new WhatsAppError("Enter an Indian mobile number (10 digits, or +91…).", 400);
  return send(to, { type: "text", text: { body: text.slice(0, 4096), preview_url: false } }, text);
}

/** Speak `text` with a Chirp 3 HD voice and send it as a WhatsApp voice message, with the words as text after it. */
export async function sendVoiceNote(rawTo: string, text: string, lang: "hi" | "en" = "hi"): Promise<string> {
  if (!whatsappConfigured()) throw new WhatsAppError("WhatsApp is off: WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not set.", 503);
  const to = waNumber(rawTo);
  if (!to) throw new WhatsAppError("Enter an Indian mobile number (10 digits, or +91…).", 400);
  if (!voiceConfigured()) return sendText(rawTo, text);
  const mp3 = await synthesize(text, lang);
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "audio/mpeg");
  form.append("file", new Blob([new Uint8Array(mp3)], { type: "audio/mpeg" }), "jugnu-voice-note.mp3");
  const media = await graph<{ id: string }>(`${cfg().phoneId}/media`, { method: "POST", body: form });
  const id = await send(to, { type: "audio", audio: { id: media.id } }, text);
  await send(to, { type: "text", text: { body: text.slice(0, 4096) } }).catch(() => undefined);
  return id;
}

/** Remember which school and action a number's replies belong to (the number itself is not stored). */
export async function rememberContact(rawTo: string, c: { block: string; schoolId?: string | null; ref?: string | null; teacher?: string | null; practice?: string | null; language?: string; awaiting?: "checkin" | null }) {
  const to = normaliseIndianNumber(rawTo);
  if (!to) return;
  await db.run(
    `INSERT INTO wa_contacts (phone_hash, block, school_id, ref, teacher, practice, language, awaiting, last_out_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(phone_hash) DO UPDATE SET block = excluded.block, school_id = excluded.school_id, ref = excluded.ref, teacher = excluded.teacher,
       practice = excluded.practice, language = excluded.language, awaiting = excluded.awaiting, last_out_at = excluded.last_out_at`,
    phoneHash(to), c.block, c.schoolId ?? null, c.ref ?? null, c.teacher ?? null, c.practice ?? null, c.language ?? "hi", c.awaiting ?? null, now(),
  );
}

export const checkinText = (teacher: string | undefined, practice: string | undefined, lang: "hi" | "en") =>
  lang === "en"
    ? `Namaste${teacher ? ` ${teacher}` : ""}! Two weeks ago you heard about ${practice ?? "a method from a nearby school"}. Did you try it? What happened? Reply here — typing or a voice note is fine.`
    : `नमस्ते${teacher ? ` ${teacher} जी` : ""}! दो हफ़्ते पहले आपने ${practice ?? "पास के स्कूल का एक तरीका"} के बारे में सुना था। क्या आपने इसे आज़माया? क्या हुआ? यहीं जवाब दीजिए — लिखकर या बोलकर (वॉइस नोट)।`;

/** Ask the day-14 question on WhatsApp and wait for the answer. */
export async function sendCheckin(rawTo: string, c: { block: string; schoolId: string; ref: string; teacher?: string; practice?: string; language?: "hi" | "en" }) {
  const lang = c.language ?? "hi";
  const id = await sendText(rawTo, checkinText(c.teacher, c.practice, lang));
  await rememberContact(rawTo, { ...c, language: lang, awaiting: "checkin" });
  return id;
}

// ---------------------------------------------------------------- incoming messages

type Incoming = { from: string; id: string; type: string; text?: { body: string }; audio?: { id: string; mime_type?: string }; button?: { text: string }; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } } };
interface Contact {
  phone_hash: string;
  block: string;
  school_id: string | null;
  ref: string | null;
  teacher: string | null;
  practice: string | null;
  language: string;
  awaiting: string | null;
}

export function signatureOk(raw: Buffer | undefined, header: string | undefined, secret = cfg().secret): boolean {
  if (!secret) return true; // not configured: rely on the verify token and the unguessable webhook URL
  if (!raw || !header?.startsWith("sha256=")) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return want.length === got.length && timingSafeEqual(want, got);
}

async function download(mediaId: string): Promise<{ buf: Buffer; mime: string }> {
  const meta = await graph<{ url: string; mime_type: string }>(mediaId, { method: "GET" });
  const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${cfg().token}` }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new WhatsAppError(`media download ${res.status}`);
  return { buf: Buffer.from(await res.arrayBuffer()), mime: meta.mime_type };
}

/** Handle one incoming message. Returns what was done (for the webhook log and tests). */
export async function handleIncoming(m: Incoming): Promise<string> {
  const to = normaliseIndianNumber(`+${m.from}`) ?? normaliseIndianNumber(m.from);
  if (!to) return "ignored: not an Indian number";
  const contact = await db.get<Contact>(`SELECT * FROM wa_contacts WHERE phone_hash = ?`, phoneHash(to));
  if (!contact) return "ignored: unknown number";
  await db.run(`UPDATE wa_contacts SET last_in_at = ? WHERE phone_hash = ?`, now(), contact.phone_hash);
  const lang = contact.language === "en" ? "en" : "hi";

  let said = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
  if (!said && m.type === "audio" && m.audio?.id) {
    const { buf, mime } = await download(m.audio.id);
    said = (await transcribe(buf, mime || "audio/ogg", lang, [])).text;
  }
  said = said.trim();
  if (!said) return "ignored: nothing to read";
  const school = contact.school_id ?? contact.ref?.replace(/-(note|visit|call|review)$/, "") ?? "unknown";

  if (contact.awaiting !== "checkin") {
    await writeEvent(contact.block, "note", school, { text: `WhatsApp from ${contact.teacher ?? "a teacher"}: ${said}` }, "Teacher (WhatsApp)");
    return "noted";
  }

  const reading = await readFollowUp(said, contact.practice ?? "the suggested method", contact.ref ?? school);
  const r = reading.value;
  const outcome = r.outcome === "not_tried" ? "trying" : r.outcome;
  await writeEvent(
    contact.block,
    "followup",
    school,
    {
      outcome,
      said: said.slice(0, 2000),
      summary: [r.summary_en.slice(0, 200), r.summary_en.slice(0, 200)],
      barrier: r.barrier?.slice(0, 120) ?? undefined,
      barrierOwner: r.owner ?? undefined,
    },
    "Teacher (WhatsApp)",
  );
  if (contact.ref) {
    const status = outcome === "barrier" ? "stuck" : outcome === "adopted" ? "done" : "scheduled";
    await writeEvent(contact.block, "action", contact.ref, { status, note: `WhatsApp reply: ${r.summary_en}` }, ACTOR);
    if (status === "stuck") await enqueue(contact.block, "escalate", contact.ref, now(), { teacher: contact.teacher, reason: r.barrier ?? r.summary_en });
  }
  await db.run(`UPDATE wa_contacts SET awaiting = NULL WHERE phone_hash = ?`, contact.phone_hash);
  const thanks = lang === "en" ? "Thank you! Your CRP will see this today." : "धन्यवाद! आपके CRP आज ही इसे देखेंगे।";
  await sendText(to, thanks).catch(() => undefined);
  return `follow-up: ${outcome}`;
}

export const whatsapp = Router();

/** Meta's webhook verification handshake. */
whatsapp.get("/webhook", (req, res) => {
  const c = cfg();
  if (c.verify && req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === c.verify) return res.status(200).send(String(req.query["hub.challenge"] ?? ""));
  res.status(403).end();
});

whatsapp.post("/webhook", async (req, res) => {
  if (!signatureOk((req as { rawBody?: Buffer }).rawBody, req.get("x-hub-signature-256"))) return res.status(401).end();
  res.status(200).end(); // acknowledge at once; Meta retries slow webhooks
  const body = req.body as { entry?: { changes?: { value?: { messages?: Incoming[] } }[] }[] };
  for (const e of body.entry ?? [])
    for (const ch of e.changes ?? [])
      for (const m of ch.value?.messages ?? [])
        await handleIncoming(m).catch((err) => console.error("WhatsApp message failed:", (err as Error).message));
});

whatsapp.get("/status", (_req, res) => res.json(whatsappStatus()));

/** Send from the console: a check-in, a peer voice note, or a plain message. */
whatsapp.post("/send", requireOfficer, rateLimit("whatsapp", 60, 600000), express.json(), async (req, res) => {
  const body = z
    .object({
      to: z.string().min(10).max(20),
      kind: z.enum(["checkin", "voice_note", "text"]),
      text: z.string().max(2000).optional(),
      block: BlockKey,
      schoolId: z.string().max(40),
      ref: z.string().max(80).optional(),
      teacher: z.string().max(80).optional(),
      practice: z.string().max(120).optional(),
      language: z.enum(["hi", "en"]).default("hi"),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "to, kind, block and schoolId are required" });
  const b = body.data;
  try {
    let id: string;
    if (b.kind === "checkin") id = await sendCheckin(b.to, { block: b.block, schoolId: b.schoolId, ref: b.ref ?? `${b.schoolId}-call`, teacher: b.teacher, practice: b.practice, language: b.language });
    else {
      if (!b.text) return res.status(400).json({ error: "text is required" });
      id = b.kind === "voice_note" ? await sendVoiceNote(b.to, b.text, b.language) : await sendText(b.to, b.text);
      await rememberContact(b.to, { block: b.block, schoolId: b.schoolId, ref: b.ref, teacher: b.teacher, practice: b.practice, language: b.language });
    }
    const what = { checkin: "day-14 check-in", voice_note: "voice note", text: "message" }[b.kind];
    await writeEvent(b.block, "note", b.schoolId, { text: `WhatsApp ${what} sent to ${b.teacher ?? "the teacher"}.` }, ACTOR);
    res.json({ ok: true, id });
  } catch (e) {
    const err = e as WhatsAppError;
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
