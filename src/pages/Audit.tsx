// Audit: who came into Jugnu and as which role, what they changed, and how Jugnu is being used —
// pages, time, AI, voice and calls. Refreshes on its own. No names, numbers or addresses are kept.
import { Bot, ChevronDown, Clock3, Globe2, Laptop, LayoutGrid, MessageCircleQuestion, Mic, MousePointerClick, PenLine, PhoneCall, ShieldCheck, Smartphone, Tablet, UserRound, Users } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { AuditTrail } from "../components/Audit";
import { Card, Empty, PageHeader, Segmented, Stat, useAgo } from "../components/kit";
import { cx } from "../components/ui";
import { usePoll } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";

interface Tally {
  name: string;
  n: number;
}
interface VisitEvent {
  at: string;
  kind: string;
  name: string;
  detail: string | null;
  ms: number | null;
}
interface Visit {
  id: string;
  started_at: string;
  last_at: string;
  role: string | null;
  name: string | null;
  device: string;
  browser: string;
  os: string;
  place: string | null;
  lang: string | null;
  entry: string | null;
  bot: number;
  pages: number;
  actions: number;
  changes: number;
  active_ms: number;
  events: VisitEvent[];
}
interface Report {
  days: number;
  summary: { visits: number; signedIn: number; changes: number; ai: number; voice: number; calls: number; pages: number; avgMinutes: number; liveNow: number };
  byDay: { day: string; n: number }[];
  byHour: number[];
  pages: { name: string; n: number; avgSec: number }[];
  roles: Tally[];
  devices: Tally[];
  browsers: Tally[];
  places: Tally[];
  languages: Tally[];
  features: Tally[];
  visits: Visit[];
}

const ROLE: Record<string, [string, string]> = {
  beo: ["Block officer", "ब्लॉक अधिकारी"],
  crp: ["Cluster coordinator", "क्लस्टर समन्वयक"],
  head: ["School head", "प्रधानाध्यापक"],
  guest: ["Guest", "अतिथि"],
  "No role chosen": ["Didn't choose a role", "भूमिका नहीं चुनी"],
};
const KIND_ICON: Record<string, typeof PenLine> = { page: LayoutGrid, role: UserRound, change: PenLine, ai: MessageCircleQuestion, voice: Mic, call: PhoneCall, action: MousePointerClick };
const DEVICE_ICON: Record<string, typeof Laptop> = { Phone: Smartphone, Tablet, Laptop };

