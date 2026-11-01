// TRACK: understand a teacher's answer to the day-14 follow-up call ("Did you try it? What
// happened?"). Outcome drives the action board; a barrier becomes an escalated task with an owner.
import { z } from "zod";
import { askClaude } from "../claude";
import { groundQuote, type Check } from "./guardrails";
import { SAFETY } from "./interviewer";
import { runAI, type AIResult } from "./run";

export type Outcome = "adopted" | "trying" | "barrier" | "not_tried";

export interface FollowUpReading {
  outcome: Outcome;
  barrier: string | null;
  owner: "CRP" | "BEO" | "Teacher" | null;
  summary_en: string;
  quote: string;
}

const Schema = z.object({
  outcome: z.enum(["adopted", "trying", "barrier", "not_tried"]),
  barrier: z.string().nullable().describe("What stops them, in a few words, or null"),
  owner: z.enum(["CRP", "BEO", "Teacher"]).nullable().describe("Who can remove the barrier: materials/permissions → BEO; a demo or visit → CRP"),
  summary_en: z.string(),
  quote: z.string().describe("The teacher's words that justify the outcome, verbatim"),
});

const BARRIER = /नहीं (हो|कर) (पा|सक)|समय नहीं|समय कम|वक़्त कम|सामग्री नहीं|किताब(ें)? नहीं|कार्ड नहीं|अनुमति|ऑर्डर|समझ नहीं|मुश्किल|दिक्कत|परेशानी|can't|cannot|no time|no material|difficult|problem/i;
const ADOPTED = /रोज़|रोज|हर दिन|कर रह(े|ी) हैं|शुरू कर दिया|अच्छा चल|daily|every day|started|working well/i;
const TRYING = /कोशिश|एक-दो बार|कुछ दिन|शुरू कि|tried|trying|a few times/i;
const NOT_TRIED = /अभी नहीं|नहीं किया|नहीं कर पाए|not yet|didn't/i;

export function offlineFollowUp(reply: string): FollowUpReading {
  const outcome: Outcome = BARRIER.test(reply) ? "barrier" : TRYING.test(reply) ? "trying" : ADOPTED.test(reply) ? "adopted" : NOT_TRIED.test(reply) ? "not_tried" : "trying";
  const material = /सामग्री|किताब|कार्ड|material|card|book|तीली|बंडल/i.test(reply);
  return {
    outcome,
    barrier: outcome === "barrier" ? (material ? "materials missing" : "needs a demonstration or time") : null,
    owner: outcome === "barrier" ? (material ? "BEO" : "CRP") : null,
    summary_en: { adopted: "Uses the method regularly.", trying: "Has started trying it.", barrier: "Wants to, but something is in the way.", not_tried: "Has not started yet." }[outcome],
    quote: reply,
  };
}

export async function readFollowUp(reply: string, practice: string, ref?: string): Promise<AIResult<FollowUpReading>> {
  return runAI({
    task: "track.follow_up",
    ref,
    timeoutMs: 20000,
    offline: () => offlineFollowUp(reply),
    claude: (signal) =>
      askClaude({
        system: `${SAFETY}
Read a teacher's answer to a follow-up call two weeks after they were invited to try a peer's method. Classify honestly:
- "barrier" whenever they name something that stops or limits them (missing materials, no time, no permission, not sure how) — even if they have started. A barrier becomes a task for whoever can remove it, so do not hide it under "trying".
- "trying" when they started but not regularly, and name nothing in the way.
- "adopted" when they do it regularly; "not_tried" when they have not started and give no reason.`,
        content: `Method suggested: ${practice}\nTeacher said: ${reply}`,
        schema: Schema,
        effort: "low",
        maxTokens: 1500,
        quick: true,
        signal,
      }),
    guard: (out) => {
      const g = groundQuote(out.quote, [reply]);
      const checks: Check[] = [
        { name: "evidence quote is verbatim", passed: g.grounded },
        { name: "barrier has an owner", passed: out.outcome !== "barrier" || out.owner !== null },
      ];
      return { value: out, checks, accept: checks.every((c) => c.passed) };
    },
  });
}
