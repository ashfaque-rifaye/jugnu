// Deploys the phone server to Cloud Run for a fixed address: `npm run phone:deploy`.
// Reads the settings it needs from .env, passes them through a temporary file that is always
// deleted, then saves the permanent address as PUBLIC_URL. See docs/PHONE-SERVER.md.
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SERVICE = "jugnu-phone";
const REGION = "asia-south1";
const PROJECT = "ai-pro-developer";
const KEEP = ["ANTHROPIC_API_KEY", "CLAUDE_MODEL", "CREDIT_BUDGET_USD", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "API_KEY_EXOTEL", "API_TOKEN_PASSWORD", "GOOGLE_CLOUD_API_KEY", "TELEPHONY_PROVIDER", "EXOTEL_SID", "EXOTEL_HOST", "EXOTEL_FROM", "EXOTEL_APP_ID", "PHONE_SALT"];

const raw = fs.readFileSync(".env", "utf-8");
const env = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
// A fixed public address must not let strangers place calls: its officer routes need this private key.
const phoneKey = env.PHONE_SERVER_KEY || env.PHONE_SERVER_PASSCODE || crypto.randomBytes(24).toString("base64url");
if (!env.PHONE_SERVER_KEY) fs.appendFileSync(".env", `\nPHONE_SERVER_KEY=${phoneKey}\n`);

const file = path.join(os.tmpdir(), `jugnu-phone-${crypto.randomUUID()}.yaml`);
const lines = KEEP.filter((k) => env[k]).map((k) => `${k}: ${JSON.stringify(env[k])}`);
lines.push(`PHONE_SERVER_KEY: ${JSON.stringify(phoneKey)}`);
const run = (cmd, capture = false) => execSync(cmd, { stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", encoding: "utf-8" });
const where = `--region ${REGION} --project ${PROJECT}`;

try {
  fs.writeFileSync(file, lines.join("\n") + "\n", { mode: 0o600 });
  run(`gcloud run deploy ${SERVICE} --source . ${where} --allow-unauthenticated --env-vars-file "${file}" --memory 1Gi --cpu 1 --min-instances 0 --max-instances 3 --timeout 3600 --cpu-boost --quiet`);
  const url = run(`gcloud run services describe ${SERVICE} ${where} --format="value(status.url)"`, true).trim();
  run(`gcloud run services update ${SERVICE} ${where} --update-env-vars PUBLIC_URL=${url} --quiet`);
  const next = /^PUBLIC_URL=.*$/m.test(raw) ? fs.readFileSync(".env", "utf-8").replace(/^PUBLIC_URL=.*$/m, `PUBLIC_URL=${url}`) : `${fs.readFileSync(".env", "utf-8")}\nPUBLIC_URL=${url}\n`;
  fs.writeFileSync(".env", next);
  console.log(`\nFixed address: ${url}`);
  console.log(`Exotel Voicebot URL: ${url.replace(/^https/, "wss")}/api/ivr/exotel/stream`);
} finally {
  fs.rmSync(file, { force: true });
}
