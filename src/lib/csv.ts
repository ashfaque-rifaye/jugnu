// Import real school-level data (e.g. a state's FLN assessment + UDISE+ export) to run
// Find + Verify on your own block. No hidden truth exists for imported data.
import { CYCLES, type Block, type School } from "../engine/types";

export const CSV_COLUMNS = [
  "school_id",
  "school_name",
  "village",
  "cluster",
  "crp",
  "x_km",
  "y_km",
  "enrolment",
  "grade3_tested",
  "pupil_teacher_ratio",
  "multigrade",
  "library_in_use",
  "attendance",
  "home_language_mismatch",
  "teacher",
  ...CYCLES.flatMap((c) => [`reading_${c}`, `numeracy_${c}`]),
];

export function templateCsv(block: Block): string {
  const rows = block.schools.map((s) =>
    [
      s.id,
      s.name,
      s.village,
      s.clusterName,
      s.crp,
      s.x,
      s.y,
      s.enrolment,
      s.grade3,
      s.ptr,
      s.multigrade ? 1 : 0,
      s.library ? 1 : 0,
      s.attendance,
      s.langMismatch,
      s.teacher,
      ...CYCLES.flatMap((_, i) => [s.reading[i], s.numeracy[i]]),
    ].join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\n");
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export function parseCsv(text: string): Block {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);
  const col = (row: string[], name: string) => row[header.indexOf(name)];
  const num = (row: string[], name: string) => {
    const v = Number(col(row, name));
    if (!Number.isFinite(v)) throw new Error(`Row ${col(row, "school_id")}: "${name}" is not a number`);
    return v;
  };
  const clusters = new Map<string, number>();
  const schools: School[] = lines.slice(1).map((line) => {
    const row = splitLine(line);
    const clusterName = col(row, "cluster");
    if (!clusters.has(clusterName)) clusters.set(clusterName, clusters.size);
    return {
      id: col(row, "school_id"),
      name: col(row, "school_name"),
      village: col(row, "village"),
      cluster: clusters.get(clusterName)!,
      clusterName,
      crp: col(row, "crp"),
      x: num(row, "x_km"),
      y: num(row, "y_km"),
      enrolment: num(row, "enrolment"),
      grade3: num(row, "grade3_tested"),
      ptr: num(row, "pupil_teacher_ratio"),
      multigrade: num(row, "multigrade") === 1,
      library: num(row, "library_in_use") === 1,
      attendance: num(row, "attendance"),
      langMismatch: num(row, "home_language_mismatch"),
      teacher: col(row, "teacher"),
      teacherGender: "f",
      reading: CYCLES.map((c) => num(row, `reading_${c}`)),
      numeracy: CYCLES.map((c) => num(row, `numeracy_${c}`)),
      attendanceByCycle: CYCLES.map(() => num(row, "attendance")),
      grades: [],
      teacherCount: 0,
      staff: [],
      subjectTrend: { hindi: [], maths: [], science: [], english: [], spoken: [] },
    };
  });
  if (schools.length < 20) throw new Error("Need at least 20 schools to model expected scores");
  return { name: "Imported block", district: "Your data", state: "Imported CSV", source: "imported", schools, truth: null, seed: 0 };
}

/** The header and a few rows of any CSV, for the column mapper. */
export function headerAndSample(text: string, rows = 3): { headers: string[]; sample: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return { headers: splitLine(lines[0] ?? "").map((h) => h.replace(/^﻿/, "")), sample: lines.slice(1, 1 + rows).map(splitLine) };
}

/** Rewrite a CSV into Jugnu's columns using a mapping (Jugnu column → source header) and optional scales. */
export function remapCsv(text: string, mapping: Record<string, string | null>, scale: Record<string, number> = {}): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = splitLine(lines[0]).map((h) => h.replace(/^﻿/, ""));
  const idx = Object.fromEntries(CSV_COLUMNS.map((c) => [c, mapping[c] ? header.indexOf(mapping[c]!) : -1]));
  const quote = (v: string) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const out = lines.slice(1).map((line) => {
    const row = splitLine(line);
    return CSV_COLUMNS.map((c) => {
      const v = idx[c] >= 0 ? (row[idx[c]] ?? "") : "";
      const k = scale[c];
      return quote(k && v !== "" && Number.isFinite(Number(v)) ? String(Math.round(Number(v) * k * 1000) / 1000) : v);
    }).join(",");
  });
  return [CSV_COLUMNS.join(","), ...out].join("\n");
}
