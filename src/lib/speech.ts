// Browser speech: Mitthu speaks (speechSynthesis) and listens (Web Speech recognition).
// In production these are swapped for Indic ASR/TTS (Bhashini / AI4Bharat / Sarvam);
// the interface stays the same.

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(lang.split("-")[0])) ?? undefined;
}

export function speak(text: string, lang = "hi-IN", rate = 0.95): Promise<void> {
  return new Promise((resolve) => {
    if (!canSpeak()) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = lang.startsWith("hi") ? 1.15 : 1;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): (new () => RecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => typeof window !== "undefined" && recognitionCtor() !== null;

export function listen(lang = "hi-IN", onInterim?: (text: string) => void): { promise: Promise<string>; stop: () => void } {
  const Ctor = recognitionCtor();
  if (!Ctor) return { promise: Promise.reject(new Error("Speech recognition is not available in this browser — type the reply instead.")), stop: () => {} };
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  let finalText = "";
  const promise = new Promise<string>((resolve, reject) => {
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      finalText = text;
      onInterim?.(text);
    };
    rec.onerror = (e) => reject(new Error(e.error === "not-allowed" ? "Microphone permission denied." : `Speech recognition error: ${e.error}`));
    rec.onend = () => resolve(finalText.trim());
  });
  rec.start();
  return { promise, stop: () => rec.stop() };
}
