// Human review: every AI-written practice card and voice note waits here for a CRP or the BEO.
// Each shows the deterministic guardrail results and, for cards, the teacher quote behind every step.
import { Check, Loader2, Pencil, Quote, ShieldAlert, ShieldCheck, Volume2, X } from "lucide-react";
import { useState } from "react";
import { Glass, cx } from "../components/ui";
import { PRACTICES, type PracticeId } from "../engine/practices";
import { postJSON, usePoll } from "../lib/api";
import { useT } from "../lib/prefs";
import { roleName, useRole } from "../lib/role";
import { speak } from "../lib/speech";
import { markJourney } from "../lib/journey";

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

export default function ReviewPage() {
  const t = useT();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [items, , reload] = usePoll<Item[]>(`/api/reviews?status=${status}`, 6000);
  const [role] = useRole();
  const [reviewer, setReviewer] = useState(() => localStorage.getItem("jugnu-reviewer") || roleName(role) || "");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-[1.75rem]">{t("Approvals", "मंज़ूरी")}</h1>
        <p className="mt-1 max-w-3xl text-[15px] text-[var(--color-ink-2)]">
          {t(
            "Claude drafts practice cards and peer voice notes from teachers' own words. Automatic checks run first (every step cites a real quote, no invented numbers, right language, fits in 60 seconds); then a CRP or the BEO approves, edits or rejects.",
            "Claude शिक्षकों के अपने शब्दों से तरीकों के कार्ड और वॉइस नोट बनाता है। पहले अपने-आप जाँच होती है (हर कदम असली उद्धरण से, कोई गढ़ा हुआ अंक नहीं, सही भाषा, 60 सेकंड में); फिर CRP या BEO मंज़ूर, संपादित या अस्वीकार करते हैं।",
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1">
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <button key={s} className={cx("rounded-full px-3 py-1.5 text-sm", status === s ? "bg-white/15 text-white" : "text-[var(--color-ink-2)]")} onClick={() => setStatus(s)}>
                {{ pending: t("Waiting", "बाकी"), approved: t("Approved", "मंज़ूर"), rejected: t("Rejected", "अस्वीकार"), all: t("All", "सभी") }[s]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink-2)]">
            {t("Reviewer", "समीक्षक")}
            <input
              value={reviewer}
              onChange={(e) => (setReviewer(e.target.value), localStorage.setItem("jugnu-reviewer", e.target.value))}
              placeholder={t("your name / role", "आपका नाम / पद")}
              className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-sm outline-none"
            />
          </label>
        </div>
      </div>

      {items === null && <Loader2 className="animate-spin text-amber-200" />}
      {items?.length === 0 && (
        <Glass className="p-6 text-sm text-[var(--color-ink-2)]">
          {t("Nothing here. Draft a practice card on “What works”, or send a voice note from a school in the Support plan.", "यहाँ कुछ नहीं। 'क्या काम करता है' पर कार्ड बनाएँ, या 'मदद की योजना' के किसी स्कूल से वॉइस नोट भेजें।")}
        </Glass>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        {items?.map((it) => (
          <ReviewCard key={it.id} item={it} reviewer={reviewer} onDone={reload} />
        ))}
      </div>
    </div>
  );
}

function Checks({ checks }: { checks: CheckRow[] }) {
  if (!checks.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {checks.map((c) => (
        <span key={c.name} className="chip text-[10px]" style={{ borderColor: c.passed ? "#2dd4bf88" : "#f8717188", background: c.passed ? "#2dd4bf14" : "#f8717114" }} title={c.detail}>
          {c.passed ? <ShieldCheck size={11} className="text-teal-300" /> : <ShieldAlert size={11} className="text-red-300" />} {c.name}
          {c.detail && !c.passed ? ` — ${c.detail}` : ""}
        </span>
      ))}
    </div>
  );
}

function ReviewCard({ item, reviewer, onDone }: { item: Item; reviewer: string; onDone: () => void }) {
  const t = useT();
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
          {item.kind === "practice_card" ? t("Practice card", "तरीके का कार्ड") : item.kind === "voice_note" ? t("Peer voice note", "साथी का वॉइस नोट") : t("Barrier", "रुकावट")} · {item.payload.source === "claude" ? "Claude" : t("offline engine", "ऑफ़लाइन इंजन")}
          {item.payload.edited ? ` · ${t("edited", "संपादित")}` : ""}
          {item.payload.demo ? ` · ${t("demo draft", "डेमो ड्राफ़्ट")}` : ""}
        </span>
        <span className="text-xs text-[var(--color-ink-3)]">{new Date(item.created_at).toLocaleString()}</span>
      </div>

      {card && (
        <div>
          <h3 className="font-deva text-xl font-bold">{card.title_hi}</h3>
          <div className="text-sm text-[var(--color-ink-3)]">{card.title_en || PRACTICES[card.practice]?.label}</div>
          <ol className="mt-3 space-y-2">
            {card.steps.map((s, i) => (
              <li key={i} className="glass-inset p-3">
                <div className="flex gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-200/20 text-xs font-bold">{i + 1}</span>
                  <div>
                    <div className="font-deva text-sm">{s.hi}</div>
                    {s.en && <div className="text-xs text-[var(--color-ink-3)]">{s.en}</div>}
                    {s.quote_ids.map((qid) => (
                      <div key={qid} className="mt-1 flex gap-1 text-[11px] text-[var(--color-ink-3)]">
                        <Quote size={11} className="mt-0.5 shrink-0 text-amber-200" /> <span className="font-deva">{quotes.get(qid)?.quote ?? `#${qid}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {(card.time_hi || card.materials.length > 0) && (
            <div className="mt-2 text-sm text-[var(--color-ink-2)]">
              {card.time_hi && <span className="font-deva">⏱ {card.time_hi} </span>}
              {card.materials.length > 0 && <span className="font-deva">· 🧰 {card.materials.join(", ")}</span>}
            </div>
          )}
          {card.watch_out_hi && <div className="mt-1 font-deva text-sm text-amber-100/90">⚠ {card.watch_out_hi}</div>}
        </div>
      )}

      {item.kind === "voice_note" && (
        <div>
          <div className="text-sm text-[var(--color-ink-3)]">{item.payload.practice}</div>
          {editing ? (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 p-3 font-deva text-sm outline-none" />
          ) : (
            <p className="mt-2 font-deva text-sm leading-relaxed">{item.payload.voice_hi}</p>
          )}
          {item.payload.voice_en && <p className="mt-2 text-xs text-[var(--color-ink-3)]">{item.payload.voice_en}</p>}
          <button className="btn btn-glass mt-2 !py-1.5" onClick={() => speak(editing ? text : item.payload.voice_hi ?? "", "hi-IN")}>
            <Volume2 size={14} /> {t("Listen", "सुनें")}
          </button>
        </div>
      )}

      <div className="mt-3">
        <div className="label mb-1">{t("Automatic checks", "अपने-आप जाँच")}</div>
        <Checks checks={item.checks} />
      </div>

      {item.status === "pending" ? (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Note (optional) — e.g. what you changed and why", "टिप्पणी (वैकल्पिक) — क्या बदला और क्यों")} className="w-full rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-sm outline-none" />
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
              <X size={14} /> {t("Reject", "अस्वीकार")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 border-t border-white/10 pt-3 text-sm text-[var(--color-ink-2)]">
          {item.status === "approved" ? "✓ " + t("Approved", "मंज़ूर") : "✗ " + t("Rejected", "अस्वीकार")} · {item.reviewer} · {item.decided_at && new Date(item.decided_at).toLocaleString()}
          {item.note && <div className="mt-1 text-xs text-[var(--color-ink-3)]">“{item.note}”</div>}
        </div>
      )}
    </Glass>
  );
}
