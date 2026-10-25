// The Jugnu agent behind the orb and the chat panel. Claude reads the block with the same
// read-only tools as "Ask Jugnu" (run here, on the server) and works the screen with UI tools
// (go to a page, open a school, show it on the map, click, fill, record) that the browser runs.
// The loop is stateless: when Claude asks for UI tools the server returns them, the browser
// runs them and sends the results back with the conversation.
import type Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam, BetaToolUnion } from "@anthropic-ai/sdk/resources/beta";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { PipelineState } from "../../src/engine/pipeline";
import { claudeAvailable, describeError, getClient, PRICES } from "../claude";
import { db, now } from "../db";
import { writeEvent } from "../eventlog";
import { enqueue, enqueueForAction, listJobs } from "../scheduler";
import { CallError, placeCall } from "../telephony";
import { SAFETY } from "./interviewer";
import { officerTools } from "./officer";

/** The voice/chat agent may use Sonnet 5.5 (better at multi-step screen work); default Sonnet, override with AGENT_MODEL. */
const wanted = process.env.AGENT_MODEL || "claude-sonnet-5-5";
export const AGENT_MODEL = wanted in PRICES ? wanted : "claude-haiku-5-5";

export const PAGES = ["today", "schools", "map", "plan", "approvals", "results", "practices", "interviews", "district", "ai", "method", "about", "home"] as const;

/** Tools the browser runs. Kept small: the agent can see the screen (read_screen) and act on it. */
export const UI_TOOLS: BetaToolUnion[] = [
  {
    name: "go_to",
    description: "Open a page of the console. today = the officer's day; schools = list; map = schools on the real map; plan = who learns from whom; approvals = items waiting for sign-off; results = did it work; district = all 7 blocks.",
    input_schema: { type: "object", properties: { page: { type: "string", enum: [...PAGES] } }, required: ["page"] },
  },
  {
    name: "open_school",
    description: "Open one school's page by its name (English or Hindi).",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "show_on_map",
    description: "Fly the map to a school and open its card (photo from above, distances, nearest bright spot).",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "switch_block",
    description: "Work in another Damoh block: Damoh, Hatta, Patharia, Batiyagarh, Jabera, Tendukheda or Patera.",
    input_schema: { type: "object", properties: { block: { type: "string" } }, required: ["block"] },
  },
  {
    name: "search",
    description: "Search the school list for a village, school, teacher or cluster and show the results.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "read_screen",
    description: "What is on screen now: page, headings, buttons, links and form fields (with their labels). Use before click or fill.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "click",
    description: "Click a button, tab or link on screen by its visible label.",
    input_schema: { type: "object", properties: { label: { type: "string" } }, required: ["label"] },
  },
  {
    name: "fill",
    description: "Type into a form field on screen, found by its label or placeholder.",
    input_schema: { type: "object", properties: { field: { type: "string" }, value: { type: "string" } }, required: ["field", "value"] },
  },
  {
    name: "record",
    description:
      "Write to the block's shared log (everyone sees it). Only when the officer clearly asked. kind=note: text. kind=spot_check: sampled, read, subtract (children). kind=follow_up: outcome adopted|trying|barrier|no_answer, said. kind=action: task (words from the task), status todo|scheduled|done|stuck, note.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["note", "spot_check", "follow_up", "action"] },
        school: { type: "string" },
        text: { type: "string" },
        sampled: { type: "integer" },
        read: { type: "integer" },
        subtract: { type: "integer" },
        outcome: { type: "string", enum: ["adopted", "trying", "barrier", "no_answer"] },
        said: { type: "string" },
        task: { type: "string" },
        status: { type: "string", enum: ["todo", "scheduled", "done", "stuck"] },
        note: { type: "string" },
      },
      required: ["kind", "school"],
    },
  },
  {
    name: "set_preference",
    description: "Change the screen language (en|hi) or theme (dark|light).",
    input_schema: { type: "object", properties: { language: { type: "string", enum: ["en", "hi"] }, theme: { type: "string", enum: ["dark", "light"] } } },
  },
];
const UI_NAMES = new Set(UI_TOOLS.map((t) => ("name" in t ? t.name : "")));

export interface AgentContext {
  page: string;
  school?: string | null;
  lang: "en" | "hi";
  role?: string | null;
  /** The block key the console is on (`seed:231205` or `import:…`); write tools need it. */
  block?: string | null;
}

