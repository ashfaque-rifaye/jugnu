// Copy the live site's settings from your local .env to Vercel (project "jugnu", Production).
// Usage: npm run env:push   — run it yourself; values go straight from .env to Vercel and are
// never printed. Then redeploy (npm run deploy:vercel) so the live site picks them up.
import "dotenv/config";
import { execFileSync } from "node:child_process";

// Turso is not copied: .env points at the jugnu-dev database, and the live site keeps its own (jugnu).
const NAMES = ["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_2", "CLAUDE_MODEL", "CREDIT_BUDGET_USD", "GOOGLE_CLOUD_API_KEY"];
const vercel = process.platform === "win32" ? "vercel.cmd" : "vercel";

for (const name of NAMES) {
  const value = process.env[name];
  if (!value) {
    console.log(`skip  ${name} (not in .env)`);
    continue;
  }
  const secret = /KEY|TOKEN/.test(name);
  try {
    execFileSync(vercel, ["env", "add", name, "production", "--force", "--yes", ...(secret ? ["--sensitive"] : [])], {
      input: value,
      stdio: ["pipe", "ignore", "pipe"],
      shell: process.platform === "win32",
    });
    console.log(`set   ${name}${secret ? " (sensitive)" : ""}`);
  } catch (e) {
    console.log(`FAIL  ${name}: ${String(e.stderr ?? e.message).split("\n").find((l) => l.trim()) ?? "error"}`);
  }
}
console.log("\nDone. Now redeploy: npm run deploy:vercel");
