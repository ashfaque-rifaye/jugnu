import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Offline engine + in-memory database for every server test.
process.env.JUGNU_DB = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

type G = typeof import("./ai/guardrails");
type I = typeof import("./ai/interviewer");
type S = typeof import("./interviews");
let g: G, iv: I, svc: S;

beforeAll(async () => {
  g = await import("./ai/guardrails");
  iv = await import("./ai/interviewer");
  svc = await import("./interviews");
});

describe("guardrails", () => {
  it("grounds verbatim and near-verbatim quotes, rejects invented ones", () => {
    const said = ["रोज़ पहले 40 मिनट हम बच्चों को कक्षा से नहीं, स्तर से बाँटते हैं।"];
    expect(g.groundQuote("बच्चों को कक्षा से नहीं, स्तर से बाँटते हैं", said).method).toBe("exact");
    expect(g.groundQuote("रोज़ पहले 40 मिनट हम बच्चों को स्तर से बाँटते हैं", said).method).toBe("near");
    expect(g.groundQuote("हम हर हफ़्ते टेस्ट लेते हैं", said).grounded).toBe(false);
  });

  it("reads Devanagari digits and Hindi number words, and catches invented numbers", () => {
    expect(g.numbersIn("रोज़ ४० मिनट, दस बच्चे")).toEqual([40, 10]);
    expect(g.checkNoInventedNumbers("रोज़ 40 मिनट", ["पहले 40 मिनट"]).passed).toBe(true);
    expect(g.checkNoInventedNumbers("रोज़ 45 मिनट", ["पहले 40 मिनट"]).passed).toBe(false);
    expect(g.checkKeepsNumbers("रोज़ मिनट", "पहले 40 मिनट").passed).toBe(false);
  });

  it("keeps the interviewer off personal topics and scrubs phone numbers", () => {
    expect(g.checkSafeTopic("आपकी जाति क्या है?").passed).toBe(false);
    expect(g.checkSafeTopic("Who did you vote for?").passed).toBe(false);
    expect(g.checkSafeTopic("Children devote 10 minutes to number talk").passed).toBe(true);
    expect(g.scrubPII("मेरा नंबर 9876543210 है").text).toContain("[phone removed]");
    expect(g.checkLanguage("बच्चे रोज़ पढ़ते हैं", "hi").passed).toBe(true);
    expect(g.checkLanguage("Children read daily", "hi").passed).toBe(false);
  });
});

describe("interviewer", () => {
  it("follows up once when a practice is named without specifics", () => {
    const turns = [
      { speaker: "jugnu" as const, text: "गिनती के लिए रोज़ क्या होता है?", kind: "question", topic: "numeracy" },
      { speaker: "teacher" as const, text: "गिनती करवाते हैं।", kind: "answer", topic: "numeracy" },
    ];
    expect(iv.offlineNext(turns, "hi").kind).toBe("follow_up");
  });

  it("rejects unsafe, long, wrong-language, repeated or premature turns", () => {
    const prior = [{ speaker: "jugnu" as const, text: "बच्चे पहले आधे घंटे में क्या करते हैं?", kind: "question", topic: "open" }];
    const base = { say: "गिनती के लिए रोज़ क्या होता है?", say_en: "What happens daily for counting?", kind: "question" as const, topic: "numeracy", done: false };
    expect(iv.guardTurn(base, prior, "hi").accept).toBe(true);
    expect(iv.guardTurn({ ...base, say: "आपका धर्म क्या है?" }, prior, "hi").accept).toBe(false);
    expect(iv.guardTurn({ ...base, say: "What happens daily for counting?" }, prior, "hi").accept).toBe(false);
    expect(iv.guardTurn({ ...base, say: prior[0].text }, prior, "hi").accept).toBe(false);
    expect(iv.guardTurn({ ...base, kind: "closing", done: true }, prior, "hi").accept).toBe(false);
  });
});

