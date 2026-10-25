// The Jugnu API as one Express app. server/index.ts serves it (with the built web app) on a normal
// server; server/vercel.ts exports it as a Vercel function.
import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { readFollowUp } from "./ai/followup";
import { askOfficer } from "./ai/officer";
import { creditReport, recentCalls, traceSummary } from "./ai/run";
import { passcodeRequired, rateLimit, requireOfficer } from "./auth";
import { pipelineFor } from "./blocks";
import { claudeAvailable, MODEL } from "./claude";
import { db, storage } from "./db";
import { answer, codeAndStore, codedForBlock, codingsOf, createInterview, eraseInterview, getById, getByToken, listInterviews, start, turnsOf } from "./interviews";
import { events } from "./events";
import { ivr, ivrConfigured } from "./ivr";
import { reviews } from "./reviews";
import { testing } from "./testing";

export const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "4mb" }));

app.get("/api/status", (_req, res) =>
  res.json({ claude: claudeAvailable(), model: claudeAvailable() ? MODEL : null, ivr: ivrConfigured(), passcode: passcodeRequired(), storage: storage() }),
);

app.post("/api/auth/check", (req, res) => res.json({ ok: !process.env.DEMO_PASSCODE || req.body?.passcode === process.env.DEMO_PASSCODE }));

// ---------------------------------------------------------------- interviews: officer side
const Invite = z.object({
  teacherName: z.string().max(80).optional(),
  schoolName: z.string().max(120).optional(),
  schoolId: z.string().max(40).optional(),
  group: z.enum(["bright", "comparison", "live"]).default("live"),
  language: z.enum(["hi", "en"]).default("hi"),
});

app.get("/api/interviews", requireOfficer, async (_req, res) => res.json(await listInterviews()));

/** Completed, school-linked interviews with grounded codings — merged into the block's evidence. */
app.get("/api/interviews/coded", requireOfficer, async (_req, res) => res.json(await codedForBlock()));

app.post("/api/interviews", requireOfficer, async (req, res) => {
  const body = Invite.safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "Invalid invitation" });
  const row = await createInterview({ ...body.data, channel: "web" });
  res.json({ interview: row, link: `/talk/${row.token}` });
});

app.get("/api/interviews/:id", requireOfficer, async (req, res) => {
  const row = await getById(String(req.params.id));
  if (!row) return res.status(404).json({ error: "Not found" });
  const [turns, codings] = await Promise.all([turnsOf(row.id), codingsOf(row.id)]);
  res.json({ interview: row, turns, codings });
});

app.post("/api/interviews/:id/code", requireOfficer, rateLimit("ai", 120, 600000), async (req, res) => {
  if (!(await getById(String(req.params.id)))) return res.status(404).json({ error: "Not found" });
  const out = await codeAndStore(String(req.params.id));
  res.json({ source: out.source, checks: out.checks, warning: out.warning, codings: await codingsOf(String(req.params.id)) });
});

app.delete("/api/interviews/:id", requireOfficer, async (req, res) => {
  await eraseInterview(String(req.params.id));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- interviews: teacher side (link token)
const publicView = async (token: string) => {
  const row = await getByToken(token);
  if (!row) return null;
  return {
    interview: { teacher_name: row.teacher_name, school_name: row.school_name, language: row.language, status: row.status, channel: row.channel, token: row.token },
    turns: (await turnsOf(row.id)).map((t) => ({ speaker: t.speaker, text: t.text, text_en: t.text_en, kind: t.kind })),
  };
};

/** Anyone (e.g. a judge) can try the teacher side: creates a practice interview. */
app.post("/api/talk/demo", rateLimit("demo", 12, 600000), async (req, res) => {
  const body = Invite.safeParse(req.body ?? {});
  // Public practice interviews are never linked to a school in the block.
  const row = await createInterview({ ...(body.success ? { ...body.data, schoolId: undefined } : {}), group: "live", channel: "web", schoolName: body.success ? body.data.schoolName || "Demo school" : "Demo school" });
  res.json({ token: row.token });
});

app.get("/api/talk/:token", async (req, res) => {
  const view = await publicView(String(req.params.token));
  if (!view) return res.status(404).json({ error: "This interview link is not valid." });
  res.json(view);
});

app.post("/api/talk/:token/language", async (req, res) => {
  const row = await getByToken(String(req.params.token));
  const lang = req.body?.language === "en" ? "en" : "hi";
  if (!row) return res.status(404).json({ error: "Not found" });
  if ((await turnsOf(row.id)).length === 0) await db.run(`UPDATE interviews SET language = ? WHERE id = ?`, lang, row.id);
  res.json(await publicView(row.token));
});

app.post("/api/talk/:token/start", async (req, res) => {
  const row = await getByToken(String(req.params.token));
  if (!row) return res.status(404).json({ error: "Not found" });
  await start(row);
  res.json(await publicView(row.token));
});

app.post("/api/talk/:token/answer", rateLimit("talk", 40, 60000), async (req, res) => {
  const row = await getByToken(String(req.params.token));
  if (!row) return res.status(404).json({ error: "Not found" });
  const body = z.object({ text: z.string().max(3000), source: z.enum(["asr", "typed"]).default("typed"), confidence: z.number().min(0).max(1).nullable().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "text is required" });
  const out = await answer(row, body.data.text, { source: body.data.source, confidence: body.data.confidence ?? null });
  res.json({ ...out, ...(await publicView(row.token)) });
});

// ---------------------------------------------------------------- track: follow-up calls
app.post("/api/followup/read", requireOfficer, rateLimit("ai", 120, 600000), async (req, res) => {
  const body = z.object({ reply: z.string().min(1).max(2000), practice: z.string(), schoolId: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "reply and practice are required" });
  res.json(await readFollowUp(body.data.reply, body.data.practice, body.data.schoolId));
});

// ---------------------------------------------------------------- the officer asks the block
app.post("/api/ask", requireOfficer, rateLimit("ask", 60, 600000), async (req, res) => {
  const body = z.object({ question: z.string().min(2).max(500), seed: z.number().int().optional(), track: z.boolean().optional(), block: z.any().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "question is required" });
  const st = pipelineFor({ seed: body.data.seed, track: body.data.track, block: body.data.block });
  res.json(await askOfficer(body.data.question, st));
});

// ---------------------------------------------------------------- AI trace + evaluation
app.get("/api/ai/trace", requireOfficer, async (_req, res) => res.json({ summary: await traceSummary(), calls: await recentCalls(150) }));

// Totals only (no prompts or answers), so `npm run credits` can read the deployed app's spend.
app.get("/api/ai/credits", async (_req, res) => res.json(await creditReport()));

app.get("/api/ai/eval", (_req, res) => {
  const f = path.resolve("data/eval/results.json");
  res.json(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf-8")) : null);
});

app.use("/api/events", events);
app.use("/api/reviews", reviews);
app.use("/api/testing", testing);
app.use("/api/ivr", ivr);

// Errors are logged and answered as JSON, never as an HTML stack trace.
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (!res.headersSent) res.status(500).json({ error: "Something went wrong on the server. Please try again." });
});