const time = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60_000)} min`);

/** A list of names with a thin bar each: one series, so no legend; the number is written beside it. */
function Bars({ rows, label, empty, color = "var(--st-bright)" }: { rows: { name: string; n: number; note?: string }[]; label?: (name: string) => ReactNode; empty: string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="text-sm text-[var(--color-ink-3)]">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.name} className="text-sm" title={`${r.name}: ${r.n}${r.note ? ` · ${r.note}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">{label ? label(r.name) : r.name}</span>
            <span className="shrink-0 tabular-nums text-[var(--color-ink-2)]">
              {r.n}
              {r.note && <span className="ml-1.5 text-xs text-[var(--color-ink-3)]">{r.note}</span>}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--ring-track)]">
            <div className="h-full rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Upright bars along a time axis (days, or hours of the day), with the value on hover. */
function Columns({ values, labels, every = 1, height = 120, tip }: { values: number[]; labels: string[]; every?: number; height?: number; tip: (i: number) => string }) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {values.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end" title={tip(i)}>
            <div className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-80" style={{ height: `${v ? Math.max(4, (v / max) * 100) : 0}%`, background: "var(--st-bright)" }} />
            {!v && <div className="h-[2px] w-full rounded-full bg-[var(--ring-track)]" />}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px] text-[10.5px] tabular-nums text-[var(--color-ink-3)]">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center">
            {i % every === 0 ? l : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function VisitRow({ v }: { v: Visit }) {
  const t = useT();
  const ago = useAgo();
  const { lang } = usePrefs();
  const [open, setOpen] = useState(false);
  const Device = DEVICE_ICON[v.device] ?? Laptop;
  const live = Date.now() - new Date(v.last_at).getTime() < 3 * 60_000;
  const role = v.role ? (ROLE[v.role] ? t(...ROLE[v.role]) : v.role) : t(...ROLE["No role chosen"]);
  return (
    <li className="card-inset overflow-hidden">
      <button className="grid w-full gap-x-4 gap-y-1 px-3.5 py-3 text-left text-sm md:grid-cols-[1.4fr_1.2fr_1fr_auto]" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            {live && <span className="live-dot shrink-0" style={{ color: "var(--tone-good)" }} title={t("Here now", "अभी यहाँ")} />}
            <span className="truncate">{(v.role === "crp" || v.role === "head") && v.name ? v.name : role}</span>
            {v.bot ? (
              <span className="chip !px-2 !py-0 !text-[11px]">
                <Bot size={11} /> {t("automated check", "स्वचालित जाँच")}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-[var(--color-ink-3)]">
            {ago(v.started_at)} · {new Date(v.started_at).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[var(--color-ink-2)]">
          <Device size={15} className="shrink-0" aria-hidden />
          <span className="truncate">
            {v.device} · {v.browser} · {v.os}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[var(--color-ink-2)]">
          <Globe2 size={15} className="shrink-0" aria-hidden />
          <span className="truncate">{v.place ?? t("Place not known", "जगह पता नहीं")}</span>
        </div>
        <div className="flex items-center gap-3 text-xs tabular-nums text-[var(--color-ink-2)] md:justify-end">
          <span title={t("Pages", "पेज")}>
            <LayoutGrid size={13} className="mr-0.5 inline" /> {v.pages}
          </span>
          <span title={t("Changes", "बदलाव")}>
            <PenLine size={13} className="mr-0.5 inline" /> {v.changes}
          </span>
          <span title={t("Time on screen", "स्क्रीन पर समय")}>
            <Clock3 size={13} className="mr-0.5 inline" /> {v.active_ms ? time(v.active_ms) : "–"}
          </span>
          <ChevronDown size={15} className={cx("transition-transform", open && "rotate-180")} aria-hidden />
        </div>
      </button>
      {open && (
        <ol className="space-y-1 border-t border-[var(--line)] px-3.5 py-3">
          {v.events.length === 0 && <li className="text-xs text-[var(--color-ink-3)]">{t("Nothing recorded yet in this visit.", "इस बार अभी कुछ दर्ज नहीं।")}</li>}
          {v.events.map((e, i) => {
            const Icon = KIND_ICON[e.kind] ?? MousePointerClick;
            return (
              <li key={i} className="grid grid-cols-[64px_18px_1fr_auto] items-center gap-2 text-[13px]">
                <span className="tabular-nums text-[var(--color-ink-3)]">{new Date(e.at).toLocaleTimeString(lang === "hi" ? "hi-IN" : "en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                <Icon size={14} className="text-[var(--color-ink-3)]" aria-hidden />
                <span className="min-w-0 truncate">
                  {e.kind === "page" ? (e.detail === "again" ? t(`Back on ${e.name}`, `फिर ${e.name} पर`) : t(`Opened ${e.name}`, `${e.name} खोला`)) : e.kind === "role" ? t(`Chose the role: ${ROLE[e.name] ? t(...ROLE[e.name]) : e.name}`, `भूमिका चुनी: ${ROLE[e.name] ? t(...ROLE[e.name]) : e.name}`) : e.name}
                  {e.detail && e.kind !== "page" && e.kind !== "role" && <span className="text-[var(--color-ink-3)]"> · {e.detail}</span>}
                </span>
                <span className="tabular-nums text-xs text-[var(--color-ink-3)]">{e.ms ? time(e.ms) : ""}</span>
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

export default function AuditPage() {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const [days, setDays] = useState(7);
  const [bots, setBots] = useState(false);
  const [r, error] = usePoll<Report>(`/api/audit?days=${days}&bots=${bots ? 1 : 0}`, 15000);
  const s = r?.summary;
  const featureName = (k: string) => k.split(":").slice(1).join(":");
  const roleLabel = (n: string) => (ROLE[n] ? t(...ROLE[n]) : n);
  const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", days > 7 ? { day: "numeric" } : { weekday: "short" });

  return (
    <div>
      <PageHeader
        eyebrow={t("Who came in · what changed · how Jugnu is used", "कौन आया · क्या बदला · जुगनू कैसे इस्तेमाल हुआ")}
        title={t("Audit", "ऑडिट")}
        hint={t(
          "Every visit to Jugnu is noted here: the role chosen, the device, the city, the pages used and for how long, every change made, and each use of Jugnu's AI, voice and phone calls. No names, phone numbers or internet addresses are kept.",
          "जुगनू पर हर आना यहाँ दर्ज होता है: चुनी गई भूमिका, डिवाइस, शहर, कौन से पेज कितनी देर देखे, हर बदलाव, और जुगनू की AI, आवाज़ व फ़ोन कॉल का हर इस्तेमाल। नाम, फ़ोन नंबर या इंटरनेट पता नहीं रखा जाता।",
        )}
        sub={t("Updates by itself every few seconds.", "हर कुछ सेकंड में अपने आप अपडेट होता है।")}
        actions={
          <>
            <Segmented
              size="sm"
              value={days}
              onChange={setDays}
              options={[
                { value: 1, label: t("Today", "आज") },
                { value: 7, label: t("7 days", "7 दिन") },
                { value: 30, label: t("30 days", "30 दिन") },
              ]}
            />
            <button className={cx("chip !py-1.5", bots && "!border-[var(--st-bright)]")} onClick={() => setBots((x) => !x)} aria-pressed={bots} title={t("Our own automated checks of the site", "साइट की हमारी अपनी स्वचालित जाँचें")}>
              <Bot size={14} /> {bots ? t("Showing automated checks", "स्वचालित जाँचें दिख रही हैं") : t("Automated checks hidden", "स्वचालित जाँचें छिपी हैं")}
            </button>
          </>
        }
      />

      {error && !r && (
        <Empty icon={ShieldCheck} title={t("The audit log can't be reached right now", "ऑडिट लॉग अभी नहीं मिल रहा")}>
          {error}
        </Empty>
      )}
      {!r && !error && <div className="skeleton h-40 rounded-[1.4rem]" />}

      {r && s && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Stat label={t("Visits", "विज़िट")} value={s.visits} hint={s.liveNow ? t(`${s.liveNow} here now`, `${s.liveNow} अभी यहाँ`) : undefined} />
            <Stat label={t("Chose a role", "भूमिका चुनी")} value={s.signedIn} hint={s.visits ? t(`${Math.round((s.signedIn / s.visits) * 100)}% of visits`, `${Math.round((s.signedIn / s.visits) * 100)}% विज़िट`) : undefined} />
            <Stat label={t("Changes made", "बदलाव किए")} value={s.changes} />
            <Stat label={t("Questions to Jugnu", "जुगनू से सवाल")} value={s.ai} />
            <Stat label={t("Spoke to Jugnu", "जुगनू से बोले")} value={s.voice} />
            <Stat label={t("Phone calls", "फ़ोन कॉल")} value={s.calls} />
            <Stat label={t("Time per visit", "प्रति विज़िट समय")} value={s.avgMinutes ? `${s.avgMinutes} min` : "–"} hint={t(`${s.pages} pages opened`, `${s.pages} पेज खोले`)} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card title={days === 1 ? t("Visits today", "आज की विज़िट") : t("Visits per day", "रोज़ की विज़िट")} icon={Users}>
              <Columns values={r.byDay.map((d) => d.n)} labels={r.byDay.map((d) => dayLabel(d.day))} every={days > 7 ? 5 : 1} tip={(i) => `${dayLabel(r.byDay[i].day)}: ${r.byDay[i].n}`} />
            </Card>
            <Card title={t("Busiest hours (India time)", "सबसे व्यस्त घंटे (भारतीय समय)")} icon={Clock3}>
              <Columns values={r.byHour} labels={r.byHour.map((_, h) => String(h))} every={3} tip={(h) => t(`${h}:00 to ${h + 1}:00 — ${r.byHour[h]} things done`, `${h}:00 से ${h + 1}:00 — ${r.byHour[h]} काम`)} />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card title={t("Pages people used", "जो पेज इस्तेमाल हुए")} icon={LayoutGrid} className="lg:col-span-1">
              <Bars rows={r.pages.map((p) => ({ name: p.name, n: p.n, note: p.avgSec ? t(`~${time(p.avgSec * 1000)} each`, `~${time(p.avgSec * 1000)} हर बार`) : undefined }))} empty={t("No pages yet.", "अभी कोई पेज नहीं।")} />
            </Card>
            <Card title={t("Who came in", "कौन आए")} icon={UserRound}>
              <div className="space-y-5">
                <Bars rows={r.roles} label={roleLabel} empty={t("No visits yet.", "अभी कोई विज़िट नहीं।")} color="var(--tone-teal)" />
                <Bars rows={r.devices} empty="" color="var(--tone-teal)" />
                <Bars rows={r.languages} empty="" color="var(--tone-teal)" />
              </div>
            </Card>
            <Card title={t("Where from, and what they used", "कहाँ से, और क्या इस्तेमाल किया")} icon={Globe2}>
              <div className="space-y-5">
                <Bars rows={r.places} empty={t("Places show on the live site.", "जगहें लाइव साइट पर दिखती हैं।")} color="var(--tone-good)" />
                <Bars rows={r.features.map((f) => ({ name: featureName(f.name), n: f.n }))} empty={t("No AI, voice or calls used yet.", "अभी AI, आवाज़ या कॉल का इस्तेमाल नहीं।")} color="var(--tone-good)" />
              </div>
            </Card>
          </div>

          <Card title={t("Every visit", "हर विज़िट")} icon={ShieldCheck} right={<span className="text-xs text-[var(--color-ink-3)]">{t("Tap one to see what happened in it", "क्या हुआ देखने के लिए किसी को दबाएँ")}</span>}>
            {r.visits.length === 0 ? (
              <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>{t("No visits in this period yet.", "इस अवधि में अभी कोई विज़िट नहीं।")}</p>
            ) : (
              <ol className="space-y-1.5">
                {r.visits.map((v) => (
                  <VisitRow key={v.id} v={v} />
                ))}
              </ol>
            )}
          </Card>

          <AuditTrail />

          <p className={cx("text-xs text-[var(--color-ink-3)]", hi)} style={{ maxWidth: "70ch" } as CSSProperties}>
            {t(
              "A visit is one browser tab, under a random number. Jugnu keeps the role chosen, the kind of device, the city the internet provider reports, and what was done. It keeps no names, phone numbers or internet addresses.",
              "एक विज़िट यानी एक ब्राउज़र टैब, एक अनजान नंबर के साथ। जुगनू चुनी गई भूमिका, डिवाइस का प्रकार, इंटरनेट कंपनी जो शहर बताती है, और जो किया गया, वही रखता है। नाम, फ़ोन नंबर या इंटरनेट पता नहीं रखता।",
            )}
          </p>
        </div>
      )}
    </div>
  );
}
