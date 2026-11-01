// Speech for the teacher's page and the small mic buttons: Google Chirp 3 speaks and listens, through
// the server. With no network or no Google, speaking falls back to the browser's own voice, and
// listening rejects so the page can offer typing instead.
import { fetchSpeech, openMic, play, stopPlayback, transcribe, type Mic } from "./voice";

const VOICE = "Aoede";

export function canSpeak(): boolean {
  return typeof window !== "undefined";
}

function browserVoice(text: string, lang: string, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = lang.startsWith("hi") ? 1.15 : 1;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(lang.split("-")[0]));
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

let run = 0; // a newer line, or a stop, cancels a line still being fetched

export async function speak(text: string, lang = "hi-IN", rate = 0.95): Promise<void> {
  const me = ++run;
  stopPlayback();
  let line: AudioBuffer;
  try {
    line = await fetchSpeech(text, VOICE);
  } catch {
    if (me === run) await browserVoice(text, lang, rate);
    return;
  }
  if (me === run) await play(line);
}

export function stopSpeaking() {
  run++;
  stopPlayback();
}

export const canListen = () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/** Record one spoken answer and read it with Google. Resolves with "" if nobody spoke. */
export function listen(lang = "hi-IN", _onInterim?: (text: string) => void): { promise: Promise<string>; stop: () => void } {
  let mic: Mic | null = null;
  let stopped = false;
  const promise = (async () => {
    mic = await openMic();
    try {
      if (stopped) return "";
      const blob = await mic.turn({ waitMs: 12000, maxMs: 55000 });
      return blob ? (await transcribe(blob, lang.split("-")[0], Number.NaN)).text.trim() : "";
    } finally {
      mic.close();
    }
  })();
  return {
    promise,
    stop: () => {
      stopped = true;
      mic?.stopTurn();
    },
  };
}