describe("interview service (offline)", () => {
  it("opens a phone call by asking the language, then runs the interview in that one", async () => {
    const row = await svc.createInterview({ channel: "phone", teacherName: "Asha", language: "hi" });
    const opening = await svc.start(row);
    expect(opening.map((t) => t.kind)).toEqual(["language"]);
    expect(opening[0].text).toContain("Hindi or English");

    const unclear = await svc.answer((await svc.getById(row.id))!, "the line is bad");
    expect(unclear.reply.topic).toBe(svc.ASK_LANGUAGE);

    const chosen = await svc.answer((await svc.getById(row.id))!, "English please");
    expect(chosen.reply.say).toContain("Shall we begin");
    const after = (await svc.getById(row.id))!;
    expect(after.language).toBe("en");
    expect((await svc.turnsOf(row.id)).slice(-2).map((t) => t.kind)).toEqual(["intro", "consent"]);

    const go = await svc.answer(after, "yes");
    expect((await svc.getById(row.id))!.consent).toBe(1);
    expect(go.reply.kind).toBe("question");
    expect(go.reply.say).not.toMatch(/[\u0900-\u097F]/);
  });

  it("reads the language a teacher names, in either script, and carries on after two tries", async () => {
    expect(svc.readLanguage("इंग्लिश में")).toBe("en");
    expect(svc.readLanguage("अंग्रेज़ी")).toBe("en");
    expect(svc.readLanguage("हिंदी")).toBe("hi");
    expect(svc.readLanguage("Hindi")).toBe("hi");
    expect(svc.readLanguage("Hindi or English")).toBeNull();
    const row = await svc.createInterview({ channel: "phone", language: "hi" });
    await svc.answer(row, "");
    const second = await svc.answer((await svc.getById(row.id))!, "");
    expect(second.reply.say).toContain("क्या हम शुरू करें");
    expect((await svc.getById(row.id))!.language).toBe("hi");
  });

  it("asks for consent, runs the script, finishes, and codes grounded practices", async () => {
    const row = await svc.createInterview({ teacherName: "Sunita", schoolName: "GPS Test", group: "bright" });
    const opening = await svc.start(row);
    expect(opening.map((t) => t.kind)).toEqual(["intro", "consent"]);
    let r = await svc.answer((await svc.getById(row.id))!, "हाँ, शुरू कीजिए");
    expect((await svc.getById(row.id))!.consent).toBe(1);
    expect(r.reply.kind).toBe("question");
    const answers = [
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
    for (const a of answers) {
      if (r.status === "completed") break;
      r = await svc.answer((await svc.getById(row.id))!, a);
    }
    expect(r.status).toBe("completed");
    const turns = await svc.turnsOf(row.id);
    expect(turns.map((t) => t.idx)).toEqual(turns.map((_, i) => i)); // one ordered transcript, no gaps
    const res = await svc.codeAndStore(row.id);
    expect(res.source).toBe("offline");
    const practices = (await svc.codingsOf(row.id)).map((c) => c.practice);
    expect(practices).toContain("level_groups");
    expect(practices).toContain("number_talk");
    const listed = (await svc.listInterviews()).find((i) => i.id === row.id)!;
    expect(listed.turns).toBeGreaterThan(5);
    expect(listed.practices).toContain("level_groups");
    await svc.eraseInterview(row.id);
    expect(await svc.getById(row.id)).toBeUndefined();
    expect(await svc.turnsOf(row.id)).toHaveLength(0);
    expect(await svc.codingsOf(row.id)).toHaveLength(0);
  });

  it("keeps no transcript when the teacher declines", async () => {
    const row = await svc.createInterview({ teacherName: "Ramesh" });
    await svc.start(row);
    const r = await svc.answer((await svc.getById(row.id))!, "नहीं, अभी नहीं");
    expect(r.status).toBe("declined");
    expect(await svc.turnsOf(row.id)).toHaveLength(0);
  });

  it("asks again on silence instead of storing an empty answer", async () => {
    const row = await svc.createInterview({});
    await svc.start(row);
    const r = await svc.answer((await svc.getById(row.id))!, "  ");
    expect(r.reply.kind).toBe("clarify");
    expect((await svc.turnsOf(row.id)).filter((t) => t.speaker === "teacher")).toHaveLength(0);
  });
});

describe("coder, writer and officer guardrails", () => {
  it("drops quotes the teacher never said", async () => {
    const { guardCoding } = await import("./ai/coder");
    const turns = [{ speaker: "teacher" as const, text: "रोज़ 10 मिनट तीलियों से गिनती करते हैं।" }];
    const out = guardCoding({ mentions: [{ practice: "number_talk", quote: "रोज़ 10 मिनट तीलियों से गिनती", details: ["रोज़", "10 मिनट", "तीलियों", "रविवार को"], note: "" }, { practice: "weekly_tests", quote: "हर हफ़्ते टेस्ट", details: [], note: "" }], new_practices: [] }, turns);
    expect(out.value.map((c) => c.practice)).toEqual(["number_talk"]);
    // "रविवार को" is not in the quote, so only 3 details count towards specificity.
    expect(out.value[0].specificity).toBe(3);
    expect(out.checks[0].passed).toBe(false);
    expect(out.accept).toBe(true);
  });

  it("rejects a practice card step with an invented number or no citation", async () => {
    const { guardCard } = await import("./ai/writer");
    const quotes = [{ id: 1, school: "A", quote: "रोज़ 10 मिनट तीलियों के बंडल से गिनती" }];
    const good = { title_hi: "तीलियों से गिनती", title_en: "Number talk", steps: [{ hi: "रोज़ 10 मिनट तीलियों के बंडल से गिनती करें", en: "", quote_ids: [1] }, { hi: "बच्चे बंडल खोलकर बताएँ", en: "", quote_ids: [1] }], materials: ["तीलियाँ"], time_hi: "रोज़ 10 मिनट", watch_out_hi: "" };
    expect(guardCard(good, "number_talk", quotes).accept).toBe(true);
    expect(guardCard({ ...good, steps: [{ ...good.steps[0], hi: "रोज़ 20 मिनट गिनती करें" }, good.steps[1]] }, "number_talk", quotes).accept).toBe(false);
    expect(guardCard({ ...good, steps: [{ ...good.steps[0], quote_ids: [9] }, good.steps[1]] }, "number_talk", quotes).accept).toBe(false);
  });

  it("officer answers keep only real school names and need a lookup", async () => {
    const { guardAnswer, offlineAnswer } = await import("./ai/officer");
    const { pipelineFor } = await import("./blocks");
    const st = pipelineFor({ seed: 2024 });
    const real = st.block.schools[0].name;
    const out = guardAnswer({ answer: "x", schools: [real, "GPS Imaginary"], next_step: "y", owner: "CRP" }, st, 2);
    expect(out.value.schools).toEqual([real]);
    expect(out.checks[0].passed).toBe(false);
    expect(guardAnswer({ answer: "x", schools: [], next_step: "y", owner: null }, st, 0).accept).toBe(false);
    expect(offlineAnswer("which schools may have inflated data?", st).schools.length).toBeGreaterThan(0);
  });

  it("keeps replies fit to read aloud", async () => {
    const { spoken, wholeSentences } = await import("./ai/agent");
    expect(spoken("**Two** schools:\n- GPS Gorkha\n1. GPS Bandhna")).toBe("Two schools: GPS Gorkha GPS Bandhna");
    expect(spoken("3 teachers are showing 61 schools.")).toBe("3 teachers are showing 61 schools.");
    expect(wholeSentences("पहला वाक्य। दूसरा अधू", "max_tokens")).toBe("पहला वाक्य।");
    expect(wholeSentences("Complete", "end_turn")).toBe("Complete");
  });

  it("assistant: offline turn, commands, school lookup and briefing", async () => {
    const { agentTurn } = await import("./ai/agent");
    const { buildBriefing, findSchool, parseCommand } = await import("../src/lib/agent");
    const { pipelineFor } = await import("./blocks");
    const st = pipelineFor({ seed: 231205 });
    const turn = await agentTurn([{ role: "user", content: "Brief me" }], st, { page: "/today", lang: "en" });
    expect(turn.source).toBe("offline");
    const s = st.block.schools[3];
    expect(findSchool(st.block.schools, s.name)?.id).toBe(s.id);
    if (s.nameHi) expect(findSchool(st.block.schools, s.nameHi)?.id).toBe(s.id);
    expect(parseCommand("brief me", st.block.schools, ["Hatta"])).toEqual({ brief: true });
    expect(parseCommand(`show ${s.name} on the map`, st.block.schools, ["Hatta"])).toEqual({ tool: "show_on_map", input: { name: s.name } });
    expect(parseCommand("switch to Hatta block", st.block.schools, ["Hatta"])).toEqual({ tool: "switch_block", input: { block: "Hatta" } });
    expect(parseCommand("open the plan", st.block.schools, ["Hatta"])).toEqual({ tool: "go_to", input: { page: "plan" } });
    const lines = buildBriefing(st, [], (en) => en, false);
    expect(lines[0]).toContain(`${st.block.schools.length} schools`);
    expect(lines.length).toBeGreaterThan(3);
  });

  it("scores the System Usability Scale", async () => {
    const { susScore } = await import("./testing");
    expect(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(50);
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
  });

  it("normalises Indian numbers, hashes them, and signs/escapes for the phone line", async () => {
    const t = await import("./telephony");
    expect(t.normaliseIndianNumber("06382 844365")).toBe("+916382844365");
    expect(t.normaliseIndianNumber("+91 63828-44365")).toBe("+916382844365");
    expect(t.normaliseIndianNumber("916382844365")).toBe("+916382844365");
    expect(t.normaliseIndianNumber("12345")).toBeNull();
    expect(t.normaliseIndianNumber("+14155550100")).toBeNull();
    expect(t.phoneHash("+916382844365")).toBe(t.phoneHash("06382844365"));
    expect(t.phoneHash("+916382844365")).not.toContain("6382");
    expect(t.plivoSignature("https://x.test/a", "nonce", "token")).toBe(t.plivoSignature("https://x.test/a", "nonce", "token"));
    expect(t.plivoSignature("https://x.test/a", "nonce", "token")).not.toBe(t.plivoSignature("https://x.test/b", "nonce", "token"));
    expect(t.xmlEscape("A & B < C")).toBe("A &amp; B &lt; C");
    const { pcmToWav } = await import("./voice");
    const wav = pcmToWav(Buffer.alloc(16), 8000);
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.length).toBe(44 + 16);
  });
});

describe("scheduler and agent write tools", () => {
  const block = "seed:231205";

  it("validates events and queues the follow-up an action implies, once", async () => {
    const { writeEvent, EventError } = await import("./eventlog");
    const { enqueueForAction, listJobs } = await import("./scheduler");
    await expect(writeEvent(block, "action", "s001-call", { status: "flying" } as never)).rejects.toBeInstanceOf(EventError);
    await expect(writeEvent(block, "note", "s001", { text: "" })).rejects.toBeInstanceOf(EventError);
    const w = await writeEvent(block, "action", "s001-call", { status: "scheduled" }, "test");
    expect(w.id).toBeGreaterThan(0);
    const job = await enqueueForAction(block, "s001-call", "scheduled", { dueDays: 3, teacher: "A", to: "+916382844365" });
    expect(job?.kind).toBe("followup_call");
    expect(job?.school_id).toBe("s001");
    expect(new Date(job!.due_at).getTime() - Date.now()).toBeGreaterThan(2.9 * 86_400_000);
    expect(await enqueueForAction(block, "s001-call", "scheduled", {})).toBeNull();
    expect((await listJobs(block, "pending")).length).toBe(1);
    await enqueueForAction(block, "s001-call", "done");
    expect((await listJobs(block, "pending")).length).toBe(0);
    expect((await listJobs(block, "skipped")).length).toBe(1);
  });

  it("runs due jobs on tick and writes what it did to the block's log", async () => {
    const { enqueue, tick } = await import("./scheduler");
    const { db } = await import("./db");
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await enqueue(block, "reminder", "s002-note", past, { teacher: "Teacher B", school: "School B" });
    await enqueue(block, "escalate", "s003-visit", past, { reason: "no CRP visit" });
    await enqueue(block, "followup_call", "s004-call", past, { to: "+916382844365", teacher: "Teacher D" });
    await enqueue(block, "visit_check", "s005-visit", future);
    const { ran, results } = await tick();
    expect(ran).toBe(3);
    expect(results.map((r) => r.result).sort()).toEqual(["call handed to CRP", "escalated to BEO", "reminder posted"]);
    const rows = await db.all<{ kind: string; ref: string; payload: string; actor: string }>(`SELECT kind, ref, payload, actor FROM events WHERE block = ? ORDER BY id`, block);
    const review = rows.find((r) => r.ref === "s003-review");
    expect(review?.kind).toBe("action");
    expect(review?.actor).toBe("Jugnu AI");
    expect(JSON.parse(review!.payload).note).toContain("no CRP visit");
    const call = rows.find((r) => r.ref === "s004" && r.kind === "note");
    expect(JSON.parse(call!.payload).text).toMatch(/could not dial|CRP, please call/);
    expect((await tick()).ran).toBe(0);
  });

  it("agent write tools act on the open block and refuse without one", async () => {
    const { writeTools } = await import("./ai/agent");
    const { listJobs } = await import("./scheduler");
    const { pipelineFor } = await import("./blocks");
    const st = pipelineFor({ seed: 231205 });
    const school = st.block.schools[0];
    type Tool = { name: string; run: (input: unknown) => Promise<unknown> };
    const use = (tools: unknown[], name: string, input: unknown) => (tools as Tool[]).find((t) => t.name === name)!.run(input).then(String);
    const noBlock = writeTools(st, { page: "/", lang: "en" });
    expect(await use(noBlock, "move_action", { school: school.name, step: "visit", status: "scheduled" })).toMatch(/open a block/i);
    const tools = writeTools(st, { page: "/today", lang: "en", block });
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(["move_action", "schedule_followup", "escalate_to_beo", "dial_teacher", "list_followups"]));
    expect(await use(tools, "move_action", { school: school.name, step: "visit", status: "scheduled", note: "ok" })).toContain(school.name);
    expect((await listJobs(block, "pending")).some((j) => j.ref === `${school.id}-visit` && j.kind === "visit_check")).toBe(true);
    expect(await use(tools, "escalate_to_beo", { school: school.name.toUpperCase(), step: "visit", reason: "teacher on leave" })).toMatch(/escalated/i);
    expect(await use(tools, "dial_teacher", { school: school.name, to: "12", language: "hi" })).toMatch(/does not look right/);
    expect(await use(tools, "dial_teacher", { school: school.name, to: "+916382844365", language: "hi" })).toMatch(/Could not place the call/);
    expect(await use(tools, "schedule_followup", { school: school.name, kind: "followup_call", inDays: 5, to: "+916382844365", language: "hi" })).toMatch(/^Done:/);
    expect(await use(tools, "schedule_followup", { school: school.name, kind: "followup_call", inDays: 5 })).toMatch(/already on the clock/);
    const listed = await use(tools, "list_followups", {});
    expect(listed).toContain("visit check");
    expect(listed).toContain("followup call");
    expect(await use(tools, "move_action", { school: "Nowhere School", step: "note", status: "done" })).toMatch(/No school/);
  });
});

