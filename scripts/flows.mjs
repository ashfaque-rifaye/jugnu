// Flow check — every user flow, end to end, against a running server.
// Usage: node scripts/flows.mjs [baseUrl]   (default http://localhost:8080)
// Everything it creates is labelled "Flow check" and removed afterwards: interviews, the test block's
// activity log and the drafts it approved, so nothing shows up in a demo.
import fs from "node:fs";
import path from "node:path";

const base = (process.argv[2] ?? "http://localhost:8080").replace(/\/$/, "");
const headers = { "content-type": "application/json" };
const BLOCK = `flowcheck:${Date.now()}`;

async function call(method, url, body) {
  const r = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: r.status, data };
}
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

const results = [];
let answeredBy = "claude"; // which model should answer: the first that passes the health check
const aiNotes = [];
async function flow(name, who, fn) {
  const started = Date.now();
  const steps = [];
  const step = (label, ok, detail = "") => {
    steps.push({ label, ok: Boolean(ok), detail: String(detail).slice(0, 220) });
    if (!ok) throw new Error(`${label}${detail ? ` — ${detail}` : ""}`);
  };
  let error = null;
  try {
    await fn(step);
  } catch (e) {
    error = e.message;
  }
  const ms = Date.now() - started;
  results.push({ name, who, ok: !error, ms, steps, error });
  console.log(`${error ? "FAIL" : "PASS"}  ${name.padEnd(34)} ${(ms / 1000).toFixed(1).padStart(5)} s  ${error ?? `${steps.length} steps`}`);
}

const ANSWERS = {
  consent: "हाँ जी, शुरू कीजिए",
  follow_up: "रोज़ 15 मिनट, पहले बच्चे खुद करते हैं, फिर कॉपी में लिखते हैं।",
  open: "रोज़ पहले 40 मिनट हम बच्चों को स्तर से बाँटते हैं — अक्षर, शब्द, अनुच्छेद, कहानी। हर सोमवार समूह फिर बनाते हैं।",
  levels: "हर सोमवार 5 मिनट में हर बच्चे को पढ़वाकर देखते हैं और टोली बदल देते हैं।",
  numeracy: "गणित में तीलियों के बंडल से दहाई सिखाते हैं, रोज़ 15 मिनट मौखिक सवाल।",
  language: "कई बच्चे भीली बोलते हैं, तो पहले भीली में बात करके फिर हिंदी पर आते हैं।",
  absent: "जो बच्चा नहीं आया, उसका साथी अगले दिन उसे कॉपी दिखाकर काम करवाता है। मेरा नंबर 9876543210 है।",
  parents: "हर शनिवार बच्चे घर पर माँ या पापा को एक पन्ना पढ़कर सुनाते हैं; मैं 1 मिनट का voice note भेजती हूँ।",
  one_thing: "रोज़ पहले 40 मिनट स्तर वाली टोलियाँ — यही सबसे ज़रूरी है।",
};
const answerFor = (reply) => (reply.kind === "consent" ? ANSWERS.consent : reply.kind === "follow_up" ? ANSWERS.follow_up : (ANSWERS[reply.topic] ?? "जी, ठीक है।"));

// ------------------------------------------------------------------------------------------ flows
await flow("App is up", "Everyone", async (step) => {
  const s = await call("GET", "/api/status");
  step("Status responds", s.status === 200, JSON.stringify(s.data));
  const h = await call("GET", "/api/ai/health");
  answeredBy = h.data.claude?.ok ? "claude" : h.data.gemini?.ok ? "gemini" : "offline";
  aiNotes.push(`AI tasks are answered by: ${answeredBy}${answeredBy === "claude" ? "" : ` (Claude: ${h.data.claude?.detail?.slice(0, 80)})`}`);
  // Without Google credentials (as in CI) the app uses the browser's voice and typing.
  if (s.data.voice) {
    step("Google voice speaks", h.data.speaking?.ok, h.data.speaking?.detail);
    step("Google voice listens", h.data.listening?.ok, h.data.listening?.detail);
  }
  step("Storage is permanent", s.data.storage !== "temporary", s.data.storage);
  for (const p of ["/", "/today", "/schools", "/interviews", "/practices", "/plan", "/results", "/review", "/testing", "/ai", "/method", "/about", "/talk"]) {
    const r = await fetch(base + p);
    step(`Page ${p}`, r.status === 200 && (await r.text()).includes('id="root"'), r.status);
  }
});

