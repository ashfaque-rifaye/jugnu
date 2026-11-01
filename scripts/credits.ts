// Claude credit balance — `npm run credits`.
// Adds up what every Claude call cost (tokens × the model's price): calls made on this computer,
// `npm run eval` runs, and calls on the deployed app. It is an estimate from logged tokens; the
// Anthropic Console's billing page is the exact figure.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const { creditReport } = await import("../server/ai/run");
const PROD = process.env.PUBLIC_APP_URL || "https://jugnu-nine.vercel.app";

const local = await creditReport();
const evalFile = path.resolve("data/runtime/eval-spend.jsonl");
const evals = fs.existsSync(evalFile)
  ? fs.readFileSync(evalFile, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { usd: number; calls: number })
  : [];
const evalUsd = evals.reduce((s, e) => s + e.usd, 0);

let prod: { spent: number; calls: number; database?: string | null } | null = null;
try {
  const r = await fetch(`${PROD}/api/ai/credits`, { signal: AbortSignal.timeout(10000) });
  if (r.ok) prod = await r.json();
  // Same Turso database as this computer: its calls are already in the first row.
  if (prod?.database && prod.database === local.database) prod = { spent: 0, calls: 0, database: prod.database, shared: true } as typeof prod;
} catch {
  // Offline, or the deployed app is older than this endpoint.
}

const usd = (x: number) => `$${x.toFixed(x < 1 ? 4 : 2)}`;
const spent = local.spent + evalUsd + (prod?.spent ?? 0);
console.log(`Claude credits — budget ${usd(local.budget)}`);
console.table([
  { where: "This computer (dev server)", calls: local.calls, spent: usd(local.spent) },
  { where: "Evaluation runs", calls: evals.reduce((s, e) => s + e.calls, 0), spent: usd(evalUsd) },
  { where: `Deployed app (${PROD})`, calls: (prod as { shared?: boolean } | null)?.shared ? "same database as row 1" : (prod?.calls ?? "unreachable"), spent: prod ? usd(prod.spent) : "—" },
]);
console.log(`Spent ${usd(spent)} · Remaining ≈ ${usd(local.budget - spent)} (${(((local.budget - spent) / local.budget) * 100).toFixed(2)}%)`);