describe("officer insight tools", () => {
  it("contrast_pairs and what_if answer from the block, without Claude", async () => {
    const { officerTools } = await import("./ai/officer");
    const { pipelineFor } = await import("./blocks");
    const st = pipelineFor({ seed: 2024 });
    const tools = officerTools(st);
    const run = (name: string, input: object) => (tools.find((t) => t.name === name) as unknown as { run: (i: object) => string | Promise<string> }).run(input);
    const pairs = JSON.parse(await run("contrast_pairs", { limit: 2 }));
    expect(pairs.length).toBe(2);
    expect(pairs[0].school_doing_well).not.toBe(pairs[0].matched_with);
    const practice = st.evidence.find((e) => e.verdict === "distinctive")!.practice;
    const r = JSON.parse(await run("what_if", { practice, crps: 3, days_each: 3 }));
    expect(r.schools).toBe(st.find.struggling.length);
    expect(r.upliftPts.lo).toBeLessThanOrEqual(r.upliftPts.hi);
    expect(r.assumptions.length).toBeGreaterThan(2);
    expect(await run("what_if", { practice, schools: ["no such school"], crps: 1, days_each: 3 })).toMatch(/None of those/);
  });
});

describe("photo check", () => {
  it("falls back honestly when Claude is unavailable", async () => {
    const { checkPhoto } = await import("./ai/vision");
    const r = await checkPhoto({ image: "iVBORw0KGgo=", mediaType: "image/png", practice: "print_wall" });
    expect(r.source).toBe("offline");
    expect(r.value.visible).toBe("cannot_tell");
    expect(r.value.seen).toEqual([]);
  });
});

