// Jugnu's ears and voice. Speech-to-text: Google Chirp 3 (any Indian language, mixed speech, written
// in the speaker's own script) when Google credentials are present; otherwise Google's v1 recogniser
// with an API key, steered towards the block's school, cluster and teacher names. Text-to-speech:
// Google Chirp 3 HD voices in Hindi, Indian English and other Indian languages.
// All language-model work (understanding, answering, agent tools) is Claude — see ../claude.ts.
// TODO(bhashini): add Sarvam / Bhashini as an alternative engine behind transcribe() and synthesize()
// (same Heard / Buffer contracts), chosen by a SPEECH_PROVIDER env. Tracked in PROJECT-HISTORY §12.
import { GoogleAuth } from "google-auth-library";
import { createHash } from "node:crypto";

const KEY = () => process.env.GOOGLE_CLOUD_API_KEY;
const PROJECT = () => process.env.GOOGLE_CLOUD_PROJECT || "ai-pro-developer";

export const voiceConfigured = () => Boolean(KEY());

/** BCP-47 codes for the languages the console speaks; recognition also accepts these. */
export const LOCALES: Record<string, string> = { en: "en-IN", hi: "hi-IN", ta: "ta-IN", te: "te-IN", mr: "mr-IN", bn: "bn-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN" };

/** Voices offered in the console (Chirp 3 HD). The first is the default. */
export const VOICES = ["Aoede", "Leda", "Kore", "Zephyr", "Charon", "Puck", "Orus", "Fenrir"] as const;

let auth: GoogleAuth | null = null;
let adcOk: boolean | null = null;

/** Google credentials for Chirp 3: a service-account JSON in GOOGLE_SERVICE_ACCOUNT_JSON, or the machine's own gcloud login. */
async function googleClient() {
  if (adcOk === false) return null;
  // On a hosted server only an explicit service account counts (no gcloud login there).
  if (process.env.VERCEL && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;
  try {
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    auth ??= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"], ...(json ? { credentials: JSON.parse(json) } : {}) });
    const c = await auth.getClient();
    adcOk = true;
    return c;
  } catch {
    adcOk = false;
    return null;
  }
}

export interface Heard {
  text: string;
  language: string | null;
  engine: "chirp_3" | "google_v1";
}

/** Speech to text. `lang` is the console language; Chirp 3 also hears other languages and mixed speech. */
export async function transcribe(audio: Buffer, mime: string, lang: string, hints: string[]): Promise<Heard> {
  const locale = LOCALES[lang] ?? "en-IN";
  const client = await googleClient();
  if (client) {
    try {
      const r = await client.request<{ results?: { alternatives?: { transcript?: string }[]; languageCode?: string }[] }>({
        url: `https://us-speech.googleapis.com/v2/projects/${PROJECT()}/locations/us/recognizers/_:recognize`,
        method: "POST",
        headers: { "x-goog-user-project": PROJECT() },
        data: {
          config: {
            autoDecodingConfig: {},
            model: "chirp_3",
            // The interview language first, then the other one: "auto" guesses wrong on short phone answers ("हाँ").
            languageCodes: [locale, ...["hi-IN", "en-IN"].filter((l) => l !== locale)],
            features: { enableAutomaticPunctuation: true },
            // (Chirp 3 takes no phrase hints; the agent matches misheard names to the block's schools.)
          },
          content: audio.toString("base64"),
        },
        timeout: 20000,
      });
      const res = r.data.results ?? [];
      return { text: res.map((x) => x.alternatives?.[0]?.transcript ?? "").join(" ").trim(), language: res[0]?.languageCode ?? null, engine: "chirp_3" };
    } catch (e) {
      console.warn("Chirp 3 failed, falling back:", (e as Error).message);
    }
  }
  const key = KEY();
  if (!key) throw new Error("Voice is not configured (GOOGLE_CLOUD_API_KEY).");
  const encoding = mime.includes("ogg") ? "OGG_OPUS" : mime.includes("webm") ? "WEBM_OPUS" : undefined;
  const others = [...new Set(["en-IN", "hi-IN"].filter((l) => l !== locale))];
  const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: {
        ...(encoding ? { encoding, sampleRateHertz: 48000 } : {}),
        languageCode: locale,
        alternativeLanguageCodes: others,
        enableAutomaticPunctuation: true,
        speechContexts: hints.length ? [{ phrases: hints.slice(0, 450), boost: 12 }] : undefined,
      },
      audio: { content: audio.toString("base64") },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const d = (await res.json()) as { results?: { alternatives?: { transcript?: string }[]; languageCode?: string }[]; error?: { message: string } };
  if (d.error) throw new Error(`Speech recognition: ${d.error.message}`);
  const r = d.results ?? [];
  return { text: r.map((x) => x.alternatives?.[0]?.transcript ?? "").join(" ").trim(), language: r[0]?.languageCode ?? null, engine: "google_v1" };
}

const cache = new Map<string, Buffer>();

export type TtsFormat = "mp3" | "pcm8k";

/**
 * Text to speech with a Chirp 3 HD voice. "mp3" (default) is for browsers; "pcm8k" is raw 16-bit
 * mono 8 kHz PCM for telephone streams (the WAV header Google returns is stripped). Short lines
 * are cached (briefings and interview openers repeat).
 */
export async function synthesize(text: string, lang: string, voice?: string, format: TtsFormat = "mp3"): Promise<Buffer> {
  const key = KEY();
  if (!key) throw new Error("Voice is not configured (GOOGLE_CLOUD_API_KEY).");
  const locale = LOCALES[lang] ?? "en-IN";
  const name = `${locale}-Chirp3-HD-${VOICES.includes(voice as (typeof VOICES)[number]) ? voice : VOICES[0]}`;
  const id = createHash("sha1").update(`${name}|${format}|${text}`).digest("hex");
  const hit = cache.get(id);
  if (hit) return hit;
  const audioConfig =
    format === "pcm8k" ? { audioEncoding: "LINEAR16", sampleRateHertz: 8000, speakingRate: 0.95 } : { audioEncoding: "MP3", speakingRate: 0.97 };
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: { text }, voice: { languageCode: locale, name }, audioConfig }),
    signal: AbortSignal.timeout(20000),
  });
  const d = (await res.json()) as { audioContent?: string; error?: { message: string } };
  if (!d.audioContent) throw new Error(`Text to speech: ${d.error?.message ?? "no audio"}`);
  let buf = Buffer.from(d.audioContent, "base64");
  if (format === "pcm8k" && buf.length > 44 && buf.toString("ascii", 0, 4) === "RIFF") buf = buf.subarray(44);
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  cache.set(id, buf);
  return buf;
}

/** Wrap raw 16-bit mono PCM in a WAV header so the recognisers can auto-detect it. */
export function pcmToWav(pcm: Buffer, sampleRate = 8000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
