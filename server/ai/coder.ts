// CONTRAST input: code a finished interview into the practice taxonomy. Claude reads meaning
// (code-mixed Hindi/English, practices described without the usual keywords, brand-new practices);
// the guardrail keeps only quotes that are verbatim in what the TEACHER said, and specificity is
// re-scored deterministically so offline and Claude codings are comparable.
import { z } from "zod";
import { codeInterview } from "../../src/engine/interview";
import { PRACTICE_IDS, PRACTICES, specificity, type PracticeId } from "../../src/engine/practices";
import type { Turn } from "../../src/engine/types";
import { askClaude } from "../claude";
import { groundQuote, normalize, type Check } from "./guardrails";
import { SAFETY } from "./interviewer";
import { runAI, type AIResult } from "./run";

export interface Coding {
  practice: PracticeId | null;
  newName: string | null;
  quote: string;
  specificity: number;
  grounded: boolean;
  note: string | null;
}

const taxonomy = PRACTICE_IDS.map((p) => `${p}: ${PRACTICES[p].label} — ${PRACTICES[p].what}`).join("\n");

const CodeSchema = z.object({
  mentions: z.array(
    z.object({
      practice: z.enum(PRACTICE_IDS as [PracticeId, ...PracticeId[]]),
      quote: z.string().describe("The teacher's exact words, copied verbatim in the original language"),
      details: z.array(z.string()).describe("Concrete details copied word-for-word from the quote: a duration, a frequency, a material, a step, what children do"),
      note: z.string().describe("One line: what the teacher actually does"),
    }),
  ),
  new_practices: z.array(
    z.object({
      name: z.string().describe("Short English name for a routine that fits no taxonomy entry"),
      quote: z.string().describe("The teacher's exact words, verbatim"),
      details: z.array(z.string()),
      note: z.string(),
    }),
  ),
});

export function offlineCoding(turns: Turn[]): Coding[] {
  return codeInterview(turns).map((m) => ({ practice: m.practice, newName: null, quote: m.quote, specificity: m.specificity, grounded: true, note: null }));
}

/** Guardrail for a Claude coding. Exported for tests. */
export function guardCoding(out: z.infer<typeof CodeSchema>, turns: Turn[]) {
  const said = turns.filter((t) => t.speaker === "teacher").map((t) => t.text);
  const all = [
    ...out.mentions.map((m) => ({ practice: m.practice as PracticeId, newName: null, quote: m.quote, details: m.details, note: m.note })),
    ...out.new_practices.map((m) => ({ practice: null, newName: m.name, quote: m.quote, details: m.details, note: m.note })),
  ];
  // Specificity = the larger of the keyword cue count and the number of Claude's concrete details
  // that really appear in the quote — so a detail only counts if the teacher actually said it.
  const coded: Coding[] = all.map(({ details, ...m }) => {
    const verified = new Set(details.map(normalize).filter((d) => d.length >= 3 && normalize(m.quote).includes(d))).size;
    return { ...m, grounded: groundQuote(m.quote, said).grounded, specificity: Math.min(6, Math.max(specificity(m.quote), verified)) };
  });
  const kept = coded.filter((c) => c.grounded);
  const lexicon = new Set(codeInterview(turns).map((m) => m.practice));
  const claudeSet = new Set(kept.flatMap((c) => (c.practice ? [c.practice] : [])));
  const both = [...claudeSet].filter((p) => lexicon.has(p)).length;
  const union = new Set([...claudeSet, ...lexicon]).size;
  const checks: Check[] = [
    { name: "quotes are verbatim", passed: coded.length === kept.length, detail: `${kept.length}/${coded.length} grounded${coded.length > kept.length ? " — ungrounded quotes dropped" : ""}` },
    { name: "agreement with keyword coder", passed: true, detail: union ? `${Math.round((100 * both) / union)}% overlap` : "nothing to compare" },
  ];
  // Reject only if Claude produced quotes and none of them is real.
  return { value: kept, checks, accept: coded.length === 0 || kept.length > 0 };
}

export async function codeTranscript(turns: Turn[], ref?: string): Promise<AIResult<Coding[]>> {
  return runAI({
    task: "interview.code",
    ref,
    timeoutMs: 45000,
    offline: () => offlineCoding(turns),
    claude: (signal) =>
      askClaude({
        system: `${SAFETY}
You code interview transcripts for a positive-deviance study of foundational learning.
Code ONLY what the TEACHER said, never Jugnu's questions. Copy each quote verbatim (original language, no translation, no paraphrase).
Code a practice only if the teacher describes doing it — not if they merely agree with a question.
A routine that fits no taxonomy entry goes in new_practices.`,
        content: `Practice taxonomy:\n${taxonomy}\n\nTranscript (JSON):\n${JSON.stringify(turns.map((t) => ({ speaker: t.speaker, text: t.text })))}`,
        schema: CodeSchema,
        effort: "medium",
        maxTokens: 8000,
        signal,
      }),
    guard: (out) => guardCoding(out, turns),
  });
}
