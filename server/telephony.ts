// Real phone interviews. Jugnu dials the teacher through a telephony provider, the provider streams
// the call's audio to us over a WebSocket, and the same Chirp → Claude → Chirp loop that runs the
// web interview runs on the phone. Two adapters share one call session:
//
//   exotel  — live. Outbound call via /v1/Accounts/{sid}/Calls/connect, audio via the "Voicebot"
//             applet in the Exotel flow (bidirectional 8 kHz 16-bit PCM, base64 in JSON frames).
//   plivo   — dormant until an Indian number is on the account. Outbound call via /v1/Account/{id}/Call,
//             audio via <Stream bidirectional="true"> (same PCM format, Plivo's JSON frames).
//
// Nothing here is simulated: without provider credentials the phone line is simply off.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import type { IncomingMessage, Server } from "node:http";
import { Router, urlencoded } from "express";
import { WebSocketServer, type WebSocket } from "ws";
import { requireOfficer } from "./auth";
import { db } from "./db";
import { answer, createInterview, getByCallSid, getById, getByToken, ASK_LANGUAGE, LANGUAGE_ASK, start, type InterviewRow } from "./interviews";
import { pcmToWav, synthesize, transcribe, voiceConfigured } from "./voice";

export type Provider = "exotel" | "plivo";

const env = (k: string) => (process.env[k] ?? "").trim();

const exotel = () => ({
  key: env("API_KEY_EXOTEL"),
  token: env("API_TOKEN_PASSWORD"),
  sid: env("EXOTEL_SID"),
  host: env("EXOTEL_HOST") || "api.exotel.com",
  from: env("EXOTEL_FROM"),
  appId: env("EXOTEL_APP_ID"),
});
const plivo = () => ({ id: env("PLIVO_AUTH_ID"), token: env("PLIVO_AUTH_TOKEN"), from: env("PLIVO_FROM"), appId: env("PLIVO_APP_ID") });

const exotelConfigured = () => {
  const e = exotel();
  return !!(e.key && e.token && e.sid && e.from && e.appId);
};
const plivoConfigured = () => {
  const p = plivo();
  return !!(p.id && p.token && p.from);
};

const publicUrl = () => env("PUBLIC_URL").replace(/\/$/, "");

/** The provider that will place the next call, or null when the phone line is off. */
function activeProvider(): Provider | null {
  const wanted = env("TELEPHONY_PROVIDER") as Provider | "";
  if (wanted === "plivo") return plivoConfigured() ? "plivo" : null;
  if (wanted === "exotel") return exotelConfigured() ? "exotel" : null;
  return exotelConfigured() ? "exotel" : plivoConfigured() ? "plivo" : null;
}

export function telephonyStatus() {
  return {
    active: activeProvider(),
    publicUrl: publicUrl() || null,
    voice: voiceConfigured(),
    providers: {
      exotel: { configured: exotelConfigured(), from: exotel().from || null },
      plivo: { configured: plivoConfigured(), from: plivo().from || null },
    },
  };
}

/** Phone numbers are never stored; only a salted hash of the last ten digits. */
export function phoneHash(number: string): string {
  const digits = number.replace(/\D/g, "").slice(-10);
  return createHash("sha256").update(`${env("PHONE_SALT") || "jugnu"}:${digits}`).digest("hex").slice(0, 24);
}

