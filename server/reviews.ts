// Human in the loop: AI-written practice cards, voice notes and escalated barriers wait here until a
// CRP or the BEO approves, edits or rejects them. Nothing is sent to a teacher without approval.
import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import { generateBlock } from "../src/engine/block";
import { DEFAULT_SEED } from "../src/engine/district";
import { runPipeline } from "../src/engine/pipeline";
import { PRACTICES, PRACTICE_IDS, type PracticeId } from "../src/engine/practices";
import type { Check } from "./ai/guardrails";
import { draftCard, guardNote, polishNote, type CardQuote } from "./ai/writer";
import { requireOfficer, rateLimit } from "./auth";
import { db, json, now } from "./db";

export const reviews = express.Router();
reviews.use(requireOfficer);

async function enqueue(kind: string, ref: string | null, payload: unknown, checks: Check[], source: string) {
  const id = crypto.randomUUID();
  await db.run(`INSERT INTO reviews (id, kind, ref, payload, checks, created_at) VALUES (?, ?, ?, ?, ?, ?)`, id, kind, ref, JSON.stringify({ ...(payload as object), source }), JSON.stringify(checks), now());
  return id;
}

// A new reviewer should have something to approve: three voice notes from the demo block's own plan
// wait here once. Approving or rejecting them is permanent until the demo is started fresh.
let demoSeeded = false;
async function seedDemoDrafts() {
  if (demoSeeded) return;
  const { recs } = runPipeline(generateBlock(DEFAULT_SEED));
  for (const r of recs.filter((x) => x.wave === 1).slice(0, 3)) {
    const note = { voice_hi: r.voiceNoteHi, voice_en: r.voiceNoteEn };
    const payload = { ...note, draftHi: r.voiceNoteHi, practice: PRACTICES[r.practice].label, demo: true, source: "offline" };
    await db.run(`INSERT OR IGNORE INTO reviews (id, kind, ref, payload, checks, created_at) VALUES (?, ?, ?, ?, ?, ?)`, `demo-${r.schoolId}`, "voice_note", r.schoolId, JSON.stringify(payload), JSON.stringify(guardNote(note, r.voiceNoteHi).checks), now());
  }
  demoSeeded = true;
}

/** "Start the demo block fresh" also puts the demo drafts back. */
export async function resetDemoDrafts() {
  await db.run(`DELETE FROM reviews WHERE id LIKE 'demo-%'`);
  demoSeeded = false;
}

reviews.get("/", async (req, res) => {
  await seedDemoDrafts().catch((e) => console.warn("demo drafts:", e));
  const status = String(req.query.status ?? "pending");
  const rows = await db.all<Record<string, string>>(`SELECT * FROM reviews WHERE (? = 'all' OR status = ?) ORDER BY created_at DESC LIMIT 200`, status, status);
  res.json(rows.map((r) => ({ ...r, payload: json(r.payload, {}), checks: json(r.checks, []) })));
});

reviews.post("/card", rateLimit("ai", 120, 600000), async (req, res) => {
  const body = z.object({ practice: z.enum(PRACTICE_IDS as [PracticeId, ...PracticeId[]]), quotes: z.array(z.object({ school: z.string(), quote: z.string() })).min(1).max(12) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "practice and at least one quote are required" });
  const quotes: CardQuote[] = body.data.quotes.map((q, i) => ({ id: i + 1, ...q }));
  const out = await draftCard(body.data.practice, quotes);
  const id = await enqueue("practice_card", body.data.practice, { card: out.value, quotes }, out.checks, out.source);
  res.json({ id, ...out });
});

reviews.post("/voice-note", rateLimit("ai", 120, 600000), async (req, res) => {
  const body = z.object({ draftHi: z.string().min(1), draftEn: z.string(), practice: z.string(), schoolId: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "draftHi, draftEn and practice are required" });
  const out = await polishNote({ ...body.data, ref: body.data.schoolId });
  const id = await enqueue("voice_note", body.data.schoolId ?? null, { ...out.value, draftHi: body.data.draftHi, practice: body.data.practice }, out.checks, out.source);
  res.json({ id, ...out });
});

reviews.post("/:id/decide", async (req, res) => {
  const body = z.object({ decision: z.enum(["approved", "rejected"]), reviewer: z.string().min(1).max(60), note: z.string().max(500).optional(), payload: z.record(z.string(), z.unknown()).optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "decision and reviewer are required" });
  const row = await db.get<{ payload: string }>(`SELECT payload FROM reviews WHERE id = ?`, String(req.params.id));
  if (!row) return res.status(404).json({ error: "Not found" });
  const payload = body.data.payload ? JSON.stringify({ ...json(row.payload, {}), ...body.data.payload, edited: true }) : row.payload;
  await db.run(`UPDATE reviews SET status = ?, reviewer = ?, note = ?, payload = ?, decided_at = ? WHERE id = ?`, body.data.decision, body.data.reviewer, body.data.note ?? null, payload, now(), String(req.params.id));
  res.json({ ok: true });
});
