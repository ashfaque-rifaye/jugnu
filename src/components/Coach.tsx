// The teacher coach on the teacher's own page: ask about a classroom problem, get an answer built only
// from practices proven in the block, with a bright-spot teacher's words and where to see it. Kept
// free of the engine and the console kit so the teacher page stays light on rural phones.
import { Lightbulb, Loader2 } from "lucide-react";
import { useState } from "react";
import { postJSON } from "../lib/api";
import { cx } from "./ui";

type CoachResult = { value: { practice: string | null; answer: string; steps: string[]; quote: string | null; demonstrator: { school: string; teacher: string; roadKm: number | null } | null } };

const COPY = {
  hi: { title: "अपनी कक्षा के बारे में जुगनू से पूछें", hint: "जैसे: मेरे बच्चे मात्रा में अटकते हैं", ask: "पूछें", see: (s: string, t: string) => `${s} में ${t} के पास देखें`, km: "किमी" },
  en: { title: "Ask Jugnu about your classroom", hint: "e.g. My children get stuck on matras", ask: "Ask", see: (s: string, t: string) => `See it at ${s} with ${t}`, km: "km" },
};

export function CoachBox({ lang, schoolId, seed }: { lang: "hi" | "en"; schoolId?: string; seed?: number }) {
  const c = COPY[lang];
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CoachResult | null>(null);
  const [err, setErr] = useState("");
  const ask = async () => {
    setBusy(true);
    setErr("");
    try {
      setRes(await postJSON<CoachResult>("/api/coach", { question: q, lang, seed, schoolId }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cx("glass-strong mt-5 p-5 text-left", lang === "hi" && "font-deva")}>
      <div className="flex items-center gap-2 font-semibold">
        <Lightbulb size={18} className="text-[var(--st-bright)]" aria-hidden /> {c.title}
      </div>
      <textarea
        aria-label={c.title}
        className="mt-3 min-h-[84px] w-full rounded-2xl border border-[var(--chip-line)] bg-[var(--inset-bg)] px-3.5 py-2.5 text-[15px] outline-none"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={c.hint}
      />
      <button className="btn btn-primary mt-3" disabled={q.trim().length < 4 || busy} onClick={ask}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Lightbulb size={15} />} {c.ask}
      </button>
      {res && (
        <div className="mt-4 space-y-2 text-sm">
          <p>{res.value.answer}</p>
          {res.value.steps.length > 0 && (
            <ol className="list-decimal space-y-1 pl-5 text-[var(--color-ink-2)]">
              {res.value.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
          {res.value.quote && <p className="text-[var(--color-ink-2)]">“{res.value.quote}”</p>}
          {res.value.demonstrator && (
            <p className="text-xs text-[var(--color-ink-3)]">
              {c.see(res.value.demonstrator.school, res.value.demonstrator.teacher)}
              {res.value.demonstrator.roadKm != null && ` · ${res.value.demonstrator.roadKm} ${c.km}`}
            </p>
          )}
        </div>
      )}
      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
    </div>
  );
}
