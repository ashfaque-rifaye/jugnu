// The Jugnu API as one Express app. server/index.ts serves it (with the built web app) on a normal
// server; server/vercel.ts exports it as a Vercel function.
import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { readFollowUp } from "./ai/followup";
import { checkPhoto, PHOTO_TYPES } from "./ai/vision";
import { agentBrief, agentPageGuide, agentTurn } from "./ai/agent";
import { askOfficer } from "./ai/officer";
import { creditReport, recentCalls, traceSummary } from "./ai/run";
import { passcodeRequired, rateLimit, requireOfficer } from "./auth";
import { pipelineFor } from "./blocks";
import { PRACTICE_IDS, PRACTICES, type PracticeId } from "../src/engine/practices";
import { claudeAvailable, MODEL } from "./claude";
import { db, storage } from "./db";
import { answer, codeAndStore, codedForBlock, codingsOf, createInterview, eraseInterview, getById, getByToken, listInterviews, start, turnsOf } from "./interviews";
import { EventError, writeEvent } from "./eventlog";
import { events } from "./events";
import { jobs } from "./scheduler";
import { ivr, telephonyStatus } from "./telephony";
import { reviews } from "./reviews";
import { testing } from "./testing";
import { synthesize, transcribe, voiceConfigured, VOICES } from "./voice";

export const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "6mb" })); // a phone photo for the spot check, base64

app.get("/api/status", (_req, res) =>
  res.json({ claude: claudeAvailable(), model: claudeAvailable() ? MODEL : null, voice: voiceConfigured(), ivr: telephonyStatus(), passcode: passcodeRequired(), storage: storage() }),
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
app.post("/api/talk/practice", rateLimit("practice", 12, 600000), async (req, res) => {
  const body = Invite.safeParse(req.body ?? {});
  // Public practice interviews are never linked to a school in the block.
  const row = await createInterview({ ...(body.success ? { ...body.data, schoolId: undefined } : {}), group: "live", channel: "web", schoolName: body.success ? body.data.schoolName || "Practice school" : "Practice school" });
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

// ---------------------------------------------------------------- verify: a photo from the spot check
// The photo is checked and dropped; only the verdict is kept (in the block's log, when a block is given).
app.post("/api/evidence/photo", requireOfficer, rateLimit("photo", 40, 600000), async (req, res) => {
  const body = z
    .object({
      image: z.string().min(100).max(5_500_000), // base64, or a data: URL
      mediaType: z.enum(PHOTO_TYPES).optional(),
      practice: z.enum(PRACTICE_IDS as [PracticeId, ...PracticeId[]]),
      schoolId: z.string().max(40),
      block: z.string().max(80).optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "image, practice and schoolId are required" });
  const m = /^data:(image\/[a-z]+);base64,(.*)$/s.exec(body.data.image);
  const mediaType = (m?.[1] ?? body.data.mediaType ?? "image/jpeg") as (typeof PHOTO_TYPES)[number];
  if (!PHOTO_TYPES.includes(mediaType)) return res.status(415).json({ error: "Use a JPEG, PNG or WebP photo" });
  const result = await checkPhoto({ image: m?.[2] ?? body.data.image, mediaType, practice: body.data.practice, ref: body.data.schoolId });
  const v = result.value;
  if (body.data.block && result.source === "claude" && !v.child_faces) {
    const label = PRACTICES[body.data.practice].label;
    const verdict = { yes: "visible", partly: "partly visible", no: "not visible", cannot_tell: "could not be judged" }[v.visible];
    try {
      await writeEvent(body.data.block, "note", body.data.schoolId, { text: `Photo check · ${label}: ${verdict}. ${v.seen.length ? `Seen: ${v.seen.join(", ")}.` : ""}`.trim() }, "Jugnu AI");
    } catch (e) {
      if (!(e instanceof EventError)) throw e;
    }
  }
  res.json(result);
});

// ---------------------------------------------------------------- the officer asks the block
app.post("/api/ask", requireOfficer, rateLimit("ask", 60, 600000), async (req, res) => {
  const body = z.object({ question: z.string().min(2).max(500), seed: z.number().int().optional(), track: z.boolean().optional(), block: z.any().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "question is required" });
  const st = pipelineFor({ seed: body.data.seed, track: body.data.track, block: body.data.block });
  res.json(await askOfficer(body.data.question, st));
});

// ---------------------------------------------------------------- the voice / chat agent
app.post("/api/agent", requireOfficer, rateLimit("agent", 150, 600000), async (req, res) => {
  const body = z
    .object({
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.any() })).min(1).max(60),
      context: z.object({
        page: z.string().max(80),
        school: z.string().max(120).nullish(),
        lang: z.enum(["en", "hi"]),
        role: z.string().max(40).nullish(),
        block: z.string().max(80).nullish(), // the block key the console is on; write tools need it
      }),
      seed: z.number().int().optional(),
      track: z.boolean().optional(),
      block: z.any().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "messages and context are required" });
  const st = pipelineFor({ seed: body.data.seed, track: body.data.track, block: body.data.block });
  res.json(await agentTurn(body.data.messages as Parameters<typeof agentTurn>[0], st, body.data.context));
});

app.post("/api/agent/brief", requireOfficer, rateLimit("agent", 150, 600000), async (req, res) => {
  const body = z.object({ facts: z.array(z.string().max(400)).min(1).max(30), lang: z.enum(["en", "hi"]), name: z.string().max(80).optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "facts and lang are required" });
  res.json(await agentBrief(body.data.facts, body.data.lang, body.data.name));
});

app.post("/api/agent/page", requireOfficer, rateLimit("agent", 200, 600000), async (req, res) => {
  const body = z.object({ page: z.string().min(1).max(60), screen: z.string().max(4000), facts: z.array(z.string().max(400)).max(30), lang: z.enum(["en", "hi"]) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "page, screen, facts and lang are required" });
  res.json(await agentPageGuide(body.data.page, body.data.screen, body.data.facts, body.data.lang));
});

// ---------------------------------------------------------------- voice: speech in, speech out
app.post("/api/voice/stt", requireOfficer, rateLimit("voice", 240, 600000), express.raw({ type: () => true, limit: "8mb" }), async (req, res) => {
  const audio = req.body as Buffer;
  if (!Buffer.isBuffer(audio) || audio.length < 800) return res.json({ text: "", language: null, engine: null });
  const seed = Number(req.query.seed);
  const st = Number.isFinite(seed) ? pipelineFor({ seed }) : null;
  const hints = st ? [...new Set(st.block.schools.flatMap((s) => [s.name, s.nameHi ?? "", s.clusterName, s.teacher].filter(Boolean)))] : [];
  try {
    res.json(await transcribe(audio, String(req.get("content-type") ?? ""), String(req.query.lang ?? "en"), ["Jugnu", "spot check", "bright spot", "CRP", "BEO", ...hints]));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

app.post("/api/voice/tts", rateLimit("voice", 400, 600000), async (req, res) => {
  const body = z.object({ text: z.string().min(1).max(1200), lang: z.string().max(5), voice: z.enum(VOICES).optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "text and lang are required" });
  try {
    const mp3 = await synthesize(body.data.text, body.data.lang, body.data.voice);
    res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" }).send(mp3);
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
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
app.use("/api/jobs", jobs);

// Errors are logged and answered as JSON, never as an HTML stack trace.
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (!res.headersSent) res.status(500).json({ error: "Something went wrong on the server. Please try again." });
});