const ACTOR = "Jugnu AI";
const STEPS = { note: "voice note", visit: "peer visit", review: "BEO review", call: "follow-up call" } as const;
const phoneOk = (s: string) => /^\+?[0-9]{10,15}$/.test(s.replace(/[\s-]/g, ""));

/**
 * Tools that change things: dial a teacher now, put a follow-up on Jugnu's clock, escalate to the
 * BEO, or move an action on the board. Every one of them lands in the block's shared log as
 * "Jugnu AI" so the officer sees exactly what was done. They need the block key; without it (the
 * home page, for instance) they explain why rather than guess.
 */
export function writeTools(st: PipelineState, ctx: AgentContext) {
  const block = ctx.block ?? null;
  const byName = (name: string) => {
    const q = name.trim().toLowerCase();
    return st.block.schools.find((s) => s.name.toLowerCase() === q) ?? st.block.schools.find((s) => s.name.toLowerCase().includes(q)) ?? st.block.schools.find((s) => s.teacher.toLowerCase().includes(q));
  };
  const need = () => (block ? null : "No block is open on screen, so nothing can be written. Ask the officer to open a block first.");
  return [
    betaZodTool({
      name: "move_action",
      description: "Move an action on the plan board for a school: step = note (peer voice note) | visit (peer visit) | review (BEO review) | call (follow-up call); status = todo | scheduled | done | stuck. Scheduling a step puts its follow-up on Jugnu's clock automatically.",
      inputSchema: z.object({
        school: z.string().describe("School name as the block tools return it"),
        step: z.enum(["note", "visit", "review", "call"]),
        status: z.enum(["todo", "scheduled", "done", "stuck"]),
        note: z.string().max(400).optional().describe("Why, in one line"),
      }),
      run: async ({ school, step, status, note }) => {
        const miss = need();
        if (miss) return miss;
        const s = byName(school);
        if (!s) return `No school called "${school}" in this block.`;
        const ref = `${s.id}-${step}`;
        await writeEvent(block!, "action", ref, { status, note }, ACTOR);
        const job = await enqueueForAction(block!, ref, status, { note, teacher: s.teacher, school: s.name });
        return `${STEPS[step]} for ${s.name} (${s.teacher}) is now "${status}".${job ? ` Jugnu will ${job.kind.replace("_", " ")} on ${job.due_at.slice(0, 10)}.` : ""}`;
      },
    }),
    betaZodTool({
      name: "schedule_followup",
      description: "Put a follow-up on Jugnu's clock for a school: a reminder, a visit check, or a follow-up call in N days. The call is dialled for real on the day if a phone number is given, otherwise it is handed to the CRP.",
      inputSchema: z.object({
        school: z.string(),
        kind: z.enum(["reminder", "visit_check", "followup_call"]),
        inDays: z.number().int().min(0).max(90),
        to: z.string().optional().describe("Teacher's phone number with country code, only if the officer gave it"),
        language: z.enum(["hi", "en"]).optional(),
      }),
      run: async ({ school, kind, inDays, to, language }) => {
        const miss = need();
        if (miss) return miss;
        const s = byName(school);
        if (!s) return `No school called "${school}" in this block.`;
        if (to && !phoneOk(to)) return "That phone number does not look right — ask for it again with the country code.";
        const step = kind === "reminder" ? "note" : kind === "visit_check" ? "visit" : "call";
        const due = new Date(Date.now() + inDays * 86_400_000).toISOString();
        const job = await enqueue(block!, kind, `${s.id}-${step}`, due, { to, teacher: s.teacher, school: s.name, language });
        if (!job) return `A ${kind.replace("_", " ")} for ${s.name} is already on the clock.`;
        await writeEvent(block!, "note", s.id, { text: `${kind.replace("_", " ")} for ${s.teacher} put on Jugnu's clock for ${due.slice(0, 10)}.` }, ACTOR);
        return `Done: ${kind.replace("_", " ")} for ${s.name} on ${due.slice(0, 10)} (job ${job.id}).`;
      },
    }),
    betaZodTool({
      name: "escalate_to_beo",
      description: "Escalate a school to the Block Education Officer now: marks the action stuck and opens a BEO review with the reason.",
      inputSchema: z.object({ school: z.string(), step: z.enum(["note", "visit", "call"]).default("visit"), reason: z.string().max(400) }),
      run: async ({ school, step, reason }) => {
        const miss = need();
        if (miss) return miss;
        const s = byName(school);
        if (!s) return `No school called "${school}" in this block.`;
        await writeEvent(block!, "action", `${s.id}-${step}`, { status: "stuck", note: reason }, ACTOR);
        await writeEvent(block!, "action", `${s.id}-review`, { status: "scheduled", note: `Escalated by Jugnu: ${reason}` }, ACTOR);
        return `${s.name} is escalated: ${STEPS[step]} marked stuck and a BEO review opened. Reason recorded: ${reason}`;
      },
    }),
    betaZodTool({
      name: "dial_teacher",
      description: "Place a real phone call to a teacher right now through Jugnu's phone line (the AI interviewer talks to them in Hindi or English). Only with a number the officer gave in this conversation; never invent one.",
      inputSchema: z.object({ school: z.string(), to: z.string().describe("Phone number with country code"), language: z.enum(["hi", "en"]).default("hi") }),
      run: async ({ school, to, language }) => {
        const miss = need();
        if (miss) return miss;
        const s = byName(school);
        if (!s) return `No school called "${school}" in this block.`;
        if (!phoneOk(to)) return "That phone number does not look right — ask for it again with the country code.";
        try {
          const call = await placeCall({ to, teacherName: s.teacher, schoolName: s.name, schoolId: s.id, group: "live", language });
          await writeEvent(block!, "note", s.id, { text: `Jugnu is calling ${s.teacher} (${s.name}) now via ${call.provider}; interview ${call.interview?.id ?? "?"}.` }, ACTOR);
          return `Calling ${s.teacher} at ${s.name} now (${call.provider}). The transcript will appear under Interviews when the call ends.`;
        } catch (e) {
          const err = e as CallError;
          return `Could not place the call: ${err.message}`;
        }
      },
    }),
    betaZodTool({
      name: "list_followups",
      description: "What is on Jugnu's clock for this block: pending reminders, visit checks, follow-up calls and escalations with their due dates.",
      inputSchema: z.object({}),
      run: async () => {
        const miss = need();
        if (miss) return miss;
        const jobs = await listJobs(block!, "pending");
        if (!jobs.length) return "Nothing is pending on Jugnu's clock for this block.";
        return jobs.map((j) => `${j.kind.replace("_", " ")} · ${st.block.schools.find((s) => s.id === j.school_id)?.name ?? j.ref} · due ${j.due_at.slice(0, 10)}`).join("\n");
      },
    }),
  ];
}

