// Notifications that drop in from the top like an iPhone banner: what someone just did in the
// block (live, from any device), and "what happens next" after your own action.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, X, type LucideIcon } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cx } from "../components/ui";
import { usePrefs } from "./prefs";

export interface ToastInput {
  title: string;
  body?: string;
  icon?: LucideIcon;
  tone?: string;
  /** an optional next step */
  to?: string;
  action?: string;
  /** small caption, e.g. "Live · Rekha's phone" */
  meta?: string;
  ms?: number;
}
interface Toast extends ToastInput {
  id: number;
}

const Ctx = createContext<(t: ToastInput) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, number>());
  const close = useCallback((id: number) => {
    setItems((cur) => cur.filter((x) => x.id !== id));
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);
  const push = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setItems((cur) => [...cur.slice(-2), { ...t, id }]);
      timers.current.set(
        id,
        window.setTimeout(() => close(id), t.ms ?? 5200),
      );
    },
    [close],
  );
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 top-2 z-[80] flex flex-col items-center gap-2 px-3 sm:top-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <ToastCard key={t.id} toast={t} onClose={() => close(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { lang } = usePrefs();
  const Icon = toast.icon ?? Bell;
  const tone = toast.tone ?? "var(--st-bright)";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -28, scale: 0.94, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -18, scale: 0.96, filter: "blur(4px)", transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="sheet pointer-events-auto flex w-full max-w-[440px] items-start gap-3 rounded-[1.4rem] p-3 pr-2.5"
      role="status"
    >
      <span className="icon-tile mt-0.5 h-9 w-9 rounded-[0.85rem]" style={{ "--tile": tone } as CSSProperties}>
        <Icon size={17} />
      </span>
      <div className={cx("min-w-0 flex-1", lang === "hi" && "font-deva")}>
        {toast.meta && <div className="text-xs font-medium text-[var(--color-ink-3)]">{toast.meta}</div>}
        <div className="text-[14px] font-semibold leading-snug">{toast.title}</div>
        {toast.body && <div className="mt-0.5 text-[13px] leading-snug text-[var(--color-ink-2)]">{toast.body}</div>}
        {toast.to && (
          <Link to={toast.to} onClick={onClose} className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: tone }}>
            {toast.action ?? "Open"} <ArrowRight size={13} />
          </Link>
        )}
      </div>
      <button className="rounded-full p-1 text-[var(--color-ink-3)] hover:bg-[var(--hover)]" onClick={onClose} aria-label="Close">
        <X size={14} />
      </button>
    </motion.div>
  );
}
