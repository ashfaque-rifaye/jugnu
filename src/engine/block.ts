// A simulated block of government primary schools, calibrated to REAL national figures from
// ASER 2024 (rural): Std III reading at Std II level in government schools 23.4%; Std III
// subtraction 33.7%; 52.1% of government primary schools have < 60 students; two-thirds of
// Std I–II classrooms are multigrade; average student attendance 75.9%; library books in use
// in 51.3% of schools. Each school also has hidden practices whose effects only the
// simulator knows — Jugnu has to discover them.
import { DISTRICT, govtElementary, profileFor, pupilsPerTeacher } from "./district";
import { EFFECTIVE, PRACTICE_IDS, PRACTICES } from "./practices";
import { chance, logit, mulberry32, pick, randInt, shuffle, sigmoid, type Rng } from "./rng";
import { CYCLES, type Block, type School, type SchoolTruth } from "./types";

export const ASER_2024 = {
  std3ReadingGovt: 0.234,
  std3Subtraction: 0.337,
  smallSchoolShare: 0.521,
  multigradeShare: 2 / 3,
  studentAttendance: 0.759,
  teacherAttendance: 0.875,
  libraryInUse: 0.513,
  flnDirective: 0.832,
  tlmReceived: 0.745,
} as const;

const PREFIX = ["Ram", "Sona", "Khair", "Bhan", "Pipal", "Bar", "Naya", "Sem", "Kot", "Dham", "Jamun", "Amar", "Chand", "Kesar", "Mahu", "Sirs", "Tendu", "Kanhar", "Lal", "Nim", "Gular", "Bel", "Kusum", "Palas", "Hari"];
const SUFFIX = ["pur", "gaon", "khedi", "pura", "wada", "tola", "nagar", "ghat", "pali", "dih", "khera", "bandh"];
const CLUSTERS = ["Rampur", "Sonagaon", "Kotra", "Dhamnod", "Jamuniya", "Semaria", "Barkheda", "Nayagaon", "Pipalia", "Tendukheda"];
const CRPS = ["Sunil Verma", "Anita Patel", "Mohd. Irfan", "Rekha Bhuriya", "Devendra Singh", "Kavita Joshi", "Rajesh Meena", "Shabana Qureshi", "Prakash Dhurve", "Lata Yadav"];
const F_NAMES = ["Sunita", "Farida", "Kamla", "Rekha", "Anjali", "Pushpa", "Meera", "Savita", "Radha", "Neelam", "Sarita", "Babita", "Geeta", "Lalita"];
const M_NAMES = ["Ramesh", "Birsa", "Mahesh", "Arvind", "Imran", "Santosh", "Dinesh", "Suresh", "Mukesh", "Raju", "Vijay", "Hemant", "Anil", "Kailash"];
const SURNAMES = ["Devi", "Meena", "Khan", "Hansda", "Patel", "Bhuriya", "Yadav", "Kushwaha", "Dhurve", "Sharma", "Rawat", "Solanki", "Ahirwar", "Uikey"];

const FEATURE_EFFECTS = { multigrade: -0.25, small: -0.12, library: 0.18, attendance: 2.2, langMismatch: -1.0, ptr: -0.012 };

function trueRate(base: number, s: School, t: Pick<SchoolTruth, "practices" | "fidelity" | "schoolEffect">, which: "reading" | "numeracy", cycle: number) {
  let x = base + t.schoolEffect + cycle * 0.06;
  x += FEATURE_EFFECTS.multigrade * Number(s.multigrade);
  x += FEATURE_EFFECTS.small * Number(s.enrolment < 60);
  x += FEATURE_EFFECTS.library * Number(s.library);
  x += FEATURE_EFFECTS.attendance * (s.attendance - ASER_2024.studentAttendance);
  x += FEATURE_EFFECTS.langMismatch * s.langMismatch;
  x += FEATURE_EFFECTS.ptr * (s.ptr - 30);
  for (const p of t.practices) {
    let e = PRACTICES[p].effect[which] * t.fidelity;
    if (p === "home_language") e *= 0.4 + 1.6 * s.langMismatch; // matters where languages differ
    if (p === "absent_buddies") e *= 1 + 2 * Math.max(0, 0.8 - s.attendance);
    x += e;
  }
  return sigmoid(x);
}

export function measured(rng: Rng, rate: number, n: number) {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng() < rate) k++;
  return Math.round((1000 * k) / n) / 10;
}

export const BASE = { reading: logit(ASER_2024.std3ReadingGovt) + 0.02, numeracy: logit(0.3) };

export function rateFor(s: School, t: Pick<SchoolTruth, "practices" | "fidelity" | "schoolEffect">, which: "reading" | "numeracy", cycle: number) {
  return trueRate(BASE[which], s, t, which, cycle);
}

