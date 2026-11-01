// While Claude's limit is in force, puts back what the agent did on camera in the plan take (same school, same steps,
// through the same log), so the board and history in the tour show that work.
import { DEFAULT_SEED } from "../src/engine/district";
import { pipelineFor } from "../server/blocks";
import { writeEvent } from "../server/eventlog";
import { enqueueForAction } from "../server/scheduler";

const block = `seed:${DEFAULT_SEED}`;
const st = pipelineFor({ seed: DEFAULT_SEED });
const s = st.block.schools.find((x) => x.name.includes("Dantipura")) ?? st.block.schools[0];
for (const [step, note] of [["note", "Peer voice note, asked for by the officer"], ["visit", "Classroom visit, asked for by the officer"]] as const) {
  const ref = `${s.id}-${step}`;
  await writeEvent(block, "action", ref, { status: "scheduled", note }, "Jugnu AI");
  await enqueueForAction(block, ref, "scheduled", { note, teacher: s.teacher, school: s.name });
}
console.log("actions back on the board for", s.name);
process.exit(0);
