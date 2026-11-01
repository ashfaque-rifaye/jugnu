// State-feed import: a district's own spreadsheet (UDISE+ export, a state FLN assessment sheet, Hindi
// headers…) rarely uses Jugnu's column names. Claude reads the headers and a few sample rows and says
// which source column fills each Jugnu field; guardrails make sure every named column exists and none
// is used twice. Offline, a synonym table does the same for the common names.
import { z } from "zod";
import { askClaude } from "../claude";
import type { Check } from "./guardrails";
import { runAI, type AIResult } from "./run";

export interface ColumnMap {
  mapping: Record<string, string | null>;
  scale: Record<string, number>;
  notes: string[];
}

const SYNONYMS: Record<string, RegExp> = {
  school_id: /^(school ?id|udise( ?code)?|udise\+?|school code|विद्यालय कोड|यू ?डाइस)$/i,
  school_name: /^(school ?name|name of (the )?school|school|विद्यालय (का )?नाम|स्कूल (का )?नाम)$/i,
  village: /^(village|gram|गाँव|ग्राम|habitation)$/i,
  cluster: /^(cluster|crc|sankul|संकुल|जन शिक्षा केंद्र|jsk)$/i,
  crp: /^(crp|crc coordinator|cluster coordinator|jan shiksha|संकुल समन्वयक|जन शिक्षक)$/i,
  x_km: /^(x( ?km)?|east(ing)?|longitude|lon|lng|देशांतर)$/i,
  y_km: /^(y( ?km)?|north(ing)?|latitude|lat|अक्षांश)$/i,
  enrolment: /^(enrol(l)?ment|total enrol(l)?ment|students|नामांकन|कुल नामांकन)$/i,
  grade3_tested: /^(grade ?3 ?tested|class 3 tested|tested|परीक्षित)$/i,
  pupil_teacher_ratio: /^(ptr|pupil ?teacher ?ratio|छात्र शिक्षक अनुपात)$/i,
  multigrade: /^(multi ?grade|बहु ?कक्षा)$/i,
  library_in_use: /^(library(_in_use)?|पुस्तकालय)$/i,
  attendance: /^(attendance|avg attendance|उपस्थिति)$/i,
  home_language_mismatch: /^(home ?language ?mismatch|language mismatch|घर की भाषा)$/i,
  teacher: /^(teacher|head ?teacher|teacher name|शिक्षक|प्रधानाध्यापक)$/i,
};

export function offlineMap(target: string[], headers: string[]): ColumnMap {
  const mapping: Record<string, string | null> = {};
  const used = new Set<string>();
  for (const t of target) {
    const exact = headers.find((h) => h.trim().toLowerCase() === t);
    const re = SYNONYMS[t];
    const norm = (h: string) => h.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    const hit = exact ?? (re ? headers.find((h) => re.test(norm(h)) && !used.has(h)) : undefined);
    mapping[t] = hit ?? null;
    if (hit) used.add(hit);
  }
  return { mapping, scale: {}, notes: ["Matched by column names only (the AI mapper was not used)."] };
}

export async function mapColumns(target: string[], headers: string[], sample: string[][]): Promise<AIResult<ColumnMap>> {
  const Schema = z.object({
    pairs: z.array(z.object({ jugnu: z.string(), source: z.string().nullable(), multiply_by: z.number().nullable().describe("e.g. 0.01 when the source is 0–100 but Jugnu wants 0–1; null if no change") })),
    notes: z.array(z.string()).max(6),
  });
  return runAI({
    task: "import.map_columns",
    timeoutMs: 25000,
    offline: () => offlineMap(target, headers),
    claude: (signal) =>
      askClaude({
        system: `You map the columns of an Indian school-data spreadsheet onto Jugnu's import format. For every Jugnu column give the ONE source column that holds it (copy its header exactly) or null. Never map two Jugnu columns to the same source column. Only map when the sample values fit.
Jugnu columns and units: school_id (UDISE code or any unique id), school_name, village, cluster, crp (cluster coordinator's name), x_km / y_km (km east / north of the block HQ — longitude/latitude are NOT km, leave null), enrolment, grade3_tested, pupil_teacher_ratio, multigrade (0/1), library_in_use (0/1), attendance (share 0–1), home_language_mismatch (share 0–1), teacher, reading_<cycle> / numeracy_<cycle> (% of Grade 3 at level, 0–100). When a share is given as 0–100, set multiply_by 0.01. When a % column is given as 0–1, set multiply_by 100.`,
        content: `Jugnu columns: ${target.join(", ")}\nSource headers: ${JSON.stringify(headers)}\nSample rows:\n${sample.slice(0, 3).map((r) => JSON.stringify(r)).join("\n")}`,
        schema: Schema,
        effort: "low",
        maxTokens: 3000,
        signal,
      }),
    guard: (raw) => {
      const mapping: Record<string, string | null> = Object.fromEntries(target.map((t) => [t, null]));
      const scale: Record<string, number> = {};
      for (const p of raw.pairs) {
        if (!(p.jugnu in mapping)) continue;
        mapping[p.jugnu] = p.source;
        if (p.multiply_by && p.multiply_by !== 1) scale[p.jugnu] = p.multiply_by;
      }
      const named = Object.values(mapping).filter((v): v is string => v !== null);
      const checks: Check[] = [
        { name: "every mapped column exists in the file", passed: named.every((h) => headers.includes(h)) },
        { name: "no source column used twice", passed: new Set(named).size === named.length },
        { name: "scales are plausible", passed: Object.values(scale).every((x) => x > 0 && x <= 100) },
      ];
      return { value: { mapping, scale, notes: raw.notes }, checks, accept: checks.every((c) => c.passed) };
    },
  });
}
