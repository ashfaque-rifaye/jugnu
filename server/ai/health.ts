// Is the AI really answering? A key on the server proves nothing (a spending cap, a bad key or an
// outage all look the same from outside), so each check makes one tiny real call. The server runs
// the checks when it starts and every 30 minutes and logs any change. The console shows none of this.
import { claudeAvailable, describeError, getClient, MODEL } from "../claude";
import { synthesize, transcribe, voiceConfigured } from "../voice";
import { GEMINI_MODEL, geminiAvailable, geminiText } from "./gemini";
import { logCall } from "./run";

export interface Check {
  ok: boolean;
  detail: string;
}

export interface Health {
  ok: boolean;
  checkedAt: string;
  claude: Check;
  gemini: Check;
  speaking: Check;
  listening: Check;
}

/** One short Claude call on the cheapest allowed model. Successful ones are logged so `npm run credits` counts them. */
export async function checkClaude(): Promise<Check> {
  if (!claudeAvailable()) return { ok: false, detail: "No API key on this server" };
  const started = Date.now();
  try {
    const r = await getClient().messages.create(
      { model: MODEL, max_tokens: 8, messages: [{ role: "user", content: "Reply with the word OK." }] },
      { signal: AbortSignal.timeout(15000), maxRetries: 0 },
    );
    const ms = Date.now() - started;
    await logCall("health.check", null, "claude", r.model, ms, r.usage, [], true, null);
    return { ok: true, detail: `${r.model} answered in ${ms} ms` };
  } catch (error) {
    return { ok: false, detail: describeError(error) };
  }
}

/** One short Gemini call: the backup is only worth having if it answers. */
async function checkGemini(): Promise<Check> {
  if (!geminiAvailable()) return { ok: false, detail: "No Google credentials on this server" };
  const started = Date.now();
  try {
    const said = await geminiText("Reply with one word.", "Say OK", 60);
    return said ? { ok: true, detail: `${GEMINI_MODEL} answered in ${Date.now() - started} ms` } : { ok: false, detail: "Empty answer" };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

/** Google speech, both ways: say a phrase, then hear it back. The number changes because synthesize() caches. */
async function checkSpeech(): Promise<{ speaking: Check; listening: Check }> {
  if (!voiceConfigured()) {
    const off = { ok: false, detail: "No Google key on this server" };
    return { speaking: off, listening: off };
  }
  let audio: Buffer;
  try {
    audio = await synthesize(`जाँच संख्या ${Date.now() % 1000}`, "hi");
  } catch (error) {
    const detail = (error as Error).message;
    return { speaking: { ok: false, detail }, listening: { ok: false, detail: "Not checked: nothing to listen to" } };
  }
  const speaking = { ok: true, detail: `${audio.length} bytes of audio` };
  try {
    const heard = await transcribe(audio, "audio/mpeg", "hi", []);
    return { speaking, listening: heard.text.trim() ? { ok: true, detail: `${heard.engine} heard "${heard.text.trim()}"` } : { ok: false, detail: "Heard nothing" } };
  } catch (error) {
    return { speaking, listening: { ok: false, detail: (error as Error).message } };
  }
}

export async function runChecks(): Promise<Health> {
  const [claude, gemini, speech] = await Promise.all([checkClaude(), checkGemini(), checkSpeech()]);
  return { ok: (claude.ok || gemini.ok) && speech.speaking.ok && speech.listening.ok, checkedAt: new Date().toISOString(), claude, gemini, ...speech };
}

let last: Health | null = null;

/** The latest result. Younger than five minutes is reused, so asking often does not spend anything. */
export async function aiHealth(maxAgeMs = 5 * 60_000): Promise<Health> {
  if (last && Date.now() - Date.parse(last.checkedAt) < maxAgeMs) return last;
  last = await runChecks();
  return last;
}

const line = (h: Health) => (["claude", "gemini", "speaking", "listening"] as const).map((k) => `${k} ${h[k].ok ? "ok" : `DOWN (${h[k].detail})`}`).join(" · ");

/** Check now and every 30 minutes; write to the server log on the first run and whenever the answer changes. */
export function watchAI() {
  let said = "";
  const check = () =>
    aiHealth(0)
      .then((h) => {
        // Compare up or down only: an error's text changes on every call (it carries a request id).
        const now = [h.claude.ok, h.gemini.ok, h.speaking.ok, h.listening.ok].join();
        if (now !== said) console.log(`AI check: ${line(h)}`);
        said = now;
      })
      .catch((e) => console.error("AI check failed", e));
  void check();
  setInterval(check, 30 * 60_000).unref();
}
