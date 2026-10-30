// From an approved method to children in classrooms: who it reaches, how far it has got, and what
// changed. Everything here is worked out from the block's plan and what people have recorded.
import type { PipelineState } from "../engine/pipeline";
import type { PracticeId } from "../engine/practices";
import { schoolOverall } from "../engine/subjects";
import type { Action, FollowUp, Recommendation, School } from "../engine/types";
import type { BlockEvent, RecordedFollowUp } from "./store";

export interface WeeklyReport {
  schoolId: string;
  method?: string;
  teachersUsing: number;
  childrenReached: number;
  classes: number[];
  going: "well" | "mixed" | "hard";
  note?: string;
  by: string | null;
  at: string;
}

/** The latest report from each school, plus every report in time order. */
export function weeklyReports(events: BlockEvent[]): { latest: Map<string, WeeklyReport>; all: WeeklyReport[] } {
  const all = events
    .filter((e) => e.kind === "weekly")
    .map((e) => ({ ...(e.payload as unknown as Omit<WeeklyReport, "schoolId" | "by" | "at">), schoolId: e.ref, by: e.actor, at: e.created_at }));
  return { latest: new Map(all.map((r) => [r.schoolId, r])), all };
}

export type Stage = "waiting" | "note" | "visit" | "trying" | "regular" | "stuck";

export interface RolloutSchool {
  school: School;
  rec: Recommendation;
  demonstrator: School;
  stage: Stage;
  note: boolean;
  visit: boolean;
  followUp: FollowUp | RecordedFollowUp | null;
  report: WeeklyReport | null;
  stuck: Action | null;
  done: number;
  total: number;
  before: number | null;
  after: number | null;
}

export interface MethodRollout {
  practice: PracticeId;
  schools: RolloutSchool[];
  now: RolloutSchool[];
  next: RolloutSchool[];
  clusters: { name: string; total: number; note: number; visit: number; using: number }[];
  crps: number;
  teachers: number;
  children: number;
  counts: { note: number; visit: number; reported: number; called: number; trying: number; regular: number; stuck: number };
  reach: { teachersUsing: number; childrenReached: number };
  progress: number;
  impact: { effect: number; low: number; high: number; adopters: number; groupOne: number } | null;
  evidence: { doingWell: number; similar: number; doingWellOf: number; similarOf: number; withScore: number | null; similarScore: number | null } | null;
}

const has = (r: Recommendation, suffix: string, ...status: Action["status"][]) => r.actions.some((a) => a.id.endsWith(suffix) && status.includes(a.status));

export function buildRollouts(state: PipelineState, followUps: RecordedFollowUp[], events: BlockEvent[]): MethodRollout[] {
  const byId = new Map(state.block.schools.map((s) => [s.id, s]));
  const { latest } = weeklyReports(events);
  const recorded = new Map(followUps.map((f) => [f.schoolId, f]));
  const simulated = new Map((state.track?.followUps ?? []).map((f) => [f.schoolId, f]));
  const practices = [...new Set(state.recs.map((r) => r.practice))];
  const mean = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  return practices
    .map((practice) => {
      const schools: RolloutSchool[] = state.recs
        .filter((r) => r.practice === practice)
        .map((rec) => {
          const school = byId.get(rec.schoolId)!;
          const note = has(rec, "-note", "done", "submitted");
          const visit = has(rec, "-visit", "done", "submitted");
          const followUp = recorded.get(school.id) ?? simulated.get(school.id) ?? null;
          const report = latest.get(school.id) ?? null;
          const stuck = rec.actions.find((a) => a.status === "stuck") ?? null;
          const stage: Stage = stuck ? "stuck" : followUp?.outcome === "adopted" ? "regular" : followUp?.outcome === "trying" || report ? "trying" : visit ? "visit" : note ? "note" : "waiting";
          const next = state.track?.nextScores[school.id];
          return {
            school,
            rec,
            demonstrator: byId.get(rec.demonstratorId)!,
            stage,
            note,
            visit,
            followUp,
            report,
            stuck,
            done: rec.actions.filter((a) => a.status === "done").length,
            total: rec.actions.length,
            before: mean([school.reading.at(-1), school.numeracy.at(-1)]),
            after: next ? mean([next.reading, next.numeracy]) : null,
          };
        });
      const now = schools.filter((s) => s.rec.wave === 1);
      const clusters = [...new Set(schools.map((s) => s.school.clusterName))]
        .map((name) => {
          const mine = now.filter((s) => s.school.clusterName === name);
          return { name, total: mine.length, note: mine.filter((s) => s.note).length, visit: mine.filter((s) => s.visit).length, using: mine.filter((s) => s.stage === "trying" || s.stage === "regular").length };
        })
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total);
      const counts = {
        note: now.filter((s) => s.note).length,
        visit: now.filter((s) => s.visit).length,
        reported: now.filter((s) => s.report).length,
        called: now.filter((s) => s.followUp).length,
        trying: now.filter((s) => s.stage === "trying").length,
        regular: now.filter((s) => s.stage === "regular").length,
        stuck: now.filter((s) => s.stage === "stuck").length,
      };
      // Four steps count for each school: voice note, classroom visit, a report or call, regular use.
      const steps = now.reduce((a, s) => a + (s.note ? 1 : 0) + (s.visit ? 1 : 0) + (s.report || s.followUp ? 1 : 0) + (s.stage === "regular" ? 1 : 0), 0);
      const e = state.evidence.find((x) => x.practice === practice);
      const users = new Set(state.interviews.filter((i) => i.group === "bright" && i.mentions.some((m) => m.practice === practice && m.specificity >= 2)).map((i) => i.schoolId));
      const similar = state.interviews.filter((i) => i.group === "comparison").map((i) => i.schoolId);
      const t = state.track?.byPractice.find((b) => b.practice === practice);
      return {
        practice,
        schools,
        now,
        next: schools.filter((s) => s.rec.wave === 2),
        clusters,
        crps: new Set(schools.map((s) => s.school.crp)).size,
        teachers: schools.reduce((a, s) => a + Math.max(1, s.school.teacherCount), 0),
        children: schools.reduce((a, s) => a + s.school.enrolment, 0),
        counts,
        reach: { teachersUsing: now.reduce((a, s) => a + (s.report?.teachersUsing ?? 0), 0), childrenReached: now.reduce((a, s) => a + (s.report?.childrenReached ?? 0), 0) },
        progress: now.length ? steps / (now.length * 4) : 0,
        impact: t ? { effect: t.effect, low: t.ci[0], high: t.ci[1], adopters: t.adopters, groupOne: t.wave1 } : null,
        evidence: e
          ? {
              doingWell: e.bright.k,
              doingWellOf: e.bright.n,
              similar: e.comparison.k,
              similarOf: e.comparison.n,
              withScore: mean([...users].map((id) => schoolOverall(byId.get(id)!))),
              similarScore: mean(similar.map((id) => schoolOverall(byId.get(id)!))),
            }
          : null,
      };
    })
    .sort((a, b) => b.schools.length - a.schools.length);
}
