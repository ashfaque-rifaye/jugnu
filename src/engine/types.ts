import type { PracticeId } from "./practices";

export const CYCLES = ["2022-23", "2023-24", "2024-25"] as const;
export const NEXT_CYCLE = "2025-26";

export interface School {
  id: string;
  name: string;
  /** Devanagari name, when the village is a real one */
  nameHi?: string;
  village: string;
  cluster: number;
  clusterName: string;
  crp: string;
  x: number; // km east of block HQ
  y: number; // km north of block HQ
  enrolment: number;
  grade3: number;
  ptr: number;
  multigrade: boolean;
  library: boolean;
  attendance: number; // average student attendance
  langMismatch: number; // share of children whose home language differs from instruction
  teacher: string;
  teacherGender: "f" | "m";
  reading: number[]; // reported % Grade 3 proficient, per cycle
  numeracy: number[];
  /** student attendance per cycle (share of enrolled children present on an average day) */
  attendanceByCycle: number[];
  /** Grades 1–5 in the latest cycle. Grade 3 is the officially assessed cohort (reading/numeracy above). */
  grades: GradeRow[];
  /** real location (UDISE+), when the block is a real one */
  lat?: number;
  lon?: number;
  /** UDISE+ school code, when the school is a real one */
  udise?: string;
  clusterNameHi?: string;
  /** Highest class taught (UDISE+): 5 = primary, 8 = middle. */
  classTo?: number;
  /** Teachers for classes 1–5. */
  teacherCount: number;
  /** Head, point of contact and class teachers. Names are simulated; phone numbers are never held here. */
  staff: Staff[];
  /** Across classes 1–5, per assessment year. */
  subjectTrend: Record<"hindi" | "maths" | "science" | "english" | "spoken", number[]>;
}

export interface Staff {
  id: string;
  name: string;
  /** head: runs the school. contact: collects and shares for the school. teacher: teaches. */
  role: "head" | "contact" | "teacher";
  grades: number[];
  /** Subjects this teacher answers for across the school. */
  leads: ("hindi" | "maths" | "science" | "english" | "spoken")[];
}

export interface GradeRow {
  grade: 1 | 2 | 3 | 4 | 5;
  enrolled: number;
  attendance: number; // share present on an average day
  reading: number; // % at grade level
  numeracy: number; // % at grade level
  science: number; // % at grade level (simulated)
  english: number; // % at grade level (simulated)
  spoken: number; // % at grade level (simulated)
}

/** Hidden truth — only the simulator reads this. */
export interface SchoolTruth {
  practices: PracticeId[];
  fidelity: number;
  inflated: boolean;
  schoolEffect: number;
  trueReading: number[];
  trueNumeracy: number[];
}

export interface Block {
  name: string;
  district: string;
  state: string;
  source: "simulated" | "imported";
  schools: School[];
  truth: Record<string, SchoolTruth> | null;
  seed: number;
}

export interface FindResult {
  coefficients: { feature: string; reading: number; numeracy: number }[];
  r2: { reading: number; numeracy: number };
  expected: Record<string, { reading: number[]; numeracy: number[] }>;
  z: Record<string, number[]>; // combined standardized residual per cycle
  candidates: string[];
  struggling: string[];
}

export type VerifyVerdict = "verified" | "inflation_suspected" | "revisit";

export interface VerifyResult {
  schoolId: string;
  verdict: VerifyVerdict;
  checks: { name: string; passed: boolean; detail: string }[];
  spotCheck: { sampled: number; proficient: number; reported: number; pValue: number; numeracyProficient: number; numeracyReported: number; numeracyPValue: number };
}

export interface Turn {
  speaker: "jugnu" | "teacher";
  text: string;
  textEn?: string;
}

export interface Mention {
  practice: PracticeId;
  quote: string;
  specificity: number;
}

export interface Interview {
  schoolId: string;
  group: "bright" | "comparison" | "live";
  language: "hi" | "en";
  turns: Turn[];
  mentions: Mention[];
  codedBy: "offline" | "ai";
  minutes: number;
}

export interface PracticeEvidence {
  practice: PracticeId;
  bright: { k: number; n: number };
  comparison: { k: number; n: number };
  lift: number;
  pDistinctive: number;
  verdict: "distinctive" | "common_everywhere" | "not_enough_evidence" | "no_difference";
  quotes: { schoolId: string; quote: string }[];
  score: number;
}

export interface Action {
  id: string;
  schoolId: string;
  owner: string;
  ownerRole: "CRP" | "BEO" | "Jugnu AI" | "Teacher";
  task: string;
  due: number; // days from today
  /** submitted = the school or owner says it is done, and someone else must sign it off. */
  status: "todo" | "scheduled" | "submitted" | "done" | "stuck";
  note?: string;
}

export interface Recommendation {
  schoolId: string;
  practice: PracticeId;
  why: string;
  demonstratorId: string;
  distanceKm: number;
  voiceNoteHi: string;
  voiceNoteEn: string;
  wave: 1 | 2;
  actions: Action[];
}

export interface FollowUp {
  schoolId: string;
  day: number;
  outcome: "adopted" | "trying" | "barrier" | "no_answer";
  said: string;
  saidEn: string;
  /** What happened, in a line: [en, hi]. */
  summary?: [string, string];
  /** What it means and the next step: [en, hi]. */
  insight?: [string, string];
  barrier?: string;
  owner?: "BEO" | "CRP" | "Teacher";
}

export interface TrackResult {
  followUps: FollowUp[];
  nextScores: Record<string, { reading: number; numeracy: number }>;
  byPractice: {
    practice: PracticeId;
    wave1: number;
    adopters: number;
    effect: number; // difference-in-differences, percentage points
    ci: [number, number];
    trueEffect?: number;
  }[];
  overall: { effect: number; ci: [number, number] };
}
