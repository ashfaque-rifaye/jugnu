// The five subjects Jugnu tracks in classes 1–5: language and maths first, then science (STEM) and
// English, written and spoken. Results are simulated at this level of detail; UDISE+ publishes none.
import type { GradeRow, School, Staff } from "./types";

export const SUBJECTS = ["hindi", "maths", "science", "english", "spoken"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_INFO: Record<Subject, { en: string; hi: string; short: [string, string]; color: string; can: [string, string] }> = {
  hindi: { en: "Hindi reading", hi: "हिंदी पढ़ना", short: ["Hindi", "हिंदी"], color: "var(--tone-reading)", can: ["read a text meant for their class", "अपनी कक्षा का पाठ पढ़ पाते हैं"] },
  maths: { en: "Maths", hi: "गणित", short: ["Maths", "गणित"], color: "var(--st-bright)", can: ["solve sums meant for their class", "अपनी कक्षा के सवाल हल कर पाते हैं"] },
  science: { en: "Science & EVS", hi: "विज्ञान व पर्यावरण", short: ["Science", "विज्ञान"], color: "var(--tone-teal)", can: ["explain and test simple science ideas", "विज्ञान की सरल बातें समझा और परख पाते हैं"] },
  english: { en: "English reading", hi: "अंग्रेज़ी पढ़ना", short: ["English", "अंग्रेज़ी"], color: "var(--tone-info)", can: ["read simple English words and sentences", "अंग्रेज़ी के सरल शब्द और वाक्य पढ़ पाते हैं"] },
  spoken: { en: "Spoken English", hi: "बोलचाल की अंग्रेज़ी", short: ["Spoken", "बोलचाल"], color: "var(--tone-lime)", can: ["answer simple questions aloud in English", "अंग्रेज़ी में सरल सवालों के जवाब बोल पाते हैं"] },
};

export const scoreOf = (g: GradeRow, subject: Subject): number =>
  subject === "hindi" ? g.reading : subject === "maths" ? g.numeracy : g[subject];

/** Share of children at level in one grade, or across classes 1–5 weighted by how many children are in each. */
export function schoolScore(s: School, subject: Subject, grade?: number): number | null {
  const rows = s.grades.filter((g) => grade == null || g.grade === grade);
  const n = rows.reduce((a, g) => a + g.enrolled, 0);
  if (!rows.length || !n) return null;
  return rows.reduce((a, g) => a + scoreOf(g, subject) * g.enrolled, 0) / n;
}

/** All five subjects together, for a single at-a-glance number. */
export function schoolOverall(s: School, grade?: number): number | null {
  const v = SUBJECTS.map((x) => schoolScore(s, x, grade)).filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** The block's average, so a school can be read against its neighbours. */
export function blockScore(schools: School[], subject: Subject, grade?: number): number | null {
  let sum = 0;
  let n = 0;
  for (const s of schools)
    for (const g of s.grades) {
      if (grade != null && g.grade !== grade) continue;
      sum += scoreOf(g, subject) * g.enrolled;
      n += g.enrolled;
    }
  return n ? sum / n : null;
}

/** The fewest teachers whose classes together cover every grade: who to talk to, instead of everyone. */
export function representatives(staff: Staff[]): Staff[] {
  const left = new Set(staff.flatMap((p) => p.grades));
  const pool = [...staff];
  const out: Staff[] = [];
  while (left.size && pool.length) {
    pool.sort((a, b) => b.grades.filter((g) => left.has(g)).length - a.grades.filter((g) => left.has(g)).length);
    const next = pool.shift()!;
    if (!next.grades.some((g) => left.has(g))) break;
    next.grades.forEach((g) => left.delete(g));
    out.push(next);
  }
  return out;
}
