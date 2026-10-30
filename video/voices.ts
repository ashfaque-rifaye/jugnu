// The intro's two lines, in the voice Jugnu uses on real calls (Chirp 3 HD "Aoede") and a teacher's.
// Run: npx tsx --env-file=.env video/voices.ts
import { existsSync, writeFileSync } from "node:fs";
import { synthesize } from "../server/voice";

const LINES = [
  { file: "jugnu.mp3", voice: "Aoede", text: "नमस्ते सुनीता जी। मैं जुगनू हूँ। आपके बच्चे अच्छा पढ़ने लगे हैं — आपने क्या अलग किया?" },
  { file: "teacher.mp3", voice: "Kore", text: "हम अक्षरों से खेल बनाते हैं… रोज़ दस मिनट।" },
  { file: "closing.mp3", voice: "Aoede", text: "जो काम करता है — वो हर स्कूल तक।" },
];

for (const l of LINES) {
  const file = new URL(`./assets/${l.file}`, import.meta.url);
  if (existsSync(file)) continue;
  writeFileSync(file, await synthesize(l.text, "hi", l.voice));
  console.log("wrote", l.file);
}
