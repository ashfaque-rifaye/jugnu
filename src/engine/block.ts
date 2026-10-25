// A simulated block of government primary schools, calibrated to REAL national figures from
// ASER 2024 (rural): Std III reading at Std II level in government schools 23.4%; Std III
// subtraction 33.7%; 52.1% of government primary schools have < 60 students; two-thirds of
// Std I–II classrooms are multigrade; average student attendance 75.9%; library books in use
// in 51.3% of schools. Each school also has hidden practices whose effects only the
// simulator knows — Jugnu has to discover them.
import { DISTRICT, govtElementary, profileFor, pupilsPerTeacher, type BlockProfile } from "./district";
import { EFFECTIVE, PRACTICE_IDS, PRACTICES } from "./practices";
import { chance, logit, mulberry32, pick, randInt, shuffle, sigmoid, type Rng } from "./rng";
import { CYCLES, type Block, type School, type SchoolTruth } from "./types";
import { BLOCK_HQ, VILLAGES } from "./villages";

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
  // A real block: every school stands in a real village, clusters are drawn from the geography.
  const geo = profile ? realSites(profile, size, rng) : null;
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
    const enrolment = chance(rng, ASER_2024.smallSchoolShare) ? randInt(rng, 22, 59) : randInt(rng, 60, 180);
    const female = chance(rng, femaleShare);
    const s: School = {
      id: `s${String(i + 1).padStart(3, "0")}`,
      name: "",
      village: site ? site.name : village(),
      ...(site && { nameHi: site.nameHi, lat: site.lat, lon: site.lon }),
      cluster,
      clusterName: clusterNames[cluster],
      crp: CRPS[cluster % CRPS.length],
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
      attendanceByCycle: [],
      grades: [],
    };
    // Every school here is a government primary school, so the village is its name ("GPS" in records).
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

interface Site { name: string; nameHi: string; lat: number; lon: number; x: number; y: number; cluster: number }

/** km east / north of a point, on the local flat approximation (fine at block scale). */
export function toKm(lat: number, lon: number, lat0: number, lon0: number) {
  return { x: (lon - lon0) * 111.32 * Math.cos((lat0 * Math.PI) / 180), y: (lat - lat0) * 110.57 };
}

// Schools for a real block: one per real village (OpenStreetMap), in a seeded order. A block with
// more government schools than mapped villages gives its villages a second school in a tola or
// basti, a few hundred metres off, as big villages have. Clusters (Jan Shiksha Kendras, ~20
// schools each) are k-means groups of the sites, named after the village nearest their centre.
function realSites(profile: BlockProfile, size: number, rng: Rng) {
  const [lat0, lon0] = BLOCK_HQ[profile.block];
  const vs = shuffle(rng, VILLAGES[profile.block] ?? []);
  const sites: Omit<Site, "cluster">[] = [];
  const extras = [["Tola", "टोला"], ["Basti", "बस्ती"], ["Majra", "मजरा"]];
  for (let i = 0; sites.length < size && vs.length; i++) {
    const [name, nameHi, lat, lon] = vs[i % vs.length];
    const round = Math.floor(i / vs.length);
    const jitter = round ? 0.006 + rng() * 0.006 : 0;
    const a = rng() * Math.PI * 2;
    const la = lat + Math.sin(a) * jitter;
    const lo = lon + Math.cos(a) * jitter;
    const [suffix, suffixHi] = extras[(round - 1) % extras.length] ?? ["", ""];
    // Two real villages can share a name in one block (two Bamoris): number the second one.
    let nm = round ? `${name} ${suffix}` : name;
    let nmHi = round ? `${nameHi} ${suffixHi}` : nameHi;
    for (let n = 2; sites.some((x) => x.name === nm); n++) [nm, nmHi] = [`${round ? `${name} ${suffix}` : name} (${n})`, `${round ? `${nameHi} ${suffixHi}` : nameHi} (${n})`];
    sites.push({ name: nm, nameHi: nmHi, lat: Math.round(la * 1e5) / 1e5, lon: Math.round(lo * 1e5) / 1e5, ...toKm(la, lo, lat0, lon0) });
  }
  const k = Math.max(6, Math.min(18, Math.round(size / 20)));
  // Farthest-point start from the block HQ, then a few rounds of k-means.
  let centers = [{ x: 0, y: 0 }];
  while (centers.length < k) {
    const far = sites.reduce((best, s) => {
      const d = Math.min(...centers.map((c) => Math.hypot(c.x - s.x, c.y - s.y)));
      return d > best.d ? { s, d } : best;
    }, { s: sites[0], d: -1 }).s;
    centers.push({ x: far.x, y: far.y });
  }
  let label = sites.map(() => 0);
  for (let it = 0; it < 12; it++) {
    label = sites.map((s) => centers.reduce((b, c, j) => (Math.hypot(c.x - s.x, c.y - s.y) < Math.hypot(centers[b].x - s.x, centers[b].y - s.y) ? j : b), 0));
    centers = centers.map((c, j) => {
      const mine = sites.filter((_, i) => label[i] === j);
      return mine.length ? { x: mine.reduce((a, s) => a + s.x, 0) / mine.length, y: mine.reduce((a, s) => a + s.y, 0) / mine.length } : c;
    });
  }
  // A cluster of a handful of outlying villages joins its nearest neighbour.
  for (;;) {
    const sizes = centers.map((_, j) => label.filter((l) => l === j).length);
    const tiny = sizes.findIndex((n) => n > 0 && n < 10);
    if (tiny < 0) break;
    const rest = centers.map((c, j) => ({ c, j })).filter(({ j }) => j !== tiny && sizes[j] > 0);
    label = label.map((l, i) => (l !== tiny ? l : rest.reduce((b, r) => (Math.hypot(r.c.x - sites[i].x, r.c.y - sites[i].y) < Math.hypot(b.c.x - sites[i].x, b.c.y - sites[i].y) ? r : b)).j));
  }
  const live = [...new Set(label)];
  centers = live.map((j) => {
    const mine = sites.filter((_, i) => label[i] === j);
    return { x: mine.reduce((a, s) => a + s.x, 0) / mine.length, y: mine.reduce((a, s) => a + s.y, 0) / mine.length };
  });
  label = label.map((l) => live.indexOf(l));
  // Cluster 0 is nearest the block HQ; the rest follow outward.
  const order = centers.map((c, j) => ({ j, d: Math.hypot(c.x, c.y) })).sort((a, b) => a.d - b.d).map((o) => o.j);
  const rank = new Map(order.map((j, r) => [j, r]));
  const sorted = order.map((j) => centers[j]);
  const used = new Set<string>();
  const clusterNames = sorted.map((c) => {
    const near = sites.filter((s) => !/ (Tola|Basti|Majra)$/.test(s.name) && !used.has(s.name)).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    used.add(near.name);
    return near.name;
  });
  return {
    sites: sites.map((s, i) => ({ ...s, x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10, cluster: rank.get(label[i])! })),
    centers: sorted,
    clusterNames,
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
