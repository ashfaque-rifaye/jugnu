// Before a take: the demo block as it starts, with no earlier tests or rehearsals on it.
import { DEFAULT_SEED } from "../src/engine/district";
import { db } from "../server/db";
import { resetDemoDrafts } from "../server/reviews";
import { eraseInterview } from "../server/interviews";

const block = `seed:${DEFAULT_SEED}`;
await db.run(`DELETE FROM events WHERE block = ?`, block);
await db.run(`DELETE FROM scheduled_jobs WHERE block = ?`, block).catch((e) => console.log("jobs:", e.message));
await resetDemoDrafts();
for (const r of await db.all<{ id: string }>(`SELECT id FROM interviews WHERE teacher_name = 'Rehearsal' OR (channel = 'phone' AND status <> 'completed')`)) await eraseInterview(r.id);
console.log("demo block is fresh");
process.exit(0);