let interviewId = null;
await flow("Teacher web interview", "Teacher · BEO", async (step) => {
  const inv = await call("POST", "/api/interviews", { teacherName: "Flow check", schoolName: "GPS Flow Check", group: "bright" });
  step("BEO creates an invitation link", inv.status === 200 && inv.data.link, inv.data.link);
  interviewId = inv.data.interview.id;
  const token = inv.data.interview.token;
  const view = await call("GET", `/api/talk/${token}`);
  step("Teacher opens the link (no login)", view.status === 200, view.data.interview?.status);
  const st = await call("POST", `/api/talk/${token}/start`);
  step("Jugnu greets and asks consent", st.data.turns?.length > 0, st.data.turns?.at(-1)?.text);
  let reply = { kind: "consent", topic: null };
  let turns = 0;
  const sources = new Set();
  const answered = new Set();
  for (let i = 0; i < 20; i++) {
    if (reply.kind === "question" && reply.topic) answered.add(reply.topic);
    const r = await call("POST", `/api/talk/${token}/answer`, { text: answerFor(reply), source: "typed" });
    if (r.status !== 200) step("Answer accepted", false, JSON.stringify(r.data));
    sources.add(r.data.source);
    turns++;
    reply = r.data.reply;
    if (r.data.status === "completed") break;
  }
  step(`Interview completes (${turns} answers)`, reply.done || reply.kind === "closing", reply.say);
  step(`Questions written by ${answeredBy}`, sources.has(answeredBy), [...sources].join(", "));
  let d = await call("GET", `/api/interviews/${interviewId}`);
  for (let i = 0; i < 40 && d.data.codings.length === 0; i++) {
    await sleep(1000);
    d = await call("GET", `/api/interviews/${interviewId}`);
  }
  const practices = [...new Set(d.data.codings.map((c) => c.practice).filter(Boolean))];
  // Each scripted answer describes one practice; every one the teacher actually gave must be found.
  const PRACTICE_OF = { open: "level_groups", levels: "level_groups", numeracy: "number_talk", language: "home_language", absent: "absent_buddies", parents: "parent_voice" };
  const expected = [...answered].map((t) => PRACTICE_OF[t]).filter(Boolean);
  const missing = expected.filter((p) => !practices.includes(p));
  step(`Every practice described is coded (${answered.size} topics asked)`, missing.length === 0 && practices.length > 0, missing.length ? `missing ${missing.join(", ")} · found ${practices.join(", ")}` : practices.join(", "));
  step("Every quote found word for word", d.data.codings.every((c) => c.grounded), `${d.data.codings.length} quotes`);
  const said = d.data.turns.filter((t) => t.speaker === "teacher").map((t) => t.text).join(" ");
  step("Phone number removed from transcript", !said.includes("9876543210"), said.includes("9876543210") ? "number kept" : "scrubbed");
});

await flow("Teacher interview (public demo link)", "Teacher / judge", async (step) => {
  const demo = await call("POST", "/api/talk/practice", { language: "hi", schoolName: "Flow check" });
  step("Anyone can open a practice interview", demo.status === 200, demo.data.token);
  const token = demo.data.token;
  const st = await call("POST", `/api/talk/${token}/start`);
  step("Jugnu greets and asks consent", st.data.turns?.length > 0, st.data.turns?.at(-1)?.text);
  let reply = { kind: "consent", topic: null };
  let n = 0;
  const sources = new Set();
  for (let i = 0; i < 20; i++) {
    const r = await call("POST", `/api/talk/${token}/answer`, { text: answerFor(reply), source: "typed" });
    sources.add(r.data.source);
    n++;
    reply = r.data.reply;
    if (r.data.status === "completed") break;
  }
  step(`Interview completes (${n} answers)`, reply.done || reply.kind === "closing", reply.say);
  step(`Questions written by ${answeredBy}`, sources.has(answeredBy), [...sources].join(", "));
});

await flow("Teacher says no to consent", "Teacher", async (step) => {
  const inv = await call("POST", "/api/interviews", { teacherName: "Flow check (no consent)", schoolName: "GPS Flow Check" });
  const token = inv.data.interview.token;
  await call("POST", `/api/talk/${token}/start`);
  const r = await call("POST", `/api/talk/${token}/answer`, { text: "नहीं, मुझे बात नहीं करनी", source: "typed" });
  step("Jugnu ends politely", r.status === 200 && (r.data.reply?.done || r.data.status !== "in_progress"), r.data.reply?.say);
  const d = await call("GET", `/api/interviews/${inv.data.interview.id}`);
  const kept = (d.data.turns ?? []).filter((t) => t.speaker === "teacher").length;
  step("Nothing the teacher said is kept", kept === 0, `${kept} teacher turns stored · status ${d.data.interview?.status}`);
  await call("DELETE", `/api/interviews/${inv.data.interview.id}`);
});

