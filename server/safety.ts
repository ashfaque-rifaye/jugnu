// The safety layer, always on. Every note, comment and interview answer passes through cleanAndLog
// before it is stored or shown: personal numbers and bad language are removed, sensitive topics are
// flagged, and only the count is kept, never the words. POST /check lets anyone try it on demand.
import express from "express";
import { z } from "zod";
import { inspectText, type SafetyFinding } from "./ai/guardrails";
import { rateLimit } from "./auth";
import { db, now } from "./db";

export const safety = express.Router();

/** Clean a piece of text and remember, without the content, what had to be removed. */
export function cleanAndLog(text: string, where: string): string {
  const out = inspectText(text);
  if (out.findings.length)
    void db
      .batch(out.findings.map((f) => ({ sql: `INSERT INTO safety_log (kind, source, count, created_at) VALUES (?, ?, ?, ?)`, args: [f.kind, where, f.count, now()] })))
      .catch((e) => console.warn("safety log:", e));
  return out.text;
}

const LABEL: Record<SafetyFinding["kind"], string> = { phone: "Phone number", id: "ID number", email: "Email address", profanity: "Bad language", topic: "Sensitive topic" };

safety.post("/check", rateLimit("safety", 60, 600000), (req, res) => {
  const body = z.object({ text: z.string().min(1).max(4000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Enter some text to check" });
  const out = inspectText(body.data.text);
  res.json({ text: out.text, safe: out.findings.length === 0, findings: out.findings.map((f) => ({ ...f, label: LABEL[f.kind] })) });
});

safety.get("/summary", async (_req, res) => {
  const totals = await db.all<{ kind: string; n: number }>(`SELECT kind, SUM(count) n FROM safety_log GROUP BY kind`);
  const recent = await db.all<{ kind: string; source: string; count: number; created_at: string }>(`SELECT kind, source, count, created_at FROM safety_log ORDER BY id DESC LIMIT 8`);
  const drafts = await db.get<{ checked: number; stopped: number }>(
    `SELECT COUNT(*) checked, SUM(CASE WHEN error = 'rejected by guardrails' THEN 1 ELSE 0 END) stopped FROM ai_calls WHERE source = 'claude' AND task != 'health.check'`,
  );
  const answers = await db.get<{ n: number }>(`SELECT COUNT(*) n FROM turns WHERE speaker = 'teacher'`);
  const declined = await db.get<{ n: number }>(`SELECT COUNT(*) n FROM interviews WHERE status = 'declined'`);
  res.json({
    totals: Object.fromEntries(totals.map((t) => [t.kind, t.n])),
    recent,
    answersChecked: answers?.n ?? 0,
    aiChecked: drafts?.checked ?? 0,
    aiStopped: drafts?.stopped ?? 0,
    declined: declined?.n ?? 0,
  });
});
