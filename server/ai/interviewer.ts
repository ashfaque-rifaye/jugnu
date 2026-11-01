// ASK, live: Jugnu's next turn in a 12-minute interview with a teacher, over a web voice call or a
// phone line. Claude adapts the conversation (follows up for specifics, skips what was already
// answered, mirrors the teacher's language); guardrails keep every question short, in the right
// language, on classroom routines only, and never repeated. The offline script is the fallback.
import { z } from "zod";
import { FOLLOW_UP, SCRIPT } from "../../src/engine/interview";
import { PRACTICE_IDS, PRACTICES, specificity } from "../../src/engine/practices";
import { askClaude } from "../claude";
import { checkLanguage, checkLength, checkSafeTopic, normalize, type Check } from "./guardrails";
import { runAI, type AIResult } from "./run";

export const TOPICS = SCRIPT.map((q) => q.id) as [string, ...string[]];
export type Lang = "hi" | "en";

export interface LiveTurn {
  speaker: "jugnu" | "teacher";
  text: string;
  text_en?: string | null;
  kind?: string | null;
  topic?: string | null;
}

export interface NextTurn {
  say: string;
  say_en: string;
  kind: "question" | "follow_up" | "clarify" | "closing";
  topic: string | null;
  done: boolean;
}

export const SAFETY = `You work for a Block Education Office in India, learning from government primary-school teachers.
Rules: be warm and respectful; never judge, rank or blame a teacher; never ask about caste, religion, politics, pay, transfers or personal life;
never ask for children's names or phone numbers; focus on concrete classroom routines; if something is unclear, ask rather than assume.
Words: say "school doing well", "similar school", "method" and "confirmation visit". Never say bright spot, bright school, spot check, positive deviance or inflation; a score that looks too high is "worth a respectful second visit".`;

export const MAX_QUESTIONS = 14;

export function closingTurn(lang: Lang): NextTurn {
  return {
    say: lang === "hi" ? "बहुत-बहुत धन्यवाद! आपकी बात से दूसरे स्कूलों के बच्चे भी सीखेंगे। आपकी अनुमति के बिना आपका नाम किसी को नहीं बताया जाएगा।" : "Thank you so much! Children in other schools will learn from what you shared. Your name will not be shared without your permission.",
    say_en: "Thank you so much! Children in other schools will learn from what you shared. Your name will not be shared without your permission.",
    kind: "closing",
    topic: null,
    done: true,
  };
}

export function clarifyTurn(lang: Lang): NextTurn {
  return {
    say: lang === "hi" ? "माफ़ कीजिए, आवाज़ साफ़ नहीं आई। क्या आप फिर से बता सकते हैं?" : "Sorry, I couldn't hear that clearly. Could you say it again?",
    say_en: "Sorry, I couldn't hear that clearly. Could you say it again?",
    kind: "clarify",
    topic: null,
    done: false,
  };
}

// "Please say that again" counts too, so a bad phone line can never keep the interview going forever.
const questionsAsked = (turns: LiveTurn[]) => turns.filter((t) => t.speaker === "jugnu" && (t.kind === "question" || t.kind === "follow_up" || t.kind === "clarify")).length;
const topicsAsked = (turns: LiveTurn[]) => new Set(turns.filter((t) => t.speaker === "jugnu" && t.kind === "question" && t.topic).map((t) => t.topic!));

/** The scripted interviewer: next uncovered topic, with one follow-up when an answer is vague. */
export function offlineNext(turns: LiveTurn[], lang: Lang): NextTurn {
  if (questionsAsked(turns) >= MAX_QUESTIONS) return closingTurn(lang);
  const last = turns[turns.length - 1];
  const prevJugnu = [...turns].reverse().find((t) => t.speaker === "jugnu");
  if (last?.speaker === "teacher" && prevJugnu?.kind === "question") {
    const named = PRACTICE_IDS.some((p) => PRACTICES[p].lexicon.test(last.text));
    if (named && specificity(last.text) < 2) return { say: lang === "hi" ? FOLLOW_UP.hi : FOLLOW_UP.en, say_en: FOLLOW_UP.en, kind: "follow_up", topic: prevJugnu.topic ?? null, done: false };
  }
  const asked = topicsAsked(turns);
  const q = SCRIPT.find((x) => !asked.has(x.id));
  if (!q) return closingTurn(lang);
  return { say: lang === "hi" ? q.hi : q.en, say_en: q.en, kind: "question", topic: q.id, done: false };
}

