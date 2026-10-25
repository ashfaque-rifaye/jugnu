// A block of government primary schools — real ones from UDISE+ for Damoh's blocks — whose
// learning results are simulated, calibrated to REAL national figures from
// ASER 2024 (rural): Std III reading at Std II level in government schools 23.4%; Std III
// subtraction 33.7%; 52.1% of government primary schools have < 60 students; two-thirds of
// Std I–II classrooms are multigrade; average student attendance 75.9%; library books in use
// in 51.3% of schools. Each school also has hidden practices whose effects only the
// simulator knows — Jugnu has to discover them.
import { DISTRICT, govtElementary, profileFor, pupilsPerTeacher } from "./district";
import { EFFECTIVE, PRACTICE_IDS, PRACTICES } from "./practices";
import { chance, logit, mulberry32, pick, randInt, shuffle, sigmoid, type Rng } from "./rng";
import { CYCLES, type Block, type School, type SchoolTruth } from "./types";
import { UDISE } from "./udise";
import { BLOCK_HQ } from "./villages";

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
const CRPS = ["Sunil Verma", "Anita Patel", "Mohd. Irfan", "Rekha Bhuriya", "Devendra Singh", "Kavita Joshi", "Rajesh Meena", "Shabana Qureshi", "Prakash Dhurve", "Lata Yadav", "Manoj Lodhi", "Seema Ahirwar", "Ashok Thakur", "Pooja Kurmi", "Naresh Uikey", "Usha Chaurasia", "Ramkishan Patel", "Farzana Bee"];
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

