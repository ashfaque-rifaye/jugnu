// Approvals: every AI-written method card and voice note waits here for a person. The numbers show how
// the queue is moving, and each approved item shows how far it has travelled across the schools.
import { ArrowRight, Check, Loader2, Pencil, Quote, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Meter } from "../components/kit";
import { Glass, cx } from "../components/ui";
import { VoicePlayer } from "../components/VoicePlayer";
import { PRACTICES, type PracticeId } from "../engine/practices";
import { postJSON, usePoll } from "../lib/api";
import { markJourney } from "../lib/journey";
import { usePrefs, useT } from "../lib/prefs";
import { roleName, useRole } from "../lib/role";
import { buildRollouts, type MethodRollout } from "../lib/rollout";
import { usePipeline } from "../lib/store";

interface CheckRow {
  name: string;
  passed: boolean;
  detail?: string;
}
interface Card {
  practice: PracticeId;
  title_hi: string;
  title_en: string;
  steps: { hi: string; en: string; quote_ids: number[] }[];
  materials: string[];
  time_hi: string;
  watch_out_hi: string;
}
interface Item {
  id: string;
  kind: "practice_card" | "voice_note" | "barrier";
  ref: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer: string | null;
  note: string | null;
  created_at: string;
  decided_at: string | null;
  checks: CheckRow[];
  payload: { source: string; demo?: boolean; card?: Card; quotes?: { id: number; school: string; quote: string }[]; voice_hi?: string; voice_en?: string; draftHi?: string; practice?: string; edited?: boolean };
}

const DAY = 86_400_000;

