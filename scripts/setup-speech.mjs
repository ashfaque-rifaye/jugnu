// Turn on Chirp 3 listening and the Gemini backup for the live site. Neither accepts an API key, and no key
// file is created: Vercel proves who it is to Google, and acts as a service account that can only use speech
// and Vertex AI. Only this project's production site can do so. Usage: npm run speech:setup — run it yourself,
// signed in to gcloud and vercel. It is safe to run again.
import "dotenv/config";
import { execFileSync } from "node:child_process";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "ai-pro-developer";
const TEAM = process.env.VERCEL_TEAM_SLUG || "ashfaques-projects-f955ce95";
const NAME = "jugnu-speech";
const EMAIL = `${NAME}@${PROJECT}.iam.gserviceaccount.com`;
const POOL = "vercel";
const PROVIDER = "jugnu";
const SUBJECT = `owner:${TEAM}:project:jugnu:environment:production`;
const win = process.platform === "win32";
const gcloud = win ? "gcloud.cmd" : "gcloud";
const vercel = win ? "vercel.cmd" : "vercel";
// On Windows these run through a shell, which splits any argument with a space unless it is quoted.
const run = (cmd, args, input) =>
  execFileSync(cmd, win ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args, { input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"], shell: win, encoding: "utf8" });
const ensure = (what, describe, create) => {
  try {
    run(gcloud, describe);
    console.log(`found ${what}`);
  } catch {
    run(gcloud, create);
    console.log(`made  ${what}`);
  }
};
const addEnv = (name, value, sensitive) => {
  run(vercel, ["env", "add", name, "production", "--force", "--yes", ...(sensitive ? ["--sensitive"] : [])], value);
  console.log(`set   ${name} on Vercel`);
};

if (!process.env.GOOGLE_CLOUD_API_KEY) {
  console.error("GOOGLE_CLOUD_API_KEY is not in .env. Add it and run this again.");
  process.exit(1);
}

try {
  const P = ["--project", PROJECT];
  run(gcloud, ["services", "enable", "sts.googleapis.com", "iamcredentials.googleapis.com", "aiplatform.googleapis.com", "speech.googleapis.com", ...P]);
  ensure(EMAIL, ["iam", "service-accounts", "describe", EMAIL, ...P], ["iam", "service-accounts", "create", NAME, ...P, "--display-name", "Jugnu speech"]);
  for (const role of ["roles/speech.client", "roles/aiplatform.user"]) {
    run(gcloud, ["projects", "add-iam-policy-binding", PROJECT, "--member", `serviceAccount:${EMAIL}`, "--role", role, "--condition", "None", "--quiet"]);
  }
  console.log("gave  it speech and Vertex AI access only");

  const L = ["--location", "global", ...P];
  ensure("the Vercel identity pool", ["iam", "workload-identity-pools", "describe", POOL, ...L], ["iam", "workload-identity-pools", "create", POOL, ...L, "--display-name", "Vercel"]);
  ensure(
    "the Jugnu identity provider",
    ["iam", "workload-identity-pools", "providers", "describe", PROVIDER, "--workload-identity-pool", POOL, ...L],
    ["iam", "workload-identity-pools", "providers", "create-oidc", PROVIDER, "--workload-identity-pool", POOL, ...L, "--display-name", "Jugnu on Vercel",
      "--issuer-uri", `https://oidc.vercel.com/${TEAM}`, "--allowed-audiences", `https://vercel.com/${TEAM}`,
      "--attribute-mapping", "google.subject=assertion.sub", "--attribute-condition", `assertion.sub=='${SUBJECT}'`],
  );
  const number = run(gcloud, ["projects", "describe", PROJECT, "--format", "value(projectNumber)"]).trim();
  const poolPath = `projects/${number}/locations/global/workloadIdentityPools/${POOL}`;
  run(gcloud, ["iam", "service-accounts", "add-iam-policy-binding", EMAIL, ...P, "--role", "roles/iam.workloadIdentityUser", "--member", `principal://iam.googleapis.com/${poolPath}/subject/${SUBJECT}`, "--condition", "None", "--quiet"]);
  console.log("let   only Jugnu's production site act as it");

  addEnv("GOOGLE_WIF_AUDIENCE", `//iam.googleapis.com/${poolPath}/providers/${PROVIDER}`);
  addEnv("GOOGLE_SERVICE_ACCOUNT", EMAIL);
  addEnv("GOOGLE_CLOUD_API_KEY", process.env.GOOGLE_CLOUD_API_KEY, true);
  addEnv("GOOGLE_CLOUD_PROJECT", PROJECT);
} catch (e) {
  console.error(`Stopped: ${String(e.stderr ?? e.message).split("\n").find((l) => l.trim()) ?? "error"}`);
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log("\nDeploying the live site…");
  execFileSync(win ? "npm.cmd" : "npm", ["run", "deploy:vercel"], { stdio: "inherit", shell: win });
  console.log("\nDone. Check it with: curl https://jugnu-nine.vercel.app/api/ai/health");
}
