// Records a full walkthrough of Jugnu (every page and feature) against the local server.
// node record.mjs [baseUrl]  → video/*.webm (converted to mp4 afterwards with ffmpeg)
import { chromium } from "playwright";

const B = process.argv[2] ?? "http://localhost:8080";
const W = 1440, H = 900;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: "video6", size: { width: W, height: H } }, locale: "en-IN" });

// A visible cursor and a caption bar (video capture does not show the real mouse).
await ctx.addInitScript(() => {
  const mount = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div");
    c.id = "__cur";
    c.style.cssText = "position:fixed;left:-50px;top:-50px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(250,204,21,.55);border:2px solid #fff;box-shadow:0 0 12px rgba(250,204,21,.9);pointer-events:none;z-index:2147483647;transition:transform .12s";
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => ((c.style.left = e.clientX + "px"), (c.style.top = e.clientY + "px")), true);
    addEventListener("mousedown", () => (c.style.transform = "scale(.6)"), true);
    addEventListener("mouseup", () => (c.style.transform = ""), true);
    const cap = document.createElement("div");
    cap.id = "__cap";
    cap.style.cssText = "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:1100px;padding:12px 22px;border-radius:14px;background:rgba(0,0,0,.82);color:#fff;font:600 21px/1.35 system-ui,sans-serif;text-align:center;pointer-events:none;z-index:2147483646;display:none;box-shadow:0 8px 30px rgba(0,0,0,.4)";
    document.documentElement.appendChild(cap);
    window.__setCap = (t) => ((cap.textContent = t), (cap.style.display = t ? "block" : "none"));
    if (window.__lastCap) window.__setCap(window.__lastCap);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", mount);
  else mount();
});

const page = await ctx.newPage();
let caption = "";
const wait = (ms) => page.waitForTimeout(ms);
const cap = async (text, hold = 2500) => {
  caption = text;
  console.log("·", text);
  await page.evaluate((t) => ((window.__lastCap = t), window.__setCap?.(t)), text).catch(() => {});
  await wait(hold);
};
const go = async (path, hold = 2500) => {
  await page.goto(B + path, { waitUntil: "domcontentloaded" });
  await wait(600);
  await page.evaluate((t) => ((window.__lastCap = t), window.__setCap?.(t)), caption).catch(() => {});
  await wait(hold);
};
let mx = W / 2, my = H / 2;
const moveTo = async (x, y) => {
  await page.mouse.move(x, y, { steps: 18 });
  mx = x; my = y;
};
const click = async (loc, hold = 1500) => {
  // Click by position like a real mouse: many controls animate forever, so Playwright's
  // "wait until stable" never finishes on them.
  loc = loc.filter({ visible: true }).first();
  await loc.waitFor({ state: "visible", timeout: 10000 });
  await loc.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" }));
  await wait(700);
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box");
  await moveTo(b.x + b.width / 2, b.y + b.height / 2);
  await wait(250);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await wait(hold);
};
// Toggles here are radios, segmented controls are tabs: treat them all as "buttons".
const btn = (name, exact = false) =>
  page.getByRole("button", { name, exact }).or(page.getByRole("tab", { name, exact })).or(page.getByRole("radio", { name, exact })).or(page.getByRole("checkbox", { name, exact }));