export default function ReviewPage() {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [all, , reload] = usePoll<Item[]>("/api/reviews?status=all", 6000);
  const [role] = useRole();
  const { state, followUps, events } = usePipeline();
  const [reviewer, setReviewer] = useState(() => localStorage.getItem("jugnu-reviewer") || roleName(role, state.block) || "");
  const rollouts = useMemo(() => buildRollouts(state, followUps, events), [state, followUps, events]);
  const items = all?.filter((x) => status === "all" || x.status === status) ?? null;

  const stats = useMemo(() => {
    const rows = all ?? [];
    const waiting = rows.filter((x) => x.status === "pending");
    const decided = rows.filter((x) => x.decided_at);
    const avg = decided.length ? decided.reduce((a, x) => a + (Date.parse(x.decided_at!) - Date.parse(x.created_at)), 0) / decided.length / DAY : null;
    const oldest = waiting.length ? Math.max(...waiting.map((x) => (Date.now() - Date.parse(x.created_at)) / DAY)) : 0;
    const approvedMethods = new Set(rows.filter((x) => x.kind === "practice_card" && x.status === "approved").map((x) => x.ref));
    const live = rollouts.filter((r) => approvedMethods.has(r.practice));
    return {
      waiting: waiting.length,
      oldest,
      approved: rows.filter((x) => x.status === "approved").length,
      returned: rows.filter((x) => x.status === "rejected").length,
      avg,
      schools: live.reduce((a, r) => a + r.schools.length, 0),
      children: live.reduce((a, r) => a + r.children, 0),
    };
  }, [all, rollouts]);
  const days = (n: number) => (n < 1 ? t("under a day", "एक दिन से कम") : t(`${Math.round(n)} day${Math.round(n) === 1 ? "" : "s"}`, `${Math.round(n)} दिन`));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.9rem] font-semibold leading-tight tracking-[-0.035em]">{t("Approvals", "मंज़ूरी")}</h1>
        <p className={cx("mt-1 max-w-3xl text-[15px] text-[var(--color-ink-2)]", hi)}>
          {t(
            "Jugnu drafts method cards and voice notes from teachers' own words. Nothing reaches a teacher until a person says yes here.",
            "जुगनू शिक्षकों के अपने शब्दों से तरीकों के कार्ड और वॉइस नोट बनाता है। यहाँ इंसान की हाँ के बिना कुछ भी शिक्षक तक नहीं जाता।",
          )}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            [t("Waiting for you", "आपका इंतज़ार"), stats.waiting, stats.waiting ? t(`Oldest: ${days(stats.oldest)}`, `सबसे पुराना: ${days(stats.oldest)}`) : t("All caught up", "सब निपट गया")],
            [t("Approved so far", "अब तक मंज़ूर"), stats.approved, stats.returned ? t(`${stats.returned} sent back`, `${stats.returned} वापस भेजे`) : t("None sent back", "कोई वापस नहीं")],
            [t("Time to decide", "फ़ैसले में समय"), stats.avg == null ? "—" : days(stats.avg), t("On average", "औसतन")],
            [t("Approved methods reach", "मंज़ूर तरीके पहुँचेंगे"), t(`${stats.schools} schools`, `${stats.schools} स्कूल`), t(`${stats.children.toLocaleString("en-IN")} children`, `${stats.children.toLocaleString("en-IN")} बच्चे`)],
          ] as const
        ).map(([label, v, sub]) => (
          <div key={label} className="card p-4">
            <dt className={cx("text-[13px] text-[var(--color-ink-2)]", hi)}>{label}</dt>
            <dd className={cx("mt-1 font-display text-[1.6rem] font-bold leading-none tabular-nums", hi)}>{v}</dd>
            <dd className={cx("mt-1.5 text-xs text-[var(--color-ink-3)]", hi)}>{sub}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--inset-bg)] p-1">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button key={s} className={cx("seg-item rounded-full px-3 py-1.5 text-sm", status === s ? "seg-on font-medium text-[var(--color-ink)]" : "text-[var(--color-ink-2)]")} onClick={() => setStatus(s)}>
              {{ pending: t("Waiting", "बाकी"), approved: t("Approved", "मंज़ूर"), rejected: t("Sent back", "वापस भेजे"), all: t("All", "सभी") }[s]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink-2)]">
          {t("Reviewer", "समीक्षक")}
          <input
            value={reviewer}
            onChange={(e) => (setReviewer(e.target.value), localStorage.setItem("jugnu-reviewer", e.target.value))}
            placeholder={t("your name or role", "आपका नाम या पद")}
            className="rounded-full border border-[var(--line)] bg-[var(--inset-bg)] px-3 py-1.5 text-sm outline-none"
          />
        </label>
      </div>

      {items === null && <Loader2 className="animate-spin text-[var(--st-bright)]" />}
      {items?.length === 0 && (
        <Glass className={cx("p-6 text-sm text-[var(--color-ink-2)]", hi)}>
          {t("Nothing here. Draft a method card on “Methods that work”, or send a voice note from a school's page.", "यहाँ कुछ नहीं। 'जो तरीके काम करते हैं' पर कार्ड बनाएँ, या स्कूल के पेज से वॉइस नोट भेजें।")}
        </Glass>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        {items?.map((it) => (
          <ReviewCard key={it.id} item={it} reviewer={reviewer} onDone={reload} rollout={it.kind === "practice_card" ? rollouts.find((r) => r.practice === it.ref) : undefined} />
        ))}
      </div>
    </div>
  );
}

