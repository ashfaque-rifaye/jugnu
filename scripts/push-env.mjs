// Copy the live site's settings from your local .env to Vercel (project "jugnu", Production).
// Usage: npm run env:push   — run it yourself; values go straight from .env to Vercel and are
// never printed. Then redeploy (npm run deploy:vercel) so the live site picks them up.
import "dotenv/config";
import { execFileSync } from "node:child_process";

// Turso is not copied: .env points at the jugnu-dev database, and the live site keeps its own (jugnu).
const NAMES = ["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_2", "CLAUDE_MODEL", "CREDIT_BUDGET_USD", "GOOGLE_CLOUD_API_KEY"]; // gitleaks:allow (names of settings, not their values)
const vercel = process.platform === "win32" ? "vercel.cmd" : "vercel";

// The phone line, once `npm run phone:deploy` has given the phone server its fixed address. The live site
// places the call; the call's audio goes to the phone server. Only the demo phones may be rung from it.
if (process.env.PHONE_SERVER_URL) {
  process.env.PUBLIC_URL = process.env.PHONE_SERVER_URL;
  process.env.CALL_ONLY_TO ||= [process.env.DEMO_TEACHER_PHONE, process.env.TEST_PHONE].filter(Boolean).join(",");
  const provider = process.env.TELEPHONY_PROVIDER === "exotel" ? ["API_KEY_EXOTEL", "API_TOKEN_PASSWORD", "EXOTEL_SID", "EXOTEL_HOST", "EXOTEL_FROM", "EXOTEL_APP_ID"] : ["PLIVO_AUTH_ID", "PLIVO_AUTH_TOKEN", "PLIVO_FROM", "PLIVO_APP_ID"]; // gitleaks:allow (names)
  if (!process.env.CALL_ONLY_TO || !process.env.PHONE_SALT) console.log("skip  phone line (needs DEMO_TEACHER_PHONE and PHONE_SALT in .env)");
  else NAMES.push("TELEPHONY_PROVIDER", ...provider, "PHONE_SALT", "DEMO_TEACHER_PHONE", "CALL_ONLY_TO", "PUBLIC_URL");
}

// WhatsApp (Meta Cloud API), once docs/WHATSAPP-SETUP.md is done. Sends go only to CALL_ONLY_TO on the live site.
for (const n of ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_TEMPLATE", "WHATSAPP_TEMPLATE_LANG", "WHATSAPP_TEMPLATE_VARS", "WHATSAPP_TO"]) if (process.env[n]) NAMES.push(n); // gitleaks:allow (names)

for (const name of NAMES) {
  const value = process.env[name];
  if (!value) {
    console.log(`skip  ${name} (not in .env)`);
    continue;
  }
  const secret = /KEY|TOKEN|PASSWORD|SALT|PHONE|CALL_ONLY|AUTH_ID|SID|SECRET|_TO$/.test(name);
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
