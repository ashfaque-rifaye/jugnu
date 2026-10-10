// The practice taxonomy Jugnu codes interviews into. Effects are HIDDEN TRUTH used only by
// the simulator; the engine must discover which practices matter from interviews + data.

export type PracticeId =
  | "level_groups"
  | "number_talk"
  | "home_language"
  | "absent_buddies"
  | "parent_voice"
  | "print_wall"
  | "circular_compliance"
  | "extra_worksheets"
  | "weekly_tests";

export interface PracticeInfo {
  id: PracticeId;
  label: string;
  labelHi: string;
  what: string;
  cost: "zero" | "low" | "medium";
  outcome: "reading" | "numeracy" | "both";
  /** words a teacher uses when describing it (Hindi + English, code-mixed) */
  lexicon: RegExp;
  icon: string;
  /** Simulation-only truth: logit effect on reading / numeracy proficiency. */
  effect: { reading: number; numeracy: number };
  /** Simulation-only: how common the practice is in ordinary schools. */
  baseRate: number;
}

export const PRACTICES: Record<PracticeId, PracticeInfo> = {
  level_groups: {
    id: "level_groups",
    label: "Daily reading-level groups",
    labelHi: "रोज़ स्तर के हिसाब से समूह",
    what: "For 45 minutes every morning children sit in groups by reading level (letters / words / paragraph / story), not by grade; groups are re-formed every week.",
    cost: "zero",
    outcome: "reading",
    lexicon: /समूह|ग्रुप|group|स्तर|level|टोली/i,
    icon: "users",
    effect: { reading: 0.55, numeracy: 0.2 },
    baseRate: 0.1,
  },
  number_talk: {
    id: "number_talk",
    label: "10-minute number talk with sticks",
    labelHi: "तीलियों से 10 मिनट गिनती-बातचीत",
    what: "Every day starts with 10 minutes of oral maths using bundles of sticks or pebbles — children explain how they got the answer.",
    cost: "zero",
    outcome: "numeracy",
    lexicon: /तीली|तीलियाँ|कंकड़|बंडल|pebble|stick|number talk|गिनती/i,
    icon: "sigma",
    effect: { reading: 0.05, numeracy: 0.6 },
    baseRate: 0.08,
  },
  home_language: {
    id: "home_language",
    label: "Home-language bridge",
    labelHi: "घर की भाषा से पुल",
    what: "New words and concepts are first explained in the children's home language; children may answer in it before moving to Hindi.",
    cost: "zero",
    outcome: "both",
    lexicon: /घर की (भाषा|बोली)|बोली|भीली|गोंडी|संथाली|mother tongue|home language|local language/i,
    icon: "languages",
    effect: { reading: 0.4, numeracy: 0.25 },
    baseRate: 0.07,
  },
  absent_buddies: {
    id: "absent_buddies",
    label: "Catch-up buddies for absentees",
    labelHi: "छूटे बच्चों के लिए साथी",
    what: "When a child returns after missing school, a classmate re-teaches that day's work for 10 minutes with the notebook.",
    cost: "zero",
    outcome: "both",
    lexicon: /जो नहीं आया|लौटने पर|अनुपस्थित|absent|buddy|catch[- ]?up/i,
    icon: "handshake",
    effect: { reading: 0.2, numeracy: 0.2 },
    baseRate: 0.08,
  },
  parent_voice: {
    id: "parent_voice",
    label: "Weekly read-aloud to parents",
    labelHi: "हर हफ़्ते माता-पिता को पढ़कर सुनाना",
    what: "Every Saturday children read a short text aloud to a parent; the teacher sends a 1-minute voice note telling parents what to listen for.",
    cost: "low",
    outcome: "reading",
    lexicon: /माता-पिता|अभिभावक|parents?|मम्मी|पापा|WhatsApp|व्हाट्सऐप|voice note/i,
    icon: "phone",
    effect: { reading: 0.3, numeracy: 0 },
    baseRate: 0.1,
  },
  print_wall: {
    id: "print_wall",
    label: "Wall of children's own writing",
    labelHi: "बच्चों के लेखन की दीवार",
    what: "Children's own sentences and stories are displayed at their eye level and read aloud every week.",
    cost: "low",
    outcome: "reading",
    lexicon: /दीवार|wall/i,
    icon: "layout",
    effect: { reading: 0.12, numeracy: 0 },
    baseRate: 0.2,
  },
  circular_compliance: {
    id: "circular_compliance",
    label: "Following the lesson plan / circular",
    labelHi: "पाठ योजना / परिपत्र का पालन",
    what: "Teaching strictly as per the official lesson plan and circulars.",
    cost: "zero",
    outcome: "both",
    lexicon: /पाठ योजना|परिपत्र|circular|lesson plan|निर्देश|आदेश/i,
    icon: "file",
    effect: { reading: 0, numeracy: 0 },
    baseRate: 0.75,
  },
  extra_worksheets: {
    id: "extra_worksheets",
    label: "Extra homework worksheets",
    labelHi: "अतिरिक्त गृहकार्य पत्रक",
    what: "Daily extra worksheets sent home.",
    cost: "low",
    outcome: "both",
    lexicon: /वर्कशीट|worksheet|गृहकार्य|होमवर्क|homework/i,
    icon: "sheet",
    effect: { reading: 0, numeracy: 0 },
    baseRate: 0.45,
  },
  weekly_tests: {
    id: "weekly_tests",
    label: "Weekly written tests",
    labelHi: "साप्ताहिक टेस्ट",
    what: "A written test every week.",
    cost: "zero",
    outcome: "both",
    lexicon: /टेस्ट|test|परीक्षा|exam/i,
    icon: "clipboard",
    effect: { reading: 0, numeracy: 0 },
    baseRate: 0.5,
  },
};

export const PRACTICE_IDS = Object.keys(PRACTICES) as PracticeId[];
export const EFFECTIVE = PRACTICE_IDS.filter((p) => PRACTICES[p].effect.reading + PRACTICES[p].effect.numeracy > 0.1);

/** Specificity cues: concrete times, frequencies, materials, steps. Vague claims have none. */
const SPECIFIC = [/\d+\s*(मिनट|minute|min)/i, /रोज़|रोज|daily|हर दिन|every day/i, /हर (हफ़्ते|सोमवार|शनिवार)|weekly|every (week|saturday|monday)/i, /तीली|कंकड़|बंडल|कॉपी|कार्ड|card|notebook/i, /पहले|फिर|उसके बाद|first|then/i, /बच्चे (खुद|आपस)|children (explain|teach)/i];

export function specificity(text: string): number {
  return SPECIFIC.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
}
