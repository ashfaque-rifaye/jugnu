// "Ask Jugnu": the officer asks the block a question by voice or text. Claude answers as an agent
// that looks the data up with tools; the answer lists the schools, one next step with an owner,
// which lookups it made and which guardrails ran.
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, Search, Send, ShieldAlert, ShieldCheck, Sparkles, Volume2, X } from "lucide-react";
import { useState } from "react";
import { postJSON } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { canListen, listen, speak } from "../lib/speech";
import { usePipeline } from "../lib/store";
import { cx } from "./ui";

interface Answer {
  source: "claude" | "offline";
  answer: string;
  schools: string[];
  next_step: string;
  owner: string | null;
  tools: string[];
  checks: { name: string; passed: boolean; detail?: string }[];
  warning?: string;
}

const EXAMPLES: [string, string][] = [
  ["Which schools need help with maths, and who nearby can show them?", "किन स्कूलों को गणित में मदद चाहिए, और पास में कौन दिखा सकता है?"],
  ["Which actions are stuck, and who owns them?", "कौन-से काम अटके हैं, और किसकी ज़िम्मेदारी है?"],
  ["Why might some schools' results be inflated?", "कुछ स्कूलों के नतीजे बढ़ा-चढ़ाकर क्यों हो सकते हैं?"],
  ["What do bright-spot teachers do that others don't?", "अच्छे स्कूलों के शिक्षक ऐसा क्या करते हैं जो बाकी नहीं करते?"],
];

export function AskJugnu({ open, onClose, onSchool }: { open: boolean; onClose: () => void; onSchool: (name: string) => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const { state, seed } = usePipeline();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [history, setHistory] = useState<{ q: string; a: Answer | null; error?: string }[]>([]);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setBusy(true);
    setQ("");
    setHistory((h) => [{ q: question, a: null }, ...h]);
    try {
      const body = state.block.source === "imported" ? { question, block: state.block } : { question, seed, track: !!state.track };
      const a = await postJSON<Answer>("/api/ask", body);
      setHistory((h) => [{ q: question, a }, ...h.slice(1)]);
    } catch (e) {
      setHistory((h) => [{ q: question, a: null, error: (e as Error).message }, ...h.slice(1)]);
    } finally {
      setBusy(false);
    }
  };

  const mic = async () => {
    setListening(true);
    const h = listen(lang === "hi" ? "hi-IN" : "en-IN", setQ);
    try {
      const text = await h.promise;
      if (text) await ask(text);
    } finally {
      setListening(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside initial={{ x: 480, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 480, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 240 }} className="glass-strong fixed bottom-3 right-3 top-3 z-[60] flex w-[min(460px,calc(100vw-24px))] flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="label">{t("Ask the block", "ब्लॉक से पूछें")}</div>
              <div className="font-display text-lg font-bold">Ask Jugnu</div>
            </div>
            <button onClick={onClose} aria-label="close">
              <X size={18} />
            </button>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(q);
            }}
          >
            {canListen() && (
              <button type="button" className={cx("btn", listening ? "btn-primary" : "btn-glass")} onClick={mic} aria-label="speak">
                <Mic size={16} />
              </button>
            )}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Ask about a school, cluster or practice…", "किसी स्कूल, क्लस्टर या तरीके के बारे में पूछें…")} className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/25 px-4 py-2 font-deva text-sm outline-none" />
            <button className="btn btn-primary" disabled={busy || !q.trim()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
          {history.length === 0 && (
            <div className="mt-3 grid gap-1.5">
              {EXAMPLES.map(([en, hi]) => (
                <button key={en} className="glass-inset p-2.5 text-left text-sm hover:bg-white/8" onClick={() => ask(lang === "hi" ? hi : en)}>
                  <span className={cx(lang === "hi" && "font-deva")}>{lang === "hi" ? hi : en}</span>
                </button>
              ))}
            </div>
          )}
          <div className="scroll-thin mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
            {history.map((h, i) => (
              <div key={i} className="space-y-2">
                <div className="ml-8 rounded-2xl rounded-br-sm bg-amber-200/12 px-3 py-2 font-deva text-sm">{h.q}</div>
                {!h.a && !h.error && (
                  <div className="flex items-center gap-2 text-sm text-[var(--color-ink-3)]">
                    <Loader2 size={14} className="animate-spin text-amber-200" /> {t("Looking it up…", "देख रहा हूँ…")}
                  </div>
                )}
                {h.error && <div className="text-sm text-red-300">{h.error}</div>}
                {h.a && (
                  <div className="glass-inset space-y-2 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="chip text-[10px]">{h.a.source === "claude" ? <Sparkles size={10} className="text-emerald-300" /> : null} {h.a.source === "claude" ? "Claude agent" : t("offline answer", "ऑफ़लाइन जवाब")}</span>
                      <button className="text-[var(--color-ink-3)] hover:text-white" onClick={() => speak(h.a!.answer, /[ऀ-ॿ]/.test(h.a!.answer) ? "hi-IN" : "en-IN")} aria-label="listen">
                        <Volume2 size={14} />
                      </button>
                    </div>
                    <p className="font-deva leading-relaxed">{h.a.answer}</p>
                    {h.a.schools.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {h.a.schools.map((s) => (
                          <button key={s} className="chip text-[11px] hover:bg-white/15" onClick={() => onSchool(s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="rounded-xl border border-amber-200/25 bg-amber-200/8 p-2 text-[13px]">
                      <b>{t("Next step", "अगला कदम")}:</b> {h.a.next_step} {h.a.owner && <span className="text-[var(--color-ink-3)]">· {h.a.owner}</span>}
                    </div>
                    {(h.a.tools.length > 0 || h.a.checks.length > 0) && (
                      <div className="flex flex-wrap gap-1 border-t border-white/10 pt-2 text-[10px]">
                        {h.a.tools.map((tool, k) => (
                          <span key={k} className="chip !py-0">
                            <Search size={9} /> {tool}
                          </span>
                        ))}
                        {h.a.checks.map((c) => (
                          <span key={c.name} className="chip !py-0" title={c.detail}>
                            {c.passed ? <ShieldCheck size={9} className="text-teal-300" /> : <ShieldAlert size={9} className="text-red-300" />} {c.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {h.a.warning && <div className="text-[11px] text-amber-200">{h.a.warning}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
