// The agent's hands and voice in the browser: the morning briefing (built from the block's own
// state, so it is instant, free and works offline), the UI tools Claude can call (go to a page,
// open a school, show it on the map, click, fill, record), and a small offline command parser
// for when Claude is not available.
import type { PipelineState } from "../engine/pipeline";
import type { Action, School } from "../engine/types";
import { practiceLabel, schoolStatuses } from "./status";
import type { BlockEvent } from "./store";

type T = (en: string, hi: string) => string;

// Anything with its own sound (the film) hushes Jugnu while it plays: no speaking, listening or page guide.
export const HUSH_EVENT = "jugnu:hush";
let hushed = false;
export const isHushed = () => hushed;
export function hushJugnu(on: boolean) {
  hushed = on;
  window.dispatchEvent(new Event(HUSH_EVENT));
}

const lc = (s: string) => s.toLowerCase().normalize("NFC").trim();

/** Find a school by English or Hindi name, village or teacher: exact first, then partial. */
export function findSchool(schools: School[], name: string): School | null {
  const k = lc(name).replace(/\b(school|govt\.?|primary|gps|स्कूल|शाला)\b/g, "").trim();
  if (!k) return null;
  const keys = (s: School) => [s.name, s.nameHi ?? "", s.village].map(lc);
  return (
    schools.find((s) => keys(s).includes(k)) ??
    schools.find((s) => keys(s).some((x) => x && (x.includes(k) || k.includes(x)))) ??
    schools.find((s) => lc(s.teacher).includes(k)) ??
    null
  );
}