describe("WhatsApp (Cloud API, faked)", () => {
  const calls: { url: string; body: unknown }[] = [];
  let failNextWith: number | null = null;
  const realFetch = globalThis.fetch;
  beforeAll(() => {
    process.env.WHATSAPP_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "12345";
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-me";
    process.env.WHATSAPP_TEMPLATE = "jugnu_checkin";
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
      calls.push({ url: String(url), body });
      if (failNextWith) {
        const code = failNextWith;
        failNextWith = null;
        return new Response(JSON.stringify({ error: { message: "Re-engagement message", code } }), { status: 400 });
      }
      return new Response(JSON.stringify({ messages: [{ id: `wamid.${calls.length}` }] }), { status: 200 });
    }) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
    for (const k of ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_TEMPLATE"]) delete process.env[k];
  });

  it("normalises numbers and checks signatures", async () => {
    const { waNumber, signatureOk } = await import("./whatsapp");
    const { createHmac } = await import("node:crypto");
    expect(waNumber("98765 43210")).toBe("919876543210");
    expect(waNumber("+91-98765-43210")).toBe("919876543210");
    expect(waNumber("12")).toBeNull();
    const raw = Buffer.from('{"a":1}');
    const sig = "sha256=" + createHmac("sha256", "s3cret").update(raw).digest("hex");
    expect(signatureOk(raw, sig, "s3cret")).toBe(true);
    expect(signatureOk(raw, "sha256=00", "s3cret")).toBe(false);
  });

  it("sends a check-in, falls back to the template outside the 24-hour window, and reads the reply onto the board", async () => {
    const { sendCheckin, handleIncoming } = await import("./whatsapp");
    const { db } = await import("./db");
    const block = "seed:wa-test";
    failNextWith = 131047;
    await sendCheckin("+919876543210", { block, schoolId: "s010", ref: "s010-call", teacher: "Sunita", practice: "Daily reading-level groups" });
    expect(calls.at(-2)!.url).toContain("/12345/messages");
    const tpl = calls.at(-1)!.body as { type: string; template: { name: string } };
    expect(tpl.type).toBe("template");
    expect(tpl.template.name).toBe("jugnu_checkin");

    expect(await handleIncoming({ from: "919999999999", id: "x", type: "text", text: { body: "hello" } })).toMatch(/unknown number/);
    const done = await handleIncoming({ from: "919876543210", id: "m1", type: "text", text: { body: "हाँ, रोज़ कर रहे हैं, अच्छा चल रहा है" } });
    expect(done).toBe("follow-up: adopted");
    const rows = await db.all<{ kind: string; ref: string; payload: string }>(`SELECT kind, ref, payload FROM events WHERE block = ? ORDER BY id`, block);
    expect(rows.find((r) => r.kind === "followup")).toBeTruthy();
    expect(JSON.parse(rows.find((r) => r.ref === "s010-call")!.payload).status).toBe("done");
    expect((calls.at(-1)!.body as { text: { body: string } }).text.body).toMatch(/धन्यवाद/);

    // A barrier escalates on its own.
    await sendCheckin("+919876543210", { block, schoolId: "s010", ref: "s010-call", teacher: "Sunita" });
    expect(await handleIncoming({ from: "919876543210", id: "m2", type: "text", text: { body: "सामग्री नहीं है, कार्ड नहीं मिले" } })).toBe("follow-up: barrier");
    const job = await db.get<{ kind: string }>(`SELECT kind FROM scheduled_jobs WHERE block = ? AND kind = 'escalate'`, block);
    expect(job?.kind).toBe("escalate");
  });
});

