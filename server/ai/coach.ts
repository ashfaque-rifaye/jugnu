// Teacher coach: a teacher describes a classroom problem ("मेरे बच्चे मात्रा में अटकते हैं") and Jugnu
// answers ONLY with practices proven in their own block — distinctive in bright spots against matched
// comparison schools — quoting a bright-spot teacher's own words and naming the nearest school that
// does it. Nothing generic, nothing invented: the quote must be one of the block's coded quotes.
import { z } from "zod";
import { trip } from "../../src/engine/geo";
import type { PipelineState } from "../../src/engine/pipeline";
import { PRACTICE_IDS, PRACTICES, type PracticeId } from "../../src/engine/practices";
import { askClaude } from "../claude";
import { groundQuote, type Check } from "./guardrails";
import { SAFETY } from "./interviewer";
import { runAI, type AIResult } from "./run";

export interface CoachAnswer {
  practice: PracticeId | null;
  answer: string;
  steps: string[];
  quote: string | null;
  demonstrator: { school: string; teacher: string; roadKm: number | null } | null;
}

const Schema = z.object({
  practice: z.enum(PRACTICE_IDS as [PracticeId, ...PracticeId[]]).nullable().describe("One of the proven practices listed, or null if none fits"),
  answer: z.string().describe("2–3 sentences in the teacher's language, warm and practical"),
  steps: z.array(z.string()).max(4).describe("Concrete first steps for tomorrow, in the teacher's language"),
  quote: z.string().nullable().describe("One quote copied exactly from the list, or null"),
});

const HINTS: [RegExp, PracticeId[]][] = [
  [/मात्रा|पढ़|अक्षर|शब्द|read|letter|word|level|स्तर/i, ["level_groups", "home_language"]],
  [/गिनती|गणित|अंक|जोड़|घटा|math|number|count/i, ["number_talk"]],
  [/भाषा|गोंडी|बुंदेली|समझ नहीं|language|understand/i, ["home_language"]],
  [/गैरहाज़िर|अनुपस्थित|नहीं आते|छूट|absent|attendance|miss/i, ["absent_buddies"]],
  [/माता|पिता|अभिभावक|parent/i, ["parent_voice"]],
];

function proven(st: PipelineState) {
  return st.evidence
    .filter((e) => e.verdict === "distinctive")
    .map((e) => {
      const doers = st.interviews
        .filter((i) => i.group !== "comparison" && st.bright.includes(i.schoolId) && i.mentions.some((m) => m.practice === e.practice && m.specificity >= 2))
        .map((i) => st.block.schools.find((s) => s.id === i.schoolId)!)
        .filter(Boolean);
      return { e, p: PRACTICES[e.practice], doers };
    });
}

function nearestDoer(st: PipelineState, practice: PracticeId, schoolId?: string) {
  const list = proven(st).find((x) => x.e.practice === practice)?.doers ?? [];
  const here = schoolId ? st.block.schools.find((s) => s.id === schoolId) : undefined;
  const best = here ? list.map((d) => ({ d, km: trip(here, d).roadKm })).sort((a, b) => a.km - b.km)[0] : list[0] ? { d: list[0], km: null } : undefined;
  return best ? { school: best.d.name, teacher: best.d.teacher, roadKm: best.km } : null;
}

export function offlineCoach(question: string, st: PipelineState, lang: "hi" | "en", schoolId?: string): CoachAnswer {
  const list = proven(st);
  const wanted = HINTS.filter(([re]) => re.test(question)).flatMap(([, ps]) => ps);
  const lexical = list.filter((x) => x.p.lexicon.test(question)).map((x) => x.e.practice);
  const pick = [...wanted, ...lexical].find((p) => list.some((x) => x.e.practice === p)) ?? null;
  if (!pick) {
    return {
      practice: null,
      answer:
        lang === "hi"
          ? "आपके ब्लॉक में अभी इस समस्या के लिए कोई सिद्ध तरीका नहीं मिला है। अपने CRP से बात कीजिए — वे आपको पास के किसी स्कूल से जोड़ सकते हैं।"
          : "No practice proven in your block fits this yet. Talk to your CRP; they can connect you with a nearby school.",
      steps: [],
      quote: null,
      demonstrator: null,
    };
  }
  const x = list.find((y) => y.e.practice === pick)!;
  return {
    practice: pick,
    answer: lang === "hi" ? `आपके ब्लॉक के अच्छे स्कूलों में "${x.p.labelHi}" काम कर रहा है।` : `In your block's bright spots, "${x.p.label}" is what works.`,
    steps: [x.p.what],
    quote: x.e.quotes[0]?.quote ?? null,
    demonstrator: nearestDoer(st, pick, schoolId),
  };
}

export async function askCoach(question: string, st: PipelineState, lang: "hi" | "en", schoolId?: string): Promise<AIResult<CoachAnswer>> {
  const list = proven(st);
  const quotes = list.flatMap((x) => x.e.quotes.map((q) => q.quote));
  const menu = list
    .map((x) => `- ${x.e.practice}: ${x.p.label} / ${x.p.labelHi}. ${x.p.what} In bright spots ${x.e.bright.k}/${x.e.bright.n}, in similar schools ${x.e.comparison.k}/${x.e.comparison.n}.\n  Quotes:\n${x.e.quotes.map((q) => `  · ${q.quote}`).join("\n")}`)
    .join("\n");
  return runAI({
    task: "coach.answer",
    ref: schoolId ?? null,
    timeoutMs: 25000,
    offline: () => offlineCoach(question, st, lang, schoolId),
    claude: (signal) =>
      askClaude({
        system: `${SAFETY}
You coach a government primary-school teacher in ${st.block.name}, ${st.block.district}. Answer in ${lang === "hi" ? "simple Hindi (Devanagari)" : "simple English"}.
Use ONLY the practices below — they are proven in this block's own bright spots against similar schools. If none fits the problem, set practice to null and say so kindly; never suggest anything else.
Copy at most one quote exactly from the list. Steps must be things the teacher can do tomorrow with no new materials unless the practice needs them.

Proven practices:
${menu || "(none yet)"}`,
        content: `Teacher's problem: ${question}`,
        schema: Schema,
        effort: "low",
        maxTokens: 1500,
        signal,
      }),
    guard: (raw) => {
      const okPractice = raw.practice === null || list.some((x) => x.e.practice === raw.practice);
      const g = raw.quote ? groundQuote(raw.quote, quotes) : { grounded: true };
      const checks: Check[] = [
        { name: "practice is proven in this block", passed: okPractice },
        { name: "quote is one of the block's coded quotes", passed: g.grounded },
        { name: "answer in the teacher's language", passed: lang === "hi" ? /[ऀ-ॿ]/.test(raw.answer) : true },
      ];
      const value: CoachAnswer = { ...raw, demonstrator: raw.practice ? nearestDoer(st, raw.practice, schoolId) : null };
      return { value, checks, accept: checks.every((c) => c.passed) };
    },
  });
}
