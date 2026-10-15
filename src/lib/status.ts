// One plain-language status per school, and the next step that goes with it.
import type { PipelineState } from "../engine/pipeline";
import { PRACTICES, type PracticeId } from "../engine/practices";

export type SchoolStatus = "bright" | "check_due" | "check_data" | "revisit" | "support" | "ok";

// Colours are CSS variables so they follow light / dark mode (see styles.css, --st-*).
export const STATUS_INFO: Record<SchoolStatus, { en: string; hi: string; color: string; next: [string, string] }> = {
  bright: { en: "Bright spot", hi: "अच्छा स्कूल", color: "var(--st-bright)", next: ["Learn what this teacher does — interview", "यह शिक्षक क्या करते हैं, जानें — बातचीत करें"] },
  check_due: { en: "Spot check due", hi: "मौके की जाँच बाकी", color: "var(--st-check-due)", next: ["Visit and check 15 children (15 minutes)", "जाकर 15 बच्चों की जाँच करें (15 मिनट)"] },
  check_data: { en: "Check the data", hi: "डेटा जाँचें", color: "var(--st-check-data)", next: ["Revisit respectfully — results may be over-reported", "सम्मान से दोबारा देखें — परिणाम ज़्यादा दर्ज हो सकते हैं"] },
  revisit: { en: "Revisit", hi: "दोबारा देखें", color: "var(--st-revisit)", next: ["Results changed a lot between years — talk to the teacher on the next visit", "सालों के बीच परिणाम बहुत बदले — अगली बार शिक्षक से बात करें"] },
  support: { en: "Needs support", hi: "मदद चाहिए", color: "var(--st-support)", next: ["Share one practice from a nearby teacher", "पास के शिक्षक का एक तरीका पहुँचाएँ"] },
  ok: { en: "As expected", hi: "अपेक्षा के अनुसार", color: "var(--st-ok)", next: ["No action needed now", "अभी कुछ करने की ज़रूरत नहीं"] },
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

/** "+12 pts" style difference of reported vs expected, latest cycle, reading + maths averaged. */
export function gapPts(st: PipelineState, id: string, which: "reading" | "numeracy") {
  const s = st.block.schools.find((x) => x.id === id)!;
  const last = s[which].length - 1;
  return Math.round(s[which][last] - st.find.expected[id][which][last]);
}

export const practiceLabel = (id: string, hi = false) => (id in PRACTICES ? (hi ? PRACTICES[id as PracticeId].labelHi : PRACTICES[id as PracticeId].label) : id);