// A seed that is a UDISE+ block code (see district.ts) builds that real block: its real government
// schools (UDISE+ names, locations, clusters, enrolment and teachers) and its tribal share and share
// of women teachers. What no public source has — learning levels, attendance, teachers' names and
// classroom practices — stays simulated.
export function generateBlock(seed = 2024, size = 200): Block {
  const profile = profileFor(seed);
  const real = profile ? UDISE[profile.block] : undefined;
  if (profile) size = real ? real.schools.length : govtElementary(profile);
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
  // A real block: every school is a real one, in its real Jan Shiksha Kendra (cluster).
  const geo = profile && real ? udiseSites(profile.block) : null;
  const clusterNames = geo ? geo.clusterNames : CLUSTERS;
  const centers = geo
    ? geo.centers
    : CLUSTERS.map((_, i) => {
        const angle = (i / CLUSTERS.length) * Math.PI * 2 + rng() * 0.4;
        const r = 5 + rng() * 9;
        return { x: Math.cos(angle) * r, y: Math.sin(angle) * r * 0.8 };
      });
  const tribalClusters = profile
    ? new Set(
        centers
          .map((c, i) => ({ i, se: c.x - c.y }))
          .sort((a, b) => b.se - a.se)
          .slice(0, Math.round((profile.stEnrolmentPct / 100) * clusterNames.length * 1.2))
          .map((c) => c.i),
      )
    : null;
  const femaleShare = profile ? profile.femaleTeacherPct / 100 : 0.5;
  const ppt = profile ? pupilsPerTeacher(profile) : 0;
  const schools: School[] = [];
  const truth: Record<string, SchoolTruth> = {};
  for (let i = 0; i < size; i++) {
    const site = geo?.sites[i];
    const cluster = site ? site.cluster : i % CLUSTERS.length;
    const c = centers[cluster];
    const x = site ? site.x : c.x + (rng() - 0.5) * 7;
    const y = site ? site.y : c.y + (rng() - 0.5) * 6;
    const tribal = tribalClusters ? tribalClusters.has(cluster) : x > 3 && y < -1; // south-east: tribal belt, other home languages
    const simEnrolment = chance(rng, ASER_2024.smallSchoolShare) ? randInt(rng, 22, 59) : randInt(rng, 60, 180);
    const enrolment = site ? site.enrolment : simEnrolment;
    const female = chance(rng, femaleShare);
    // Teachers for classes 1–5: a middle school (to class 8) shares its staff with classes 6–8.
    const primaryTeachers = site ? Math.max(1, Math.round(site.teachers * (site.classTo > 5 ? 0.5 : 1))) : 0;
    const s: School = {
      id: `s${String(i + 1).padStart(3, "0")}`,
      name: "",
      village: site ? site.name : village(),
      ...(site && { nameHi: site.nameHi, lat: site.lat, lon: site.lon, udise: site.udise, clusterNameHi: geo!.clusterNamesHi[cluster] }),
      cluster,
      clusterName: clusterNames[cluster],
      crp: CRPS[cluster % CRPS.length],
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      enrolment,
      grade3: site ? Math.max(3, site.grade3) : Math.max(6, Math.round(enrolment / 5.5 + (rng() - 0.5) * 4)),
      ptr: site ? Math.round(enrolment / primaryTeachers) : profile ? Math.round(ppt * (0.55 + rng() * 0.9)) : Math.round(18 + rng() * 32),
      // Fewer teachers than classes 1–5 means classes share a room and a teacher.
      multigrade: site ? primaryTeachers < 5 : chance(rng, enrolment < 60 ? 0.85 : 0.5),
      library: chance(rng, ASER_2024.libraryInUse),
      attendance: Math.round(Math.min(0.95, Math.max(0.5, ASER_2024.studentAttendance + (rng() - 0.5) * 0.24 - (tribal ? 0.04 : 0))) * 100) / 100,
      langMismatch: Math.round((tribal ? 0.45 + rng() * 0.45 : rng() * 0.25) * 100) / 100,
      teacher: `${female ? pick(rng, F_NAMES) : pick(rng, M_NAMES)} ${pick(rng, SURNAMES)}`,
      teacherGender: female ? "f" : "m",
      reading: [],
      numeracy: [],
      attendanceByCycle: [],
      grades: [],
    };
    // Government primary schools are known by their village ("GPS Sasna Kalan" in records).
    s.name = s.village;
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
  addGradesAndAttendance(seed, schools, truth);
  if (profile) return { name: `${profile.block} Block`, district: `${DISTRICT.name} (${DISTRICT.source})`, state: DISTRICT.state, source: "simulated", schools, truth, seed };
  return { name: "Sonagaon Block", district: "Simulated district", state: "Calibrated to ASER 2024 (rural India)", source: "simulated", schools, truth, seed };
}

/** km east / north of a point, on the local flat approximation (fine at block scale). */
export function toKm(lat: number, lon: number, lat0: number, lon0: number) {
  return { x: (lon - lon0) * 111.32 * Math.cos((lat0 * Math.PI) / 180), y: (lat - lat0) * 110.57 };
}

// A real block's schools from UDISE+, in register order. Clusters are the real Jan Shiksha Kendras,
// numbered from the one nearest the block HQ outward.
function udiseSites(block: string) {
  const { clusters, schools } = UDISE[block];
  const [lat0, lon0] = BLOCK_HQ[block];
  const sites = schools.map(([udise, name, nameHi, lat, lon, cluster, enrolment, grade3, teachers, classTo]) => ({ udise, name, nameHi, lat, lon, cluster, enrolment, grade3, teachers, classTo, ...toKm(lat, lon, lat0, lon0) }));
  const centers = clusters.map((_, j) => {
    const mine = sites.filter((x) => x.cluster === j);
    return { x: mine.reduce((a, x) => a + x.x, 0) / mine.length, y: mine.reduce((a, x) => a + x.y, 0) / mine.length };
  });
  const order = centers.map((c, j) => ({ j, d: Math.hypot(c.x, c.y) })).sort((a, b) => a.d - b.d).map((o) => o.j);
  const rank = new Map(order.map((j, r) => [j, r]));
  return {
    sites: sites.map((x) => ({ ...x, x: Math.round(x.x * 10) / 10, y: Math.round(x.y * 10) / 10, cluster: rank.get(x.cluster)! })),
    centers: order.map((j) => centers[j]),
    clusterNames: order.map((j) => clusters[j][0]),
    clusterNamesHi: order.map((j) => clusters[j][1]),
  };
}

// Grades 1–5 and attendance per year. A separate random stream, so adding them leaves every other
// number in the block exactly as before. Each grade is judged against its own grade-level
// expectation (letters and numbers in Grade 1 … reading a story and division in Grade 5); the
// lower grades sit a little closer to their bar, as in ASER, and attendance thins with age.
const GRADE_SHARE = [0.23, 0.21, 0.2, 0.19, 0.17];
const GRADE_OFFSET = [0.45, 0.22, 0, -0.12, -0.25];
const GRADE_ATTEND = [0.01, 0.01, 0, -0.01, -0.02];

function addGradesAndAttendance(seed: number, schools: School[], truth: Record<string, SchoolTruth>) {
  const rng = mulberry32((seed ^ 0x5f3759df) >>> 0);
  const last = CYCLES.length - 1;
  for (const s of schools) {
    const t = truth[s.id];
    s.attendanceByCycle = CYCLES.map((_, c) => Math.round(Math.min(0.97, Math.max(0.45, s.attendance + (c - last) * 0.012 + (rng() - 0.5) * 0.05)) * 100) / 100);
    s.grades = GRADE_SHARE.map((share, i) => {
      const grade = (i + 1) as 1 | 2 | 3 | 4 | 5;
      const enrolled = grade === 3 ? s.grade3 : Math.max(3, Math.round(s.enrolment * share + (rng() - 0.5) * 4));
      const attendance = Math.round(Math.min(0.97, Math.max(0.45, s.attendance + GRADE_ATTEND[i] + (rng() - 0.5) * 0.06)) * 100) / 100;
      if (grade === 3) return { grade, enrolled, attendance, reading: s.reading[last], numeracy: s.numeracy[last] };
      const shift = (which: "reading" | "numeracy") => sigmoid(logit(which === "reading" ? t.trueReading[last] : t.trueNumeracy[last]) + GRADE_OFFSET[i] + (rng() - 0.5) * 0.3);
      let reading = measured(rng, shift("reading"), enrolled);
      let numeracy = measured(rng, shift("numeracy"), enrolled);
      if (t.inflated) {
        reading = Math.min(98, Math.round(reading + 25 + rng() * 15));
        numeracy = Math.min(98, Math.round(numeracy + 25 + rng() * 15));
      }
      return { grade, enrolled, attendance, reading, numeracy };
    });
    // Grades add up to the school's enrolment (any rounding goes to Grade 1, the largest class).
    const g1 = s.grades[0];
    g1.enrolled = Math.max(2, g1.enrolled + s.enrolment - s.grades.reduce((a, g) => a + g.enrolled, 0));
  }
}

export const distanceKm = (a: School, b: School) => Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 10) / 10;