describe("teacher coach and exports", () => {
  it("answers only with practices proven in the block (offline)", async () => {
    const { offlineCoach } = await import("./ai/coach");
    const { pipelineFor } = await import("./blocks");
    const st = pipelineFor({ seed: 231206 });
    const proven = st.evidence.filter((e) => e.verdict === "distinctive").map((e) => e.practice);
    const a = offlineCoach("मेरे बच्चे मात्रा में अटकते हैं, पढ़ नहीं पाते", st, "hi", st.find.struggling[0]);
    expect(a.practice).not.toBeNull();
    expect(proven).toContain(a.practice);
    expect(a.demonstrator?.school).toBeTruthy();
    expect(offlineCoach("स्कूल की छत टपकती है", st, "hi").practice).toBeNull();
  });
  it("exports the plan board with live statuses, and a visit invite", async () => {
    const { actionsCsv, visitIcs } = await import("./exports");
    const { writeEvent } = await import("./eventlog");
    const { pipelineFor } = await import("./blocks");
    const block = "seed:231206";
    const st = pipelineFor({ seed: 231206 });
    const ref = st.recs[0].actions[1].id;
    await writeEvent(block, "action", ref, { status: "stuck", note: "bus, not running" }, "CRP");
    const csv = await actionsCsv(block, false);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const row = csv.split("\r\n").find((l) => l.includes(",stuck,"));
    expect(row).toContain('"bus, not running"');
    const ics = visitIcs(block, st.recs[0].schoolId, new Date("2026-11-02T04:30:00Z"))!;
    expect(ics).toContain("DTSTART:20261102T043000Z");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(visitIcs(block, "nope", new Date())).toBeNull();
  });
});