const link = (name, exact = false) => page.getByRole("link", { name, exact });
const typeInto = async (loc, text, delay = 18) => {
  await click(loc, 300);
  await loc.filter({ visible: true }).first().pressSequentially(text, { delay });
  await wait(500);
};
const scroll = async (px, steps = 8, pause = 120) => {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, px / steps);
    await wait(pause);
  }
  await wait(700);
};
const visible = async (loc) => loc.filter({ visible: true }).first().isVisible().catch(() => false);
// The first-visit welcome is modal: if it is still up, finish it so it cannot block later steps.
const clearWelcome = async (hold = 600) => {
  const dlg = page.locator("[role=dialog]").filter({ hasText: /Skip|Explore on my own|Who is using Jugnu/ });
  for (let i = 0; i < 10; i++) {
    if (!(await visible(dlg))) return;
    const explore = dlg.getByRole("button", { name: "Explore on my own" });
    if (await visible(explore)) { await click(explore, 1500); return; }
    const beo = dlg.getByRole("radio", { name: /Block Education Officer/ });
    if (await visible(beo)) await click(beo, 1200);
    const next = dlg.getByRole("button", { name: /^(Get started|Continue)$/ });
    if (await visible(next)) await click(next, hold);
    else await wait(500);
  }
};
const step = async (name, fn) => {
  await clearWelcome().catch(() => {});
  try {
    await fn();
  } catch (e) {
    console.log(`  ! step "${name}" hit a problem: ${String(e.message).split("\n")[0]}`);
  }
};

