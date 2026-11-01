// Turn on Chirp 3 listening and the Gemini backup for the live site. Neither accepts an API key, so the
// site needs a service account. Usage: npm run speech:setup — run it yourself, signed in to gcloud and
// vercel. It creates the account if needed, gives it speech and Vertex AI access only, copies its key and the
// speech API key from .env straight to Vercel without printing them, removes the local key file, and redeploys.
import "dotenv/config";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "ai-pro-developer";
const NAME = "jugnu-speech";
const EMAIL = `${NAME}@${PROJECT}.iam.gserviceaccount.com`;
const win = process.platform === "win32";
const gcloud = win ? "gcloud.cmd" : "gcloud";
const vercel = win ? "vercel.cmd" : "vercel";
const run = (cmd, args, input) =>
  execFileSync(cmd, args, { input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"], shell: win, encoding: "utf8" });
const addEnv = (name, value) => {
  run(vercel, ["env", "add", name, "production", "--force", "--yes", "--sensitive"], value);
  console.log(`set   ${name} on Vercel`);
};

if (!process.env.GOOGLE_CLOUD_API_KEY) {
  console.error("GOOGLE_CLOUD_API_KEY is not in .env. Add it and run this again.");
  process.exit(1);
}

const keyFile = path.join(os.tmpdir(), `jugnu-speech-${crypto.randomUUID()}.json`);
try {
  try {
    run(gcloud, ["iam", "service-accounts", "describe", EMAIL, "--project", PROJECT]);
    console.log(`found ${EMAIL}`);
  } catch {
    run(gcloud, ["iam", "service-accounts", "create", NAME, "--project", PROJECT, "--display-name", "Jugnu speech"]);
    console.log(`made  ${EMAIL}`);
  }
  for (const role of ["roles/speech.client", "roles/aiplatform.user"]) {
    run(gcloud, ["projects", "add-iam-policy-binding", PROJECT, "--member", `serviceAccount:${EMAIL}`, "--role", role, "--condition", "None", "--quiet"]);
  }
  console.log("gave  it speech and Vertex AI access only");
  run(gcloud, ["iam", "service-accounts", "keys", "create", keyFile, "--iam-account", EMAIL, "--project", PROJECT]);
  addEnv("GOOGLE_SERVICE_ACCOUNT_JSON", JSON.stringify(JSON.parse(fs.readFileSync(keyFile, "utf8"))));
  addEnv("GOOGLE_CLOUD_API_KEY", process.env.GOOGLE_CLOUD_API_KEY);
  addEnv("GOOGLE_CLOUD_PROJECT", PROJECT);
} catch (e) {
  console.error(`Stopped: ${String(e.stderr ?? e.message).split("\n").find((l) => l.trim()) ?? "error"}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(keyFile, { force: true });
}

if (!process.exitCode) {
  console.log("\nDeploying the live site…");
  execFileSync(win ? "npm.cmd" : "npm", ["run", "deploy:vercel"], { stdio: "inherit", shell: win });
  console.log("\nDone. Check it with: curl https://jugnu-nine.vercel.app/api/ai/health");
}
