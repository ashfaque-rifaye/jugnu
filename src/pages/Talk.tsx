// The teacher's side of a Jugnu interview: opened from a WhatsApp/SMS link on any Android phone.
// Voice first (Jugnu speaks every question; the teacher answers by voice), Hindi by default,
// no login, no video or 3D — and an answer is never lost if the network drops mid-call.
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, Loader2, Mic, Send, Square, Volume2, VolumeX, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CoachBox } from "../components/Coach";
import { LogoMark } from "../components/Logo";
import { cx } from "../components/ui";
import { ApiError, getJSON, postJSON } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { canListen, canSpeak, listen, speak, stopSpeaking } from "../lib/speech";

interface PublicTurn {
  speaker: "jugnu" | "teacher";
  text: string;
  text_en: string | null;
  kind: string | null;
}
interface View {
  interview: { teacher_name: string | null; school_name: string | null; language: "hi" | "en"; status: "invited" | "in_progress" | "completed" | "declined"; channel: string; token: string };
  turns: PublicTurn[];
}

const TOPICS = 7;

const COPY = {
  hi: {
    hello: (n: string | null) => (n ? `नमस्ते ${n} जी` : "नमस्ते"),
    intro: "जुगनू ब्लॉक शिक्षा कार्यालय की ओर से आपसे आपकी कक्षा के रोज़ के तरीकों के बारे में 12 मिनट बात करना चाहता है — ताकि दूसरे स्कूल भी सीख सकें।",
    how: "जुगनू हर सवाल बोलकर पूछेगा। आप माइक का बटन दबाकर अपनी भाषा में जवाब दें — हिंदी, बोली या English, सब चलेगा।",
    start: "बातचीत शुरू करें",
    tap: "बोलने के लिए दबाएँ",
    listening: "सुन रहा हूँ… रुकने के लिए दबाएँ",
    thinking: "जुगनू सोच रहा है…",
    type: "लिखकर जवाब दें",
    send: "भेजें",
    placeholder: "अपना जवाब यहाँ लिखें…",
    offline: "नेटवर्क नहीं है। आपका जवाब फ़ोन में सुरक्षित है — नेटवर्क आते ही अपने-आप भेजा जाएगा।",
    progress: (a: number) => `${a} / ${TOPICS} विषय`,
    thanks: "बहुत-बहुत धन्यवाद!",
    thanksSub: "आपकी बातों से पास के स्कूलों के बच्चे भी सीखेंगे। आपका नाम आपकी अनुमति के बिना किसी को नहीं बताया जाएगा।",
    declined: "कोई बात नहीं — धन्यवाद! आपकी कोई बात रिकॉर्ड नहीं की गई।",
    rate: "यह बातचीत कैसी लगी?",
    rated: "धन्यवाद! आपकी राय से हम जुगनू को बेहतर बनाएँगे।",
    noVoice: "इस ब्राउज़र में आवाज़ से जवाब नहीं हो सकता — कृपया लिखकर जवाब दें, या Chrome में खोलें।",
    bad: "यह लिंक सही नहीं है। कृपया अपने CRP से नया लिंक माँगें।",
    noNetwork: "अभी नेटवर्क नहीं है। नेटवर्क आते ही यह पेज अपने-आप खुल जाएगा।",
    retry: "फिर कोशिश करें",
  },
  en: {
    hello: (n: string | null) => (n ? `Namaste ${n}` : "Namaste"),
    intro: "Jugnu, from the Block Education Office, would like a 12-minute conversation about your daily classroom routines — so other schools can learn from them.",
    how: "Jugnu will speak each question. Tap the mic and answer in any language you like.",
    start: "Start the conversation",
    tap: "Tap to speak",
    listening: "Listening… tap to stop",
    thinking: "Jugnu is thinking…",
    type: "Type instead",
    send: "Send",
    placeholder: "Type your answer…",
    offline: "No network. Your answer is saved on this phone and will be sent automatically when the network returns.",
    progress: (a: number) => `${a} / ${TOPICS} topics`,
    thanks: "Thank you so much!",
    thanksSub: "Children in nearby schools will learn from what you shared. Your name won't be shared without your permission.",
    declined: "No problem — thank you! Nothing you said was recorded.",
    rate: "How was this conversation?",
    rated: "Thank you! Your opinion helps us improve Jugnu.",
    noVoice: "Voice answers don't work in this browser — please type, or open the link in Chrome.",
    bad: "This link is not valid. Please ask your CRP for a new one.",
    noNetwork: "No network right now. This page will open by itself when the network returns.",
    retry: "Try again",
  },
};