export interface AgentTurn {
  messages: BetaMessageParam[];
  /** UI tools the browser should run, then send results back. */
  calls: { id: string; name: string; input: Record<string, unknown> }[];
  /** Block lookups from the same step, already run: send them back together with the UI results. */
  results: ToolResult[];
  /** Block lookups made on the server this round (for the work chips). */
  looked: string[];
  /** Final words for this turn, when there are no calls left. */
  say: string | null;
  source: "claude" | "offline";
  error?: string;
}

const system = (st: PipelineState, ctx: AgentContext) => `${SAFETY}
You are Jugnu, the voice and chat assistant inside the console a Block Education Officer (or a cluster coordinator) uses to find schools that do better than expected, learn what they do, and spread it to nearby schools.
Block: ${st.block.name}, ${st.block.district}, ${st.block.state} — ${st.block.schools.length} government primary schools.
The officer is on: ${ctx.page}${ctx.school ? ` (school: ${ctx.school})` : ""}. Role: ${ctx.role ?? "block officer"}.

How to work:
- Look numbers and names up with the block tools; never guess. Name schools exactly as the tools return them.
- Do things on screen with the UI tools when asked ("open", "show", "go to", "fill", "mark", "record"). Use read_screen before click or fill.
- Write to the shared log (record) only when the officer clearly asked for it; repeat back what you recorded.
- You can also act: move_action moves a step on the plan board, schedule_followup puts a reminder, visit check or follow-up call on Jugnu's clock, escalate_to_beo opens a BEO review, dial_teacher places a real phone call, list_followups shows what is pending. Act when asked plainly ("schedule", "escalate", "call", "mark done"); confirm first only for a phone call with no number given. Say what you did in one sentence.
- Replies are read aloud: ${ctx.lang === "hi" ? "answer in simple Hindi (Devanagari)" : "answer in plain English"} — but if the officer speaks another language (Tamil, Marathi, …) answer in theirs, in its own script. 1–3 short sentences, no lists, no markdown, numbers as digits.
- Never shame or rank teachers; a suspicious score means "revisit respectfully".
- Earlier replies in this chat end with a note of the tools they used; trust them, and look again only if you need more detail.
- Spoken requests come through speech recognition, so names can arrive misheard or in another script ("सपना कला" for Sasna Kalan, "Mahua Kalan" for Mahguwan Kalan). Match them to the closest school, cluster or teacher in the block and carry on; ask only if two are equally close.`;

