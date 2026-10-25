// Damoh district (Madhya Pradesh): REAL block profiles from UDISE+ 2025-26 (Know Your School →
// Region Profile, retrieved 25 Oct 2026; raw copy in data/udise/damoh-2025-26.json). UDISE+ only
// publishes block aggregates without a CAPTCHA, so each block's schools are simulated, but sized
// and shaped by these figures: number of government schools, tribal (ST) share, pupils per
// teacher and the share of women teachers. A block's seed is its UDISE+ block code, so the
// server, the activity log and the officer agent all rebuild exactly the same block.

export interface BlockProfile {
  block: string;
  code: number; // UDISE+ block code, also the simulator seed
  schools: number; // all schools in the block
  govtSchoolPct: number;
  studentsPerClassroom: number;
  internetPct: number;
  enrolment: number;
  stEnrolmentPct: number;
  scEnrolmentPct: number;
  teachers: number;
  femaleTeacherPct: number;
  contractTeacherPct: number;
}

export const DISTRICT = { name: "Damoh", state: "Madhya Pradesh", source: "UDISE+ 2025-26 block profiles", year: "2025-26" } as const;

export const DAMOH: BlockProfile[] = [
  { block: "Batiyagarh", code: 231207, schools: 255, govtSchoolPct: 83.53, studentsPerClassroom: 24, internetPct: 26.27, enrolment: 29723, stEnrolmentPct: 13.33, scEnrolmentPct: 21.2, teachers: 1295, femaleTeacherPct: 32.36, contractTeacherPct: 43.78 },
  { block: "Damoh", code: 231203, schools: 537, govtSchoolPct: 71.69, studentsPerClassroom: 22, internetPct: 43.02, enrolment: 81114, stEnrolmentPct: 6.67, scEnrolmentPct: 20.66, teachers: 3597, femaleTeacherPct: 56.49, contractTeacherPct: 42.06 },
  { block: "Hatta", code: 231204, schools: 276, govtSchoolPct: 81.52, studentsPerClassroom: 20, internetPct: 55.07, enrolment: 34927, stEnrolmentPct: 10.28, scEnrolmentPct: 24.09, teachers: 1519, femaleTeacherPct: 37.52, contractTeacherPct: 41.41 },
  { block: "Jabera", code: 231206, schools: 256, govtSchoolPct: 84.38, studentsPerClassroom: 20, internetPct: 55.86, enrolment: 32447, stEnrolmentPct: 21.92, scEnrolmentPct: 20.42, teachers: 1372, femaleTeacherPct: 31.92, contractTeacherPct: 44.75 },
  { block: "Patera", code: 231201, schools: 230, govtSchoolPct: 89.57, studentsPerClassroom: 22, internetPct: 42.61, enrolment: 24681, stEnrolmentPct: 9.94, scEnrolmentPct: 24.67, teachers: 1092, femaleTeacherPct: 34.52, contractTeacherPct: 33.24 },
  { block: "Patharia", code: 231202, schools: 270, govtSchoolPct: 78.15, studentsPerClassroom: 22, internetPct: 57.41, enrolment: 33169, stEnrolmentPct: 4.48, scEnrolmentPct: 23.21, teachers: 1488, femaleTeacherPct: 39.18, contractTeacherPct: 45.9 },
  { block: "Tendukheda", code: 231205, schools: 266, govtSchoolPct: 85.71, studentsPerClassroom: 19, internetPct: 57.89, enrolment: 30291, stEnrolmentPct: 29.53, scEnrolmentPct: 15.1, teachers: 1308, femaleTeacherPct: 33.18, contractTeacherPct: 48.01 },
];

/** The block the console opens on: Tendukheda, Damoh's most tribal block (29.5% ST enrolment). */
export const DEFAULT_SEED = 231205;

export const profileFor = (seed: number) => DAMOH.find((p) => p.code === seed) ?? null;

/** Government schools with classes 1–3 (about 9 in 10 government schools are elementary). */
export const govtElementary = (p: BlockProfile) => Math.round((p.schools * p.govtSchoolPct * 0.9) / 100);

/** Pupils per teacher across the block. */
export const pupilsPerTeacher = (p: BlockProfile) => Math.round(p.enrolment / p.teachers);
