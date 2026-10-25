// The Jugnu agent behind the orb and the chat panel. Claude reads the block with the same
// read-only tools as "Ask Jugnu" (run here, on the server) and works the screen with UI tools
// (go to a page, open a school, show it on the map, click, fill, record) that the browser runs.
// The loop is stateless: when Claude asks for UI tools the server returns them, the browser
// runs them and sends the results back with the conversation.
import type Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam, BetaToolUnion } from "@anthropic-ai/sdk/resources/beta";
import type { PipelineState } from "../../src/engine/pipeline";
import { claudeAvailable, describeError, getClient, MODEL } from "../claude";
import { db, now } from "../db";
import { SAFETY } from "./interviewer";
import { officerTools } from "./officer";

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
- Replies are read aloud: ${ctx.lang === "hi" ? "answer in simple Hindi (Devanagari)" : "answer in plain English"}, 1–3 short sentences, no lists, no markdown, numbers as digits.
- Never shame or rank teachers; a suspicious score means "revisit respectfully".
- Earlier replies in this chat end with a note of the tools they used; trust them, and look again only if you need more detail.`;

async function trace(ref: string, usage: { i: number; o: number }, ok: boolean, error: string | null, started: number, tools: string[]) {
  await db
    .run(
      `INSERT INTO ai_calls (task, ref, source, model, latency_ms, input_tokens, output_tokens, checks, ok, error, created_at) VALUES ('agent.turn', ?, 'claude', ?, ?, ?, ?, ?, ?, ?, ?)`,
      ref.slice(0, 80), MODEL, Date.now() - started, usage.i, usage.o, JSON.stringify([{ name: "tools", passed: true, detail: tools.join(", ") || "none" }]), ok ? 1 : 0, error, now(),
    )
    .catch((e) => console.error("ai_calls trace failed:", e));
}

/** One agent turn: run Claude, executing block tools here, until it either answers or needs the browser. */
export async function agentTurn(messages: BetaMessageParam[], st: PipelineState, ctx: AgentContext): Promise<AgentTurn> {
  if (!claudeAvailable()) return { messages, calls: [], results: [], looked: [], say: null, source: "offline" };
  const started = Date.now();
  const server = officerTools(st);
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
          model: MODEL,
          max_tokens: 1500,
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