describe("column mapper (offline)", () => {
  it("maps a UDISE-style export with Hindi headers onto Jugnu's columns", async () => {
    const { offlineMap } = await import("./ai/mapper");
    const { CSV_COLUMNS } = await import("../src/lib/csv");
    const m = offlineMap(CSV_COLUMNS, ["UDISE Code", "विद्यालय का नाम", "Cluster", "Total Enrolment", "PTR", "Teacher Name"]);
    expect(m.mapping.school_id).toBe("UDISE Code");
    expect(m.mapping.school_name).toBe("विद्यालय का नाम");
    expect(m.mapping.enrolment).toBe("Total Enrolment");
    expect(m.mapping.pupil_teacher_ratio).toBe("PTR");
    expect(m.mapping.teacher).toBe("Teacher Name");
    expect(m.mapping.x_km).toBeNull();
  });
  it("rewrites a CSV through a mapping, scaling shares", async () => {
    const { remapCsv, CSV_COLUMNS } = await import("../src/lib/csv");
    const out = remapCsv("Code,Att\nA1,85\n", { school_id: "Code", attendance: "Att" }, { attendance: 0.01 });
    const [head, row] = out.split("\n");
    expect(head).toBe(CSV_COLUMNS.join(","));
    const cells = row.split(",");
    expect(cells[CSV_COLUMNS.indexOf("school_id")]).toBe("A1");
    expect(cells[CSV_COLUMNS.indexOf("attendance")]).toBe("0.85");
  });
});

describe("backup coder", () => {
  it("recognises a catch-up buddy however the teacher names the absent child", async () => {
    const { PRACTICES } = await import("../src/engine/practices");
    for (const said of ["जो नहीं आया, उसका साथी काम करवाता है", "जो बच्चा नहीं आया, उसका साथी अगले दिन कॉपी दिखाता है", "जो बच्ची नहीं आई, लौटकर साथी से पढ़ती है"]) {
      expect(PRACTICES.absent_buddies.lexicon.test(said), said).toBe(true);
    }
  });
});

