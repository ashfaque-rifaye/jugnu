import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

let client: Anthropic | null = null;

/** True when the SDK can find credentials (API key or auth token). */
export function claudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export class ClaudeRefusal extends Error {}

type Content = string | Anthropic.Beta.BetaContentBlockParam[];

/**
 * One structured call to Claude. Output is constrained to `schema` (structured outputs) and
 * validated by zod. Server-side fallbacks re-run a declined request on Anthropic's
 * recommended fallback model instead of failing the classroom flow.
 */
export async function askClaude<S extends z.ZodType>(args: {
  system: string;
  content: Content;
  schema: S;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: args.maxTokens ?? 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: args.system,
    output_config: { effort: args.effort ?? "medium", format: betaZodOutputFormat(args.schema) },
    messages: [{ role: "user", content: args.content }],
  });
  if (response.stop_reason === "refusal") {
    throw new ClaudeRefusal(response.stop_details?.explanation ?? "Request declined");
  }
  if (response.parsed_output == null) throw new Error(`Claude returned no parseable output (stop_reason: ${response.stop_reason})`);
  return response.parsed_output as z.infer<S>;
}

export function describeError(error: unknown): string {
  if (error instanceof ClaudeRefusal) return `Claude declined: ${error.message}`;
  if (error instanceof Anthropic.AuthenticationError) return "Claude API key is invalid";
  if (error instanceof Anthropic.RateLimitError) return "Claude rate limit — retry shortly";
  if (error instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) return "Cannot reach Claude (offline?)";
  if (error instanceof Anthropic.APIError) return `Claude API error ${error.status}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