/** The morning briefing: what changed and what needs the officer, in a few spoken lines. */
export function buildBriefing(st: PipelineState, events: BlockEvent[], t: T, hi: boolean): string[] {
  const status = schoolStatuses(st);
  const count = (k: string) => [...status.values()].filter((v) => v === k).length;
  const name = (id: string) => {
    const s = st.block.schools.find((x) => x.id === id);
    return s ? (hi && s.nameHi ? s.nameHi : s.name) : id;
  };
  const hour = new Date().getHours();
  const lines: string[] = [];
  const hello = hour < 12 ? t("Good morning", "सुप्रभात") : hour < 17 ? t("Good afternoon", "नमस्ते") : t("Good evening", "शुभ संध्या");
  const blockName = st.block.name.replace(/ Block$/, "");
  lines.push(t(`${hello}. Here is ${blockName} today: ${st.block.schools.length} schools.`, `${hello}। आज ${blockName} का हाल: ${st.block.schools.length} स्कूल।`));

  const bright = count("bright");
  const due = count("check_due");
  lines.push(
    due
      ? t(`${bright} bright spots are verified, and ${due} more need a spot check before anyone visits them.`, `${bright} अच्छे स्कूल पक्के हो चुके हैं, और ${due} की मौके पर जाँच बाकी है।`)
      : t(`${bright} bright spots are verified.`, `${bright} अच्छे स्कूल पक्के हो चुके हैं।`),
  );

  const actions: (Action & { wave: number })[] = st.recs.flatMap((r) => r.actions.map((a) => ({ ...a, wave: r.wave })));
  const stuck = actions.filter((a) => a.status === "stuck");
  if (stuck.length) {
    const a = stuck[0];
    lines.push(
      t(
        `${stuck.length} action${stuck.length === 1 ? " is" : "s are"} stuck — first: “${a.task}” at ${name(a.schoolId)}.`,
        `${stuck.length} काम अटके हैं — पहला: ${name(a.schoolId)} में “${a.task}”।`,
      ),
    );
  }
  const visits = actions.filter((a) => a.wave === 1 && a.ownerRole === "CRP" && (a.status === "todo" || a.status === "scheduled")).length;
  if (visits) lines.push(t(`${visits} peer visits are still to happen this term.`, `इस सत्र में ${visits} शिक्षक-भ्रमण अभी बाकी हैं।`));

  const calls = events.filter((e) => e.kind === "followup");
  if (calls.length) {
    const by = (o: string) => calls.filter((e) => (e.payload as { outcome?: string }).outcome === o).length;
    const working = by("adopted") + by("trying");
    lines.push(t(`Follow-up calls: ${working} of ${calls.length} teachers say the new practice is working.`, `फ़ॉलो-अप कॉल: ${calls.length} में से ${working} शिक्षक कहते हैं नया तरीका काम कर रहा है।`));
    const barrier = [...calls].reverse().find((e) => (e.payload as { outcome?: string }).outcome === "barrier");
    if (barrier) {
      const p = barrier.payload as { summary?: [string, string]; barrierOwner?: string };
      const what = p.summary ? (hi ? p.summary[1] : p.summary[0]) : t("something is in the way", "कोई रुकावट है");
      const who = p.barrierOwner === "BEO" ? t("that one is yours", "यह आपके ज़िम्मे है") : p.barrierOwner === "CRP" ? t("the cluster coordinator can fix it", "संकुल समन्वयक हल कर सकते हैं") : "";
      lines.push(t(`At ${name(barrier.ref)}: ${what}${who ? ` — ${who}` : ""}.`, `${name(barrier.ref)} में: ${what}${who ? ` — ${who}` : ""}।`));
    }
  }

  const checks = events.filter((e) => e.kind === "spotcheck").length;
  if (checks) lines.push(t(`${checks} spot check${checks === 1 ? " was" : "s were"} recorded.`, `${checks} जाँच दर्ज हुईं।`));

  const withAtt = st.block.schools.filter((s) => s.attendanceByCycle?.length);
  if (withAtt.length) {
    const low = [...withAtt].sort((a, b) => a.attendanceByCycle[a.attendanceByCycle.length - 1] - b.attendanceByCycle[b.attendanceByCycle.length - 1])[0];
    const pct = Math.round(low.attendanceByCycle[low.attendanceByCycle.length - 1] * 100);
    lines.push(t(`Attendance is lowest at ${name(low.id)}, about ${pct}% on an average day.`, `सबसे कम उपस्थिति ${name(low.id)} में है, औसतन लगभग ${pct}%।`));
  }

  const top = st.evidence.find((e) => e.verdict === "distinctive");
  if (top) lines.push(t(`What works here: ${practiceLabel(top.practice)}.`, `यहाँ जो काम करता है: ${practiceLabel(top.practice, true)}।`));

  lines.push(
    due
      ? t("Shall I open the schools that need a spot check?", "क्या जाँच वाले स्कूल खोलूँ?")
      : stuck.length
        ? t("Shall I open the stuck actions?", "क्या अटके काम खोलूँ?")
        : t("Ask me anything, or tell me where to go.", "कुछ भी पूछें, या बताएँ कहाँ चलना है।"),
  );
  return lines;
}

