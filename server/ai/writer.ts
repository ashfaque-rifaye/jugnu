// SPREAD outputs written by Claude — a practice card built only from teachers' own quotes, and a
// 60-second peer voice note. Both are checked for invented numbers and length, then wait in the
// human review queue: nothing reaches a teacher until a CRP or the BEO approves it.
import { z } from "zod";
import { PRACTICES, type PracticeId } from "../../src/engine/practices";
import { askClaude } from "../claude";
import { checkKeepsNumbers, checkLanguage, checkLength, checkNoInventedNumbers, checkSafeTopic, type Check } from "./guardrails";
import { SAFETY } from "./interviewer";
import { runAI, type AIResult } from "./run";

// ---------------------------------------------------------------- practice card
export interface CardQuote {
  id: number;
  school: string;
  quote: string;
}

export interface PracticeCard {
  practice: PracticeId;
  title_hi: string;
  title_en: string;
  steps: { hi: string; en: string; quote_ids: number[] }[];
  materials: string[];
  time_hi: string;
  watch_out_hi: string;
}

const CardSchema = z.object({
  title_hi: z.string(),
  title_en: z.string(),
  steps: z
    .array(z.object({ hi: z.string().describe("One concrete step, Hindi"), en: z.string(), quote_ids: z.array(z.number().int()).describe("ids of the quotes this step comes from") }))
    .describe("3–5 steps a teacher can follow tomorrow"),
  materials: z.array(z.string()).describe("Only materials named in the quotes"),
  time_hi: z.string().describe("How long and how often, only as stated in the quotes"),
  watch_out_hi: z.string().describe("One common mistake to avoid, if the quotes suggest one; else empty"),
});

export function offlineCard(practice: PracticeId, quotes: CardQuote[]): PracticeCard {
  const p = PRACTICES[practice];
  return {
    practice,
    title_hi: p.labelHi,
    title_en: p.label,
    steps: quotes.slice(0, 3).map((q) => ({ hi: q.quote, en: p.what, quote_ids: [q.id] })),
    materials: [],
    time_hi: "",
    watch_out_hi: "",
  };
}

export function guardCard(out: z.infer<typeof CardSchema>, practice: PracticeId, quotes: CardQuote[]) {
  const ids = new Set(quotes.map((q) => q.id));
  const byId = new Map(quotes.map((q) => [q.id, q.quote]));
  const cited = out.steps.every((s) => s.quote_ids.length > 0 && s.quote_ids.every((i) => ids.has(i)));
  const stepNumbers = out.steps.map((s) => checkNoInventedNumbers(s.hi, s.quote_ids.map((i) => byId.get(i) ?? "")));
  const allText = [out.title_hi, ...out.steps.map((s) => s.hi), out.time_hi, out.watch_out_hi].join(" ");
  const checks: Check[] = [
    { name: "every step cites a teacher quote", passed: cited },
    { name: "no invented numbers", passed: stepNumbers.every((c) => c.passed) && checkNoInventedNumbers(out.time_hi, quotes.map((q) => q.quote)).passed, detail: stepNumbers.find((c) => !c.passed)?.detail },
    checkLanguage(out.steps.map((s) => s.hi).join(" "), "hi"),
    checkSafeTopic(allText),
    { name: "3–5 steps", passed: out.steps.length >= 2 && out.steps.length <= 6, detail: `${out.steps.length} steps` },
  ];
  return { value: { practice, ...out } as PracticeCard, checks, accept: checks.every((c) => c.passed) };
}

export async function draftCard(practice: PracticeId, quotes: CardQuote[]): Promise<AIResult<PracticeCard>> {
  return runAI({
    task: "spread.card",
    ref: practice,
    timeoutMs: 40000,
    offline: () => offlineCard(practice, quotes),
    claude: (signal) =>
      askClaude({
        system: `${SAFETY}
Turn teachers' own descriptions of a classroom routine into a one-page practice card another government-school teacher can use tomorrow.
Use ONLY what the quotes say. Every step must cite the quote ids it comes from. Do not add numbers, materials or claims that are not in the quotes.
Write Hindi in simple spoken style (Devanagari).`,
        content: `Practice: ${PRACTICES[practice].label}\nQuotes (JSON):\n${JSON.stringify(quotes)}`,
        schema: CardSchema,
        effort: "medium",
        maxTokens: 6000,
        signal,
      }),
    guard: (out) => guardCard(out, practice, quotes),
  });
}

// ---------------------------------------------------------------- 60-second peer voice note
export interface VoiceNote {
  voice_hi: string;
  voice_en: string;
}

const NoteSchema = z.object({ voice_hi: z.string(), voice_en: z.string() });

export function guardNote(out: VoiceNote, draftHi: string) {
  const checks: Check[] = [
    checkKeepsNumbers(out.voice_hi, draftHi),
    checkNoInventedNumbers(out.voice_hi, [draftHi]),
    checkLength(out.voice_hi, 170, "fits in 60 seconds"),
    checkLanguage(out.voice_hi, "hi"),
    checkSafeTopic(out.voice_hi),
  ];
  return { value: out, checks, accept: checks.every((c) => c.passed) };
}

export async function polishNote(args: { draftHi: string; draftEn: string; practice: string; ref?: string }): Promise<AIResult<VoiceNote>> {
  return runAI({
    task: "spread.voice_note",
    ref: args.ref ?? args.practice,
    timeoutMs: 25000,
    offline: () => ({ voice_hi: args.draftHi, voice_en: args.draftEn }),
    claude: (signal) =>
      askClaude({
        system: `${SAFETY}
Rewrite a 60-second peer-to-peer voice note from one teacher to another (under 150 words). Keep every fact, every number, the demonstrator's own words and the invitation to visit. Warm, spoken, simple Hindi.`,
        content: `Practice: ${args.practice}\nDraft (Hindi): ${args.draftHi}\nDraft (English): ${args.draftEn}`,
        schema: NoteSchema,
        effort: "low",
        maxTokens: 3000,
        signal,
      }),
    guard: (out) => guardNote(out, args.draftHi),
  });
}
