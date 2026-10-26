// Jugnu's own clock. When an action is scheduled, the follow-up it implies is queued here and runs
// on its due day without anyone remembering: a reminder for the voice note, a check after the peer
// visit, the day-14 follow-up call (dialled for real when the teacher's number is on the job), and
// an escalation to the BEO when an action is marked stuck. Everything a job does lands in the
// block's activity log, so the console shows it within seconds.
import express from "express";
import { z } from "zod";
import { rateLimit, requireOfficer } from "./auth";
import { db, json, now } from "./db";
import { BlockKey, writeEvent } from "./eventlog";
import { CallError, placeCall } from "./telephony";
import { sendCheckin, sendText, sendVoiceNote, whatsappConfigured } from "./whatsapp";

export type JobKind = "followup_call" | "escalate" | "reminder" | "visit_check";
export type JobStatus = "pending" | "done" | "skipped" | "failed";

export interface Job {
  id: number;
  block: string;
  kind: JobKind;
  ref: string;
  school_id: string | null;
  due_at: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: string | null;
  created_at: string;
  done_at: string | null;
}

export const ACTOR = "Jugnu AI";

const DAY = 86_400_000;
const addDays = (days: number, from = Date.now()) => new Date(from + days * DAY).toISOString();

/** `s001-call` → `s001`; action ids are `<schoolId>-<step>` throughout the engine. */
export const schoolOf = (ref: string) => ref.replace(/-(note|visit|call|review)$/, "");

type Row = Omit<Job, "payload"> & { payload: string };
const parse = (r: Row): Job => ({ ...r, payload: json(r.payload, {}) as Record<string, unknown> });