/** The facts behind a spoken briefing (English; Claude retells them in the officer's language). */
export function briefingFacts(st: PipelineState, events: BlockEvent[]): string[] {
  const en: T = (a) => a;
  const facts = buildBriefing(st, events, en, false).slice(0, -1);
  facts[0] = facts[0].replace(/^Good \w+\. /, "");
  const status = schoolStatuses(st);
  const name = (id: string) => st.block.schools.find((x) => x.id === id)?.name ?? id;
  const of = (k: string) => st.block.schools.filter((s) => status.get(s.id) === k).map((s) => s.name);
  const due = of("check_due");
  if (due.length) facts.push(`Waiting for a spot check: ${due.slice(0, 4).join(", ")}${due.length > 4 ? ` and ${due.length - 4} more` : ""}.`);
  const dataCheck = of("check_data");
  if (dataCheck.length) facts.push(`Reported results look too good to be true at ${dataCheck.slice(0, 3).join(", ")} — the spot check disagreed.`);
  facts.push(`${of("support").length} schools are getting help this term from a nearby school that does better.`);
  const actions = st.recs.flatMap((r) => r.actions);
  for (const a of actions.filter((x) => x.status === "stuck").slice(0, 3)) facts.push(`Stuck: "${a.task}" at ${name(a.schoolId)}; owner ${a.owner} (${a.ownerRole})${a.note ? `; note: ${a.note}` : ""}.`);
  const overdue = actions.filter((a) => a.due < 0 && a.status !== "done" && a.status !== "stuck");
  if (overdue.length) facts.push(`${overdue.length} actions are past their due date, for example "${overdue[0].task}" at ${name(overdue[0].schoolId)} (${overdue[0].owner}).`);
  const soon = actions.filter((a) => a.due >= 0 && a.due <= 3 && a.status !== "done").length;
  if (soon) facts.push(`${soon} actions fall due in the next 3 days.`);
  const now = new Date();
  facts.push(`It is ${now.toLocaleDateString("en-IN", { weekday: "long" })}, ${now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}.`);
  return facts.map((f) => f.slice(0, 400)).slice(0, 30);
}

// ---------------------------------------------------------------- screen helpers

const visible = (el: Element) => {
  const r = (el as HTMLElement).getBoundingClientRect();
  return r.width > 0 && r.height > 0 && !el.closest("[data-agent]") && getComputedStyle(el).visibility !== "hidden";
};
const labelOf = (el: Element) => lc((el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("title") || "").replace(/\s+/g, " "));

function fieldLabel(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const id = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
  return lc(el.getAttribute("aria-label") || (id as HTMLElement | null)?.innerText || el.closest("label")?.innerText || el.getAttribute("placeholder") || el.name || "");
}

/** A compact description of the page for the agent. */
export function readScreen(): string {
  const take = (sel: string, n: number) =>
    [...document.querySelectorAll(sel)]
      .filter(visible)
      .map(labelOf)
      .filter((x) => x && x.length < 80)
      .filter((x, i, a) => a.indexOf(x) === i)
      .slice(0, n);
  const fields = [...document.querySelectorAll("input, textarea, select")]
    .filter(visible)
    .filter((el) => (el as HTMLInputElement).type !== "hidden")
    .map((el) => {
      const f = el as HTMLInputElement;
      return `${fieldLabel(f) || f.type}${f.value ? ` = "${f.value.slice(0, 40)}"` : ""}`;
    })
    .slice(0, 20);
  return JSON.stringify({
    path: location.pathname + location.search,
    headings: take("h1, h2, h3", 16),
    buttons: take("button, [role=button], [role=tab]", 45),
    links: take("main a[href], aside a[href]", 30),
    fields,
  });
}

export function clickByLabel(label: string): string {
  const k = lc(label);
  const els = [...document.querySelectorAll("button, a[href], [role=button], [role=tab], summary, label")].filter(visible);
  const el = els.find((e) => labelOf(e) === k) ?? els.find((e) => labelOf(e).startsWith(k)) ?? els.find((e) => labelOf(e).includes(k));
  if (!el) return `No button or link labelled "${label}" on screen.`;
  (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });
  (el as HTMLElement).click();
  return `Clicked "${labelOf(el).slice(0, 60)}".`;
}

export function fillField(field: string, value: string): string {
  const k = lc(field);
  const els = [...document.querySelectorAll("input, textarea, select")].filter(visible) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];
  const el = els.find((e) => fieldLabel(e) === k) ?? els.find((e) => fieldLabel(e).includes(k)) ?? (els.length === 1 ? els[0] : undefined);
  if (!el) return `No field like "${field}" on screen.`;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.focus();
  if (el instanceof HTMLSelectElement) {
    const opt = [...el.options].find((o) => lc(o.text).includes(lc(value)) || o.value === value);
    if (!opt) return `"${value}" is not an option in ${fieldLabel(el)}.`;
    el.value = opt.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return `Chose "${opt.text}" in ${fieldLabel(el) || "the list"}.`;
  }
  // React keeps its own copy of the value: set it through the native setter so onChange fires.
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return `Typed into ${fieldLabel(el) || "the field"}.`;
}

