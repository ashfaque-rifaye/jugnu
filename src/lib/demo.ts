// "Play the term": one term of the demo block, replayed in under a minute — spot checks, voice
// notes, peer visits, day-14 calls and the next assessment — as activity events on this screen.
// Everything comes from the simulator (the same draws the block already uses), is labelled as
// playback, and is never written to the shared log.
import { simulatedSpotCheck, type PipelineState } from "../engine/pipeline";
import { simulateTerm } from "../engine/track";
import { runVerify } from "../engine/verify";
import type { EventKind } from "./store";

export interface DemoEvent {
  kind: EventKind;
  ref: string;
  payload: Record<string, unknown>;
  actor: string;
}

export interface DemoBeat {
  key: "results" | "checks" | "notes" | "visits" | "calls" | "assess";
  day: [string, string];
  title: [string, string];
  sub: [string, string];
  events: DemoEvent[];
  /** run the next assessment (wave 1 vs wave 2) at the end of this beat */
  track?: boolean;
}

export function buildTerm(state: PipelineState): DemoBeat[] | null {
  const { block, find, recs } = state;
  if (!block.truth || !recs.length) return null;
  const byId = new Map(block.schools.map((s) => [s.id, s]));
  const crpOf = (id: string) => {
    const s = byId.get(id)!;
    return `CRP ${s.crp} (${s.clusterName})`;
  };

  // The checks still due: the same draws the pipeline holds back for them.
  const sim = simulatedSpotCheck(block);
  const drawn = new Map(find.candidates.map((id) => [id, sim(id)]));
  const pending = state.verify.filter((v) => v.spotCheck.sampled === 0).map((v) => v.schoolId);
  const checks = pending.map((id) => ({ id, sc: drawn.get(id)! })).filter((x) => x.sc);
  const after = runVerify(block, find, (id) => checks.find((c) => c.id === id)?.sc ?? null).filter((v) => pending.includes(v.schoolId));
  const caught = after.filter((v) => v.verdict === "inflation_suspected").length;
  const confirmed = after.filter((v) => v.verdict === "verified").length;

  const wave1 = recs.filter((r) => r.wave === 1);
  const term = simulateTerm(block, recs);
  const call = new Map(term.followUps.map((f) => [f.schoolId, f]));
  const working = term.followUps.filter((f) => f.outcome === "adopted" || f.outcome === "trying").length;

  return [
    {
      key: "results",
      day: ["Day 0", "दिन 0"],
      title: ["New results are in", "नए परिणाम आ गए"],
      sub: [
        `Jugnu compares all ${block.schools.length} schools with what their context predicts — ${find.candidates.length} beat it year after year.`,
        `जुगनू सभी ${block.schools.length} स्कूलों की तुलना उनके हालात से अपेक्षित परिणाम से करता है — ${find.candidates.length} साल-दर-साल आगे हैं।`,
      ],
      events: [],
    },
    {
      key: "checks",
      day: ["Day 2", "दिन 2"],
      title: ["Spot checks: 15 children, 15 minutes", "मौके की जाँच: 15 बच्चे, 15 मिनट"],
      sub: [
        `CRPs visit the ${checks.length} schools still waiting.${caught ? ` ${caught} had over-reported results — flagged for a respectful revisit.` : ""}${confirmed ? ` ${confirmed} confirmed as bright spots.` : ""}`,
        `CRP बाकी ${checks.length} स्कूलों में जाते हैं।${caught ? ` ${caught} में परिणाम ज़्यादा दर्ज थे — सम्मान से दोबारा देखने को चिह्नित।` : ""}${confirmed ? ` ${confirmed} अच्छे स्कूल पक्के हुए।` : ""}`,
      ],
      events: checks.map(({ id, sc }) => ({ kind: "spotcheck" as const, ref: id, payload: { ...sc }, actor: crpOf(id) })),
    },
    {
      key: "notes",
      day: ["Day 3", "दिन 3"],
      title: ["Voice notes go out", "वॉइस नोट भेजे गए"],
      sub: [
        `${wave1.length} teachers hear a 60-second note from a teacher nearby who already does it — in that teacher's own words.`,
        `${wave1.length} शिक्षकों को पास के शिक्षक का 60 सेकंड का संदेश मिलता है — उन्हीं के शब्दों में।`,
      ],
      events: wave1.map((r) => ({ kind: "action" as const, ref: `${r.schoolId}-note`, payload: { status: "done" }, actor: "Jugnu AI" })),
    },
    {
      key: "visits",
      day: ["Day 7", "दिन 7"],
      title: ["Peer visits", "साथी-दौरे"],
      sub: [
        "Each CRP takes a teacher to watch the practice in a classroom a few kilometres away.",
        "हर CRP एक शिक्षक को कुछ किलोमीटर दूर की कक्षा में तरीका देखने ले जाते हैं।",
      ],
      events: wave1.map((r) => {
        const f = call.get(r.schoolId);
        const missed = f?.outcome === "no_answer";
        return { kind: "action" as const, ref: `${r.schoolId}-visit`, payload: missed ? { status: "scheduled", note: "Moved to next week" } : { status: "done" }, actor: crpOf(r.schoolId) };
      }),
    },
    {
      key: "calls",
      day: ["Day 14", "दिन 14"],
      title: ["“Did you try it? What happened?”", "“क्या आपने आज़माया? क्या हुआ?”"],
      sub: [
        `Jugnu calls every teacher back — ${working} of ${term.followUps.length} say it is working; barriers go to the person who can fix them.`,
        `जुगनू हर शिक्षक को फ़ोन करता है — ${term.followUps.length} में से ${working} कहते हैं असर हो रहा है; रुकावटें उस तक जाती हैं जो हल कर सके।`,
      ],
      events: term.followUps.map((f) => ({ kind: "followup" as const, ref: f.schoolId, payload: { outcome: f.outcome, said: f.said, saidEn: f.saidEn, summary: f.summary, insight: f.insight, barrier: f.barrier, barrierOwner: f.owner }, actor: "Jugnu AI" })),
    },
    {
      key: "assess",
      day: ["Next term", "अगला सत्र"],
      title: ["Did it work?", "क्या असर हुआ?"],
      sub: [
        "The next assessment arrives. Wave 1 is compared with wave 2 — schools that get the same help a term later — so the block learns what really transfers.",
        "अगली परीक्षा आती है। पहली लहर की तुलना दूसरी लहर से — जिन्हें यही मदद एक सत्र बाद मिलेगी — ताकि ब्लॉक सीखे कि क्या सच में काम करता है।",
      ],
      events: [],
      track: true,
    },
  ];
}