const pendingKey = (t: string) => `jugnu-pending-${t}`;
/** A server's own message, or "offline" when the request never got through. */
const reason = (e: Error) => (e instanceof ApiError ? e.message : "offline");

export default function TalkPage() {
  const { lite } = usePrefs();
  const { token } = useParams();
  const nav = useNavigate();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [typing, setTyping] = useState(!canListen());
  const [draft, setDraft] = useState("");
  const [voiceOn, setVoiceOn] = useState(canSpeak());
  const [offline, setOffline] = useState(false);
  const [rated, setRated] = useState<number | null>(null);
  const spoken = useRef(0);
  const stopRef = useRef<() => void>(() => {});
  const bottom = useRef<HTMLDivElement>(null);

  // /talk without a token: create a practice interview (lets anyone, e.g. a judge, try it).
  useEffect(() => {
    if (token) return;
    postJSON<{ token: string }>("/api/talk/practice", { language: "hi" })
      .then((r) => nav(`/talk/${r.token}`, { replace: true }))
      .catch((e: Error) => setError(reason(e)));
  }, [token, nav]);

  useEffect(() => {
    if (!token) return;
    getJSON<View>(`/api/talk/${token}`)
      .then((v) => {
        setView(v);
        spoken.current = v.turns.length; // don't re-read an old conversation aloud
      })
      .catch((e: Error) => setError(e instanceof ApiError && e.status === 404 ? "bad" : reason(e)));
  }, [token]);

  // The page could not open for lack of a network: open it as soon as one returns.
  useEffect(() => {
    if (error !== "offline") return;
    const again = () => window.location.reload();
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, [error]);

  const lang = view?.interview.language ?? "hi";
  const c = COPY[lang];
  const status = view?.interview.status;
  const talking = status === "in_progress";

  const startListening = useCallback(async () => {
    if (!canListen()) return setTyping(true);
    stopSpeaking();
    setInterim("");
    const h = listen(lang === "hi" ? "hi-IN" : "en-IN", setInterim);
    stopRef.current = h.stop;
    setListening(true);
    try {
      const text = await h.promise;
      setListening(false);
      if (text) await sendRef.current(text, "asr");
    } catch {
      setListening(false);
      setTyping(true);
    }
  }, [lang]);

  // Speak new Jugnu turns in order, then (hands-free) start listening.
  useEffect(() => {
    if (!view) return;
    const fresh = view.turns.slice(spoken.current);
    spoken.current = view.turns.length;
    const lines = fresh.filter((t) => t.speaker === "jugnu").map((t) => t.text);
    void bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (!lines.length) return;
    let cancelled = false;
    (async () => {
      if (voiceOn) for (const l of lines) if (!cancelled) await speak(l, lang === "hi" ? "hi-IN" : "en-IN");
      if (!cancelled && view.interview.status === "in_progress" && !typing && canListen()) void startListening();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.turns.length]);

  const send = useCallback(
    async (text: string, source: "asr" | "typed") => {
      if (!token || !text.trim()) return;
      setBusy(true);
      setDraft("");
      setInterim("");
      // Optimistic: show the answer immediately.
      setView((v) => (v ? { ...v, turns: [...v.turns, { speaker: "teacher", text, text_en: null, kind: "answer" }] } : v));
      spoken.current += 1;
      try {
        const out = await postJSON<View>(`/api/talk/${token}/answer`, { text, source });
        localStorage.removeItem(pendingKey(token));
        setOffline(false);
        // Speak only Jugnu's turns after the teacher's latest answer.
        spoken.current = out.turns.findLastIndex((t) => t.speaker === "teacher") + 1;
        setView(out);
      } catch (e) {
        if (!(e instanceof ApiError)) {
          localStorage.setItem(pendingKey(token), JSON.stringify({ text, source }));
          setOffline(true);
        } else setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    [token],
  );
  const sendRef = useRef(send);
  sendRef.current = send;

  // Resend an answer saved while offline.
  useEffect(() => {
    if (!token) return;
    const retry = () => {
      const saved = localStorage.getItem(pendingKey(token));
      if (!saved) return;
      const { text, source } = JSON.parse(saved) as { text: string; source: "asr" | "typed" };
      setView((v) => (v ? { ...v, turns: v.turns.slice(0, -1) } : v));
      spoken.current = Math.max(0, spoken.current - 1);
      void sendRef.current(text, source);
    };
    window.addEventListener("online", retry);
    const id = window.setInterval(() => navigator.onLine && retry(), 15000);
    return () => {
      window.removeEventListener("online", retry);
      window.clearInterval(id);
    };
  }, [token]);

  const begin = async (language: "hi" | "en") => {
    if (!token) return;
    setBusy(true);
    try {
      if (language !== lang) await postJSON(`/api/talk/${token}/language`, { language });
      const v = await postJSON<View>(`/api/talk/${token}/start`, {});
      spoken.current = 0;
      setView(v);
    } catch (e) {
      setError(reason(e as Error));
    } finally {
      setBusy(false);
    }
  };

  const rate = (n: number) => {
    setRated(n);
    void postJSON("/api/testing/feedback", { page: "talk", kind: "rating", rating: n, role: "teacher", sessionId: localStorage.getItem("jugnu-session"), lang }).catch(() => {});
  };

  const asked = view?.turns.filter((t) => t.speaker === "jugnu" && t.kind === "question").length ?? 0;

  if (error === "offline")
    return (
      <Shell>
        <div className="glass p-6 text-center">
          <p className="font-deva text-lg">{COPY.hi.noNetwork}</p>
          <p className="mt-2 text-sm text-[var(--color-ink-3)]">{COPY.en.noNetwork}</p>
          <button className="btn btn-glass mt-4" onClick={() => window.location.reload()}>
            {COPY.hi.retry} · {COPY.en.retry}
          </button>
        </div>
      </Shell>
    );
  if (error)
    return (
      <Shell>
        <div className="glass p-6 text-center">
          <p className="font-deva text-lg">{error === "bad" ? COPY.hi.bad : error}</p>
          {error === "bad" && <p className="mt-2 text-sm text-[var(--color-ink-3)]">{COPY.en.bad}</p>}
        </div>
      </Shell>
    );
  if (!view)
    return (
      <Shell>
        <div className="grid place-items-center py-24">
          <Loader2 className="animate-spin text-amber-200" />
        </div>
      </Shell>
    );

  // ---------------------------------------------------------------- welcome
  if (status === "invited")
    return (
      <Shell>
        <div className="glass-strong overflow-hidden">
          {!lite && (
            <picture>
              <source srcSet="/media/teacher-welcome.webp" type="image/webp" />
              <img src="/media/teacher-welcome.jpg" alt="" width={760} height={568} className="h-48 w-full object-cover object-[50%_35%]" />
            </picture>
          )}
          <div className={cx("p-6", !lite && "-mt-12 pt-0")}>
          <div className="relative mx-auto mb-3 w-fit">
            <LogoMark size={lite ? 72 : 64} />
          </div>
          <h1 className="text-center font-deva text-3xl font-bold">{COPY.hi.hello(view.interview.teacher_name)}</h1>
          {view.interview.school_name && <p className="mt-1 text-center text-sm text-[var(--color-ink-3)]">{view.interview.school_name}</p>}
          <p className="mt-4 font-deva text-[17px] leading-relaxed">{COPY.hi.intro}</p>
          <p className="mt-2 font-deva text-[15px] leading-relaxed text-[var(--color-ink-2)]">{COPY.hi.how}</p>
          <p className="mt-3 text-sm text-[var(--color-ink-3)]">{COPY.en.intro}</p>
          <div className="mt-6 grid gap-2">
            <button className="btn btn-primary justify-center !py-4 font-deva text-lg" onClick={() => begin("hi")} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Mic size={18} />} {COPY.hi.start} (हिंदी)
            </button>
            <button className="btn btn-glass justify-center" onClick={() => begin("en")} disabled={busy}>
              Start in English
            </button>
          </div>
          {!canListen() && <p className="mt-4 font-deva text-sm text-amber-200">{COPY.hi.noVoice}</p>}
          </div>
        </div>
      </Shell>
    );

  // ---------------------------------------------------------------- conversation / end
  return (
    <Shell>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-display font-bold">Jugnu</span>
          <span className={cx("chip text-xs", lang === "hi" && "font-deva")}>{c.progress(Math.min(asked, TOPICS))}</span>
        </div>
        <button className="btn btn-glass !px-3 !py-1.5" onClick={() => (voiceOn ? (stopSpeaking(), setVoiceOn(false)) : setVoiceOn(true))} aria-label="voice on/off">
          {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-200 to-teal-300 transition-all" style={{ width: `${Math.min(100, (asked / TOPICS) * 100)}%` }} />
      </div>

      <div className="glass overflow-hidden">
      <div className="scroll-thin max-h-[calc(100dvh-13.5rem)] space-y-2 overflow-y-auto p-3" aria-live="polite">
        <AnimatePresence initial={false}>
          {view.turns.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cx("flex", t.speaker === "teacher" ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[88%] rounded-2xl px-4 py-2.5 text-[16px] leading-relaxed", lang === "hi" && "font-deva", t.speaker === "teacher" ? "rounded-br-sm bg-amber-200/15" : "rounded-bl-sm bg-white/10")}>{t.text}</div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className={cx("flex items-center gap-2 text-sm text-[var(--color-ink-3)]", lang === "hi" && "font-deva")}>
            <Loader2 size={14} className="animate-spin text-amber-200" /> {c.thinking}
          </div>
        )}
        {listening && interim && <div className={cx("ml-auto max-w-[88%] rounded-2xl border border-dashed border-amber-200/40 px-4 py-2 text-[15px] text-[var(--color-ink-2)]", lang === "hi" && "font-deva")}>{interim}</div>}
        <div ref={bottom} />
      </div>
      </div>

      {offline && (
        <div className={cx("mt-3 flex items-start gap-2 rounded-2xl border border-amber-200/30 bg-amber-200/10 p-3 text-sm", lang === "hi" && "font-deva")}>
          <WifiOff size={16} className="mt-0.5 shrink-0" /> {c.offline}
        </div>
      )}

      {talking && (
        <div className="mt-5">
          {!typing ? (
            <div className="flex flex-col items-center gap-3">
              <button
                className={cx("relative grid h-24 w-24 place-items-center rounded-full transition", listening ? "accent-solid" : "bg-white/12 hover:bg-white/20")}
                onClick={() => (listening ? stopRef.current() : startListening())}
                disabled={busy}
                aria-label={listening ? c.listening : c.tap}
              >
                {listening && <span className="absolute inset-0 animate-ping rounded-full bg-amber-200/40" />}
                {listening ? <Square size={30} /> : <Mic size={34} />}
              </button>
              <div className={cx("text-sm text-[var(--color-ink-2)]", lang === "hi" && "font-deva")}>{listening ? c.listening : c.tap}</div>
              <button className={cx("btn btn-glass !py-1.5 text-sm", lang === "hi" && "font-deva")} onClick={() => setTyping(true)}>
                <Keyboard size={15} /> {c.type}
              </button>
            </div>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft, "typed");
              }}
            >
              {canListen() && (
                <button type="button" className="btn btn-glass" onClick={() => (setTyping(false), void startListening())} aria-label={c.tap}>
                  <Mic size={16} />
                </button>
              )}
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={c.placeholder} className={cx("min-w-0 flex-1 rounded-full border border-white/15 bg-black/25 px-4 py-3 text-[16px] outline-none focus:border-amber-200/60", lang === "hi" && "font-deva")} />
              <button className="btn btn-primary" disabled={busy || !draft.trim()} aria-label={c.send}>
                <Send size={16} />
              </button>
            </form>
          )}
        </div>
      )}

      {(status === "completed" || status === "declined") && (
        <div className="glass-strong mt-5 p-5 text-center">
          <div className={cx("text-2xl font-bold", lang === "hi" && "font-deva")}>{status === "completed" ? c.thanks : c.declined}</div>
          {status === "completed" && <p className={cx("mt-2 text-sm text-[var(--color-ink-2)]", lang === "hi" && "font-deva")}>{c.thanksSub}</p>}
          <div className={cx("mt-5 text-sm", lang === "hi" && "font-deva")}>{rated ? c.rated : c.rate}</div>
          {!rated && (
            <div className="mt-2 flex justify-center gap-2 text-3xl">
              {["😟", "🙁", "😐", "🙂", "😄"].map((e, i) => (
                <button key={e} onClick={() => rate(i + 1)} className="rounded-full p-1 transition hover:scale-110" aria-label={`${i + 1} / 5`}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {status === "completed" && <CoachBox lang={lang} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh px-4 pb-10 pt-6" style={{ background: "radial-gradient(1200px 600px at 50% -10%, rgba(250,204,21,.12), transparent 60%), var(--bg)" }}>
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