// ---------------------------------------------------------------- offline commands

export type Intent = { tool: string; input: Record<string, unknown> } | { brief: true } | null;

const PAGE_WORDS: [RegExp, string][] = [
  [/\b(today|home ?screen|dashboard)\b|आज/, "today"],
  [/\bmap\b|नक्श/, "map"],
  [/\bschools?\b|स्कूलों|स्कूल सूची/, "schools"],
  [/\bplan\b|who learns|योजना/, "plan"],
  [/approv|review|मंज़ूरी|मंजूरी/, "approvals"],
  [/result|did it work|नतीज/, "results"],
  [/practice|what works|तरीक/, "practices"],
  [/interview|बातचीत/, "interviews"],
  [/district|ज़िला|जिला/, "district"],
];

/** Understand a few common commands without Claude: brief me, go to X, open/show school, switch block. */
export function parseCommand(text: string, schools: School[], blocks: string[]): Intent {
  const q = lc(text);
  if (/brief|update me|what'?s new|summary|सार|अपडेट|बताओ क्या/.test(q)) return { brief: true };
  const block = blocks.find((b) => q.includes(lc(b)) && /block|switch|ब्लॉक/.test(q));
  if (block) return { tool: "switch_block", input: { block } };
  const m = q.match(/(?:open|show|go to|take me to|खोलो|दिखाओ)\s+(.+)/);
  const target = (m?.[1] ?? q).replace(/\b(the|page|please|on the map|on map)\b|पेज|नक्शे पर/g, "").trim();
  const s = target.length > 2 ? findSchool(schools, target) : null;
  if (s && /map|नक्श/.test(q)) return { tool: "show_on_map", input: { name: s.name } };
  if (s) return { tool: "open_school", input: { name: s.name } };
  for (const [re, page] of PAGE_WORDS) if (re.test(q)) return { tool: "go_to", input: { page } };
  const find = q.match(/(?:find|search|खोजो|ढूँढो|ढूंढो)\s+(.+)/);
  if (find) return { tool: "search", input: { query: find[1] } };
  return null;
}

/** Labels for the work chips under a reply. */
export const TOOL_LABEL: Record<string, [string, string]> = {
  guide: ["Page guide", "पेज गाइड"],
  go_to: ["Opened the page", "पेज खोला"],
  open_school: ["Opened the school", "स्कूल खोला"],
  show_on_map: ["Showed it on the map", "नक्शे पर दिखाया"],
  switch_block: ["Switched block", "ब्लॉक बदला"],
  search: ["Searched", "खोजा"],
  read_screen: ["Read the screen", "स्क्रीन पढ़ी"],
  click: ["Clicked", "क्लिक किया"],
  fill: ["Filled a field", "भरा"],
  record: ["Recorded it", "दर्ज किया"],
  set_preference: ["Changed a setting", "सेटिंग बदली"],
  block_overview: ["Checked the block", "ब्लॉक देखा"],
  find_schools: ["Looked up schools", "स्कूल देखे"],
  school_detail: ["Read a school's record", "स्कूल का रिकॉर्ड देखा"],
  practice_evidence: ["Checked the evidence", "सबूत देखे"],
  action_board: ["Checked the actions", "काम देखे"],
  pilot_interviews: ["Read the interviews", "बातचीत पढ़ी"],
  move_action: ["Moved an action", "काम आगे बढ़ाया"],
  schedule_followup: ["Put it on the clock", "फ़ॉलो-अप तय किया"],
  escalate_to_beo: ["Escalated to the BEO", "BEO को भेजा"],
  dial_teacher: ["Called the teacher", "शिक्षक को फ़ोन किया"],
  list_followups: ["Checked the clock", "फ़ॉलो-अप देखे"],
};