await flow("Phone line (real telephony)", "Teacher on a basic phone", async (step) => {
  const st = await call("GET", "/api/ivr/status");
  step("Telephony status is reported", st.status === 200 && typeof st.data.active !== "undefined", st.data.active ? `${st.data.active} ? ${st.data.publicUrl}` : "no provider configured (set EXOTEL_* / PLIVO_* + PUBLIC_URL)");
  const bad = await call("POST", "/api/ivr/call", { to: "123" });
  step("Bad numbers are refused before dialing", bad.status === 400 || bad.status === 401 || bad.status === 503, bad.data.error);
});

await flow("CRP field work → live activity", "CRP · BEO", async (step) => {
  const ref = "s007";
  let r = await call("POST", "/api/events", { block: BLOCK, kind: "spotcheck", ref, actor: "CRP Flow check", payload: { sampled: 15, proficient: 9, numeracyProficient: 8 } });
  step("CRP records a 15-child spot check", r.status === 200, `event ${r.data.id}`);
  r = await call("POST", "/api/events", { block: BLOCK, kind: "spotcheck", ref, payload: { sampled: 15, proficient: 20, numeracyProficient: 3 } });
  step("Impossible spot check is refused", r.status === 400, r.data.error);
  for (const status of ["scheduled", "done"]) {
    r = await call("POST", "/api/events", { block: BLOCK, kind: "action", ref: `${ref}:visit`, actor: "CRP Flow check", payload: { status } });
    step(`Peer visit moved to "${status}"`, r.status === 200);
  }
  r = await call("POST", "/api/events", { block: BLOCK, kind: "action", ref: `${ref}:materials`, payload: { status: "stuck", note: "No reading cards — call me on 9876543210" } });
  step("Stuck item escalates with a note", r.status === 200 && !r.data.payload.note.includes("9876543210"), r.data.payload.note);
  r = await call("POST", "/api/events", { block: BLOCK, kind: "followup", ref, payload: { outcome: "trying", said: "दो दिन से टोलियाँ बना रहे हैं" } });
  step("Day-14 follow-up recorded", r.status === 200);
  const list = await call("GET", `/api/events?block=${encodeURIComponent(BLOCK)}`);
  step("Every officer's screen sees all 5 updates, in order", list.data.length === 5, list.data.map((e) => e.kind).join(" → "));
  const del = await call("DELETE", `/api/events?block=${encodeURIComponent(BLOCK)}`);
  step("Test block reset", del.status === 200);
});

await flow("Day-14 follow-up call read by AI", "Jugnu AI · BEO", async (step) => {
  const r = await call("POST", "/api/followup/read", {
    reply: "कोशिश की, पर कक्षा में अक्षर कार्ड नहीं हैं, इसलिए दो दिन ही कर पाए। संकुल से कार्ड मिल जाएँ तो रोज़ करेंगे।",
    practice: "level_groups",
    schoolId: "s007",
  });
  step("Reply understood", r.status === 200, `${r.data.source} · ${r.data.outcome ?? r.data.value?.outcome}`);
  const v = r.data.value ?? r.data;
  step("Outcome is a barrier", (v.outcome ?? "") === "barrier", v.outcome);
  step("Barrier has an owner", Boolean(v.barrierOwner ?? v.owner), `${v.owner} · ${v.barrier}`);
  const ok = await call("POST", "/api/followup/read", { reply: "हाँ, अब रोज़ पहले 40 मिनट टोलियाँ बनाते हैं, बच्चे मज़े से पढ़ते हैं।", practice: "level_groups" });
  step("A teacher doing it daily reads as adopted", (ok.data.value ?? ok.data).outcome === "adopted", (ok.data.value ?? ok.data).outcome);
});

await flow("AI drafts → human approval", "Jugnu AI · CRP/BEO", async (step) => {
  const card = await call("POST", "/api/reviews/card", {
    practice: "level_groups",
    quotes: [
      { school: "GPS Mahukhedi", quote: ANSWERS.open },
      { school: "GPS Amarbandh", quote: "हर सोमवार बच्चों को फिर से जाँचकर टोली बदलते हैं, 40 मिनट रोज़।" },
    ],
  });
  step("Practice card drafted from quotes", card.status === 200, `${card.data.source} · ${card.data.value?.title ?? ""}`);
  // A draft that fails a check must not be used: the card built straight from the quotes takes its place.
  step("Card passed its checks, or was replaced", card.data.source === "offline" || (card.data.checks ?? []).every((c) => c.passed), `${card.data.source}: ${(card.data.checks ?? []).filter((c) => !c.passed).map((c) => c.name).join(", ") || "all passed"}`);
  const note = await call("POST", "/api/reviews/voice-note", {
    draftHi: "नमस्ते राधा जी, मैं राजू, चांदगाँव से। हम रोज़ पहले 40 मिनट बच्चों को स्तर से बाँटते हैं। आप भी आज़माइए।",
    draftEn: "Hello Radha, I'm Raju from Chandgaon. Every day for the first 40 minutes we group children by level. Do try it.",
    practice: "level_groups",
  });
  step("Voice note polished, numbers kept", note.status === 200 && (note.data.checks ?? []).every((c) => c.passed), note.data.source);
  const pending = await call("GET", "/api/reviews?status=pending");
  step("Both wait in the Review queue", [card.data.id, note.data.id].every((id) => pending.data.some((x) => x.id === id)), `${pending.data.length} pending`);
  let r = await call("POST", `/api/reviews/${card.data.id}/decide`, { decision: "approved", reviewer: "Flow check" });
  step("Officer approves the card", r.status === 200);
  r = await call("POST", `/api/reviews/${note.data.id}/decide`, { decision: "rejected", reviewer: "Flow check" });
  step("Officer can send a draft back", r.status === 200);
  for (const id of [card.data.id, note.data.id]) await call("DELETE", `/api/reviews/${id}`);
});

