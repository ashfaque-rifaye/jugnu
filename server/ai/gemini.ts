// Gemini through Vertex AI: the backup for Jugnu's voice and chat when Claude does not answer.
// It uses the same Google credentials as Chirp 3 (a service account on a host, a gcloud login locally).
// The conversation stays in Claude's message shape, so the browser and the tools don't change.
import { randomUUID } from "node:crypto";
import { googleClient, googleProject } from "../voice";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

type Json = Record<string, unknown>;
interface Part {
  text?: string;
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

async function generate(system: string, contents: unknown[], tools: { name: string; description?: string; input_schema?: unknown }[], maxTokens: number): Promise<{ parts: Part[]; finish: string | null }> {
  const client = await googleClient();
  if (!client) throw new Error("Gemini needs a Google service account on this server");
  const r = await client.request<{ candidates?: { content?: { parts?: Part[] }; finishReason?: string }[] }>({
    url: `https://aiplatform.googleapis.com/v1/projects/${googleProject()}/locations/global/publishers/google/models/${GEMINI_MODEL}:generateContent`,
    method: "POST",
    headers: { "x-goog-user-project": googleProject() },
    data: {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      ...(tools.length ? { tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description ?? "", parametersJsonSchema: t.input_schema })) }] } : {}),
      generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingLevel: "LOW" } },
    },
    timeout: 30000,
  });
  const c = r.data.candidates?.[0];
  return { parts: (c?.content?.parts ?? []).filter((p) => !p.thought), finish: c?.finishReason ?? null };
}

/** A plain answer, for the page guide and the briefing. */
export async function geminiText(system: string, user: string, maxTokens = 1500): Promise<string> {
  const { parts } = await generate(system, [{ role: "user", parts: [{ text: user }] }], [], maxTokens);
  return parts.map((p) => p.text ?? "").join(" ").replace(/[ \t]+/g, " ").trim();
}

/** One step of the agent. The reply comes back as Claude-shaped blocks. */
export async function geminiStep(system: string, messages: Message[], tools: { name: string; description?: string; input_schema?: unknown }[]): Promise<Block[]> {
  const { parts } = await generate(system, toContents(messages), tools, 3000);
  return parts.flatMap((p): Block[] => {
    if (p.functionCall) return [{ type: "tool_use", id: `gem_${randomUUID()}`, name: p.functionCall.name, input: p.functionCall.args ?? {}, ...(p.thoughtSignature ? { gemini_signature: p.thoughtSignature } : {}) }];
    return p.text?.trim() ? [{ type: "text", text: p.text }] : [];
  });
}

/** A turn Gemini already started carries on with Gemini: its tool blocks mean nothing to Claude. */
export const startedByGemini = (messages: Message[]) => messages.some((m) => Array.isArray(m.content) && m.content.some((b) => b.type === "tool_use" && b.id?.startsWith("gem_")));
