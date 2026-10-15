// The activity log of a block: what CRPs and the BEO did — moved an action along, recorded a spot
// check or a follow-up call, left a note. The console folds these events over the block's baseline,
// so every officer sees the same state, and the Today page shows them as recent activity.
import express from "express";
import { z } from "zod";
import { scrubPII } from "./ai/guardrails";
import { rateLimit, requireOfficer } from "./auth";
import { db, json, now } from "./db";

export const events = express.Router();
events.use(requireOfficer);

const Block = z.string().min(1).max(80);
const Kind = z.enum(["action", "spotcheck", "followup", "note"]);

const Payloads = {
  action: z.object({ status: z.enum(["todo", "scheduled", "done", "stuck"]), note: z.string().max(500).optional() }),
  spotcheck: z.object({ sampled: z.number().int().min(5).max(40), proficient: z.number().int().min(0), numeracyProficient: z.number().int().min(0) }),
  followup: z.object({ outcome: z.enum(["adopted", "trying", "barrier", "no_answer"]), said: z.string().max(2000).optional(), barrierOwner: z.string().max(80).optional() }),
  note: z.object({ text: z.string().min(1).max(1000) }),
} as const;

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
  const payload = Payloads[head.data.kind].safeParse(head.data.payload);
  if (!payload.success) return res.status(400).json({ error: `Invalid ${head.data.kind}` });
  const p = payload.data as Record<string, unknown>;
  if (head.data.kind === "spotcheck" && (Number(p.proficient) > Number(p.sampled) || Number(p.numeracyProficient) > Number(p.sampled)))
    return res.status(400).json({ error: "More children passed than were checked" });
  // Free text never keeps phone or ID numbers.
  for (const k of ["note", "said", "text"]) if (typeof p[k] === "string") p[k] = scrubPII(p[k] as string).text;
  const created = now();
  await db.run(
    `INSERT INTO events (block, kind, ref, payload, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    head.data.block,
    head.data.kind,
    head.data.ref,
    JSON.stringify(p),
    head.data.actor ?? null,
    created,
  );
  const row = await db.get<{ id: number }>(`SELECT MAX(id) id FROM events WHERE block = ?`, head.data.block);
  res.json({ id: row?.id ?? null, created_at: created, payload: p });
});

/** Start the demo block afresh (e.g. before a testing session). */
events.delete("/", async (req, res) => {
  const block = Block.safeParse(req.query.block);
  if (!block.success) return res.status(400).json({ error: "block is required" });
  await db.run(`DELETE FROM events WHERE block = ?`, block.data);
  res.json({ ok: true });
});