await flow("Ask Jugnu (officer agent)", "BEO", async (step) => {
  const r = await call("POST", "/api/ask", { question: "Which schools need help with reading, and who nearby can show them?" });
  step("Answer returned", r.status === 200, r.data.source);
  step(`Answered by ${answeredBy}`, r.data.source === answeredBy, r.data.warning ?? "");
  if (answeredBy !== "offline") step("Looked the data up first", (r.data.tools ?? []).length > 0, (r.data.tools ?? []).join(", "));
  step("Only real school names", (r.data.checks ?? []).every((c) => c.passed), (r.data.answer ?? "").slice(0, 160));
});

await flow("Testing page and AI transparency", "Judges · testers", async (step) => {
  for (const p of ["/api/testing/summary", "/api/testing/changes", "/api/ai/eval", "/api/ai/credits"]) {
    const r = await call("GET", p);
    step(`${p}`, r.status === 200);
  }
  const t = await call("GET", "/api/ai/trace");
  step("Every AI call in this run is traced", t.data.calls?.length > 0, `${t.data.calls.length} recent calls`);
});

await flow("Sign-off, weekly reports and the audit trail", "School head · CRP · BEO", async (step) => {
  const block = `flowcheck:${Date.now()}`;
  const ref = "s001-visit";
  let r = await call("POST", "/api/events", { block, kind: "action", ref, actor: "Head, Flow check", payload: { status: "submitted", from: "todo" } });
  step("A school reports a task as done", r.status === 200);
  r = await call("POST", "/api/events", { block, kind: "action", ref, actor: "BEO", payload: { status: "done", from: "submitted", note: "Seen it myself" } });
  step("Someone else signs it off", r.status === 200);
  r = await call("POST", "/api/events", { block, kind: "weekly", ref: "s001", actor: "Contact, Flow check", payload: { teachersUsing: 2, childrenReached: 40, classes: [1, 2], going: "well", note: "मेरा नंबर 9876543210 है" } });
  step("A weekly report is saved", r.status === 200);
  step("Its note loses the phone number", !String(r.data.payload?.note).includes("9876543210"), r.data.payload?.note);
  const log = await call("GET", `/api/events?block=${encodeURIComponent(block)}`);
  step("All three are in the audit trail, in order", log.data.length === 3 && log.data[1].payload.from === "submitted");
  await call("DELETE", `/api/events?block=${encodeURIComponent(block)}`);
});

await flow("Safety filter", "Everyone", async (step) => {
  const r = await call("POST", "/api/safety/check", { text: "Call 98765 43210, this is a bastard rule about my caste" });
  step("Removes the number and the bad word", r.status === 200 && !r.data.text.includes("98765") && !r.data.text.includes("bastard"), r.data.text);
  step("Flags the sensitive topic", r.data.findings.some((f) => f.kind === "topic"));
  const s = await call("GET", "/api/safety/summary");
  step("The summary responds", s.status === 200);
});

await flow("Clean up", "—", async (step) => {
  // Everything labelled "Flow check", whichever flow made it (web interviews and phone-line tests alike).
  const list = await call("GET", "/api/interviews");
  const rows = Array.isArray(list.data) ? list.data : (list.data.interviews ?? []);
  for (const row of rows.filter((r) => /flow check/i.test(`${r.school_name ?? ""} ${r.teacher_name ?? ""}`))) {
    const r = await call("DELETE", `/api/interviews/${row.id}`);
    step(`Test interview erased: ${row.school_name}`, r.status === 200);
  }
});

// ------------------------------------------------------------------------------------------ report
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} flows passed against ${base}`);
for (const n of aiNotes) console.log(n);
fs.mkdirSync(path.resolve("data/runtime"), { recursive: true });
fs.writeFileSync(path.resolve("data/runtime/flowcheck.json"), JSON.stringify({ base, ranAt: new Date().toISOString(), results }, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