const NextSchema = z.object({
  say: z.string().describe("Jugnu's next utterance, in the interview language, spoken style, under 35 words"),
  say_en: z.string().describe("English translation of `say`"),
  kind: z.enum(["question", "follow_up", "clarify", "closing"]),
  topic: z.enum(TOPICS).nullable().describe("Which script area this turn belongs to; null for closing"),
  done: z.boolean().describe("true only for the closing thank-you"),
});

/** Guardrails for one interviewer turn. Exported for tests. */
export function guardTurn(out: NextTurn, turns: LiveTurn[], lang: Lang): { checks: Check[]; accept: boolean; value: NextTurn } {
  const previous = new Set(turns.filter((t) => t.speaker === "jugnu").map((t) => normalize(t.text)));
  const coveredEnough = topicsAsked(turns).size >= 5 || questionsAsked(turns) >= MAX_QUESTIONS;
  const lastAsk = turns.filter((t) => t.speaker === "jugnu").at(-1);
  const probingAgain = (out.kind === "follow_up" || out.kind === "clarify") && (lastAsk?.kind === "follow_up" || lastAsk?.kind === "clarify");
  const checks: Check[] = [
    checkSafeTopic(`${out.say} ${out.say_en}`),
    checkLength(out.say, 40, "short spoken turn"),
    checkLanguage(out.say, lang),
    { name: "does not repeat a question", passed: !previous.has(normalize(out.say)) },
    { name: "one follow-up, then moves on", passed: !probingAgain, detail: probingAgain ? "second follow-up in a row" : undefined },
    { name: "closes only when the script is covered", passed: !out.done || coveredEnough, detail: out.done && !coveredEnough ? "tried to end early" : undefined },
  ];
  const accept = checks.every((c) => c.passed);
  return { checks, accept, value: out.done ? { ...out, kind: "closing", topic: null } : out };
}

export async function nextTurn(turns: LiveTurn[], opts: { lang: Lang; ref?: string; group?: string; deadlineMs?: number }): Promise<AIResult<NextTurn>> {
  if (questionsAsked(turns) >= MAX_QUESTIONS) return { value: closingTurn(opts.lang), source: "offline", checks: [] };
  const asked = [...topicsAsked(turns)];
  return runAI({
    task: "interview.next",
    ref: opts.ref,
    timeoutMs: opts.deadlineMs ?? 15000,
    offline: () => offlineNext(turns, opts.lang),
    claude: (signal) =>
      askClaude({
        system: `${SAFETY}
You are "Jugnu", conducting a 12-minute ${opts.group === "bright" ? "appreciative interview with a teacher whose children learn unusually well for their context (positive-deviance inquiry)" : "interview with a teacher about daily classroom routines"}.
Goal: surface SPECIFIC, transferable routines — what exactly happens, for how many minutes, with which materials, what children do, how often.
Script areas (cover each once, in a natural order): ${SCRIPT.map((q) => `${q.id} = "${q.en}"`).join("; ")}.
Rules:
- The introduction and consent are already done. Go straight to the question; a short "धन्यवाद।" / "Thank you." before it is enough.
- One question per turn. Under 35 words. Spoken, simple ${opts.lang === "hi" ? "Hindi in Devanagari (common English classroom words like 'group' are fine)" : "English"}.
- If the teacher's last answer names a practice but gives no concrete detail, ask ONE follow-up for specifics (kind=follow_up) before moving on.
- If the last answer was unclear or empty, ask them to repeat (kind=clarify).
- If Jugnu's last turn was already a follow_up or clarify, do not probe again: move to a new area (kind=question) or close.
- If the teacher already answered an area while talking about another, skip it.
- Never repeat an earlier question. Never praise one school over another.
- End (kind=closing, done=true) with a short thank-you only when at least 5 areas are covered or ${MAX_QUESTIONS} questions have been asked.`,
        content: `Areas already asked: ${asked.length ? asked.join(", ") : "none"}. Questions asked so far: ${questionsAsked(turns)}.\nConversation (JSON, oldest first):\n${JSON.stringify(turns.map((t) => ({ speaker: t.speaker, text: t.text, kind: t.kind, topic: t.topic })))}\n\nWrite Jugnu's next turn.`,
        schema: NextSchema,
        effort: "low",
        maxTokens: 1500,
        quick: true,
        signal,
      }),
    guard: (out) => guardTurn(out as NextTurn, turns, opts.lang),
  });
}
