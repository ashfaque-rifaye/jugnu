// SPREAD: sideways, not top-down. Each struggling school gets ONE practice that fits its gap
// and context, a named demonstrator teacher nearby who already does it (with a voice note in
// that teacher's own words), and owned actions. Schools are split into two waves so wave 2
// is the fair comparison for measuring whether wave 1 actually improved (stepped-wedge).
import { distanceKm } from "./block";
import { PRACTICES, type PracticeId } from "./practices";
import { mulberry32, shuffle } from "./rng";
import type { Action, Block, FindResult, Interview, PracticeEvidence, Recommendation, School } from "./types";

export function runSpread(block: Block, find: FindResult, evidence: PracticeEvidence[], interviews: Interview[], seed = 5): Recommendation[] {
  const distinctive = evidence.filter((e) => e.verdict === "distinctive").map((e) => e.practice);
  if (!distinctive.length) return [];
  const byId = new Map(block.schools.map((s) => [s.id, s]));
  const doers = (p: PracticeId) =>
    interviews.filter((i) => i.group === "bright" && i.mentions.some((m) => m.practice === p && m.specificity >= 2)).map((i) => i.schoolId);
  const last = (s: School, k: "reading" | "numeracy") => s[k][s[k].length - 1] - find.expected[s.id][k][s[k].length - 1];

  const order = shuffle(mulberry32(seed), find.struggling);
  const wave1 = new Set(order.slice(0, Math.ceil(order.length / 2)));

  return find.struggling.map((id) => {
    const s = byId.get(id)!;
    const readingGap = last(s, "reading") < last(s, "numeracy");
    const fit = (p: PracticeId) => {
      let f = evidence.find((e) => e.practice === p)!.score;
      const o = PRACTICES[p].outcome;
      if (o === (readingGap ? "reading" : "numeracy")) f *= 1.6;
      if (o === "both") f *= 1.2;
      if (p === "home_language") f *= s.langMismatch >= 0.4 ? 2.2 : 0.3;
      if (p === "absent_buddies") f *= s.attendance < 0.7 ? 1.8 : 0.7;
      return f;
    };
    const practice = [...distinctive].sort((a, b) => fit(b) - fit(a))[0];
    const demos = doers(practice).map((d) => byId.get(d)!).filter(Boolean);
    const demo = demos.sort((a, b) => distanceKm(a, s) - distanceKm(b, s))[0] ?? byId.get(find.candidates[0])!;
    const quote = interviews.find((i) => i.schoolId === demo.id)?.mentions.find((m) => m.practice === practice)?.quote ?? PRACTICES[practice].what;
    const km = distanceKm(demo, s);
    const why = [
      readingGap ? "Reading is further below expectation than maths" : "Maths is further below expectation than reading",
      practice === "home_language" ? `${Math.round(s.langMismatch * 100)}% of children speak another language at home` : "",
      practice === "absent_buddies" ? `Attendance is ${Math.round(s.attendance * 100)}%` : "",
      `${demos.length} bright-spot school${demos.length === 1 ? "" : "s"} in this block already do it`,
    ]
      .filter(Boolean)
      .join(" · ");
    const firstName = demo.teacher.split(" ")[0];
    const voiceNoteHi = `नमस्ते ${s.teacher} जी, मैं ${demo.teacher}, ${demo.village} से। हमारे स्कूल में — "${quote}" — इससे बच्चों को बहुत मदद मिली। आप भी कल से आज़माइए। ${s.crp} जी आपको हमारे स्कूल लाएँगे, मिलकर देखेंगे।`;
    const voiceNoteEn = `Hello ${s.teacher}, I'm ${demo.teacher} from ${demo.village}. In our school: "${PRACTICES[practice].what}" It has really helped our children — try it from tomorrow. ${s.crp} will bring you to our school to see it.`;
    const w = wave1.has(id) ? 1 : 2;
    const offset = w === 1 ? 0 : 90;
    const actions: Action[] = [
      { id: `${id}-note`, schoolId: id, owner: "Jugnu AI", ownerRole: "Jugnu AI", task: `Send ${firstName}'s 60-second voice note to ${s.teacher}`, due: offset + 1, status: w === 1 ? "scheduled" : "todo" },
      { id: `${id}-visit`, schoolId: id, owner: s.crp, ownerRole: "CRP", task: `Take ${s.teacher} to watch ${firstName} at ${demo.name} (${km} km)`, due: offset + 7, status: "todo" },
      { id: `${id}-call`, schoolId: id, owner: "Jugnu AI", ownerRole: "Jugnu AI", task: `Follow-up call: "Did you try it? What happened?"`, due: offset + 14, status: "todo" },
      { id: `${id}-review`, schoolId: id, owner: "Block Education Officer", ownerRole: "BEO", task: "Review at the next assessment cycle", due: offset + 120, status: "todo" },
    ];
    return { schoolId: id, practice, why, demonstratorId: demo.id, distanceKm: km, voiceNoteHi, voiceNoteEn, wave: w, actions };
  });
}