describe("safety filter", () => {
  it("removes personal numbers and bad language, flags sensitive topics, and keeps the rest", () => {
    const out = g.inspectText("Call 98765 43210 or a@b.co. यह हरामी नियम, bastard rule, मेरी जाति को लेकर है।");
    expect(out.text).not.toMatch(/98765|a@b\.co|हरामी|bastard/);
    expect(out.text).toContain("नियम");
    expect(out.findings.map((f) => f.kind).sort()).toEqual(["email", "phone", "profanity", "topic"]);
    expect(g.inspectText("रोज़ 40 मिनट समूह में पढ़ते हैं").findings).toEqual([]);
    // A fine word that merely contains a bad one stays.
    expect(g.inspectText("the class assessment").findings).toEqual([]);
  });

  it("is applied to everything written to the shared log", async () => {
    const { writeEvent, EventError } = await import("./eventlog");
    const r = await writeEvent("seed:test-safety", "weekly", "s001", { teachersUsing: 1, childrenReached: 9, classes: [1], going: "hard", note: "मेरा नंबर 9876543210" }, "Contact");
    expect(String(r.payload.note)).not.toContain("9876543210");
    await expect(writeEvent("seed:test-safety", "weekly", "s001", { teachersUsing: -1, childrenReached: 9, classes: [], going: "well" }, "Contact")).rejects.toBeInstanceOf(EventError);
    const moved = await writeEvent("seed:test-safety", "action", "s001-visit", { status: "submitted", from: "todo" }, "Head");
    expect(moved.payload.from).toBe("todo");
  });
});

describe("who signs off", () => {
  it("lets a school report work, and only someone outside it confirm", async () => {
    const { canSignOff } = await import("../src/lib/role");
    expect(canSignOff({ kind: "head", schoolId: "s001", cluster: 0 }, { ownerRole: "Teacher" })).toBe(false);
    expect(canSignOff({ kind: "head", schoolId: "s001", cluster: 0 }, { ownerRole: "CRP" })).toBe(false);
    expect(canSignOff({ kind: "crp", cluster: 0 }, { ownerRole: "Teacher" })).toBe(true);
    expect(canSignOff({ kind: "crp", cluster: 0 }, { ownerRole: "CRP" })).toBe(false); // nobody approves their own work
    expect(canSignOff({ kind: "beo" }, { ownerRole: "CRP" })).toBe(true);
  });
});

describe("rollout tracking", () => {
  it("follows a method from approval to schools, and counts what people record", async () => {
    const { buildRollouts } = await import("../src/lib/rollout");
    const { runPipeline } = await import("../src/engine/pipeline");
    const { generateBlock } = await import("../src/engine/block");
    const { DEFAULT_SEED } = await import("../src/engine/district");
    const st = runPipeline(generateBlock(DEFAULT_SEED));
    const first = buildRollouts(st, [], []);
    expect(first.reduce((a, r) => a + r.schools.length, 0)).toBe(st.recs.length);
    expect(first[0].progress).toBe(0);
    expect(first[0].children).toBeGreaterThan(0);
    const school = first[0].now[0].school.id;
    const events = [{ id: 1, kind: "weekly" as const, ref: school, payload: { teachersUsing: 2, childrenReached: 30, classes: [1], going: "well" }, actor: "Contact", created_at: "2026-10-30T00:00:00Z" }];
    const next = buildRollouts(st, [], events);
    expect(next[0].counts.reported).toBe(1);
    expect(next[0].reach.childrenReached).toBe(30);
    expect(next[0].progress).toBeGreaterThan(0);
  });
});

describe("classes, subjects and people", () => {
  it("gives every school all five subjects in all five classes, and people who cover them", async () => {
    const { generateBlock } = await import("../src/engine/block");
    const { DEFAULT_SEED } = await import("../src/engine/district");
    const { representatives, schoolOverall, SUBJECTS, scoreOf } = await import("../src/engine/subjects");
    for (const s of generateBlock(DEFAULT_SEED).schools) {
      expect(s.grades.map((g) => g.grade)).toEqual([1, 2, 3, 4, 5]);
      for (const g of s.grades) for (const x of SUBJECTS) expect(scoreOf(g, x)).toBeGreaterThanOrEqual(0);
      expect(schoolOverall(s)).not.toBeNull();
      expect(s.staff.some((p) => p.role === "head")).toBe(true);
      expect(s.staff.some((p) => p.role === "contact") || s.staff.length === 1).toBe(true);
      expect(new Set(representatives(s.staff.filter((p) => p.grades.length)).flatMap((p) => p.grades)).size).toBe(5);
      expect(new Set(s.staff.flatMap((p) => p.leads)).size).toBe(5);
      expect(s.name).toMatch(/^G[PMH]S /);
    }
  });
});