// ─── 1. Home page ────────────────────────────────────────────────────────────
await step("home", async () => {
  await go("/", 500);
  await cap("Jugnu — finds the schools where children learn better than expected, learns what those teachers do, and spreads it teacher to teacher.", 4500);
  await cap("The home page: the whole loop told as one school's story.", 1500);
  await scroll(800, 10);
  await wait(1500);
  await scroll(900, 10);
  await wait(1500);
  await scroll(900, 10);
  await wait(1500);
  await scroll(1000, 10);
  await wait(1500);
  await cap("Bilingual: one tap switches the whole app to Hindi…", 800);
  await click(btn("हिंदी"), 3000);
  await click(btn("English"), 1500);
  await cap("…and dark / light mode.", 500);
  await click(btn("Light mode"), 2500);
  await click(btn("Dark mode"), 1500);
  await cap("Three ways in: Block Education Officer, cluster resource person (CRP), or a teacher.", 500);
  await page.evaluate(() => document.getElementById("start")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  await wait(3500);
});

// ─── 2. Welcome and role ─────────────────────────────────────────────────────
await step("welcome", async () => {
  await cap("Open Jugnu as the Block Education Officer (BEO).", 800);
  await click(btn("Open as BEO"), 3000);
  await cap("First visit: a short welcome that tells the story in four slides, then 'who is using Jugnu?'", 2500);
  await clearWelcome(3500);
});

// ─── 3. Today ────────────────────────────────────────────────────────────────
await step("today", async () => {
  if (!page.url().endsWith("/today")) await go("/today", 1000);
  await cap("TODAY — the officer's to-do list. Every task comes from the data: spot checks due, data to check, peer visits.", 4500);
  await cap("The rings show how far this term's work has got.", 2500);
  for (const chip of [/^Spot checks/, /^Data to check/, /^Peer visits/, /^All/]) await click(btn(chip), 1800).catch(() => {});
  await scroll(700, 8);
  await cap("The block at night: each house is a school — brighter windows mean children doing better than expected.", 4000);
  await scroll(800, 8);
  await wait(2500);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
  await wait(1200);
});

// ─── 4. Schools ──────────────────────────────────────────────────────────────
await step("schools", async () => {
  await cap("STEP 1 · FIND & CHECK — every school compared with what its context predicts (multigrade, size, attendance, home language).", 500);
  await click(link(/^1 Find & check/), 3500);
  await scroll(600, 8);
  await wait(1200);
  await cap("Filter by status: the 9 bright spots…", 500);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
  await wait(800);
  await click(btn(/^Bright spot \d/), 3000);
  await cap("…or the schools whose reported scores look inflated and need checking.", 500);
  await click(btn(/^Bright spot \d/), 600);
  await click(btn(/^Check the data \d/), 3000);
  await click(btn(/^Check the data \d/), 600);
  await cap("The same block as a map.", 500);
  await click(btn("Map", true), 4000);
  await click(btn("List", true), 1000);
  await cap("Search by school, village or teacher.", 500);
  await typeInto(page.getByPlaceholder("Search by school, village or teacher"), "Sirs", 90);
  await wait(2000);
});

// ─── 5. A school: verify with a spot check ───────────────────────────────────
await step("spot check", async () => {
  // Open whichever spot check is still due (earlier runs may have done some).
  await go("/today", 1500);
  const due = page.getByRole("link", { name: /^Spot check at GPS/ });
  const school = ((await due.filter({ visible: true }).first().innerText()).match(/GPS [A-Za-z]+/) ?? ["this school"])[0];
  await cap(`${school} looks like a bright spot — but is it real? Jugnu asks the CRP for a 15-minute spot check.`, 500);
  await click(due, 3500);
  await scroll(500, 6);
  await wait(1500);
  await cap("Record the spot check: 15 children checked at random — 11 read fluently, 9 did the subtraction.", 800);
  const set = async (label, v) => {
    const f = page.getByRole("spinbutton", { name: label, exact: true }).or(page.getByLabel(label, { exact: true }));
    await click(f, 200);
    await f.filter({ visible: true }).first().fill(String(v));
    await wait(500);
  };
  await set("Children checked", 15);
  await set("Read the paragraph fluently", 11);
  await set("Did the subtraction correctly", 9);
  await click(btn("Save spot check"), 2500);
  await cap("Jugnu compares this with what the school reported — a disagreement means a respectful revisit, never a penalty.", 3500);
  await scroll(700, 8);
  await cap("Below: reported vs expected results for 3 years, and the checks behind 'is this bright spot real?'", 4000);
  await scroll(800, 8);
  await wait(2000);
});

// ─── 6. A verified bright spot: invite for interview ─────────────────────────
await step("invite", async () => {
  await cap("A verified bright spot. Next: ask the teacher what she does — a 12-minute voice interview.", 500);
  await go("/schools/s164", 2500);
  await click(btn(/^Invite .* for a 12-minute interview/), 3000);
  await cap("Jugnu makes a private link for the teacher (or calls a basic phone).", 3500);
  await scroll(700, 8);
  await cap("Nearby schools that could learn from her, with distance.", 3000);
});

// ─── 7. The teacher's side: the AI interview (Hindi) ─────────────────────────
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
const answerFor = (r) => (r?.kind === "consent" ? ANSWERS.consent : r?.kind === "follow_up" || r?.kind === "clarify" ? ANSWERS.follow_up : ANSWERS[r?.topic] ?? "जी, ठीक है।");

await step("interview", async () => {
  await cap("Now the TEACHER's side. She opens the link on her phone — no app, no login. Hindi first.", 500);
  await go("/talk", 2500);
  const first = page.waitForResponse((r) => r.request().method() === "POST" && /\/api\/talk\/[^/]+\/start/.test(r.url()), { timeout: 30000 }).catch(() => null);
  await click(btn(/बातचीत शुरू करें/), 500);
  let res = await first;
  let reply = res ? (await res.json().catch(() => ({}))).reply : { kind: "consent" };
  await wait(3500);
  await cap("Jugnu (Claude) introduces itself and asks for consent. She can speak; here we type her answers.", 500);
  const typeBtn = page.getByRole("button", { name: /Type instead|लिखकर जवाब दें/ });
  if (await visible(typeBtn)) await click(typeBtn, 800);
  for (let turn = 0; turn < 16; turn++) {
    const input = page.locator("input:visible").last();
    if (!(await visible(input))) break;
    const ans = answerFor(reply);
    if (turn === 1) await cap("One question at a time about her daily routines. Claude asks one follow-up when an answer is vague, then moves on.", 0);
    if (turn === 5) await cap("Phone numbers and names are scrubbed before anything is stored.", 0);
    await typeInto(input, ans, 8);
    const next = page.waitForResponse((r) => r.request().method() === "POST" && /\/api\/talk\/[^/]+\/(answer|say|reply|turn)/.test(r.url()), { timeout: 60000 }).catch(() => null);
    await page.keyboard.press("Enter");
    res = await next;
    const body = res ? await res.json().catch(() => ({})) : {};
    reply = body.reply;
    await wait(3500);
    if (body.status === "completed" || reply?.done) break;
  }
  await cap("Interview complete. She rates the conversation.", 1500);
  const star = page.getByRole("button", { name: "5 / 5" });
  if (await visible(star)) await click(star, 2500);
  await wait(1500);
});

// ─── 8. Listen: interviews, phone line, history ──────────────────────────────
await step("listen", async () => {
  await cap("STEP 2 · LISTEN — back on the officer's side, the interview has arrived and been coded by Claude.", 500);
  await go("/interviews", 3000);
  await scroll(700, 8);
  await cap("Each practice she named is tagged, with her exact quote — checked against the transcript so nothing is made up.", 4500);
  await scroll(700, 8);
  await wait(2500);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
  await wait(800);
});

await step("phone line", async () => {
  await cap("PHONE LINE — the same interview on a basic phone call, for teachers without a smartphone. Here, the built-in simulator.", 500);
  await click(btn("Phone line", true), 2500);
  await click(page.getByRole("button", { name: "call", exact: true }), 5000);
  const say = page.getByPlaceholder("or type what the teacher says");
  for (const t of [ANSWERS.consent, ANSWERS.open]) {
    if (!(await visible(say))) break;
    await typeInto(say, t, 8);
    const r = page.waitForResponse((x) => x.request().method() === "POST" && x.url().includes("/api/ivr/sim/"), { timeout: 60000 }).catch(() => null);
    await page.keyboard.press("Enter");
    await r;
    await wait(4000);
  }
  await cap("On the right: the exact TwiML the phone network receives.", 3500);
  const hang = page.getByRole("button", { name: "hang up" });
  if (await visible(hang)) await click(hang, 1500);
});

await step("history", async () => {
  await cap("DEMO HISTORY — interviews with bright-spot teachers AND comparison schools. Comparing both is what proves a practice matters.", 500);
  await click(btn("Demo interview history", true), 2500);
  await click(page.getByRole("button", { name: /^Neelam Dhurve/ }), 3500);
  await scroll(700, 8);
  await wait(2500);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
  await click(btn(/^Comparison \(/), 3000);
});

// ─── 9. What works ───────────────────────────────────────────────────────────
await step("practices", async () => {
  await cap("STEP 3 · WHAT WORKS — only practices that bright spots do and comparison schools don't are kept.", 500);
  await click(link(/^3 What works/), 4000);
  await scroll(600, 8);
  await cap("Each with the numbers behind it and teachers' own words.", 3000);
  await cap("In the demo we can peek at the simulator's hidden truth to show the method finds the right practices.", 500);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
  await wait(800);
  await click(btn("Check against hidden truth"), 3500);
  await cap("Claude drafts a one-page practice card for teachers — a person approves it before anyone sees it.", 500);
  const draft = btn("Draft a one-page practice card");
  const r = page.waitForResponse((x) => x.request().method() === "POST" && /practice|card|review/.test(x.url()), { timeout: 60000 }).catch(() => null);
  await click(draft, 500);
  await r;
  await wait(4000);
  await scroll(800, 8);
  await cap("Practices that do NOT separate bright spots are set aside, with the reason.", 3000);
});

// ─── 10. Approvals ───────────────────────────────────────────────────────────
await step("approvals", async () => {
  await cap("APPROVALS — every AI draft waits here for a person. Nothing reaches teachers unapproved.", 500);
  await click(link(/^Approvals/), 3000);
  const who = page.getByPlaceholder("your name / role");
  if (await visible(who)) await typeInto(who, "BEO Damoh (demo)", 30);
  await scroll(500, 6);
  await cap("The draft, the automatic checks it passed, and Approve / Edit / Reject.", 3500);
  const approve = btn("Approve", true);
  if (await visible(approve)) await click(approve, 3000);
  await click(btn("Approved", true), 2500);
});

// ─── 11. Share ───────────────────────────────────────────────────────────────
await step("share", async () => {
  await cap("STEP 4 · SHARE — each struggling school is paired with a nearby teacher who already does the practice.", 500);
  await click(link(/^4 Share/), 3500);
  await cap("Every action has an owner (CRP, BEO or Jugnu itself) and a status anyone can update.", 3000);
  await click(btn("Mark done", true), 2500);
  await cap("Stuck actions are flagged so someone picks them up.", 2000);
  await click(btn("By school", true), 3500);
  await click(btn("Map", true), 4000);
  await click(btn(/^Wave 2/), 2500);
  await cap("Wave 2 gets the same help next term — the fair comparison for 'did it work?'", 3000);
  await click(btn(/^Wave 1/), 1000);
  await click(btn("Actions", true), 1500);
});

// ─── 12. Follow up ───────────────────────────────────────────────────────────
await step("follow up", async () => {
  await cap("STEP 5 · FOLLOW UP — on day 14 the CRP calls each teacher: is she doing it?", 500);
  await click(link(/^5 Follow up/), 3000);
  await click(btn("Record the call"), 2000);
  const said = page.getByPlaceholder(/What did .* say\?/);
  await typeInto(said, "Started the reading groups but we have no level cards yet, and the headmaster wants the syllabus finished first.", 12);
  await cap("Claude reads what the teacher said: outcome, the barrier, and who can remove it.", 500);
  const r = page.waitForResponse((x) => x.request().method() === "POST" && x.url().includes("/api/followup/read"), { timeout: 60000 }).catch(() => null);
  await click(btn(/Let (Claude|Jugnu) read it/), 500);
  await r;
  await wait(4000);
  await click(btn("Save the follow-up"), 3000);
  await cap("A barrier becomes a task for whoever can remove it.", 2500);
});

// ─── 13. Play the whole term ─────────────────────────────────────────────────
await step("play the term", async () => {
  await cap("PLAY THE TERM — a 40-second simulation of a whole term: checks, interviews, visits, follow-up calls.", 500);
  await click(btn("Play the term", true), 2000);
  await wait(42000);
  await cap("Term complete: Results now compares wave 1 with wave 2, practice by practice.", 1500);
  const see = btn("See the results");
  if (await visible(see)) await click(see, 3500);
  else await go("/results", 3000);
  await scroll(700, 8);
  await wait(3000);
  await scroll(700, 8);
  await wait(3000);
  const stop = page.getByRole("button", { name: "Stop and clear the playback" });
  if (await visible(stop)) await click(stop, 1500);
});

// ─── 14. Ask Jugnu ───────────────────────────────────────────────────────────
await step("ask jugnu", async () => {
  await cap("ASK JUGNU — the officer asks in plain words. A Claude agent looks the answer up in the block's data.", 500);
  await go("/today", 1500);
  await click(btn("Ask Jugnu").first(), 2000);
  const r = page.waitForResponse((x) => x.request().method() === "POST" && x.url().includes("/api/ask"), { timeout: 90000 }).catch(() => null);
  await click(btn("Which schools need help with maths, and who nearby can show them?"), 500);
  await r;
  await wait(7000);
  await cap("Every school it names is checked to be real; the answer ends with a next step and its owner.", 4000);
  const close = page.getByRole("button", { name: "close", exact: true });
  if (await visible(close)) await click(close, 1000);
});

// ─── 15. Guide ───────────────────────────────────────────────────────────────
await step("guide", async () => {
  await cap("GUIDE ME — a 1-minute guided tour over the real screens, for first-time users.", 500);
  await click(btn("Guide me"), 3000);
  for (let i = 0; i < 4; i++) {
    const next = btn("Next", true);
    if (!(await visible(next))) break;
    await click(next, 3000);
  }
  const closeG = page.getByRole("button", { name: "Close the guide" });
  if (await visible(closeG)) await click(closeG, 1000);
  else await page.keyboard.press("Escape");
});

// ─── 16. Roles, Hindi, low data ──────────────────────────────────────────────
await step("roles", async () => {
  await cap("Switch role: a CRP sees only the work for her own cluster.", 500);
  await go("/today", 1500);
  await click(page.getByRole("button", { name: /Using Jugnu as/ }), 2000);
  const crp = page.getByRole("button", { name: /Cluster resource person/ });
  if (await visible(crp)) await click(crp, 1500);
  for (const n of ["Continue", "Get started", "Done", "Save"]) if (await visible(btn(n, true))) { await click(btn(n, true), 1500); break; }
  await wait(2500);
  await cap("The whole console in Hindi.", 500);
  await click(btn("हिंदी"), 4000);
  await click(btn("English"), 1500);
  await cap("Low-data mode for slow rural connections: no video, no 3D.", 500);
  await click(btn("Low-data mode"), 3500);
  await click(btn("Low-data mode"), 1000);
  await click(page.getByRole("button", { name: /Using Jugnu as/ }), 1500);
  const beo = page.getByRole("button", { name: /Block Education Officer/ });
  if (await visible(beo)) await click(beo, 1500);
  for (const n of ["Continue", "Get started", "Done", "Save"]) if (await visible(btn(n, true))) { await click(btn(n, true), 1500); break; }
  await page.keyboard.press("Escape");
  await wait(1000);
});

// ─── 17. District ────────────────────────────────────────────────────────────
await step("district", async () => {
  await cap("DISTRICT — Damoh's 7 blocks built from real UDISE+ 2025-26 figures: 2,090 schools, 2.66 lakh children.", 500);
  await go("/district", 4000);
  await scroll(500, 6);
  await cap("Bright spots, data to check and schools needing support, block by block.", 3500);
  await scroll(600, 8);
  await cap("Practices that stand out in several blocks are the ones to push district-wide.", 3500);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
  await wait(800);
  await cap("Open a real block — Tendukheda, 30% tribal — and the whole console switches to it.", 500);
  await click(page.locator("tr", { hasText: "Tendukheda" }).getByRole("button", { name: /Open block/ }), 4000);
  await click(btn("Map", true), 4000);
  await click(link("Today", true), 4000);
});

// ─── 18. Trust & evidence pages ──────────────────────────────────────────────
await step("ai page", async () => {
  await cap("AI & SAFETY CHECKS — every Claude call is logged with its guardrail checks, and falls back to an offline engine if Claude is unavailable.", 500);
  await go("/ai", 3500);
  for (let i = 0; i < 4; i++) { await scroll(700, 8); await wait(2000); }
});
await step("method", async () => {
  await cap("DATA & METHOD — how schools are compared, the real data sources, and importing your own block as CSV.", 500);
  await go("/method", 3500);
  for (let i = 0; i < 3; i++) { await scroll(700, 8); await wait(2000); }
  const run = btn("Run evaluation");
  if (await visible(run)) {
    await cap("Run evaluation: tests the method against the simulator's hidden truth.", 500);
    await click(run, 5000);
  }
});
await step("testing", async () => {
  await cap("USER TESTING — run a session with a teacher, CRP or BEO: tasks, timings, what they struggled with. Exports to CSV.", 500);
  await go("/testing", 3000);
  await click(btn("CRP / cluster coordinator"), 1000);
  const nameBox = page.locator("main input:visible").first();
  if (await visible(nameBox)) await typeInto(nameBox, "Demo CRP, Nayagaon", 30);
  const consent = page.locator("main input[type=checkbox]").first();
  if (await visible(consent)) await click(consent, 800);
  await click(btn("Start session"), 3000);
  await scroll(700, 8);
  await wait(3000);
});
await step("about", async () => {
  await cap("ABOUT — the whole idea on one page, with a 2-minute film.", 500);
  await go("/about", 3500);
  for (let i = 0; i < 3; i++) { await scroll(700, 8); await wait(2000); }
  await cap("Feedback can be sent from any screen.", 500);
  await click(btn("Feedback", true), 3000);
  await page.keyboard.press("Escape");
  await wait(1000);
});

await step("end", async () => {
  await go("/", 1000);
  await cap("Jugnu · जुगनू — find what works, learn it from teachers, spread it teacher to teacher, and check it worked.", 5000);
});

await page.close();
await ctx.close();
await browser.close();
console.log("done");
