// Deterministic checks applied to every model output before it is stored, shown or spoken.
// They never call a model, so they can't share a model's mistakes: a quote must really be in the
// transcript, a voice note may not invent a number, a question may not stray into personal topics.

export interface Check {
  name: string;
  passed: boolean;
  detail?: string;
}

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/** Lower-case, NFC, Devanagari digits → ASCII, punctuation (incl. danda) → space, collapsed. */
export function normalize(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
    .replace(/[“”"'‘’`.,!?;:()\[\]{}…।॥\-–—/\\|*_#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const tokens = (s: string) => normalize(s).split(" ").filter(Boolean);

/**
 * Is `quote` actually something the teacher said? Exact (normalised) substring of one turn, or a
 * near-verbatim match: ≥ 90% of the quote's words appear in order inside a single turn.
 */
export function groundQuote(quote: string, sources: string[]): { grounded: boolean; turn: number | null; method: "exact" | "near" | "none" } {
  const q = normalize(quote);
  if (!q) return { grounded: false, turn: null, method: "none" };
  for (let i = 0; i < sources.length; i++) if (normalize(sources[i]).includes(q)) return { grounded: true, turn: i, method: "exact" };
  const qt = tokens(quote);
  for (let i = 0; i < sources.length; i++) {
    const st = tokens(sources[i]);
    let j = 0;
    let hit = 0;
    for (const w of qt) {
      const k = st.indexOf(w, j);
      if (k >= 0) {
        hit++;
        j = k + 1;
      }
    }
    if (qt.length >= 4 && hit / qt.length >= 0.9) return { grounded: true, turn: i, method: "near" };
  }
  return { grounded: false, turn: null, method: "none" };
}

// "एक" (a/one) and "दो" (two/give) are left out: far more often an article or a verb than a count.
const HINDI_NUMBERS: Record<string, number> = {
  तीन: 3, चार: 4, पाँच: 5, पांच: 5, छह: 6, छः: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
  ग्यारह: 11, बारह: 12, पंद्रह: 15, बीस: 20, पच्चीस: 25, तीस: 30, चालीस: 40, पैंतालीस: 45, पचास: 50, साठ: 60, सौ: 100,
};

/** Numbers mentioned in a text — digits (ASCII or Devanagari) and common Hindi number words. */
export function numbersIn(s: string): number[] {
  const n = normalize(s);
  const out = (n.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  for (const w of n.split(" ")) if (w in HINDI_NUMBERS) out.push(HINDI_NUMBERS[w]);
  return out;
}

/** An output may not contain a number that is absent from its sources (no invented facts). */
export function checkNoInventedNumbers(output: string, sources: string[]): Check {
  const allowed = new Set(sources.flatMap(numbersIn));
  const invented = [...new Set(numbersIn(output))].filter((x) => !allowed.has(x));
  return { name: "no invented numbers", passed: invented.length === 0, detail: invented.length ? `not in source: ${invented.join(", ")}` : undefined };
}

/** The key numbers of the source (minutes, counts, distances) should survive a rewrite. */
export function checkKeepsNumbers(output: string, source: string): Check {
  const out = new Set(numbersIn(output));
  const dropped = [...new Set(numbersIn(source))].filter((x) => !out.has(x));
  return { name: "keeps source numbers", passed: dropped.length === 0, detail: dropped.length ? `dropped: ${dropped.join(", ")}` : undefined };
}

export function devanagariShare(s: string): number {
  const letters = s.match(/\p{L}/gu) ?? [];
  if (!letters.length) return 0;
  return letters.filter((c) => /[ऀ-ॿ]/.test(c)).length / letters.length;
}

export function checkLanguage(s: string, language: "hi" | "en"): Check {
  const share = devanagariShare(s);
  const passed = language === "hi" ? share >= 0.6 : share <= 0.2;
  return { name: language === "hi" ? "written in Hindi" : "written in English", passed, detail: `Devanagari share ${Math.round(share * 100)}%` };
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function checkLength(s: string, maxWords: number, label = "length"): Check {
  const n = wordCount(s);
  return { name: label, passed: n > 0 && n <= maxWords, detail: `${n} words (max ${maxWords})` };
}

// Topics an interviewer working for a Block Education Office must never raise with a teacher.
const BANNED: [string, RegExp][] = [
  ["caste", /जाति|caste|दलित|सवर्ण/i],
  ["religion", /धर्म|religion|मज़हब|मजहब|हिंदू|मुस्लिम|मुसलमान|ईसाई/i],
  ["politics", /राजनीति|politic|चुनाव|election|पार्टी|\bparty\b|\bvote\b|वोट/i],
  ["pay & transfers", /वेतन|तनख़्वाह|तनख्वाह|salary|ट्रांसफर|transfer|तबादला|रिश्वत|bribe/i],
  ["personal life", /शादी|विवाह|marriage|married|आपके (?:पति|पत्नी)|husband|wife|गर्भ|pregnan/i],
  ["blame & ranking", /सबसे (?:खराब|बुरा)|worst|blame|दोषी|रैंक|rank(?:ing)?\b|सज़ा|punish/i],
];

export function checkSafeTopic(s: string): Check {
  const hit = BANNED.find(([, re]) => re.test(s));
  return { name: "stays on classroom routines", passed: !hit, detail: hit ? `touches ${hit[0]}` : undefined };
}

// Words no teacher or officer should meet in a note, a transcript or a shared comment.
const PROFANITY =
  /\b(?:fuck\w*|shit\w*|bitch\w*|bastard\w*|asshole\w*|dickhead\w*|motherfuck\w*|madarchod\w*|behenchod\w*|bhenchod\w*|chutiya\w*|gandu\w*|bhosdi\w*|harami\w*|kamina\w*)\b|मादरचोद|बहनचोद|बहिनचोद|भोसड़ी\S*|चूतिया|गांडू|हरामी|कमीन[ाी]/gi;

export interface SafetyFinding {
  kind: "phone" | "id" | "email" | "profanity" | "topic";
  count: number;
  detail?: string;
}

/** What a piece of text contains that should not be kept, and the text with it removed. */
export function inspectText(s: string): { text: string; findings: SafetyFinding[] } {
  const counts = { id: 0, phone: 0, email: 0, profanity: 0 };
  const text = s
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, () => (counts.id++, "[number removed]"))
    .replace(/(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g, () => (counts.phone++, "[phone removed]"))
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, () => (counts.email++, "[email removed]"))
    .replace(PROFANITY, () => (counts.profanity++, "[removed]"));
  const findings: SafetyFinding[] = (Object.entries(counts) as [SafetyFinding["kind"], number][]).filter(([, n]) => n > 0).map(([kind, count]) => ({ kind, count }));
  const topic = BANNED.find(([, re]) => re.test(s));
  if (topic) findings.push({ kind: "topic", count: 1, detail: topic[0] });
  return { text, findings };
}

/** Remove phone numbers, ID numbers, e-mails and bad language before text is stored or sent to a model. */
export function scrubPII(s: string): { text: string; removed: number } {
  const { text, findings } = inspectText(s);
  return { text, removed: findings.filter((f) => f.kind !== "topic").reduce((a, f) => a + f.count, 0) };
}

export const allPassed = (checks: Check[]) => checks.every((c) => c.passed);
