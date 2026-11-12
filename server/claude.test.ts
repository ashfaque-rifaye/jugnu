import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it } from "vitest";

// The backup key: a spent first key hands over to the second, and only then does Claude rest.
describe("Claude keys", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-first";
    process.env.ANTHROPIC_API_KEY_2 = "sk-ant-test-second";
  });

  it("moves to the backup key when the first is out of credit, then rests", async () => {
    const claude = await import("./claude");
    expect(claude.getClient().apiKey).toBe("sk-ant-test-first");
    const spent = new Error("You have reached your specified workspace API usage limits.");
    expect(claude.noteClaudeError(spent)).toBe(true);
    expect(claude.getClient().apiKey).toBe("sk-ant-test-second");
    expect(claude.claudeUsable()).toBe(true);
    expect(claude.noteClaudeError(spent)).toBe(false);
    expect(claude.claudeUsable()).toBe(false);
  });

  it("ignores ordinary errors", async () => {
    const claude = await import("./claude");
    expect(claude.noteClaudeError(new Anthropic.APIConnectionError({ message: "offline" }))).toBe(false);
  });
});