// A seed that is a UDISE+ block code (see district.ts) builds that real block's shape: its number
// of government elementary schools, tribal share, pupils per teacher and share of women teachers.
export function generateBlock(seed = 2024, size = 200): Block {
  const profile = profileFor(seed);
  if (profile) size = govtElementary(profile);
  const rng = mulberry32(seed);
  const names = new Set<string>();
  const village = () => {
    for (let tries = 0; ; tries++) {
      let n = pick(rng, PREFIX) + pick(rng, SUFFIX);
      // Big blocks run out of plain names: villages then split, as real ones do (Kalan / Khurd).
      if (names.has(n) && tries > 60) n = [`${n} Kalan`, `${n} Khurd`, `${n} Tola`, `${n} Chak`].find((v) => !names.has(v)) ?? n;
      if (!names.has(n)) {
        names.add(n);
        return n;
      }
    }
  };
  const centers = CLUSTERS.map((_, i) => {
    const angle = (i / CLUSTERS.length) * Math.PI * 2 + rng() * 0.4;
    const r = 5 + rng() * 9;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r * 0.8 };
  });
  // Real blocks: the most south-eastern clusters form the tribal belt, enough of them to match the
  // block's ST enrolment share (schools there carry a little more than the average ST share).
  const tribalClusters = profile
    ? new Set(
        centers
          .map((c, i) => ({ i, se: c.x - c.y }))
          .sort((a, b) => b.se - a.se)
          .slice(0, Math.round((profile.stEnrolmentPct / 100) * CLUSTERS.length * 1.2))
          .map((c) => c.i),
      )
    : null;
  const femaleShare = profile ? profile.femaleTeacherPct / 100 : 0.5;
  const ppt = profile ? pupilsPerTeacher(profile) : 0;
  const schools: School[] = [];
  const truth: Record<string, SchoolTruth> = {};
  for (let i = 0; i < size; i++) {
    const cluster = i % CLUSTERS.length;
    const c = centers[cluster];
    const x = c.x + (rng() - 0.5) * 7;
    const y = c.y + (rng() - 0.5) * 6;
    const tribal = tribalClusters ? tribalClusters.has(cluster) : x > 3 && y < -1; // south-east: tribal belt, other home languages
    const enrolment = chance(rng, ASER_2024.smallSchoolShare) ? randInt(rng, 22, 59) : randInt(rng, 60, 180);
    const female = chance(rng, femaleShare);
    const s: School = {
      id: `s${String(i + 1).padStart(3, "0")}`,
      name: "",
      village: village(),
      cluster,
      clusterName: CLUSTERS[cluster],
      crp: CRPS[cluster],
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      enrolment,
      grade3: Math.max(6, Math.round(enrolment / 5.5 + (rng() - 0.5) * 4)),
      ptr: profile ? Math.round(ppt * (0.55 + rng() * 0.9)) : Math.round(18 + rng() * 32),
      multigrade: chance(rng, enrolment < 60 ? 0.85 : 0.5),
      library: chance(rng, ASER_2024.libraryInUse),
      attendance: Math.round(Math.min(0.95, Math.max(0.5, ASER_2024.studentAttendance + (rng() - 0.5) * 0.24 - (tribal ? 0.04 : 0))) * 100) / 100,
      langMismatch: Math.round((tribal ? 0.45 + rng() * 0.45 : rng() * 0.25) * 100) / 100,
      teacher: `${female ? pick(rng, F_NAMES) : pick(rng, M_NAMES)} ${pick(rng, SURNAMES)}`,
      teacherGender: female ? "f" : "m",
      reading: [],
      numeracy: [],
    };
    s.name = `GPS ${s.village}`;
    schools.push(s);
    const practices = PRACTICE_IDS.filter((p) => chance(rng, PRACTICES[p].baseRate));
    truth[s.id] = { practices, fidelity: 0.6 + rng() * 0.4, inflated: false, schoolEffect: (rng() - 0.5) * 0.5, trueReading: [], trueNumeracy: [] };
  }

  // Positive deviants: ~9% of schools run 2–3 effective practices well — spread across the block,
  // including hard contexts (multigrade, tribal) so context alone cannot explain them.
  const order = shuffle(rng, schools.map((s) => s.id));
  const bright = order.slice(0, Math.round(size * 0.09));
  for (const id of bright) {
    const t = truth[id];
    const extra = shuffle(rng, EFFECTIVE.filter((p) => p !== "print_wall")).slice(0, chance(rng, 0.5) ? 3 : 2);
    t.practices = [...new Set([...t.practices.filter((p) => !EFFECTIVE.includes(p)), ...extra])];
    t.fidelity = 0.85 + rng() * 0.15;
  }
  // Data that looks bright but is not: reported scores inflated in the last two cycles.
  for (const id of order.slice(bright.length, bright.length + 6)) truth[id].inflated = true;

  for (const s of schools) {
    const t = truth[s.id];
    CYCLES.forEach((_, cycle) => {
      const r = rateFor(s, t, "reading", cycle);
      const n = rateFor(s, t, "numeracy", cycle);
      t.trueReading.push(r);
      t.trueNumeracy.push(n);
      let rep = measured(rng, r, s.grade3);
      let num = measured(rng, n, s.grade3);
      if (t.inflated && cycle >= 1) {
        rep = Math.min(98, Math.round(rep + 30 + rng() * 20));
        num = Math.min(98, Math.round(num + 30 + rng() * 20));
      }
      s.reading.push(rep);
      s.numeracy.push(num);
    });
  }
  if (profile) return { name: `${profile.block} Block`, district: `${DISTRICT.name} (${DISTRICT.source})`, state: DISTRICT.state, source: "simulated", schools, truth, seed };
  return { name: "Sonagaon Block", district: "Simulated district", state: "Calibrated to ASER 2024 (rural India)", source: "simulated", schools, truth, seed };
}

export const distanceKm = (a: School, b: School) => Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 10) / 10;
