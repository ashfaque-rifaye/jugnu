// Feedback from real users, everywhere in the console: a floating button for a quick rating and a
// comment (typed or spoken in Hindi), tagged with the page and — during a testing session — the role.
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageSquareHeart, Mic, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { postJSON } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { canListen, listen } from "../lib/speech";
import { cx } from "./ui";

export type Role = "teacher" | "crp" | "beo" | "other";

export function useSession() {
  const [id, setId] = useState<string | null>(() => localStorage.getItem("jugnu-session"));
  const [role, setRole] = useState<Role | null>(() => localStorage.getItem("jugnu-role") as Role | null);
  useEffect(() => {
    const sync = () => {
      setId(localStorage.getItem("jugnu-session"));
      setRole(localStorage.getItem("jugnu-role") as Role | null);
    };
    window.addEventListener("jugnu:session", sync);
    return () => window.removeEventListener("jugnu:session", sync);
  }, []);
  const begin = useCallback((sid: string, r: Role) => {
    localStorage.setItem("jugnu-session", sid);
    localStorage.setItem("jugnu-role", r);
    window.dispatchEvent(new Event("jugnu:session"));
  }, []);
  const end = useCallback(() => {
    localStorage.removeItem("jugnu-session");
    localStorage.removeItem("jugnu-role");
    window.dispatchEvent(new Event("jugnu:session"));
  }, []);
  return { id, role, begin, end };
}

export async function sendFeedback(body: { page: string; kind: "rating" | "comment" | "task" | "bug"; rating?: number | null; text?: string | null; task?: string | null; lang: string }) {
  return postJSON("/api/testing/feedback", { ...body, sessionId: localStorage.getItem("jugnu-session"), role: localStorage.getItem("jugnu-role") });
}

/** Text box with a mic button that dictates in Hindi or English. */
export function VoiceText({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder: string; rows?: number }) {
  const { lang } = usePrefs();
  const [listening, setListening] = useState(false);
  const dictate = async () => {
    setListening(true);
    const h = listen(lang === "hi" ? "hi-IN" : "en-IN", (txt) => onChange(txt));
    try {
      const txt = await h.promise;
      if (txt) onChange(txt);
    } finally {
      setListening(false);
    }
  };
  return (
    <div className="relative">
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className="w-full rounded-xl border border-white/15 bg-black/25 p-3 pr-11 font-deva text-sm outline-none focus:border-amber-200/60" />
      {canListen() && (
        <button type="button" onClick={dictate} className={cx("absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full", listening ? "accent-solid" : "bg-white/10")} aria-label="dictate">
          <Mic size={14} />
        </button>
      )}
    </div>
  );
}

/** Phones open the feedback panel from the More sheet. */
export const FEEDBACK_EVENT = "jugnu:feedback";

export function FeedbackButton() {
  const t = useT();
  const { lang } = usePrefs();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(FEEDBACK_EVENT, show);
    return () => window.removeEventListener(FEEDBACK_EVENT, show);
  }, []);
  const submit = async () => {
    setState("busy");
    const page = loc.pathname || "/";
    if (rating) await sendFeedback({ page, kind: "rating", rating, lang }).catch(() => {});
    if (text.trim()) await sendFeedback({ page, kind: "comment", text, lang }).catch(() => {});
    setState("sent");
    window.setTimeout(() => (setOpen(false), setState("idle"), setRating(null), setText("")), 1400);
  };
  return (
    <div className={`no-print fixed right-4 z-50 ${location.pathname.startsWith("/talk") ? "bottom-4" : "bottom-[172px] lg:bottom-auto lg:top-[72px]"}`}>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="sheet mb-3 w-[320px] rounded-[1.6rem] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">{t("How is this page?", "यह पेज कैसा लगा?")}</span>
              <button onClick={() => setOpen(false)} aria-label="close">
                <X size={16} />
              </button>
            </div>
            {state === "sent" ? (
              <p className="py-4 text-center text-sm">{t("Thank you — we read every comment.", "धन्यवाद — हम हर राय पढ़ते हैं।")}</p>
            ) : (
              <>
                <div className="mb-3 flex justify-between text-2xl">
                  {["😟", "🙁", "😐", "🙂", "😄"].map((e, i) => (
                    <button key={e} onClick={() => setRating(i + 1)} className={cx("rounded-full p-1 transition", rating === i + 1 ? "scale-125 bg-white/15" : "opacity-70 hover:opacity-100")} aria-label={`${i + 1} / 5`}>
                      {e}
                    </button>
                  ))}
                </div>
                <VoiceText value={text} onChange={setText} placeholder={t("What was confusing, or what would help? (type or speak)", "क्या समझ नहीं आया, या क्या मदद करेगा? (लिखें या बोलें)")} />
                <button className="btn btn-primary mt-3 w-full justify-center" onClick={submit} disabled={state === "busy" || (!rating && !text.trim())}>
                  {state === "busy" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {t("Send", "भेजें")}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <button className={cx("btn btn-glass ml-auto shadow-xl max-sm:!p-3", !location.pathname.startsWith("/talk") && "hidden")} onClick={() => setOpen((v) => !v)} aria-label={t("Feedback", "राय दें")}>
        <MessageSquareHeart size={16} /> <span className="max-sm:hidden">{t("Feedback", "राय दें")}</span>
      </button>
    </div>
  );
}
