// What feeds the Audit page: which pages a visit used and for how long, the role chosen, changes made,
// and how often Jugnu's AI, voice and calls were used. A visit is a random id kept for this browser tab;
// no name, number or address goes with it. Sent in small batches, and once more as the tab closes.

type Kind = "page" | "role" | "change" | "ai" | "voice" | "call" | "action";
interface Ev {
  at: string;
  kind: Kind;
  name: string;
  detail?: string;
  ms?: number;
}

const KEY = "jugnu-visit";
let visitId = "";
try {
  visitId = sessionStorage.getItem(KEY) ?? "";
  if (!visitId) {
    visitId = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, "").slice(0, 24);
    sessionStorage.setItem(KEY, visitId);
  }
} catch {
  visitId = `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
}

const visit: { role: string | null; name: string | null; lang?: string } = { role: null, name: null };
const entry = location.pathname;
const referrer = (() => {
  try {
    return document.referrer && new URL(document.referrer).host !== location.host ? new URL(document.referrer).host : "";
  } catch {
    return "";
  }
})();
let queue: Ev[] = [];
let timer = 0;
// Stage mode and the automated checks still count, but the Audit page can tell them apart (bot flag, server side).

function payload() {
  return JSON.stringify({ visit: { id: visitId, role: visit.role, name: visit.name, lang: visit.lang, entry, referrer, screen: `${screen.width}x${screen.height}` }, events: queue.splice(0, 60) });
}

function flush(closing = false) {
  window.clearTimeout(timer);
  timer = 0;
  if (!queue.length) return;
  const body = payload();
  if (closing && navigator.sendBeacon) navigator.sendBeacon("/api/audit/track", new Blob([body], { type: "application/json" }));
  else void fetch("/api/audit/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

/** Note one thing that happened in this visit. */
export function track(kind: Kind, name: string, detail?: string, ms?: number) {
  queue.push({ at: new Date().toISOString(), kind, name: name.slice(0, 80), detail: detail?.slice(0, 200), ms });
  if (queue.length >= 40) flush();
  else if (!timer) timer = window.setTimeout(flush, 8000);
}

/** Who this visit is, once they choose a role (or change it, or the language). */
export function setVisitor(role: string | null, name: string | null, lang?: string) {
  const changed = role !== visit.role;
  visit.role = role;
  visit.name = name;
  if (lang) visit.lang = lang;
  if (changed && role) track("role", role, name ?? undefined);
}

// ---- pages: one event per page, with the time it was on screen
let page = "";
let since = 0;
let resumed = false; // the same page again after the tab was in the background: time counts, the view doesn't
const PAGE_NAMES: [RegExp, string][] = [
  [/^\/$/, "Home"],
  [/^\/today/, "Today"],
  [/^\/schools\/[^/]+/, "School page"],
  [/^\/schools/, "Schools"],
  [/^\/interviews/, "Talk to teachers"],
  [/^\/practices/, "Methods that work"],
  [/^\/plan/, "Share with schools"],
  [/^\/results/, "Check progress"],
  [/^\/review/, "Approvals"],
  [/^\/district/, "District"],
  [/^\/audit/, "Audit"],
  [/^\/testing/, "Test lab"],
  [/^\/ai/, "Safety"],
  [/^\/about/, "About"],
  [/^\/talk/, "Teacher interview"],
];
const pageName = (path: string) => PAGE_NAMES.find(([re]) => re.test(path))?.[1] ?? path.slice(0, 40);

function closePage() {
  if (!page || !since) return;
  track("page", page, resumed ? "again" : undefined, Math.round(Date.now() - since));
  since = 0;
}

export function trackPage(path: string) {
  const name = pageName(path);
  if (name === page && since) return;
  closePage();
  resumed = name === page;
  page = name;
  since = Date.now();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    // The tab may never come back: send what we have now.
    closePage();
    flush(true);
  } else if (page) {
    resumed = true;
    since = Date.now();
  }
});
window.addEventListener("pagehide", () => (closePage(), flush(true)));

// ---- what the app asks the server to do, in plain names (read by api.tsx on every request)
const FEATURES: [string, RegExp, Kind, string][] = [
  ["POST", /^\/api\/agent$/, "ai", "Asked Jugnu"],
  ["POST", /^\/api\/agent\/brief/, "ai", "Morning brief"],
  ["POST", /^\/api\/agent\/page/, "ai", "Page guide"],
  ["POST", /^\/api\/agent\/why/, "ai", "Why this status"],
  ["POST", /^\/api\/voice\/stt/, "voice", "Spoke to Jugnu"],
  ["POST", /^\/api\/ivr\/call/, "call", "Phone call placed"],
  ["POST", /^\/api\/interviews$/, "action", "Interview link made"],
  ["POST", /^\/api\/whatsapp\/send/, "action", "WhatsApp sent"],
  ["POST", /^\/api\/testing\/feedback/, "action", "Feedback given"],
  ["POST", /^\/api\/reviews\/[^/]+/, "change", "Approval decided"],
];
export function trackRequest(method: string, url: string) {
  const path = url.split("?")[0];
  const hit = FEATURES.find(([m, re]) => m === method && re.test(path));
  if (hit) track(hit[2], hit[3]);
}
