import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { beforeAll, describe, expect, it } from "vitest";

// The interview service against the Turso adapter, as deployed on Vercel. A local libSQL file
// stands in for the Turso database: same client API, same SQL, same row shapes.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_API_KEY_2;
delete process.env.ANTHROPIC_AUTH_TOKEN;

let svc: typeof import("./interviews");
let trace: typeof import("./ai/run");

beforeAll(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jugnu-libsql-"));
  const { libsqlStore, useStore } = await import("./db");
  useStore(await libsqlStore(createClient({ url: "file:" + path.join(dir, "turso.db").replace(/\\/g, "/") })));
  svc = await import("./interviews");
  trace = await import("./ai/run");
});

const ANSWERS = [
  "रोज़ पहले 45 मिनट हम बच्चों को स्तर से समूह में बाँटते हैं — अक्षर, शब्द, कहानी। हर सोमवार समूह फिर बनाते हैं।",
  "हर टोली अलग काम करती है।",
  "रोज़ 10 मिनट तीलियों के बंडल से गिनती — बच्चे खुद बताते हैं कि जवाब कैसे आया।",
  "पहले घर की बोली में समझाती हूँ, फिर हिंदी में।",
  "लौटने पर उसका साथी 10 मिनट में कॉपी से काम करवाता है।",
  "माता-पिता को हर शनिवार बच्चे पढ़कर सुनाते हैं।",
  "स्तर वाले समूह।",
  "बस, ऐसे ही।",
  "जी।",
  "धन्यवाद।",
];

describe("Turso adapter (libSQL)", () => {
  it("runs a whole interview: ordered turns, background coding, listing, trace, erasing", async () => {
    const row = await svc.createInterview({ teacherName: "Sunita", schoolName: "GPS Turso", group: "bright" });
    expect(row.consent).toBe(0); // integers come back as numbers, not bigint
    await svc.start(row);
    let r = await svc.answer((await svc.getById(row.id))!, "हाँ, शुरू कीजिए");
    for (const a of ANSWERS) {
      if (r.status === "completed") break;
      r = await svc.answer((await svc.getById(row.id))!, a);
    }
    expect(r.status).toBe("completed");

    const turns = await svc.turnsOf(row.id);
    expect(turns.map((t) => t.idx)).toEqual(turns.map((_, i) => i));
    expect(turns[0].kind).toBe("intro");

    // Coding runs in the background after the last answer.
    let codings: Awaited<ReturnType<typeof svc.codingsOf>> = [];
    for (let i = 0; i < 40 && codings.length === 0; i++) {
      await new Promise((ok) => setTimeout(ok, 50));
      codings = await svc.codingsOf(row.id);
    }
    expect(codings.map((c) => c.practice)).toContain("level_groups");
    expect(codings.every((c) => c.grounded === 1)).toBe(true);

    const listed = (await svc.listInterviews()).find((i) => i.id === row.id)!;
    expect(listed.turns).toBeGreaterThan(5);
    expect(listed.practices).toContain("number_talk");

    const summary = await trace.traceSummary();
    expect(summary.tasks.find((t) => t.task === "interview.next")?.n).toBeGreaterThan(3);
    expect((await trace.recentCalls(5))[0].ok).toBe(true);

    await svc.eraseInterview(row.id);
    expect(await svc.getById(row.id)).toBeUndefined();
    expect(await svc.turnsOf(row.id)).toHaveLength(0);
    expect(await svc.codingsOf(row.id)).toHaveLength(0);
  });

  it("keeps no transcript when the teacher declines", async () => {
    const row = await svc.createInterview({});
    await svc.start(row);
    const r = await svc.answer((await svc.getById(row.id))!, "नहीं");
    expect(r.status).toBe("declined");
    expect(await svc.turnsOf(row.id)).toHaveLength(0);
    expect((await svc.getById(row.id))!.status).toBe("declined");
  });
});
