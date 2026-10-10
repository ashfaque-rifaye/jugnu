// Every AI task in Jugnu goes through runAI: the same five layers, in the same order —
//   input → model (Claude, with a deadline) → deterministic guardrails → fallback → trace.
// If Claude is unavailable, too slow, declines, or fails a blocking guardrail, the offline engine's
// answer is used instead, so the teacher on the line or the officer on the console never waits on it.
import { claudeAvailable, describeError, type ClaudeResult } from "../claude";
import { db, now } from "../db";
import type { Check } from "./guardrails";

export interface AIResult<T> {
  value: T;
  source: "claude" | "offline";
  checks: Check[];
  warning?: string;
}

export interface AITask<C, T = C> {
  task: string;
  ref?: string | null;
  /** Deterministic answer from the offline engine — always available. */
  offline: () => T | Promise<T>;
  /** The Claude call. Receives an abort signal tied to `timeoutMs`. */
  claude: (signal: AbortSignal) => Promise<ClaudeResult<C>>;
  /**
   * Guardrails: turn Claude's raw output into the value to use (e.g. drop ungrounded quotes) and the
   * checks that were run. `accept: false` rejects the output and falls back to the offline engine.
   */
  guard: (raw: C) => { value: T; checks: Check[]; accept: boolean };
  timeoutMs?: number;
}

export async function runAI<C, T = C>(t: AITask<C, T>): Promise<AIResult<T>> {
  const started = Date.now();
  if (!claudeAvailable()) {
    const value = await t.offline();
    log(t.task, t.ref, "offline", null, 0, null, [], true, null);
    return { value, source: "offline", checks: [] };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), t.timeoutMs ?? 20000);
  try {
    const res = await t.claude(controller.signal);
    const { value, checks, accept } = t.guard(res.output);
    const ms = Date.now() - started;
    if (!accept) {
      log(t.task, t.ref, "claude", res.model, ms, res.usage, checks, false, "rejected by guardrails");
      return { value: await t.offline(), source: "offline", checks, warning: "Claude's answer failed a guardrail — used the offline engine" };
    }
    log(t.task, t.ref, "claude", res.model, ms, res.usage, checks, true, null);
    return { value, source: "claude", checks };
  } catch (error) {
    const msg = describeError(error);
    log(t.task, t.ref, "claude", null, Date.now() - started, null, [], false, msg);
    return { value: await t.offline(), source: "offline", checks: [], warning: msg };
  } finally {
    clearTimeout(timer);
  }
}

function log(
  task: string,
  ref: string | null | undefined,
  source: "claude" | "offline",
  model: string | null,
  ms: number,
  usage: { input_tokens: number; output_tokens: number } | null,
  checks: Check[],
  ok: boolean,
  error: string | null,
) {
  db.prepare(
    `INSERT INTO ai_calls (task, ref, source, model, latency_ms, input_tokens, output_tokens, checks, ok, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(task, ref ?? null, source, model, ms, usage?.input_tokens ?? null, usage?.output_tokens ?? null, JSON.stringify(checks), ok ? 1 : 0, error, now());
}

export interface TraceRow {
  id: number;
  task: string;
  ref: string | null;
  source: string;
  model: string | null;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  checks: Check[];
  ok: boolean;
  error: string | null;
  created_at: string;
}

export function recentCalls(limit = 100): TraceRow[] {
  const rows = db.prepare(`SELECT * FROM ai_calls ORDER BY id DESC LIMIT ?`).all(limit) as Record<string, unknown>[];
  return rows.map((r) => ({ ...(r as unknown as TraceRow), checks: JSON.parse(String(r.checks || "[]")), ok: r.ok === 1 }));
}

export function traceSummary() {
  const rows = db.prepare(`SELECT task, source, ok, COUNT(*) n, AVG(latency_ms) ms, SUM(input_tokens) tin, SUM(output_tokens) tout FROM ai_calls GROUP BY task, source, ok`).all() as {
    task: string;
    source: string;
    ok: number;
    n: number;
    ms: number;
    tin: number | null;
    tout: number | null;
  }[];
  const checks = db.prepare(`SELECT checks FROM ai_calls WHERE checks != '[]'`).all() as { checks: string }[];
  const byCheck = new Map<string, { passed: number; failed: number }>();
  for (const { checks: c } of checks)
    for (const k of JSON.parse(c) as Check[]) {
      const e = byCheck.get(k.name) ?? { passed: 0, failed: 0 };
      if (k.passed) e.passed++;
      else e.failed++;
      byCheck.set(k.name, e);
    }
  return { tasks: rows, checks: [...byCheck].map(([name, v]) => ({ name, ...v })) };
}