async function trace(ref: string, usage: { i: number; o: number }, ok: boolean, error: string | null, started: number, tools: string[], model = AGENT_MODEL) {
  await db
    .run(
      `INSERT INTO ai_calls (task, ref, source, model, latency_ms, input_tokens, output_tokens, checks, ok, error, created_at) VALUES ('agent.turn', ?, 'claude', ?, ?, ?, ?, ?, ?, ?, ?)`,
      ref.slice(0, 80), model, Date.now() - started, usage.i, usage.o, JSON.stringify([{ name: "tools", passed: true, detail: tools.join(", ") || "none" }]), ok ? 1 : 0, error, now(),
    )
    .catch((e) => console.error("ai_calls trace failed:", e));
}

/** One agent turn: run Claude, executing block tools here, until it either answers or needs the browser. */
export async function agentTurn(messages: BetaMessageParam[], st: PipelineState, ctx: AgentContext): Promise<AgentTurn> {
  if (!claudeAvailable()) return { messages, calls: [], results: [], looked: [], say: null, source: "offline" };
  const started = Date.now();
  const server = [...officerTools(st), ...writeTools(st, ctx)];
  const tools: BetaToolUnion[] = [...server.map((t) => {
      const { name, description, input_schema } = t as unknown as { name: string; description: string; input_schema: Record<string, unknown> };
      return { name, description, input_schema } as BetaToolUnion;
    }), ...UI_TOOLS];
  // Tools and system prompt are the same on every step of a conversation: cache them.
  tools[tools.length - 1] = { ...tools[tools.length - 1], cache_control: { type: "ephemeral" } } as BetaToolUnion;
  const used = { i: 0, o: 0 };
  const names: string[] = [];
  const firstUser = messages.find((m) => m.role === "user" && typeof m.content === "string")?.content as string | undefined;
  const convo = [...messages];
  try {
    for (let step = 0; step < 6; step++) {
      const res: Anthropic.Beta.BetaMessage = await getClient().beta.messages.create(
        {
          model: AGENT_MODEL,
          max_tokens: 6000,
          // Think before answering: the officer would rather wait a moment for a considered reply.
          thinking: { type: "adaptive" },
          system: system(st, ctx),
          tools,
          messages: convo,
        },
        { signal: AbortSignal.timeout(45000) },
      );
      used.i += res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
      used.o += res.usage.output_tokens;
      convo.push({ role: "assistant", content: res.content as BetaMessageParam["content"] });
      const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      names.push(...uses.map((u) => u.name));
      if (res.stop_reason !== "tool_use" || !uses.length) {
        const say = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join(" ").trim();
        await trace(firstUser ?? "turn", used, true, null, started, names);
        return { messages: convo, calls: [], results: [], looked: names.filter((n) => !UI_NAMES.has(n)), say: say || null, source: "claude" };
      }
      const ui = uses.filter((u) => UI_NAMES.has(u.name));
      if (ui.length) {
        // Run any block lookups in the same turn now; hand the rest to the browser.
        const done = await Promise.all(uses.filter((u) => !UI_NAMES.has(u.name)).map((u) => runServer(server, u)));
        await trace(firstUser ?? "turn", used, true, null, started, names);
        return { messages: convo, calls: ui.map((u) => ({ id: u.id, name: u.name, input: u.input as Record<string, unknown> })), results: done, looked: names.filter((n) => !UI_NAMES.has(n)), say: null, source: "claude" };
      }
      convo.push({ role: "user", content: await Promise.all(uses.map((u) => runServer(server, u))) });
    }
    await trace(firstUser ?? "turn", used, false, "too many steps", started, names);
    return { messages: convo, calls: [], results: [], looked: [], say: ctx.lang === "hi" ? "यह काम लंबा हो गया — थोड़ा छोटा करके पूछें?" : "That took too many steps — could you ask in a smaller piece?", source: "claude" };
  } catch (error) {
    const msg = describeError(error);
    await trace(firstUser ?? "turn", used, false, msg, started, names);
    return { messages, calls: [], results: [], looked: [], say: null, source: "offline", error: msg };
  }
}

