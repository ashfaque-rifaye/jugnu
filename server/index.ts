import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { codeInterview, nextQuestion, SCRIPT } from "../src/engine/interview";
import { PRACTICE_IDS, PRACTICES } from "../src/engine/practices";
import type { Turn } from "../src/engine/types";
import { askClaude, claudeAvailable, describeError, MODEL } from "./claude";

const app = express();
app.use(express.json({ limit: "4mb" }));
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT || 8788);

const SAFETY = `You work for a Block Education Office in India, learning from government primary-school teachers.
Rules: be warm and respectful; never judge, rank or blame a teacher; never ask about caste, religion, politics or personal life;
focus on concrete classroom routines; if something is unclear, ask rather than assume.`;

const taxonomy = PRACTICE_IDS.map((p) => `${p}: ${PRACTICES[p].label} — ${PRACTICES[p].what}`).join("\n");

app.get("/api/status", (_req, res) => res.json({ claude: claudeAvailable(), model: claudeAvailable() ? MODEL : null }));

// ---------------------------------------------------------------- the AI interviewer
const NextSchema = z.object({ text: z.string(), text_en: z.string(), done: z.boolean(), reason: z.string() });

app.post("/api/interview/next", async (req, res) => {
  const { turns, language } = req.body as { turns: Turn[]; language?: "hi" | "en" };
  const offline = () => {
    const q = nextQuestion(turns);
    return {
      source: "offline",
      text: q?.text ?? "बहुत धन्यवाद! आपकी बात दूसरे शिक्षकों तक पहुँचेगी — आपकी अनुमति से।",
      text_en: q?.textEn ?? "Thank you — with your permission, this will reach other teachers.",
      done: !q,
    };
  };
  if (!claudeAvailable()) return res.json(offline());
  try {
    const out = await askClaude({
      system: `${SAFETY}
You are "Jugnu", conducting a 12-minute phone interview with a teacher whose children learn unusually well for their context (positive-deviance inquiry).
Goal: surface SPECIFIC, transferable routines (what exactly happens, how many minutes, which materials, what children do, how often).
Cover these areas in order, one question at a time: ${SCRIPT.map((q) => q.en).join(" | ")}
If the last answer names a practice but gives no specifics, ask ONE follow-up for specifics before moving on.
Ask in ${language === "en" ? "simple English" : "simple spoken Hindi (Devanagari)"}; keep each question under 30 words.
Finish (done=true) with a thank-you once all areas are covered or after about 14 questions.`,
      content: `Conversation so far (JSON):\n${JSON.stringify(turns)}\n\nWrite Jugnu's next turn.`,
      schema: NextSchema,
      effort: "low",
    });
    res.json({ source: "claude", ...out });
  } catch (error) {
    res.json({ ...offline(), warning: describeError(error) });
  }
});

// ---------------------------------------------------------------- code a transcript into practices
const CodeSchema = z.object({
  mentions: z.array(
    z.object({
      practice: z.enum(PRACTICE_IDS as [string, ...string[]]),
      quote: z.string(),
      specificity: z.number().int(),
      note: z.string(),
    }),
  ),
  new_practices: z.array(z.object({ name: z.string(), description: z.string(), quote: z.string() })),
});

app.post("/api/interview/code", async (req, res) => {
  const { turns } = req.body as { turns: Turn[] };
  const offline = { source: "offline", mentions: codeInterview(turns), new_practices: [] };
  if (!claudeAvailable()) return res.json(offline);
  try {
    const out = await askClaude({
      system: `${SAFETY}
You code interview transcripts for a positive-deviance study. Only code what the TEACHER said. Quote the teacher verbatim (original language).
specificity = number of concrete cues in the quote (0–6): a duration, a frequency, a material, a sequence of steps, what children do, a named group or structure.
Practices that do not fit the taxonomy go in new_practices.`,
      content: `Practice taxonomy:\n${taxonomy}\n\nTranscript (JSON):\n${JSON.stringify(turns)}`,
      schema: CodeSchema,
      effort: "medium",
    });
    res.json({ source: "claude", ...out });
  } catch (error) {
    res.json({ ...offline, warning: describeError(error) });
  }
});

// ---------------------------------------------------------------- voice note in the demonstrator's own words
const NoteSchema = z.object({ voice_hi: z.string(), voice_en: z.string() });

app.post("/api/voice-note", async (req, res) => {
  const { draftHi, draftEn, practice } = req.body as { draftHi: string; draftEn: string; practice: string };
  if (!claudeAvailable()) return res.json({ source: "offline", voice_hi: draftHi, voice_en: draftEn });
  try {
    const out = await askClaude({
      system: `${SAFETY}
Rewrite a 60-second peer-to-peer voice note from one teacher to another. Keep every fact, the demonstrator's own words, and the invitation to visit. Warm, spoken, simple.`,
      content: `Practice: ${practice}\nDraft (Hindi): ${draftHi}\nDraft (English): ${draftEn}`,
      schema: NoteSchema,
      effort: "low",
    });
    res.json({ source: "claude", ...out });
  } catch (error) {
    res.json({ source: "offline", voice_hi: draftHi, voice_en: draftEn, warning: describeError(error) });
  }
});

// ---------------------------------------------------------------- the officer asks about the block
const AskSchema = z.object({ answer: z.string(), schools: z.array(z.string()), next_step: z.string() });

app.post("/api/ask", async (req, res) => {
  const { question, context } = req.body as { question: string; context: unknown };
  if (!claudeAvailable()) return res.status(503).json({ offline: true });
  try {
    const out = await askClaude({
      system: `${SAFETY}
You brief a Block Education Officer. Use ONLY the block evidence given; name schools; give one concrete next step with an owner. If the data cannot answer, say which check would.`,
      content: `Block evidence (JSON):\n${JSON.stringify(context).slice(0, 60000)}\n\nOfficer asks: ${question}`,
      schema: AskSchema,
      effort: "medium",
    });
    res.json({ source: "claude", ...out });
  } catch (error) {
    res.status(502).json({ error: describeError(error) });
  }
});

const dist = path.resolve(here, "../dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => console.log(`Jugnu API on http://localhost:${PORT} — Claude ${claudeAvailable() ? `connected (${MODEL})` : "not connected (offline engine)"}`));
