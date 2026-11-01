// The one door to a language model for structured tasks: Claude first, Gemini when Claude does not answer.
// Both return the same shape, so every task keeps its own guardrails and its offline answer behind them.
import type { z } from "zod";
import { askClaude, ClaudeRefusal, claudeUsable, noteClaudeError, type ClaudeResult } from "../claude";
import { geminiAvailable, geminiJson } from "./gemini";

export async function askAI<S extends z.ZodType>(args: Parameters<typeof askClaude<S>>[0]): Promise<ClaudeResult<z.infer<S>>> {
  if (!claudeUsable()) return geminiJson(args);
  try {
    return await askClaude(args);
  } catch (error) {
    noteClaudeError(error);
    // A refusal is an answer, and a task out of time has no time left: neither goes to a second model.
    if (error instanceof ClaudeRefusal || args.signal?.aborted || !geminiAvailable()) throw error;
    return geminiJson(args);
  }
}