describe("the interview list", () => {
  it("hides practice runs and keeps samples out of the block's evidence", async () => {
    const { db } = await import("./db");
    const { seedDemoInterviews } = await import("./demo-interviews");
    await seedDemoInterviews();
    const row = await svc.createInterview({ teacherName: "Practice", schoolName: "Practice school", group: "live", channel: "web", language: "hi" });
    await db.run(`UPDATE interviews SET archived = 1 WHERE id = ?`, row.id);
    const list = await svc.listInterviews();
    expect(list.some((r) => r.id === row.id)).toBe(false);
    expect(list.filter((r) => r.id.startsWith("demo-iv-")).length).toBeGreaterThan(0);
    expect((await svc.codedForBlock()).some((r) => r.id.startsWith("demo-iv-"))).toBe(false);
  });
});

describe("follow-up reader without Claude", () => {
  it("does not mistake trying, or a lack of time, for regular use", async () => {
    const { offlineFollowUp } = await import("./ai/followup");
    expect(offlineFollowUp("कोशिश की, बच्चे पसंद कर रहे हैं पर समय कम पड़ता है।").outcome).toBe("barrier");
    expect(offlineFollowUp("दो बार कोशिश की, बच्चे पसंद कर रहे हैं।").outcome).toBe("trying");
    expect(offlineFollowUp("रोज़ कर रहे हैं, अच्छा चल रहा है।").outcome).toBe("adopted");
  });
});

describe("Ask Jugnu without Claude", () => {
  it("names the schools lowest in the subject asked about, and who can show them", async () => {
    const { offlineAnswer } = await import("./ai/officer");
    const { runPipeline } = await import("../src/engine/pipeline");
    const { generateBlock } = await import("../src/engine/block");
    const { DEFAULT_SEED } = await import("../src/engine/district");
    const st = runPipeline(generateBlock(DEFAULT_SEED));
    const a = offlineAnswer("Which schools need help with maths, and who can show them?", st);
    const school = (name: string) => st.block.schools.find((s) => s.name === name)!;
    expect(a.answer).toContain("lowest in maths");
    expect(a.answer).toContain("can learn from");
    expect(a.schools.length).toBeGreaterThan(0);
    const maths = a.schools.map((n) => school(n).numeracy.at(-1)!);
    expect(maths).toEqual([...maths].sort((x, y) => x - y));
    for (const r of st.recs.filter((r) => a.schools.includes(st.block.schools.find((s) => s.id === r.schoolId)!.name))) expect(a.answer).toContain(st.block.schools.find((s) => s.id === r.demonstratorId)!.name);
  });
});

describe("AI health check", () => {
  it("says Claude is down without a key, and makes no call", async () => {
    const { checkClaude } = await import("./ai/health");
    expect(await checkClaude()).toEqual({ ok: false, detail: "No API key on this server" });
  });

  it("leaves its own calls out of the AI page's trace but counts their cost", async () => {
    const { logCall, recentCalls, traceSummary, creditReport } = await import("./ai/run");
    const before = (await creditReport()).calls;
    await logCall("health.check", null, "claude", "claude-haiku-5-5", 5, { input_tokens: 10, output_tokens: 2 }, [], true, null);
    expect((await recentCalls(500)).some((c) => c.task === "health.check")).toBe(false);
    expect((await traceSummary()).tasks.some((x) => x.task === "health.check")).toBe(false);
    expect((await creditReport()).calls).toBe(before + 1);
  });
});

describe("you said, we changed", () => {
  it("has complete entries, in both languages, that say where they came from", async () => {
    const fs = await import("node:fs");
    const changes = JSON.parse(fs.readFileSync("data/changes.json", "utf-8")) as Record<string, string>[];
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes) {
      for (const k of ["date", "from", "fromHi", "heard", "heardHi", "changed", "changedHi"]) expect(c[k], k).toBeTruthy();
      expect(Number.isNaN(Date.parse(c.date))).toBe(false);
    }
  });
});

describe("approvals", () => {
  it("starts with demo drafts waiting, keeps decisions, and restores them on a fresh start", async () => {
    const { reviews, resetDemoDrafts } = await import("./reviews");
    const { db } = await import("./db");
    const express = (await import("express")).default;
    const app = express().use(express.json()).use("/r", reviews);
    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;
    const pending = async () => (await (await fetch(`http://127.0.0.1:${port}/r?status=pending`)).json()) as { id: string; kind: string; checks: { passed: boolean }[]; payload: { demo?: boolean; voice_hi: string } }[];
    const first = await pending();
    const demo = first.filter((r) => r.payload.demo);
    expect(demo).toHaveLength(3);
    expect(demo.every((r) => r.kind === "voice_note" && r.payload.voice_hi.length > 0)).toBe(true);
    await db.run(`UPDATE reviews SET status = 'approved' WHERE id = ?`, demo[0].id);
    expect((await pending()).filter((r) => r.payload.demo)).toHaveLength(2);
    await resetDemoDrafts();
    expect((await pending()).filter((r) => r.payload.demo)).toHaveLength(3);
    server.close();
  });
});
