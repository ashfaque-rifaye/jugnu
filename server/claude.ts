import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

let client: Anthropic | null = null;

/** True when the SDK can find credentials (API key or auth token). */
export function claudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export class ClaudeRefusal extends Error {}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export interface ClaudeResult<T> {
  output: T;
  model: string;
  usage: Usage;
}

type Content = string | Anthropic.Beta.BetaContentBlockParam[];

/** Server-side fallbacks re-run a declined request on Anthropic's recommended fallback model. */
export const FALLBACK: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: "default" } = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };

/**
 * One structured call to Claude. Output is constrained to `schema` (structured outputs) and
 * validated by zod before it reaches any guardrail.
 */
export async function askClaude<S extends z.ZodType>(args: {
  system: string;
  content: Content;
  schema: S;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<ClaudeResult<z.infer<S>>> {
  const response = await getClient().beta.messages.parse(
    {
      model: MODEL,
      max_tokens: args.maxTokens ?? 16000,
      ...FALLBACK,
      system: args.system,
      output_config: { effort: args.effort ?? "medium", format: betaZodOutputFormat(args.schema) },
      messages: [{ role: "user", content: args.content }],
    },
    { signal: args.signal },
  );
  if (response.stop_reason === "refusal") {
    throw new ClaudeRefusal(response.stop_details?.explanation ?? "Request declined");
  }
  if (response.parsed_output == null) throw new Error(`Claude returned no parseable output (stop_reason: ${response.stop_reason})`);
  return {
    output: response.parsed_output as z.infer<S>,
    model: response.model,
    usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}

export function describeError(error: unknown): string {
  if (error instanceof ClaudeRefusal) return `Claude declined: ${error.message}`;
  if (error instanceof Anthropic.AuthenticationError) return "Claude API key is invalid";
  if (error instanceof Anthropic.RateLimitError) return "Claude rate limit — retry shortly";
  if (error instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) return "Cannot reach Claude (offline?)";
  if (error instanceof Anthropic.APIError) return `Claude API error ${error.status}: ${error.message}`;
  if (error instanceof Error && error.name === "AbortError") return "Claude took too long — used the offline engine";
  return error instanceof Error ? error.message : String(error);
}
