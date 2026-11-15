// Deploys the phone server to Cloud Run for a fixed address: `npm run phone:deploy`.
// Reads the settings it needs from .env, passes them through a temporary file that is always
// deleted, then saves the permanent address as PUBLIC_URL. See docs/PHONE-SERVER.md.
//
// It serves the live site, so it uses the live database (jugnu): a call placed from
// jugnu-nine.vercel.app must be found by the server its audio reaches. `--dev` keeps .env's database.
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SERVICE = "jugnu-phone";
const REGION = "asia-south1";
const PROJECT = "ai-pro-developer";
const KEEP = ["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_2", "CLAUDE_MODEL", "CREDIT_BUDGET_USD", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "API_KEY_EXOTEL", "API_TOKEN_PASSWORD", "GOOGLE_CLOUD_API_KEY", "TELEPHONY_PROVIDER", "EXOTEL_SID", "EXOTEL_HOST", "EXOTEL_FROM", "EXOTEL_APP_ID", "PLIVO_AUTH_ID", "PLIVO_AUTH_TOKEN", "PLIVO_FROM", "PLIVO_APP_ID", "PHONE_SALT", "DEMO_TEACHER_PHONE", "CALL_ONLY_TO"]; // gitleaks:allow (names of settings, not their values)
const DEV = process.argv.includes("--dev");

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

if (!env.PHONE_SALT) throw new Error("Set PHONE_SALT in .env first: the live site and the phone server must share it.");
// The demo phones are the only numbers the public site may ring.
env.CALL_ONLY_TO ||= [env.DEMO_TEACHER_PHONE, env.TEST_PHONE].filter(Boolean).join(",");

/** The live database's address and a fresh token for it, from the Turso account in .env. */
async function liveDatabase() {
  if (!env.TURSO_API_TOKEN || !env.TURSO_DATABASE_URL) throw new Error("TURSO_API_TOKEN and TURSO_DATABASE_URL are needed to reach the live database (or run with --dev).");
  const org = new URL(env.TURSO_DATABASE_URL.replace(/^libsql:/, "https:")).hostname.split(".")[0].replace(/^jugnu-dev-/, "");
  const api = `https://api.turso.tech/v1/organizations/${org}/databases/jugnu`;
  const headers = { Authorization: `Bearer ${env.TURSO_API_TOKEN}` };
  const db = await fetch(api, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Turso: database jugnu not found (${r.status})`))));
  const tok = await fetch(`${api}/auth/tokens?authorization=full-access`, { method: "POST", headers }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Turso: no token (${r.status})`))));
  return { url: `libsql://${db.database.Hostname}`, token: tok.jwt };
}
if (!DEV) {
  const live = await liveDatabase();
  env.TURSO_DATABASE_URL = live.url;
  env.TURSO_AUTH_TOKEN = live.token;
  console.log(`Database: ${live.url.split(".")[0].replace("libsql://", "")} (live)`);
}

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
  // Live: saved as PHONE_SERVER_URL for npm run env:push, leaving PUBLIC_URL to this laptop's own tunnel
  // (the laptop uses the dev database, which this server doesn't read). --dev: this laptop dials through it.
  const name = DEV ? "PUBLIC_URL" : "PHONE_SERVER_URL";
  const now = fs.readFileSync(".env", "utf-8");
  const line = new RegExp(`^${name}=.*$`, "m");
  fs.writeFileSync(".env", line.test(now) ? now.replace(line, `${name}=${url}`) : `${now}\n${name}=${url}\n`);
  console.log(`\nFixed address: ${url}`);
  console.log(`Exotel Voicebot URL: ${url.replace(/^https/, "wss")}/api/ivr/exotel/stream`);
  if (!DEV) console.log("Next: npm run env:push, so the live site dials through this server.");
} finally {
  fs.rmSync(file, { force: true });
}
