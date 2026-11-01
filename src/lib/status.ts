// One plain-language status per school, and the next step that goes with it.
import type { PipelineState } from "../engine/pipeline";
import { PRACTICES, type PracticeId } from "../engine/practices";

export type SchoolStatus = "bright" | "check_due" | "check_data" | "revisit" | "support" | "ok";

// Colours are CSS variables so they follow light / dark mode (see styles.css, --st-*).
export const STATUS_INFO: Record<SchoolStatus, { en: string; hi: string; color: string; next: [string, string] }> = {
  bright: { en: "Doing well", hi: "अच्छा कर रहा", color: "var(--st-bright)", next: ["Ask this teacher what they do: a 12-minute conversation", "इस शिक्षक से पूछें कि वे क्या करते हैं: 12 मिनट की बातचीत"] },
  check_due: { en: "Needs a visit", hi: "दौरा बाकी", color: "var(--st-check-due)", next: ["Visit and test 15 children, to confirm the results are real", "जाकर 15 बच्चों को परखें, ताकि पता चले नतीजे सच्चे हैं"] },
  check_data: { en: "Results don't match", hi: "नतीजे मेल नहीं खाते", color: "var(--st-check-data)", next: ["Visit again, respectfully: the reported results look too high", "सम्मान से फिर जाएँ: दर्ज नतीजे ज़्यादा लगते हैं"] },
  revisit: { en: "Look again", hi: "फिर देखें", color: "var(--st-revisit)", next: ["Results changed a lot between years — talk to the teacher on the next visit", "सालों के बीच परिणाम बहुत बदले — अगली बार शिक्षक से बात करें"] },
  support: { en: "Needs help", hi: "मदद चाहिए", color: "var(--st-support)", next: ["Share one method from a nearby teacher", "पास के शिक्षक का एक तरीका पहुँचाएँ"] },
  ok: { en: "On track", hi: "ठीक चल रहा", color: "var(--st-ok)", next: ["No action needed now", "अभी कुछ करने की ज़रूरत नहीं"] },
};

/** A see-through version of any colour (hex or CSS variable), for chip backgrounds and borders. */
export const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export function schoolStatuses(st: PipelineState): Map<string, SchoolStatus> {
  const out = new Map<string, SchoolStatus>();
  const support = new Set(st.recs.map((r) => r.schoolId));
  for (const s of st.block.schools) out.set(s.id, support.has(s.id) || st.find.struggling.includes(s.id) ? "support" : "ok");
  for (const v of st.verify) {
    const pending = v.spotCheck.sampled === 0;
    out.set(v.schoolId, v.verdict === "verified" ? "bright" : v.verdict === "inflation_suspected" ? "check_data" : pending ? "check_due" : "revisit");
  }
  return out;
}

/** Mean of the per-cycle "results vs expectation" scores (standard deviations). */
export function meanZ(st: PipelineState): Record<string, number> {
  return Object.fromEntries(st.block.schools.map((s) => [s.id, st.find.z[s.id].reduce((a, b) => a + b, 0) / st.find.z[s.id].length]));
}

export const practiceLabel = (id: string, hi = false) => (id in PRACTICES ? (hi ? PRACTICES[id as PracticeId].labelHi : PRACTICES[id as PracticeId].label) : id);