/** E.164 for India; accepts "98765 43210", "098765-43210", "+91 98765 43210". */
export function normaliseIndianNumber(raw: string): string | null {
  let d = raw.replace(/[\s\-()]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0") && d.length === 11) d = `91${d.slice(1)}`;
  if (d.length === 10) d = `91${d}`;
  return /^91[6-9]\d{9}$/.test(d) ? `+${d}` : null;
}

/** Webhook URLs carry a key derived from the provider secret, so nobody else can drive a call. */
function webhookKey(): string {
  const seed = exotel().token || plivo().token || env("PHONE_SALT") || "jugnu";
  return createHash("sha256").update(`webhook:${seed}`).digest("hex").slice(0, 20);
}
const keyOk = (given: unknown) => {
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(webhookKey());
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Plivo signs webhooks with HMAC-SHA256 over url + nonce (V3); exported so the test can cover it. */
export function plivoSignature(url: string, nonce: string, token: string): string {
  return createHmac("sha256", token).update(url + nonce).digest("base64");
}

export const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

// ---------------------------------------------------------------- placing calls

async function dialExotel(to: string, token: string): Promise<string> {
  const e = exotel();
  const form = new URLSearchParams({
    From: to,
    CallerId: e.from,
    Url: `http://my.exotel.com/${e.sid}/exoml/start_voice/${e.appId}`,
    StatusCallback: `${publicUrl()}/api/ivr/exotel/status?key=${webhookKey()}`,
    StatusCallbackContentType: "application/json",
    CustomField: token,
    TimeLimit: "900",
    TimeOut: "30",
  });
  const res = await fetch(`https://${e.host}/v1/Accounts/${e.sid}/Calls/connect.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${e.key}:${e.token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  const d = (await res.json().catch(() => ({}))) as { Call?: { Sid?: string }; RestException?: { Message?: string } };
  if (!res.ok || !d.Call?.Sid) throw new Error(d.RestException?.Message ?? `Exotel ${res.status}`);
  return d.Call.Sid;
}

async function dialPlivo(to: string, token: string): Promise<string> {
  const p = plivo();
  const res = await fetch(`https://api.plivo.com/v1/Account/${p.id}/Call/`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${p.id}:${p.token}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: p.from.replace(/\D/g, ""),
      to: to.replace(/\D/g, ""),
      answer_url: `${publicUrl()}/api/ivr/plivo/answer?key=${webhookKey()}&token=${token}`,
      answer_method: "POST",
      hangup_url: `${publicUrl()}/api/ivr/plivo/status?key=${webhookKey()}`,
      hangup_method: "POST",
      ring_timeout: 30,
      time_limit: 900,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const d = (await res.json().catch(() => ({}))) as { request_uuid?: string; error?: string };
  if (!res.ok || !d.request_uuid) throw new Error(d.error ?? `Plivo ${res.status}`);
  return d.request_uuid;
}

// ---------------------------------------------------------------- the call session

const SAMPLE_RATE = 8000;
const BYTES_PER_MS = (SAMPLE_RATE * 2) / 1000;
const SPEECH_RMS = 700; // 16-bit samples; a quiet phone line idles around 100–300
const MIN_SPEECH_MS = 250; // a short "हाँ" is ~300 ms
const END_SILENCE_MS = 1000;
const MAX_UTTERANCE_MS = 25000;
const NO_SPEECH_MS = 9000; // nothing heard at all → Jugnu asks again

const rms = (pcm: Buffer) => {
  if (pcm.length < 2) return 0;
  let sum = 0;
  const n = pcm.length >> 1;
  for (let i = 0; i < n; i++) {
    const s = pcm.readInt16LE(i << 1);
    sum += s * s;
  }
  return Math.sqrt(sum / n);
};

/** How the two providers frame audio in and out. */
interface Framing {
  parse(msg: string): { type: "start"; callSid: string | null; streamId: string; custom: Record<string, string> } | { type: "media"; pcm: Buffer } | { type: "stop" } | { type: "other" };
  media(streamId: string, pcm: Buffer): string;
  clear(streamId: string): string;
}

const exotelFraming: Framing = {
  parse(msg) {
    const m = JSON.parse(msg) as { event: string; stream_sid?: string; start?: { call_sid?: string; custom_parameters?: Record<string, string> }; media?: { payload: string } };
    if (m.event === "start") return { type: "start", callSid: m.start?.call_sid ?? null, streamId: m.stream_sid ?? "", custom: m.start?.custom_parameters ?? {} };
    if (m.event === "media" && m.media?.payload) return { type: "media", pcm: Buffer.from(m.media.payload, "base64") };
    if (m.event === "stop") return { type: "stop" };
    return { type: "other" };
  },
  media: (stream_sid, pcm) => JSON.stringify({ event: "media", stream_sid, media: { payload: pcm.toString("base64") } }),
  clear: (stream_sid) => JSON.stringify({ event: "clear", stream_sid }),
};

const plivoFraming: Framing = {
  parse(msg) {
    const m = JSON.parse(msg) as { event: string; start?: { callId?: string; streamId?: string }; streamId?: string; media?: { payload: string } };
    if (m.event === "start") return { type: "start", callSid: m.start?.callId ?? null, streamId: m.start?.streamId ?? m.streamId ?? "", custom: {} };
    if (m.event === "media" && m.media?.payload) return { type: "media", pcm: Buffer.from(m.media.payload, "base64") };
    if (m.event === "stop") return { type: "stop" };
    return { type: "other" };
  },
  media: (_id, pcm) => JSON.stringify({ event: "playAudio", media: { contentType: "audio/x-l16", sampleRate: SAMPLE_RATE, payload: pcm.toString("base64") } }),
  clear: () => JSON.stringify({ event: "clearAudio" }),
};

class CallSession {
  private row: InterviewRow | null = null;
  private streamId = "";
  private chunks: Buffer[] = [];
  private speechMs = 0;
  private silenceMs = 0;
  private utteranceMs = 0;
  private quietMs = 0;
  private speaking = false;
  private busy = false;
  private closed = false;
  /** A stream that has not named a live Jugnu call within 15 s is closed. */
  private admit: ReturnType<typeof setTimeout>;
  /** For the one-line summary logged when the stream closes. */
  private stats = { opened: Date.now(), frames: 0, loud: 0, peak: 0, turns: 0 };
  /** Lines differ in loudness: speech is judged against this line's own idle level. */
  private noise = 150;
  private get speechLevel() {
    return Math.max(300, Math.min(SPEECH_RMS, this.noise * 2.5));
  }
  /** Only with RECORD_CALLS=1, for the team's own demo call: both sides, kept on this computer. */
  private tape = process.env.RECORD_CALLS === "1" ? { heard: [] as Buffer[], spoken: [] as { at: number; text: string; pcm: Buffer }[], t0: 0 } : null;

  constructor(
    private ws: WebSocket,
    private framing: Framing,
    private provider: Provider,
    private token: string | null,
  ) {
    ws.on("message", (data) => void this.onMessage(data.toString()));
    ws.on("close", (code) => {
      this.closed = true;
      clearTimeout(this.admit);
      this.saveTape();
      const s = this.stats;
      if (this.row) console.log(`[${provider}] stream closed (${code}) after ${Math.round((Date.now() - s.opened) / 1000)} s: ${s.frames} audio frames in, ${s.loud} above the speech level, loudest ${Math.round(s.peak)}, ${s.turns} turns`);
    });
    ws.on("error", (e) => console.warn(`[${provider}] stream error`, e.message));
    this.admit = setTimeout(() => !this.row && ws.close(), 15_000);
  }

  private async onMessage(raw: string) {
    let ev: ReturnType<Framing["parse"]>;
    try {
      ev = this.framing.parse(raw);
    } catch {
      return;
    }
    if (ev.type === "start") {
      this.streamId = ev.streamId;
      const token = this.token ?? ev.custom.token ?? ev.custom.CustomField ?? null;
      this.row = (ev.callSid ? await getByCallSid(ev.callSid) : null) ?? (token ? await getByToken(token) : null) ?? null;
      if (!this.row || this.row.channel !== "phone" || !LIVE_CALL.has(this.row.call_status ?? "")) {
        console.warn(`[${this.provider}] stream for a call Jugnu did not place`, ev.callSid);
        this.row = null;
        this.ws.close();
        return;
      }
      clearTimeout(this.admit);
      if (ev.callSid && !this.row.call_sid) await db.run("UPDATE interviews SET call_sid = ? WHERE id = ?", ev.callSid, this.row.id);
      await db.run("UPDATE interviews SET call_status = 'in-call', updated_at = datetime('now') WHERE id = ?", this.row.id);
      const opening = await start(this.row);
      if (opening.at(-1)?.kind === "language") await this.askLanguage();
      else await this.say(opening.map((t) => t.text).join(" "));
      return;
    }
    if (ev.type === "stop") {
      this.ws.close();
      return;
    }
    if (ev.type !== "media" || !this.row) return;
    if (this.tape) {
      this.tape.t0 ||= Date.now();
      this.tape.heard.push(ev.pcm);
    }
    const level = rms(ev.pcm);
    this.stats.frames++;
    this.stats.peak = Math.max(this.stats.peak, level);
    if (level > this.speechLevel) this.stats.loud++;
    else this.noise += (level - this.noise) * 0.02;
    if (this.speaking || this.busy) return;
    this.hear(ev.pcm);
  }

  /** Energy-based end-pointing: speech, then a second of quiet, is one answer. */
  private hear(pcm: Buffer) {
    const ms = pcm.length / BYTES_PER_MS;
    const loud = rms(pcm) > this.speechLevel;
    if (loud) {
      this.speechMs += ms;
      this.silenceMs = 0;
      this.quietMs = 0;
    } else {
      this.quietMs += ms;
      if (this.speechMs > 0) this.silenceMs += ms;
    }
    if (this.speechMs > 0) {
      this.chunks.push(pcm);
      this.utteranceMs += ms;
    } else if (this.quietMs >= NO_SPEECH_MS) {
      this.quietMs = 0;
      void this.respond(null);
      return;
    }
    const ended = this.speechMs >= MIN_SPEECH_MS && this.silenceMs >= END_SILENCE_MS;
    const tooLong = this.utteranceMs >= MAX_UTTERANCE_MS;
    const falseStart = this.speechMs > 0 && this.speechMs < MIN_SPEECH_MS && this.silenceMs >= END_SILENCE_MS;
    if (falseStart) this.reset();
    else if (ended || tooLong) void this.respond(Buffer.concat(this.chunks));
  }

  private reset() {
    this.chunks = [];
    this.speechMs = this.silenceMs = this.utteranceMs = this.quietMs = 0;
  }

  private async respond(pcm: Buffer | null) {
    if (!this.row || this.busy) return;
    this.busy = true;
    this.reset();
    try {
      let text = "";
      if (pcm) {
        try {
          text = (await transcribe(pcmToWav(pcm, SAMPLE_RATE), "audio/wav", this.row.language, [])).text;
        } catch (e) {
          console.warn(`[${this.provider}] transcribe failed`, (e as Error).message);
        }
      }
      const result = await answer(this.row, text, { source: "asr", deadlineMs: 15000 });
      this.stats.turns++;
      this.row = (await getById(this.row.id)) ?? this.row;
      if (result.reply.topic === ASK_LANGUAGE) await this.askLanguage();
      else await this.say(result.reply.say);
      if (result.status === "completed" || result.status === "declined") {
        setTimeout(() => this.ws.close(), 500);
      }
    } catch (e) {
      console.warn(`[${this.provider}] turn failed`, (e as Error).message);
    } finally {
      this.busy = false;
    }
  }

  /** Speak a line down the phone: 8 kHz PCM in ~200 ms frames, then wait for it to play out. */
  private async say(text: string, pre?: Promise<Buffer>) {
    if (!this.row || this.closed || !text.trim()) return;
    this.speaking = true;
    try {
      const pcm = await (pre ?? synthesize(text, this.row.language, undefined, "pcm8k"));
      if (this.tape) this.tape.spoken.push({ at: Date.now(), text, pcm });
      this.ws.send(this.framing.clear(this.streamId));
      const frame = 3200;
      for (let i = 0; i < pcm.length && !this.closed; i += frame) this.ws.send(this.framing.media(this.streamId, pcm.subarray(i, i + frame)));
      await new Promise((r) => setTimeout(r, pcm.length / BYTES_PER_MS + 250));
    } catch (e) {
      console.warn(`[${this.provider}] speak failed`, (e as Error).message);
    } finally {
      this.speaking = false;
      this.reset();
    }
  }

  /** The language question, each half in its own voice, played as one so an early answer has no gap to fall into. */
  private async askLanguage() {
    const both = Promise.all([synthesize(LANGUAGE_ASK.en, "en", undefined, "pcm8k"), synthesize(LANGUAGE_ASK.hi, "hi", undefined, "pcm8k")]);
    await this.say(`${LANGUAGE_ASK.en} ${LANGUAGE_ASK.hi}`, both.then(([en, hi]) => Buffer.concat([en, Buffer.alloc(BYTES_PER_MS * 400), hi])));
  }

  /** Mix both sides into one WAV, with the times of what Jugnu said, for the demo film's edit. */
  private saveTape() {
    const tape = this.tape;
    if (!tape || !this.row || !tape.t0) return;
    this.tape = null;
    const heard = Buffer.concat(tape.heard);
    const end = Math.max(heard.length, ...tape.spoken.map((s) => Math.round(((s.at - tape.t0) * BYTES_PER_MS) / 2) * 2 + s.pcm.length));
    const mix = Buffer.alloc(end);
    heard.copy(mix);
    for (const s of tape.spoken) {
      const from = Math.max(0, Math.round(((s.at - tape.t0) * BYTES_PER_MS) / 2) * 2);
      for (let i = 0; i + 1 < s.pcm.length && from + i + 1 < end; i += 2) {
        mix.writeInt16LE(Math.max(-32768, Math.min(32767, mix.readInt16LE(from + i) + s.pcm.readInt16LE(i))), from + i);
      }
    }
    const dir = "data/runtime/calls";
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${this.row.id}.wav`, pcmToWav(mix, SAMPLE_RATE));
    writeFileSync(`${dir}/${this.row.id}.json`, JSON.stringify({ started: new Date(tape.t0).toISOString(), spoken: tape.spoken.map((s) => ({ atMs: s.at - tape.t0, ms: s.pcm.length / BYTES_PER_MS, text: s.text })) }, null, 1));
    console.log(`[${this.provider}] call saved to ${dir}/${this.row.id}.wav`);
  }
}

/** Attach the audio-stream WebSocket endpoints to the HTTP server (server/index.ts). */
export function attachTelephony(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? "/", "http://x");
    const m = url.pathname.match(/^\/api\/ivr\/(exotel|plivo)\/stream$/);
    if (!m) return;
    const provider = m[1] as Provider;
    // Plivo's stream URL is sent with each call by our API, so it carries the webhook key. Exotel's is
    // typed once into the flow's Voicebot applet, so it carries no secret: a stream is admitted only
    // when its call matches an interview Jugnu is dialling right now (see CallSession "start").
    if (provider === "plivo" && !keyOk(url.searchParams.get("key"))) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      new CallSession(ws, provider === "exotel" ? exotelFraming : plivoFraming, provider, url.searchParams.get("token"));
    });
  });
}

// ---------------------------------------------------------------- HTTP: dial, webhooks, setup

export const ivr = Router();
ivr.use(urlencoded({ extended: false }));

ivr.get("/status", (_req, res) => res.json(telephonyStatus()));

/** Everything the officer must paste into the provider dashboard, in one place. */
ivr.get("/setup", requireOfficer, (_req, res) => {
  const base = publicUrl();
  const key = webhookKey();
  const wsBase = base.replace(/^http/, "ws");
  res.json({
    ...telephonyStatus(),
    exotel: {
      flowAppId: exotel().appId || null,
      voicebotUrl: base ? `${wsBase}/api/ivr/exotel/stream` : null,
      statusCallback: base ? `${base}/api/ivr/exotel/status?key=${key}` : null,
      steps: [
        `Open App Bazaar → flow ${exotel().appId || "(EXOTEL_APP_ID)"} and make it: Start → Voicebot → Hangup.`,
        "In the Voicebot applet set the URL to the voicebotUrl above (bidirectional, 8 kHz, record on).",
        "Trial accounts can only call numbers verified under Settings → Verified numbers.",
        "PUBLIC_URL must be reachable from Exotel. It is the fixed Cloud Run address of the phone server (docs/PHONE-SERVER.md).",
      ],
    },
    plivo: {
      answerUrl: base ? `${base}/api/ivr/plivo/answer?key=${key}` : null,
      streamUrl: base ? `${wsBase}/api/ivr/plivo/stream?key=${key}` : null,
      steps: ["Buy an Indian number (needs KYC) and put it in PLIVO_FROM; the answer URL is sent with each call, no dashboard app needed."],
    },
  });
});

export type CallRequest = {
  to: string;
  teacherName?: string;
  schoolName?: string;
  schoolId?: string;
  group?: InterviewRow["grp"];
  language?: InterviewRow["language"];
  interviewId?: string;
};

export class CallError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Place a real call to a teacher (used by the officer UI, the scheduler and the agent's dial tool). */
export async function placeCall(b: CallRequest): Promise<{ interview: InterviewRow | undefined; callSid: string; provider: Provider }> {
  const provider = activeProvider();
  if (!provider) throw new CallError("The phone line is off: no telephony provider is configured.", 503);
  if (!publicUrl()) throw new CallError("PUBLIC_URL is not set; the provider cannot reach this server.", 503);
  if (!voiceConfigured()) throw new CallError("Voice (GOOGLE_CLOUD_API_KEY) is not configured.", 503);
  const to = normaliseIndianNumber(String(b.to ?? ""));
  if (!to) throw new CallError("Enter an Indian mobile number (10 digits, or +91…).", 400);
  // The phone server sleeps when idle: wake it now, so the teacher does not wait in silence after answering.
  void fetch(`${publicUrl()}/api/status`, { signal: AbortSignal.timeout(20000) }).catch(() => {});
  const hash = phoneHash(to);
  let row = b.interviewId ? await getById(String(b.interviewId)) : null;
  if (!row) {
    row = await createInterview({
      teacherName: b.teacherName,
      schoolName: b.schoolName,
      schoolId: b.schoolId,
      group: b.group ?? "live",
      language: b.language ?? "hi",
      channel: "phone",
      phoneHash: hash,
    });
  }
  let callSid: string;
  try {
    callSid = provider === "exotel" ? await dialExotel(to, row.token) : await dialPlivo(to, row.token);
  } catch (e) {
    throw new CallError(`${provider === "exotel" ? "Exotel" : "Plivo"} could not place the call: ${(e as Error).message}`, 502);
  }
  await db.run(
    "UPDATE interviews SET call_sid = ?, call_status = 'dialing', channel = 'phone', phone_hash = ?, status = CASE WHEN status = 'completed' THEN status ELSE 'invited' END, updated_at = datetime('now') WHERE id = ?",
    callSid, hash, row.id,
  );
  return { interview: await getById(row.id), callSid, provider };
}

/** Dial a teacher. Body: { to, teacherName?, schoolName?, schoolId?, group?, language?, interviewId? }. */
ivr.post("/call", requireOfficer, async (req, res) => {
  try {
    res.json(await placeCall((req.body ?? {}) as CallRequest));
  } catch (e) {
    const err = e as CallError;
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/** Call states in which a provider may open the audio stream. */
const LIVE_CALL = new Set(["dialing", "in-call"]);

const terminal = new Set(["no-answer", "busy", "failed", "canceled", "cancelled", "NO_ANSWER", "BUSY", "FAILED"]);

/** Exotel's StatusCallback (terminal events, JSON or form). */
ivr.post("/exotel/status", async (req, res) => {
  if (!keyOk(req.query.key)) return res.status(403).end();
  const b = (req.body ?? {}) as Record<string, string>;
  const sid = b.CallSid ?? b.call_sid;
  const status = b.Status ?? b.status ?? "";
  if (sid) await markCallEnded(sid, status);
  res.status(200).end();
});

/** Plivo answer URL: open a bidirectional stream to us. */
ivr.post("/plivo/answer", (req, res) => {
  if (!keyOk(req.query.key)) return res.status(403).end();
  const token = String(req.query.token ?? "");
  const ws = `${publicUrl().replace(/^http/, "ws")}/api/ivr/plivo/stream?key=${webhookKey()}&token=${encodeURIComponent(token)}`;
  res
    .type("application/xml")
    .send(`<?xml version="1.0" encoding="UTF-8"?><Response><Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-l16;rate=8000">${xmlEscape(ws)}</Stream></Response>`);
});

ivr.post("/plivo/status", async (req, res) => {
  if (!keyOk(req.query.key)) return res.status(403).end();
  const b = (req.body ?? {}) as Record<string, string>;
  const sid = b.RequestUUID ?? b.CallUUID;
  if (sid) await markCallEnded(sid, b.CallStatus ?? b.HangupCause ?? "");
  res.status(200).end();
});

async function markCallEnded(callSid: string, status: string) {
  const row = await getByCallSid(callSid);
  if (!row) return;
  if (terminal.has(status) && row.status === "in_progress") {
    await db.run("UPDATE interviews SET status = 'invited', updated_at = datetime('now') WHERE id = ?", row.id);
  }
  await db.run("UPDATE interviews SET call_status = ?, updated_at = datetime('now') WHERE id = ?", status || null, row.id);
}
