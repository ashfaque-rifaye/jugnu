// Jugnu's voice I/O in the browser. Listening: the microphone stays open for a voice session; each
// turn is recorded until the speaker pauses, then sent to /api/voice/stt (Google Chirp 3 — Hindi,
// English, Tamil and more, even mixed). Speaking: /api/voice/tts (Chirp 3 HD voices), played
// through an analyser so the firefly swarm moves with the voice.
import { getPasscode, PASSCODE_EVENT } from "./api";

let ctx: AudioContext | null = null;
let outAnalyser: AnalyserNode | null = null;

/** One AudioContext for the page; call from a tap so the browser lets it play. */
export function audio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  if (!outAnalyser) {
    outAnalyser = ctx.createAnalyser();
    outAnalyser.fftSize = 512;
    outAnalyser.connect(ctx.destination);
  }
  return { ctx, out: outAnalyser };
}

const buf = new Uint8Array(512);
/** 0–1 loudness of an analyser right now. */
export function levelOf(a: AnalyserNode | null): number {
  if (!a) return 0;
  a.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < a.fftSize; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / a.fftSize) * 4);
}
export const outLevel = () => levelOf(outAnalyser);

const headers = (): Record<string, string> => {
  const p = getPasscode();
  return p ? { "x-jugnu-pass": p } : {};
};

/** Which language a line is written in, from its script (for picking the voice). */
export function scriptLang(text: string): string {
  if (/[஀-௿]/.test(text)) return "ta";
  if (/[ఀ-౿]/.test(text)) return "te";
  if (/[ঀ-৿]/.test(text)) return "bn";
  if (/[઀-૿]/.test(text)) return "gu";
  if (/[ಀ-೿]/.test(text)) return "kn";
  if (/[ഀ-ൿ]/.test(text)) return "ml";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  return "en";
}

/** Fetch and decode one spoken line (Chirp 3 HD). */
export async function fetchSpeech(text: string, voice: string): Promise<AudioBuffer> {
  const res = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json", ...headers() }, body: JSON.stringify({ text, lang: scriptLang(text), voice }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Voice unavailable" }))).error);
  const { ctx } = audio();
  return ctx.decodeAudioData(await res.arrayBuffer());
}

let current: AudioBufferSourceNode | null = null;
/** Play a decoded line; resolves when it ends or is stopped. */
export function play(b: AudioBuffer): Promise<void> {
  const { ctx, out } = audio();
  stopPlayback();
  return new Promise((resolve) => {
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(out);
    src.onended = () => {
      if (current === src) current = null;
      resolve();
    };
    current = src;
    src.start();
  });
}
export function stopPlayback() {
  try {
    current?.stop();
  } catch {
    /* already ended */
  }
  current = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

// ---------------------------------------------------------------- the microphone

export interface Mic {
  level: () => number;
  /** Record one turn: waits for speech, stops after a pause. Resolves with the audio, or null if nobody spoke. */
  turn: (opts?: { waitMs?: number; maxMs?: number; onSpeech?: () => void }) => Promise<Blob | null>;
  stopTurn: () => void;
  close: () => void;
}

export async function openMic(): Promise<Mic> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  const { ctx } = audio();
  const an = ctx.createAnalyser();
  an.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(an);
  let stop: (() => void) | null = null;
  const mime = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  return {
    level: () => levelOf(an),
    stopTurn: () => stop?.(),
    close: () => {
      stop?.();
      stream.getTracks().forEach((t) => t.stop());
    },
    turn: ({ waitMs = 9000, maxMs = 25000, onSpeech } = {}) =>
      new Promise((resolve) => {
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks: Blob[] = [];
        let spoke = false;
        let quietSince = 0;
        let noise = 0.02;
        const t0 = performance.now();
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
          clearInterval(tick);
          resolve(spoke && chunks.length ? new Blob(chunks, { type: rec.mimeType || "audio/webm" }) : null);
        };
        stop = () => rec.state !== "inactive" && rec.stop();
        // A simple voice-activity detector: learns the room's noise, starts on speech, ends on a pause.
        const tick = setInterval(() => {
          const l = levelOf(an);
          const now = performance.now();
          if (!spoke) {
            noise = noise * 0.95 + l * 0.05;
            if (l > Math.max(0.08, noise * 2.6)) {
              spoke = true;
              onSpeech?.();
            } else if (now - t0 > waitMs) stop?.();
          } else {
            if (l < Math.max(0.05, noise * 1.8)) {
              quietSince ||= now;
              if (now - quietSince > 1500) stop?.();
            } else quietSince = 0;
            if (now - t0 > maxMs) stop?.();
          }
        }, 50);
        rec.start(250);
      }),
  };
}

/** Send one recorded turn to speech-to-text. */
export async function transcribe(blob: Blob, lang: string, seed: number): Promise<{ text: string; language: string | null; engine: string | null }> {
  const res = await fetch(`/api/voice/stt?lang=${lang}&seed=${seed}`, { method: "POST", headers: { "Content-Type": blob.type || "audio/webm", ...headers() }, body: blob });
  const d = await res.json().catch(() => ({}));
  if (res.status === 401 && d.passcode) window.dispatchEvent(new Event(PASSCODE_EVENT));
  if (!res.ok) throw new Error(d.error ?? "Could not hear that");
  return d;
}