function Checks({ checks }: { checks: CheckRow[] }) {
  const t = useT();
  if (!checks.length) return null;
  const passed = checks.filter((c) => c.passed).length;
  const clean = passed === checks.length;
  return (
    <details open={!clean}>
      <summary className="tap-link cursor-pointer text-sm font-medium text-[var(--color-ink-2)]">
        {clean ? <ShieldCheck size={15} className="mr-1.5 inline text-[var(--tone-good)]" /> : <ShieldAlert size={15} className="mr-1.5 inline text-[var(--tone-bad)]" />}
        {t(`${passed} of ${checks.length} automatic checks passed`, `${checks.length} में से ${passed} जाँच पास`)}
      </summary>
      <ul className="mt-2 space-y-1 text-xs text-[var(--color-ink-2)]">
        {checks.map((c) => (
          <li key={c.name} className="flex items-center gap-1.5">
            {c.passed ? <ShieldCheck size={12} className="text-[var(--tone-good)]" /> : <ShieldAlert size={12} className="text-[var(--tone-bad)]" />} {c.name}
            {c.detail && !c.passed ? `: ${c.detail}` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Once something is approved: where it is going, and how far it has got. */
function Reach({ item, rollout }: { item: Item; rollout?: MethodRollout }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const { state, allActions } = usePipeline();
  if (item.status !== "approved") return null;
  if (item.kind === "practice_card" && rollout)
    return (
      <div className="card-inset mt-3 p-3">
        <div className={cx("mb-1.5 flex flex-wrap justify-between gap-2 text-sm", hi)}>
          <span className="font-medium">{t(`Going to ${rollout.schools.length} schools in ${rollout.clusters.length} clusters`, `${rollout.clusters.length} क्लस्टर के ${rollout.schools.length} स्कूलों तक`)}</span>
          <span className="tabular-nums text-[var(--color-ink-2)]">{Math.round(rollout.progress * 100)}%</span>
        </div>
        <Meter value={rollout.progress} height={7} color="var(--tone-good)" />
        <div className={cx("mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-[var(--color-ink-2)]", hi)}>
          <span>{t(`${rollout.teachers} teachers · ${rollout.children.toLocaleString("en-IN")} children`, `${rollout.teachers} शिक्षक · ${rollout.children.toLocaleString("en-IN")} बच्चे`)}</span>
          <Link to={`/plan?method=${rollout.practice}`} className="inline-flex items-center gap-1 font-semibold text-[var(--st-bright)]">
            {t("See the rollout", "रोलआउट देखें")} <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    );
  if (item.kind === "voice_note" && item.ref) {
    const s = state.block.schools.find((x) => x.id === item.ref);
    const a = allActions.find((x) => x.id === `${item.ref}-note`);
    if (!s) return null;
    return (
      <div className={cx("card-inset mt-3 flex flex-wrap items-center justify-between gap-2 p-3 text-sm", hi)}>
        <span>
          {t(`For ${s.teacher}, ${s.name}`, `${s.name} के ${s.teacher} के लिए`)} · <span className="text-[var(--color-ink-2)]">{a?.status === "done" ? t("sent", "भेजा गया") : t("ready to send", "भेजने को तैयार")}</span>
        </span>
        <Link to={`/schools/${s.id}?tab=act`} className="inline-flex items-center gap-1 font-semibold text-[var(--st-bright)]">
          {t("Open school", "स्कूल खोलें")} <ArrowRight size={13} />
        </Link>
      </div>
    );
  }
  return null;
}

function ReviewCard({ item, reviewer, onDone, rollout }: { item: Item; reviewer: string; onDone: () => void; rollout?: MethodRollout }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.payload.voice_hi ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (decision: "approved" | "rejected") => {
    if (!reviewer.trim()) return window.alert(t("Enter your name as reviewer first.", "पहले समीक्षक के रूप में अपना नाम लिखें।"));
    setBusy(true);
    await postJSON(`/api/reviews/${item.id}/decide`, { decision, reviewer, note: note || undefined, payload: editing && item.kind === "voice_note" ? { voice_hi: text } : undefined });
    setBusy(false);
    markJourney("review");
    onDone();
  };
  const card = item.payload.card;
  const quotes = new Map((item.payload.quotes ?? []).map((q) => [q.id, q]));
  return (
    <Glass className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="label">
          {item.kind === "practice_card" ? t("Method card", "तरीके का कार्ड") : item.kind === "voice_note" ? t("Voice note to a teacher", "शिक्षक के लिए वॉइस नोट") : t("Something in the way", "रुकावट")}
          {item.payload.edited ? ` · ${t("edited", "संपादित")}` : ""}
          {item.payload.demo ? ` · ${t("sample", "नमूना")}` : ""}
        </span>
        <span className="text-xs text-[var(--color-ink-3)]">{new Date(item.created_at).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>

      {card && (
        <div>
          <h3 className="font-deva text-xl font-bold">{card.title_hi}</h3>
          <div className="text-sm text-[var(--color-ink-3)]">{card.title_en || PRACTICES[card.practice]?.label}</div>
          <ol className="mt-3 space-y-2">
            {card.steps.map((s, i) => (
              <li key={i} className="glass-inset p-3">
                <div className="flex gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--chip)] text-xs font-bold">{i + 1}</span>
                  <div>
                    <div className="font-deva text-sm">{s.hi}</div>
                    {s.en && lang !== "hi" && <div className="mt-0.5 text-xs text-[var(--color-ink-2)]">{s.en}</div>}
                    {s.quote_ids.map((qid) => (
                      <div key={qid} className="mt-1 flex gap-1 text-xs text-[var(--color-ink-3)]">
                        <Quote size={11} className="mt-0.5 shrink-0" /> <span className="font-deva">{quotes.get(qid)?.quote ?? ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {(card.time_hi || card.materials.length > 0) && (
            <div className="mt-2 font-deva text-sm text-[var(--color-ink-2)]">
              {card.time_hi}
              {card.time_hi && card.materials.length > 0 ? " · " : ""}
              {card.materials.join(", ")}
            </div>
          )}
          {card.watch_out_hi && <div className="mt-1 font-deva text-sm text-[var(--color-ink-2)]">{card.watch_out_hi}</div>}
        </div>
      )}

      {item.kind === "voice_note" && (
        <div>
          <div className="mb-2 text-sm text-[var(--color-ink-3)]">{item.payload.practice}</div>
          {editing ? (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="w-full rounded-xl border border-[var(--line)] bg-[var(--inset-bg)] p-3 font-deva text-sm outline-none" />
          ) : (
            <VoicePlayer key={item.payload.voice_hi} text={item.payload.voice_hi ?? ""} />
          )}
          {item.payload.voice_en && !editing && (
            <details className="mt-2">
              <summary className="tap-link cursor-pointer text-sm text-[var(--color-ink-2)]">{t("Read in English", "अंग्रेज़ी में पढ़ें")}</summary>
              <p className="mt-1 text-sm text-[var(--color-ink-2)]">{item.payload.voice_en}</p>
            </details>
          )}
        </div>
      )}

      <div className="mt-3">
        <Checks checks={item.checks} />
      </div>

      <Reach item={item} rollout={rollout} />

      {item.status === "pending" ? (
        <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Note (optional): what you changed and why", "टिप्पणी (वैकल्पिक): क्या बदला और क्यों")} className="w-full rounded-full border border-[var(--line)] bg-[var(--inset-bg)] px-3 py-1.5 text-sm outline-none" />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={() => decide("approved")}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {editing ? t("Approve with my edits", "मेरे बदलावों के साथ मंज़ूर") : t("Approve", "मंज़ूर करें")}
            </button>
            {item.kind === "voice_note" && (
              <button className="btn btn-glass" onClick={() => setEditing((v) => !v)}>
                <Pencil size={14} /> {editing ? t("Cancel edit", "संपादन रद्द") : t("Edit", "संपादित करें")}
              </button>
            )}
            <button className="btn btn-glass" disabled={busy} onClick={() => decide("rejected")}>
              <X size={14} /> {t("Send back", "वापस भेजें")}
            </button>
          </div>
        </div>
      ) : (
        <div className={cx("mt-4 border-t border-[var(--line)] pt-3 text-sm text-[var(--color-ink-2)]", hi)}>
          {item.status === "approved" ? t("Approved", "मंज़ूर") : t("Sent back", "वापस भेजा")} · {item.reviewer}
          {item.decided_at && ` · ${new Date(item.decided_at).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })}`}
          {item.note && item.note !== "automated flow check" && <div className="mt-1 text-xs text-[var(--color-ink-3)]">“{item.note}”</div>}
        </div>
      )}
    </Glass>
  );
}
