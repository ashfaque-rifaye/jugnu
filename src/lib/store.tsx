// The console's state: the block (simulated demo or imported data) + everything people did in the
// field — action updates, spot checks, follow-up calls (the shared activity log on the server) and
// real teacher interviews. Every page reads the same derived state, so the loop stays connected.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { generateBlock } from "../engine/block";
import { DEFAULT_SEED } from "../engine/district";
import { runFind } from "../engine/find";
import { evaluate, runPipeline, runTrackStage, type Evaluation, type FieldData, type PipelineState } from "../engine/pipeline";
import { PRACTICE_IDS, type PracticeId } from "../engine/practices";
import type { Action, Block, FollowUp, Interview } from "../engine/types";
import { runVerify } from "../engine/verify";
import { delJSON, getJSON, postJSON } from "./api";
import type { DemoEvent } from "./demo";
import { roleName, useRole } from "./role";

export type EventKind = "action" | "spotcheck" | "followup" | "note" | "weekly";
export interface BlockEvent {
  id: number | string;
  kind: EventKind;
  ref: string;
  payload: Record<string, unknown>;
  actor: string | null;
  created_at: string;
  pending?: boolean;
  /** played back by "Play the term" on this screen only — never saved */
  demo?: boolean;
}

export interface CodedRow {
  id: string;
  school_id: string;
  grp: "bright" | "comparison" | "live";
  language: "hi" | "en";
  updated_at: string;
  codings: { practice: string | null; new_name: string | null; quote: string; specificity: number; coder: string }[];
}

export interface RecordedFollowUp extends FollowUp {
  by: string | null;
  at: string;
  barrierOwner?: string;
}

interface Store {
  state: PipelineState;
  evaluation: Evaluation | null;
  seed: number;
  blockKey: string;
  regenerate: (seed?: number) => void;
  runTrack: () => void;
  importBlock: (block: Block) => void;
  selected: string | null;
  select: (id: string | null) => void;
  /** Shared activity log for this block (plus any playback on this screen). */
  events: BlockEvent[];
  /** Events that just arrived from other people's devices (seq changes on each arrival). */
  incoming: { seq: number; events: BlockEvent[]; interviews: CodedRow[] };
  /** When the log was last fetched (ms), for the "Live" indicator. */
  lastSync: number | null;
  /** "Play the term": events shown on this screen only. */
  demoEvents: BlockEvent[];
  addDemoEvents: (evts: DemoEvent[]) => void;
  clearDemo: () => void;
  tracked: boolean;
  record: (kind: EventKind, ref: string, payload: Record<string, unknown>) => Promise<void>;
  resetBlock: () => Promise<void>;
  syncError: string | null;
  /** Real interviews linked to schools in this block. */
  live: CodedRow[];
  refreshLive: () => void;
  /** Follow-up calls recorded by people (the simulated ones are in state.track). */
  followUps: RecordedFollowUp[];
  /** Spot checks recorded by people. */
  spotChecks: Record<string, { sampled: number; proficient: number; numeracyProficient: number; by: string | null; at: string }>;
  allActions: Action[];
}

const Ctx = createContext<Store | null>(null);

function baseFor(block: Block, field: FieldData): PipelineState {
  if (block.truth) return runPipeline(block, field);
  // Imported real data: Find + checks; spot checks and interviews come from the field.
  const find = runFind(block);
  const verify = runVerify(block, find, (id) => field.spotChecks?.[id] ?? null);
  return {
    block,
    find,
    verify,
    bright: verify.filter((v) => v.verdict === "verified").map((v) => v.schoolId),
    comparison: [],
    interviews: field.live ?? [],
    evidence: [],
    recs: [],
    track: null,
    adopted: [],
  };
}

