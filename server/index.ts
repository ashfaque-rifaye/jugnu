import "./quiet";
import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { readFollowUp } from "./ai/followup";
import { askOfficer } from "./ai/officer";
import { recentCalls, traceSummary } from "./ai/run";
import { passcodeRequired, rateLimit, requireOfficer } from "./auth";
import { pipelineFor } from "./blocks";
import { claudeAvailable, MODEL } from "./claude";
import { db } from "./db";
import { answer, codeAndStore, codingsOf, createInterview, eraseInterview, getById, getByToken, listInterviews, start, turnsOf } from "./interviews";
import { ivr, ivrConfigured } from "./ivr";
import { reviews } from "./reviews";
import { testing } from "./testing";

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "4mb" }));
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT || process.env.PORT_API || 8788);

app.get("/api/status", (_req, res) =>
  res.json({ claude: claudeAvailable(), model: claudeAvailable() ? MODEL : null, ivr: ivrConfigured(), passcode: passcodeRequired() }),
);

app.post("/api/auth/check", (req, res) => res.json({ ok: !process.env.DEMO_PASSCODE || req.body?.passcode === process.env.DEMO_PASSCODE }));

// ---------------------------------------------------------------- interviews: officer side
const Invite = z.object({
  teacherName: z.string().max(80).optional(),
  schoolName: z.string().max(120).optional(),
  group: z.enum(["bright", "comparison", "live"]).default("live"),
  language: z.enum(["hi", "en"]).default("hi"),
});

app.get("/api/interviews", requireOfficer, (_req, res) => res.json(listInterviews()));

app.post("/api/interviews", requireOfficer, (req, res) => {
  const body = Invite.safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "Invalid invitation" });
  const row = createInterview({ ...body.data, channel: "web" });
  res.json({ interview: row, link: `/talk/${row.token}` });
});

app.get("/api/interviews/:id", requireOfficer, (req, res) => {
  const row = getById(String(req.params.id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ interview: row, turns: turnsOf(row.id), codings: codingsOf(row.id) });
});

app.post("/api/interviews/:id/code", requireOfficer, rateLimit("ai", 120, 600000), async (req, res) => {
  if (!getById(String(req.params.id))) return res.status(404).json({ error: "Not found" });
  const out = await codeAndStore(String(req.params.id));
  res.json({ source: out.source, checks: out.checks, warning: out.warning, codings: codingsOf(String(req.params.id)) });
});

app.delete("/api/interviews/:id", requireOfficer, (req, res) => {
  eraseInterview(String(req.params.id));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- interviews: teacher side (link token)
const publicView = (token: string) => {
  const row = getByToken(token);
  if (!row) return null;
  return {
    interview: { teacher_name: row.teacher_name, school_name: row.school_name, language: row.language, status: row.status, channel: row.channel, token: row.token },
    turns: turnsOf(row.id).map((t) => ({ speaker: t.speaker, text: t.text, text_en: t.text_en, kind: t.kind })),
  };
};

/** Anyone (e.g. a judge) can try the teacher side: creates a practice interview. */
app.post("/api/talk/demo", rateLimit("demo", 12, 600000), (req, res) => {
  const body = Invite.safeParse(req.body ?? {});
  const row = createInterview({ ...(body.success ? body.data : {}), group: "live", channel: "web", schoolName: body.success ? body.data.schoolName || "Demo school" : "Demo school" });
  res.json({ token: row.token });
});

app.get("/api/talk/:token", (req, res) => {
  const view = publicView(String(req.params.token));
  if (!view) return res.status(404).json({ error: "This interview link is not valid." });
  res.json(view);
});

app.post("/api/talk/:token/language", (req, res) => {
  const row = getByToken(String(req.params.token));
  const lang = req.body?.language === "en" ? "en" : "hi";
  if (!row) return res.status(404).json({ error: "Not found" });
  if (turnsOf(row.id).length === 0) db.prepare(`UPDATE interviews SET language = ? WHERE id = ?`).run(lang, row.id);
  res.json(publicView(row.token));
});

app.post("/api/talk/:token/start", (req, res) => {
  const row = getByToken(String(req.params.token));
  if (!row) return res.status(404).json({ error: "Not found" });
  start(row);
  res.json(publicView(row.token));
});

app.post("/api/talk/:token/answer", rateLimit("talk", 40, 60000), async (req, res) => {
  const row = getByToken(String(req.params.token));
  if (!row) return res.status(404).json({ error: "Not found" });
  const body = z.object({ text: z.string().max(3000), source: z.enum(["asr", "typed"]).default("typed"), confidence: z.number().min(0).max(1).nullable().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "text is required" });
  const out = await answer(row, body.data.text, { source: body.data.source, confidence: body.data.confidence ?? null });
  res.json({ ...out, ...publicView(row.token) });
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
app.get("/api/ai/trace", requireOfficer, (_req, res) => res.json({ summary: traceSummary(), calls: recentCalls(150) }));

app.get("/api/ai/eval", (_req, res) => {
  const f = path.resolve("data/eval/results.json");
  res.json(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf-8")) : null);
});

app.use("/api/reviews", reviews);
app.use("/api/testing", testing);
app.use("/api/ivr", ivr);

const dist = path.resolve(here, "../dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "7d", index: false }));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = process.env.NODE_ENV === "production" ? Number(process.env.PORT || 8080) : PORT;
app.listen(port, () =>
  console.log(`Jugnu API on http://localhost:${port} — Claude ${claudeAvailable() ? `connected (${MODEL})` : "not connected (offline engine)"} · phone line ${ivrConfigured() ? "on" : "simulator only"}`),
);
