// Gemini through Vertex AI: the backup for every AI task when Claude does not answer.
// It uses the same Google credentials as Chirp 3 (a service account on a host, a gcloud login locally).
// The conversation stays in Claude's message shape, so the browser and the tools don't change.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ClaudeResult, Content } from "../claude";
import { googleClient, googleProject, googleReady } from "../voice";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
// Takes over when the main model is slow or rate-limited.
const GEMINI_STEADY = "gemini-3.8-flash";

/** JUGNU_OFFLINE keeps a run on the offline engine, whatever credentials the machine has (the tests use it). */
export const geminiAvailable = () => !process.env.JUGNU_OFFLINE && googleReady();

type Json = Record<string, unknown>;
interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { name: string; args?: Json };
  functionResponse?: { name: string; response: Json };
}
export interface Block {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Json;
  tool_use_id?: string;
  content?: unknown;
  gemini_signature?: string;
}
interface Message {
  role: "user" | "assistant";
  content: string | Block[];
}

/** Claude-shaped messages to Gemini's contents, pairing each tool result with its tool's name. */
function toContents(messages: Message[]) {
  const names = new Map<string, string>();
  for (const m of messages) if (Array.isArray(m.content)) for (const b of m.content) if (b.type === "tool_use" && b.id && b.name) names.set(b.id, b.name);
  return messages
    .map((m) => {
      const blocks: Block[] = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;
      const parts: Part[] = blocks.flatMap((b): Part[] => {
        if (b.type === "text" && b.text) return [{ text: b.text }];
        if (b.type === "tool_use") return [{ functionCall: { name: b.name ?? "", args: b.input ?? {} }, ...(b.gemini_signature ? { thoughtSignature: b.gemini_signature } : {}) }];
        if (b.type === "tool_result") return [{ functionResponse: { name: names.get(b.tool_use_id ?? "") ?? "tool", response: { content: b.content } } }];
        return [];
      });
      return { role: m.role === "assistant" ? "model" : "user", parts };
    })
    .filter((c) => c.parts.length);
}

interface Reply {
  parts: Part[];
  finish: string | null;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}
interface Ask {
  system: string;
  contents: unknown[];
  tools?: { name: string; description?: string; input_schema?: unknown }[];
  maxTokens: number;
  json?: unknown;
  signal?: AbortSignal;
}

async function generate({ system, contents, tools = [], maxTokens, json, signal }: Ask): Promise<Reply> {
  const client = geminiAvailable() ? await googleClient() : null;
  if (!client) throw new Error("Gemini is not available on this server");
  const ask = (model: string, thinkingConfig: Json, timeout: number) =>
    client.request<{ candidates?: { content?: { parts?: Part[] }; finishReason?: string }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }>({
      url: `https://aiplatform.googleapis.com/v1/projects/${googleProject()}/locations/global/publishers/google/models/${model}:generateContent`,
      method: "POST",
      headers: { "x-goog-user-project": googleProject() },
      data: {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        ...(tools.length ? { tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description ?? "", parametersJsonSchema: t.input_schema })) }] } : {}),
        generationConfig: { maxOutputTokens: maxTokens, thinkingConfig, ...(json ? { responseMimeType: "application/json", responseJsonSchema: json } : {}) },
      },
      timeout,
      signal,
    }).then((r) => ({ ...r, model }));
  const r = await ask(GEMINI_MODEL, { thinkingLevel: "LOW" }, 20000).catch((error) => {
    if (signal?.aborted) throw error;
    return ask(GEMINI_STEADY, { thinkingLevel: "LOW" }, 20000);
  });
  const c = r.data.candidates?.[0];
  const used = r.data.usageMetadata;
  return { parts: (c?.content?.parts ?? []).filter((p) => !p.thought), finish: c?.finishReason ?? null, model: r.model, usage: { input_tokens: used?.promptTokenCount ?? 0, output_tokens: used?.candidatesTokenCount ?? 0 } };
}

/** A plain answer, for the page guide and the briefing. */
export async function geminiText(system: string, user: string, maxTokens = 1500): Promise<string> {
  // Thinking spends from the same limit as the answer: without the extra room a long thought leaves no answer.
  const { parts } = await generate({ system, contents: [{ role: "user", parts: [{ text: user }] }], maxTokens: maxTokens + 4000 });
  return parts.map((p) => p.text ?? "").join(" ").replace(/[ \t]+/g, " ").trim();
}

/** A structured answer, in the same shape as a Claude call and validated by the same schema. */
export async function geminiJson<S extends z.ZodType>(args: { system: string; content: Content; schema: S; maxTokens?: number; signal?: AbortSignal }): Promise<ClaudeResult<z.infer<S>>> {
  const parts: Part[] =
    typeof args.content === "string"
      ? [{ text: args.content }]
      : args.content.flatMap((b): Part[] => {
          if (b.type === "text") return [{ text: b.text }];
          if (b.type === "image" && b.source.type === "base64") return [{ inlineData: { mimeType: b.source.media_type, data: b.source.data } }];
          return [];
        });
  // The extra allowance is for thinking, which spends from the same limit as the answer.
  const { $schema: _dialect, ...json } = z.toJSONSchema(args.schema, { io: "input" }) as Record<string, unknown>;
  const reply = await generate({ system: args.system, contents: [{ role: "user", parts }], maxTokens: (args.maxTokens ?? 8000) + 4000, json, signal: args.signal });
  const text = reply.parts.map((p) => p.text ?? "").join("");
  return { output: args.schema.parse(JSON.parse(text)), model: reply.model, usage: reply.usage };
}

/** One step of the agent. The reply comes back as Claude-shaped blocks. */
export async function geminiStep(system: string, messages: Message[], tools: { name: string; description?: string; input_schema?: unknown }[]): Promise<Block[]> {
  const { parts } = await generate({ system, contents: toContents(messages), tools, maxTokens: 7000 });
  return parts.flatMap((p): Block[] => {
    if (p.functionCall) return [{ type: "tool_use", id: `gem_${randomUUID()}`, name: p.functionCall.name, input: p.functionCall.args ?? {}, ...(p.thoughtSignature ? { gemini_signature: p.thoughtSignature } : {}) }];
    return p.text?.trim() ? [{ type: "text", text: p.text }] : [];
  });
}

/** A turn Gemini already started carries on with Gemini: its tool blocks mean nothing to Claude. */
export const startedByGemini = (messages: Message[]) => messages.some((m) => Array.isArray(m.content) && m.content.some((b) => b.type === "tool_use" && b.id?.startsWith("gem_")));