const isPractice = (p: string | null): p is PracticeId => !!p && (PRACTICE_IDS as string[]).includes(p);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [role] = useRole();
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [block, setBlock] = useState<Block>(() => generateBlock(DEFAULT_SEED));
  const [tracked, setTracked] = useState(false);
  const [selected, select] = useState<string | null>(null);
  const [events, setEvents] = useState<BlockEvent[]>([]);
  const [live, setLive] = useState<CodedRow[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [incoming, setIncoming] = useState<Store["incoming"]>({ seq: 0, events: [], interviews: [] });
  const [demoEvents, setDemoEvents] = useState<BlockEvent[]>([]);
  const blockKey = block.source === "simulated" ? `seed:${block.seed}` : `import:${block.name}:${block.schools.length}`;
  // What this screen has already seen, so only other people's new work is announced.
  const known = useRef<{ key: string; events: Set<string>; interviews: Set<string> } | null>(null);

  const load = useCallback(
    async (withInterviews = true) => {
      try {
        const [ev, coded] = await Promise.all([
          getJSON<BlockEvent[]>(`/api/events?block=${encodeURIComponent(blockKey)}`),
          withInterviews ? getJSON<CodedRow[]>("/api/interviews/coded") : Promise.resolve(null),
        ]);
        setEvents((cur) => [...ev, ...cur.filter((e) => e.pending)]);
        if (coded) setLive(coded);
        setSyncError(null);
        setLastSync(Date.now());
        const seen = known.current;
        if (!seen || seen.key !== blockKey) {
          known.current = { key: blockKey, events: new Set(ev.map((e) => String(e.id))), interviews: new Set((coded ?? []).map((r) => r.id)) };
        } else {
          const fresh = ev.filter((e) => !seen.events.has(String(e.id)));
          const freshIv = (coded ?? []).filter((r) => !seen.interviews.has(r.id));
          fresh.forEach((e) => seen.events.add(String(e.id)));
          freshIv.forEach((r) => seen.interviews.add(r.id));
          if (fresh.length || freshIv.length) setIncoming((cur) => ({ seq: cur.seq + 1, events: fresh, interviews: freshIv }));
        }
      } catch (e) {
        setSyncError((e as Error).message);
      }
    },
    [blockKey],
  );

  // Live: every 4 s while someone is using this screen, every 15 s when idle, paused when hidden.
  useEffect(() => {
    let timer = 0;
    let stopped = false;
    let n = 0;
    let lastInput = Date.now();
    const onInput = () => (lastInput = Date.now());
    const tick = async () => {
      window.clearTimeout(timer);
      if (stopped) return;
      const shown = document.visibilityState === "visible";
      if (shown) await load(n++ % 3 === 0);
      if (stopped) return;
      const active = Date.now() - lastInput < 120_000;
      timer = window.setTimeout(tick, !shown ? 30_000 : active ? 4_000 : 15_000);
    };
    const onVisible = () => document.visibilityState === "visible" && void tick();
    void tick();
    window.addEventListener("pointerdown", onInput);
    window.addEventListener("keydown", onInput);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("keydown", onInput);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const record = useCallback(
    async (kind: EventKind, ref: string, payload: Record<string, unknown>) => {
      const temp: BlockEvent = { id: `tmp-${Date.now()}-${Math.random()}`, kind, ref, payload, actor: roleName(role, block), created_at: new Date().toISOString(), pending: true };
      setEvents((cur) => [...cur, temp]);
      try {
        const saved = await postJSON<{ id: number; created_at: string; payload: Record<string, unknown> }>("/api/events", { block: blockKey, kind, ref, payload, actor: temp.actor ?? undefined });
        known.current?.events.add(String(saved.id));
        setEvents((cur) => cur.map((e) => (e.id === temp.id ? { ...temp, id: saved.id, created_at: saved.created_at, payload: saved.payload, pending: false } : e)));
      } catch (e) {
        setEvents((cur) => cur.filter((x) => x.id !== temp.id));
        throw e;
      }
    },
    [blockKey, role, block],
  );

  const resetBlock = useCallback(async () => {
    await delJSON(`/api/events?block=${encodeURIComponent(blockKey)}`);
    setEvents([]);
    setDemoEvents([]);
    setTracked(false);
  }, [blockKey]);

  const addDemoEvents = useCallback((evts: DemoEvent[]) => {
    const at = new Date().toISOString();
    setDemoEvents((cur) => [...cur, ...evts.map((e, i) => ({ ...e, id: `demo-${cur.length + i}-${e.ref}`, created_at: at, demo: true }))]);
  }, []);
  const clearDemo = useCallback(() => {
    setDemoEvents([]);
    setTracked(false);
  }, []);

  // The shared log, with this screen's playback on top.
  const allEvents = useMemo(() => (demoEvents.length ? [...events, ...demoEvents] : events), [events, demoEvents]);

  // ---- field data from events + live interviews
  const spotChecks = useMemo(() => {
    const out: Store["spotChecks"] = {};
    for (const e of allEvents.filter((x) => x.kind === "spotcheck")) {
      const p = e.payload as { sampled: number; proficient: number; numeracyProficient: number };
      out[e.ref] = { sampled: p.sampled, proficient: p.proficient, numeracyProficient: p.numeracyProficient, by: e.actor, at: e.created_at };
    }
    return out;
  }, [allEvents]);

  const liveInterviews = useMemo<Interview[]>(
    () =>
      live
        .filter((r) => block.schools.some((s) => s.id === r.school_id))
        .map((r) => ({
          schoolId: r.school_id,
          group: r.grp,
          language: r.language,
          turns: [],
          mentions: r.codings.filter((c) => isPractice(c.practice)).map((c) => ({ practice: c.practice as PracticeId, quote: c.quote, specificity: c.specificity })),
          codedBy: r.codings.some((c) => c.coder !== "offline") ? "ai" : "offline",
          minutes: 12,
        })),
    [live, block],
  );

  const base = useMemo(() => {
    const st = baseFor(block, { spotChecks, live: liveInterviews });
    return tracked && block.truth ? runTrackStage(st) : st;
  }, [block, spotChecks, liveInterviews, tracked]);

  // ---- action updates + recorded follow-ups on top
  const followUps = useMemo<RecordedFollowUp[]>(() => {
    const latest = new Map<string, RecordedFollowUp>();
    for (const e of allEvents.filter((x) => x.kind === "followup")) {
      const p = e.payload as { outcome: FollowUp["outcome"]; said?: string; barrierOwner?: string };
      latest.set(e.ref, { schoolId: e.ref, day: 14, outcome: p.outcome, said: p.said ?? "", saidEn: "", by: e.actor, at: e.created_at, barrierOwner: p.barrierOwner });
    }
    return [...latest.values()];
  }, [allEvents]);

  const state = useMemo<PipelineState>(() => {
    const updates = new Map<string, { status: Action["status"]; note?: string }>();
    for (const e of allEvents.filter((x) => x.kind === "action")) updates.set(e.ref, e.payload as { status: Action["status"]; note?: string });
    // A recorded follow-up call closes (or escalates) the call action of that school.
    for (const f of followUps) {
      const id = `${f.schoolId}-call`;
      if (!updates.has(id) || allEvents.findLastIndex((e) => e.kind === "followup" && e.ref === f.schoolId) > allEvents.findLastIndex((e) => e.kind === "action" && e.ref === id))
        updates.set(
          id,
          f.outcome === "barrier" ? { status: "stuck", note: f.said } : f.outcome === "no_answer" ? { status: "scheduled", note: "No answer — call again" } : { status: "done", note: f.said },
        );
    }
    const recs = base.recs.map((r) => ({ ...r, actions: r.actions.map((a) => (updates.has(a.id) ? { ...a, ...updates.get(a.id)! } : a)) }));
    let track = base.track;
    if (track && followUps.length) {
      const mine = new Map(followUps.map((f) => [f.schoolId, f]));
      track = { ...track, followUps: track.followUps.map((f) => mine.get(f.schoolId) ?? f) };
    }
    return { ...base, recs, track };
  }, [base, allEvents, followUps]);

  const regenerate = useCallback((s?: number) => {
    const next = s ?? Math.floor(Math.random() * 100000);
    setSeed(next);
    setBlock(generateBlock(next));
    setTracked(false);
    setEvents([]);
    setDemoEvents([]);
    select(null);
  }, []);
  const importBlock = useCallback((b: Block) => {
    setBlock(b);
    setTracked(false);
    setEvents([]);
    setDemoEvents([]);
    select(null);
  }, []);
  const runTrack = useCallback(() => setTracked(true), []);
  const evaluation = useMemo(() => evaluate(state), [state]);
  const allActions = useMemo(() => state.recs.flatMap((r) => r.actions), [state]);

  return (
    <Ctx.Provider
      value={{
        state,
        evaluation,
        seed,
        blockKey,
        regenerate,
        runTrack,
        importBlock,
        selected,
        select,
        events: allEvents,
        incoming,
        lastSync,
        demoEvents,
        addDemoEvents,
        clearDemo,
        tracked,
        record,
        resetBlock,
        syncError,
        live,
        refreshLive: () => void load(true),
        followUps,
        spotChecks,
        allActions,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePipeline(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePipeline outside provider");
  return c;
}
