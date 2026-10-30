// Sample conversations for the interview list, so a demo reads like the real thing: real schools,
// simulated teacher names, transcripts from the demo block. They are marked as samples in the
// console and never feed the block's evidence (see codedForBlock).
import { generateBlock } from "../src/engine/block";
import { DEFAULT_SEED } from "../src/engine/district";
import { runPipeline } from "../src/engine/pipeline";
import { db, now, type Stmt } from "./db";

let seeded = false;

export async function seedDemoInterviews() {
  if (seeded) return;
  const { interviews, block } = runPipeline(generateBlock(DEFAULT_SEED));
  const bright = interviews.filter((i) => i.group === "bright").slice(0, 5);
  const similar = interviews.filter((i) => i.group === "comparison").slice(0, 4);
  const stmts: Stmt[] = [];
  [...bright, ...similar].forEach((iv, n) => {
    const s = block.schools.find((x) => x.id === iv.schoolId);
    if (!s) return;
    const id = `demo-iv-${iv.schoolId}`;
    const at = new Date(Date.now() - (n + 1) * 86_400_000 * 1.7).toISOString();
    stmts.push({
      sql: `INSERT OR IGNORE INTO interviews (id, token, school_name, teacher_name, school_id, grp, channel, language, consent, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'hi', 1, 'completed', ?, ?)`,
      args: [id, `demo-${iv.schoolId}`, s.name, s.teacher, iv.schoolId, iv.group, n % 3 === 1 ? "phone" : "web", at, at],
    });
    stmts.push({ sql: `DELETE FROM turns WHERE interview_id = ?`, args: [id] });
    stmts.push({ sql: `DELETE FROM codings WHERE interview_id = ?`, args: [id] });
    iv.turns.forEach((t, k) =>
      stmts.push({
        sql: `INSERT INTO turns (interview_id, idx, speaker, text, text_en, kind, source, created_at) VALUES (?, ?, ?, ?, ?, ?, 'offline', ?)`,
        args: [id, k, t.speaker, t.text, t.textEn ?? null, t.speaker === "teacher" ? "answer" : "question", now()],
      }),
    );
    for (const m of iv.mentions)
      stmts.push({
        sql: `INSERT INTO codings (interview_id, practice, quote, specificity, grounded, coder, created_at) VALUES (?, ?, ?, ?, 1, 'offline', ?)`,
        args: [id, m.practice, m.quote, m.specificity, now()],
      });
  });
  await db.batch(stmts);
  seeded = true;
}
