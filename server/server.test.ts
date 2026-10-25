import { beforeAll, describe, expect, it } from "vitest";

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

  it("signs and escapes TwiML for the phone line", async () => {
    const { twilioSignature, twimlAsk } = await import("./ivr");
    const sig = twilioSignature("token", "https://x.test/api/ivr/twilio/gather?t=a", { SpeechResult: "हाँ", Confidence: "0.9" });
    expect(sig).toBe(twilioSignature("token", "https://x.test/api/ivr/twilio/gather?t=a", { Confidence: "0.9", SpeechResult: "हाँ" }));
    expect(twimlAsk(["A & B < C"], "hi", "/next?t=1&x=2")).toContain("A &amp; B &lt; C");
  });
});
