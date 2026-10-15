// User testing with real teachers, CRPs and BEOs: consented sessions, task outcomes, quick ratings,
// comments (typed or spoken), and the System Usability Scale. The summary is the evidence for
// "proof of testing and refinement" — and the change log records what was changed because of it.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { z } from "zod";
import { scrubPII } from "./ai/guardrails";
import { rateLimit, requireOfficer } from "./auth";
import { db, json, now } from "./db";

export const testing = express.Router();

const Role = z.enum(["teacher", "crp", "beo", "other"]);

testing.post("/sessions", rateLimit("session", 30, 600000), async (req, res) => {
  const body = z.object({ role: Role, place: z.string().max(80).optional(), consent: z.boolean() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "role and consent are required" });
  if (!body.data.consent) return res.status(400).json({ error: "A session can only start with consent" });
  const id = crypto.randomUUID();
  const device = String(req.get("user-agent") ?? "").slice(0, 160);
  await db.run(`INSERT INTO sessions (id, role, place, device, consent, created_at) VALUES (?, ?, ?, ?, 1, ?)`, id, body.data.role, body.data.place ?? null, device, now());
  res.json({ id });
});

testing.post("/sessions/:id/sus", async (req, res) => {
  const answers = z.array(z.number().int().min(1).max(5)).length(10).safeParse(req.body.answers);
  if (!answers.success) return res.status(400).json({ error: "10 answers from 1 to 5" });
  await db.run(`UPDATE sessions SET sus = ?, ended_at = ? WHERE id = ?`, JSON.stringify(answers.data), now(), String(req.params.id));
  res.json({ score: susScore(answers.data) });
});

testing.post("/feedback", rateLimit("feedback", 60, 600000), async (req, res) => {
  const body = z
    .object({
      sessionId: z.string().nullable().optional(),
      role: Role.nullable().optional(),
      page: z.string().max(60),
      kind: z.enum(["rating", "comment", "task", "bug"]),
      task: z.string().max(60).nullable().optional(),
      rating: z.number().int().min(1).max(5).nullable().optional(),
      text: z.string().max(2000).nullable().optional(),
      lang: z.string().max(5).nullable().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid feedback" });
  const b = body.data;
  await db.run(
    `INSERT INTO feedback (session_id, role, page, kind, task, rating, text, lang, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    b.sessionId ?? null, b.role ?? null, b.page, b.kind, b.task ?? null, b.rating ?? null, b.text ? scrubPII(b.text).text : null, b.lang ?? null, now());
  res.json({ ok: true });
});

/** Standard SUS scoring: odd items (x−1), even items (5−x), sum × 2.5 → 0–100. */
export function susScore(a: number[]): number {
  return a.reduce((s, x, i) => s + (i % 2 === 0 ? x - 1 : 5 - x), 0) * 2.5;
}

testing.get("/summary", requireOfficer, async (_req, res) => {
  const sessions = await db.all<{ id: string; role: string; place: string | null; sus: string | null; created_at: string }>(`SELECT id, role, place, sus, created_at FROM sessions ORDER BY created_at`);
  const feedback = await db.all<Record<string, string | number | null>>(`SELECT session_id, role, page, kind, task, rating, text, lang, created_at FROM feedback ORDER BY created_at DESC`);
  const sus = sessions.filter((s) => s.sus).map((s) => ({ role: s.role, score: susScore(json<number[]>(s.sus, [])) }));
  const tasks = new Map<string, { done: number; total: number }>();
  for (const f of feedback.filter((f) => f.kind === "task")) {
    const e = tasks.get(String(f.task)) ?? { done: 0, total: 0 };
    e.total++;
    if (Number(f.rating) >= 4) e.done++;
    tasks.set(String(f.task), e);
  }
  const ratings = feedback.filter((f) => f.kind === "rating" && f.rating);
  const byPage = new Map<string, number[]>();
  for (const r of ratings) byPage.set(String(r.page), [...(byPage.get(String(r.page)) ?? []), Number(r.rating)]);
  res.json({
    sessions: Object.fromEntries(["teacher", "crp", "beo", "other"].map((r) => [r, sessions.filter((s) => s.role === r).length])),
    sus: { n: sus.length, mean: sus.length ? Math.round(sus.reduce((a, b) => a + b.score, 0) / sus.length) : null, byRole: sus },
    tasks: [...tasks].map(([task, v]) => ({ task, ...v })),
    pages: [...byPage].map(([page, v]) => ({ page, n: v.length, mean: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 })),
    comments: feedback.filter((f) => (f.kind === "comment" || f.kind === "bug") && f.text).slice(0, 200),
  });
});

const CHANGES = path.resolve("data/changes.json");

/** "You said → we changed": the refinement log shown in the app and the deck. */
testing.get("/changes", (_req, res) => {
  res.json(fs.existsSync(CHANGES) ? JSON.parse(fs.readFileSync(CHANGES, "utf-8")) : []);
});
