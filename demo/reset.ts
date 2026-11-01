// Before a take: the demo block as it starts, with no earlier tests or rehearsals on it.
import { DEFAULT_SEED } from "../src/engine/district";
import { db } from "../server/db";
import { eraseInterview } from "../server/interviews";

const block = `seed:${DEFAULT_SEED}`;
// Through the running server, so it knows to put the demo drafts back.
const res = await fetch(`http://localhost:8788/api/events?block=${encodeURIComponent(block)}`, { method: "DELETE", headers: { "x-jugnu-pass": process.env.DEMO_PASSCODE ?? "" } });
if (!res.ok) console.log("reset:", res.status);
await db.run(`DELETE FROM scheduled_jobs WHERE block = ?`, block).catch((e) => console.log("jobs:", e.message));
for (const r of await db.all<{ id: string }>(`SELECT id FROM interviews WHERE teacher_name = 'Rehearsal' OR school_name IN ('Flow check', 'Test lab') OR teacher_name IN ('Flow check', 'Test lab') OR (channel = 'phone' AND status <> 'completed')`)) await eraseInterview(r.id);
console.log("demo block is fresh");
process.exit(0);