type ServerTool = { name: string; parse: (x: unknown) => unknown; run: (x: never) => unknown };
type ToolResult = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
async function runServer(server: unknown[], u: Anthropic.Beta.BetaToolUseBlock): Promise<ToolResult> {
  const tool = (server as unknown as ServerTool[]).find((t) => t.name === u.name);
  try {
    if (!tool) throw new Error(`Unknown tool ${u.name}`);
    const out = await tool.run(tool.parse(u.input) as never);
    return { type: "tool_result" as const, tool_use_id: u.id, content: typeof out === "string" ? out : JSON.stringify(out) };
  } catch (e) {
    return { type: "tool_result" as const, tool_use_id: u.id, content: `Error: ${(e as Error).message}`, is_error: true };
  }
}

/** The spoken morning briefing: Claude turns the block's facts into a few natural sentences in the officer's language. */
export async function agentBrief(facts: string[], lang: "en" | "hi", name?: string): Promise<{ lines: string[]; source: "claude" | "offline" }> {
  if (!claudeAvailable()) return { lines: [], source: "offline" };
  const started = Date.now();
  try {
    const res = await getClient().messages.create(
      {
        model: AGENT_MODEL,
        max_tokens: 900,
        system: `${SAFETY}
You are Jugnu, briefing a Block Education Officer${name ? ` (${name})` : ""} out loud at the start of their day. Use only the facts given; never invent numbers or names.
Write ${lang === "hi" ? "in simple spoken Hindi (Devanagari), the way an Indian colleague talks — English words like spot check or CRP are fine" : "in plain spoken Indian English"}.
5 to 7 short sentences, one per line, no lists or markdown, numbers as digits. Open with a one-line greeting and the headline, put the most urgent thing second, end by offering one concrete next step as a question.`,
        messages: [{ role: "user", content: facts.map((f) => `- ${f}`).join("\n") }],
      },
      { signal: AbortSignal.timeout(25000) },
    );
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
    const lines = text.split(/\n+/).map((l) => l.replace(/^[-*•\d.\s]+/, "").trim()).filter(Boolean).slice(0, 8);
    await trace("brief", { i: res.usage.input_tokens, o: res.usage.output_tokens }, true, null, started, []);
    return { lines, source: "claude" };
  } catch (e) {
    await trace("brief", { i: 0, o: 0 }, false, describeError(e), started, []);
    return { lines: [], source: "offline" };
  }
}

/** The page guide is short and frequent, so it uses Haiku. */
const GUIDE_MODEL = "claude-haiku-5-5";

/** A spoken word of help when the officer opens a page: what it is for, and the one thing worth doing here now. */
export async function agentPageGuide(page: string, screen: string, facts: string[], lang: "en" | "hi"): Promise<{ text: string; source: "claude" | "offline" }> {
  if (!claudeAvailable()) return { text: "", source: "offline" };
  const started = Date.now();
  try {
    const res = await getClient().messages.create(
      {
        model: GUIDE_MODEL,
        max_tokens: 300,
        thinking: { type: "disabled" },
        system: `${SAFETY}
You are Jugnu, the voice guide inside a console for a Block Education Officer in India. The officer has just opened the "${page}" page. Say, out loud, in 2 short sentences: what this page helps them do, and the single most useful thing to do on it right now, naming a real school or number from the screen or the facts. Never invent names or numbers.
${lang === "hi" ? "Speak simple spoken Hindi (Devanagari); English words like spot check or CRP are fine." : "Speak plain Indian English."} No greeting, no lists, no markdown, numbers as digits, under 40 words. End with a short offer such as "Want me to open it?"`,
        messages: [{ role: "user", content: `On screen now:\n${screen.slice(0, 2500)}\n\nBlock facts:\n${facts.map((f) => `- ${f}`).join("\n")}` }],
      },
      { signal: AbortSignal.timeout(12000) },
    );
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join(" ").replace(/\s+/g, " ").trim();
    await trace("guide", { i: res.usage.input_tokens, o: res.usage.output_tokens }, true, null, started, [], GUIDE_MODEL);
    return { text, source: "claude" };
  } catch (e) {
    await trace("guide", { i: 0, o: 0 }, false, describeError(e), started, [], GUIDE_MODEL);
    return { text: "", source: "offline" };
  }
}