/** Queue one job unless the same pending job already exists for this block, action and kind. */
export async function enqueue(block: string, kind: JobKind, ref: string, dueAt: string, payload: Record<string, unknown> = {}): Promise<Job | null> {
  const dup = await db.get<{ id: number }>(`SELECT id FROM scheduled_jobs WHERE block = ? AND ref = ? AND kind = ? AND status = 'pending' LIMIT 1`, block, ref, kind);
  if (dup) return null;
  await db.run(
    `INSERT INTO scheduled_jobs (block, kind, ref, school_id, due_at, status, payload, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    block, kind, ref, schoolOf(ref), dueAt, JSON.stringify(payload), now(),
  );
  const row = await db.get<Row>(`SELECT * FROM scheduled_jobs WHERE block = ? ORDER BY id DESC LIMIT 1`, block);
  return row ? parse(row) : null;
}

/**
 * What an action change implies for the queue. Called after every action event is stored.
 * scheduled: -note → reminder (+1d), -visit → visit check (+7d), -call → follow-up call (+14d, or
 * the job's own `dueDays`). stuck → escalate to the BEO (+0, picked up on the next tick).
 * done/todo: pending jobs for the action are dropped.
 */
export async function enqueueForAction(block: string, ref: string, status: string, payload: Record<string, unknown> = {}): Promise<Job | null> {
  const step = ref.split("-").pop();
  const dueDays = typeof payload.dueDays === "number" && Number.isFinite(payload.dueDays) ? Math.max(0, Math.min(90, payload.dueDays)) : null;
  const carry: Record<string, unknown> = {};
  for (const k of ["to", "teacher", "school", "language", "practice", "voiceNote"]) if (payload[k] != null) carry[k] = payload[k];
  if (status === "stuck") return enqueue(block, "escalate", ref, now(), { ...carry, reason: typeof payload.note === "string" ? payload.note : undefined });
  if (status === "scheduled") {
    if (step === "note") return enqueue(block, "reminder", ref, addDays(dueDays ?? 1), carry);
    if (step === "visit") return enqueue(block, "visit_check", ref, addDays(dueDays ?? 7), carry);
    if (step === "call") return enqueue(block, "followup_call", ref, addDays(dueDays ?? 14), carry);
    return null;
  }
  // done or back to todo: nothing left for Jugnu to do on its own.
  await db.run(`UPDATE scheduled_jobs SET status = 'skipped', done_at = ?, result = 'action moved' WHERE block = ? AND ref = ? AND status = 'pending'`, now(), block, ref);
  return null;
}

async function finish(job: Job, status: JobStatus, result: string) {
  await db.run(`UPDATE scheduled_jobs SET status = ?, result = ?, done_at = ? WHERE id = ?`, status, result.slice(0, 500), now(), job.id);
}

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const who = (job: Job) => [job.payload.teacher, job.payload.school].filter(Boolean).join(", ") || job.school_id || job.ref;

/** Run one job now. Each kind writes to the block's log so the console sees it. */
export async function runJob(job: Job): Promise<string> {
  const school = job.school_id ?? schoolOf(job.ref);
  switch (job.kind) {
    case "reminder": {
      const to = typeof job.payload.to === "string" ? job.payload.to : "";
      const note = typeof job.payload.voiceNote === "string" ? job.payload.voiceNote : "";
      if (to && note && whatsappConfigured()) {
        // Day 1: the demonstrator's voice note goes to the teacher on WhatsApp, spoken and written.
        try {
          await sendVoiceNote(to, note, job.payload.language === "en" ? "en" : "hi");
          await writeEvent(job.block, "note", school, { text: `Day-1 peer voice note sent to ${who(job)} on WhatsApp.` }, ACTOR);
          await finish(job, "done", "voice note sent on WhatsApp");
          return "voice note sent on WhatsApp";
        } catch (e) {
          await writeEvent(job.block, "note", school, { text: `Jugnu could not send the voice note to ${who(job)} on WhatsApp (${(e as Error).message}). CRP, please share it.` }, ACTOR);
          await finish(job, "failed", (e as Error).message);
          return "voice note handed to CRP";
        }
      }
      await writeEvent(job.block, "note", school, { text: `Reminder: the peer voice note for ${who(job)} is scheduled — please check it was sent and heard.` }, ACTOR);
      await finish(job, "done", "reminder posted");
      return "reminder posted";
    }
    case "visit_check": {
      await writeEvent(job.block, "note", school, { text: `Peer visit check: it is a week since the visit for ${who(job)} was scheduled. CRP, please mark it done or stuck.` }, ACTOR);
      await finish(job, "done", "visit check posted");
      return "visit check posted";
    }
    case "escalate": {
      const reason = typeof job.payload.reason === "string" && job.payload.reason ? ` Reason: ${job.payload.reason}` : "";
      await writeEvent(job.block, "action", `${school}-review`, { status: "scheduled", note: `Escalated: ${job.ref} is stuck for ${who(job)}.${reason}` }, ACTOR);
      const beo = (process.env.BEO_WHATSAPP ?? "").trim();
      if (beo && whatsappConfigured())
        await sendText(beo, `Jugnu: ${job.ref} is stuck for ${who(job)}.${reason} A BEO review is open in the console.`).catch((e) =>
          console.warn("BEO WhatsApp alert failed:", (e as Error).message),
        );
      await finish(job, "done", "escalated to BEO");
      return "escalated to BEO";
    }
    case "followup_call": {
      const to = typeof job.payload.to === "string" ? job.payload.to : "";
      if (to) {
        try {
          const call = await placeCall({
            to,
            teacherName: typeof job.payload.teacher === "string" ? job.payload.teacher : undefined,
            schoolName: typeof job.payload.school === "string" ? job.payload.school : undefined,
            schoolId: school,
            group: "live",
            language: job.payload.language === "en" ? "en" : "hi",
          });
          await writeEvent(job.block, "note", school, { text: `Day-14 follow-up call placed to ${who(job)} (${call.provider}, interview ${call.interview?.id ?? "?"}).` }, ACTOR);
          await finish(job, "done", `call placed ${call.callSid}`);
          return "call placed";
        } catch (e) {
          const err = e as CallError;
          // No phone line: ask on WhatsApp instead, when it is set up; the reply is read the same way.
          if (err.status === 503 && whatsappConfigured()) {
            try {
              await sendCheckin(to, { block: job.block, schoolId: school, ref: job.ref, teacher: str(job.payload.teacher), practice: str(job.payload.practice), language: job.payload.language === "en" ? "en" : "hi" });
              await writeEvent(job.block, "note", school, { text: `Day-14 check-in sent to ${who(job)} on WhatsApp (the phone line is off). Their reply will update the board.` }, ACTOR);
              await finish(job, "done", "check-in sent on WhatsApp");
              return "check-in sent on WhatsApp";
            } catch {
              // fall through to the CRP
            }
          }
          // No phone line (or a bad number): hand the call to the CRP instead of failing silently.
          await writeEvent(job.block, "note", school, { text: `Follow-up call due for ${who(job)} — Jugnu could not dial (${err.message}). CRP, please call and record the outcome.` }, ACTOR);
          await finish(job, err.status === 503 ? "done" : "failed", err.message);
          return "call handed to CRP";
        }
      }
      await writeEvent(job.block, "note", school, { text: `Follow-up call due for ${who(job)}. CRP, please call the teacher and record what they said.` }, ACTOR);
      await finish(job, "done", "call handed to CRP");
      return "call handed to CRP";
    }
  }
}

let ticking = false;
/** Run every job that is due. Safe to call often; overlapping ticks are skipped. */
export async function tick(limit = 25): Promise<{ ran: number; results: { id: number; kind: JobKind; result: string }[] }> {
  if (ticking) return { ran: 0, results: [] };
  ticking = true;
  const results: { id: number; kind: JobKind; result: string }[] = [];
  try {
    const due = await db.all<Row>(`SELECT * FROM scheduled_jobs WHERE status = 'pending' AND due_at <= ? ORDER BY due_at, id LIMIT ?`, now(), limit);
    for (const r of due) {
      const job = parse(r);
      try {
        results.push({ id: job.id, kind: job.kind, result: await runJob(job) });
      } catch (e) {
        await finish(job, "failed", (e as Error).message);
        results.push({ id: job.id, kind: job.kind, result: `failed: ${(e as Error).message}` });
      }
    }
  } finally {
    ticking = false;
  }
  return { ran: results.length, results };
}

export async function listJobs(block: string, status?: JobStatus): Promise<Job[]> {
  const rows = status
    ? await db.all<Row>(`SELECT * FROM scheduled_jobs WHERE block = ? AND status = ? ORDER BY due_at, id LIMIT 500`, block, status)
    : await db.all<Row>(`SELECT * FROM scheduled_jobs WHERE block = ? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, due_at, id LIMIT 500`, block);
  return rows.map(parse);
}

export async function skipJob(id: number): Promise<boolean> {
  const row = await db.get<{ id: number }>(`SELECT id FROM scheduled_jobs WHERE id = ? AND status = 'pending'`, id);
  if (!row) return false;
  await db.run(`UPDATE scheduled_jobs SET status = 'skipped', result = 'skipped by officer', done_at = ? WHERE id = ?`, now(), id);
  return true;
}

export const jobs = express.Router();
jobs.use(requireOfficer);

jobs.get("/", async (req, res) => {
  const block = BlockKey.safeParse(req.query.block);
  if (!block.success) return res.status(400).json({ error: "block is required" });
  const status = z.enum(["pending", "done", "skipped", "failed"]).safeParse(req.query.status);
  res.json(await listJobs(block.data, status.success ? status.data : undefined));
});

/** Queue a follow-up by hand (the console's "call back in n days"). */
jobs.post("/", rateLimit("jobs", 200, 600000), async (req, res) => {
  const body = z
    .object({
      block: BlockKey,
      kind: z.enum(["followup_call", "escalate", "reminder", "visit_check"]),
      ref: z.string().min(1).max(80),
      dueDays: z.number().min(0).max(90).default(0),
      payload: z.record(z.string(), z.unknown()).default({}),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "block, kind and ref are required" });
  const job = await enqueue(body.data.block, body.data.kind, body.data.ref, addDays(body.data.dueDays), body.data.payload);
  res.json(job ?? { duplicate: true });
});

/** Run due jobs now (the server also ticks every minute). */
jobs.post("/tick", rateLimit("jobs", 60, 600000), async (_req, res) => res.json(await tick()));

/** Run one job now, regardless of its due date. */
jobs.post("/:id/run", rateLimit("jobs", 100, 600000), async (req, res) => {
  const row = await db.get<Row>(`SELECT * FROM scheduled_jobs WHERE id = ? AND status = 'pending'`, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "No such pending job" });
  const job = parse(row);
  try {
    res.json({ id: job.id, result: await runJob(job) });
  } catch (e) {
    await finish(job, "failed", (e as Error).message);
    res.status(500).json({ error: (e as Error).message });
  }
});

jobs.delete("/:id", async (req, res) => {
  const ok = await skipJob(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "No such pending job" });
  res.json({ ok: true });
});
