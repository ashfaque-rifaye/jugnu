// The activity log of a block: what CRPs and the BEO did — moved an action along, recorded a spot
// check or a follow-up call, left a note. The console folds these events over the block's baseline,
// so every officer sees the same state, and the Today page shows them as recent activity.
import express from "express";
import { z } from "zod";
import { rateLimit, requireOfficer } from "./auth";
import { resetDemoDrafts } from "./reviews";
import { db, json } from "./db";
import { BlockKey as Block, EventError, EventKind as Kind, writeEvent } from "./eventlog";
import { enqueueForAction } from "./scheduler";

export const events = express.Router();
events.use(requireOfficer);

events.get("/", async (req, res) => {
  const block = Block.safeParse(req.query.block);
  if (!block.success) return res.status(400).json({ error: "block is required" });
  const rows = await db.all<{ id: number; kind: string; ref: string; payload: string; actor: string | null; created_at: string }>(
    `SELECT id, kind, ref, payload, actor, created_at FROM events WHERE block = ? ORDER BY id LIMIT 5000`,
    block.data,
  );
  res.json(rows.map((r) => ({ ...r, payload: json(r.payload, {}) })));
});

events.post("/", rateLimit("events", 400, 600000), async (req, res) => {
  const head = z.object({ block: Block, kind: Kind, ref: z.string().min(1).max(80), actor: z.string().max(80).optional(), payload: z.record(z.string(), z.unknown()) }).safeParse(req.body);
  if (!head.success) return res.status(400).json({ error: "block, kind, ref and payload are required" });
  const { block, kind, ref, actor, payload } = head.data;
  try {
    const written = await writeEvent(block, kind, ref, payload, actor);
    // Moving an action along is what puts Jugnu's own follow-ups on the clock.
    let job = null;
    if (kind === "action") job = await enqueueForAction(block, ref, String(written.payload.status), payload);
    res.json({ ...written, job: job ? { id: job.id, kind: job.kind, due_at: job.due_at } : null });
  } catch (e) {
    const err = e as EventError;
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/** Start the demo block afresh (e.g. before a testing session). */
events.delete("/", async (req, res) => {
  const block = Block.safeParse(req.query.block);
  if (!block.success) return res.status(400).json({ error: "block is required" });
  await db.run(`DELETE FROM events WHERE block = ?`, block.data);
  await resetDemoDrafts();
  res.json({ ok: true });
});
