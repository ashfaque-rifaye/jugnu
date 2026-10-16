// The guided tour: a spotlight moves across the real screens, one short sentence at a time.
// Steps point at elements marked data-tour="…"; a step may first open another page.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cx } from "../components/ui";
import { markJourney } from "./journey";
import { usePrefs, useT } from "./prefs";

export interface TourStep {
  /** data-tour value of the element to light up (the first visible one) */
  target?: string;
  /** open this page first */
  route?: string;
  title: [string, string];
  body: [string, string];
}

interface TourCtx {
  start: (steps: TourStep[]) => void;
  active: boolean;
}
const Ctx = createContext<TourCtx>({ start: () => {}, active: false });
export const useTour = () => useContext(Ctx);

export function TourProvider({ children }: { children: ReactNode }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [i, setI] = useState(0);
  const start = useCallback((s: TourStep[]) => {
    setI(0);
    setSteps(s);
  }, []);
  const end = useCallback((finished: boolean) => {
    if (finished) markJourney("tour");
    setSteps(null);
  }, []);
  return (
    <Ctx.Provider value={{ start, active: !!steps }}>
      {children}
      <AnimatePresence>{steps && <Overlay key="tour" steps={steps} i={i} setI={setI} onEnd={end} />}</AnimatePresence>
    </Ctx.Provider>
  );
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
};

function Overlay({ steps, i, setI, onEnd }: { steps: TourStep[]; i: number; setI: (n: number) => void; onEnd: (finished: boolean) => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const step = steps[i];
  const [box, setBox] = useState<Box | null>(null);
  const [vw, setVw] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const el = useRef<Element | null>(null);
  const last = i === steps.length - 1;

  // open the step's page, then find its element (pages load lazily, so keep looking for a moment)
  useEffect(() => {
    el.current = null;
    setBox(null);
    if (step.route && pathname !== step.route.split("?")[0]) {
      nav(step.route);
      return;
    }
    if (!step.target) return;
    let tries = 0;
    const id = window.setInterval(() => {
      const found = [...document.querySelectorAll(`[data-tour="${step.target}"]`)].find(visible);
      if (found) {
        window.clearInterval(id);
        el.current = found;
        const r = found.getBoundingClientRect();
        if (r.top < 70 || r.bottom > window.innerHeight - 90) found.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? "start" : "center", behavior: "smooth" });
      } else if (++tries > 40) window.clearInterval(id);
    }, 80);
    return () => window.clearInterval(id);
  }, [step, pathname, nav]);

  // follow the element while the page scrolls or resizes
  useLayoutEffect(() => {
    let raf = 0;
    const loop = () => {
      if (el.current) {
        const r = el.current.getBoundingClientRect();
        setBox((b) => (b && Math.abs(b.x - r.left) < 0.5 && Math.abs(b.y - r.top) < 0.5 && Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5 ? b : { x: r.left, y: r.top, w: r.width, h: r.height }));
      }
      setVw((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnd(false);
      if (e.key === "ArrowRight") (last ? onEnd(true) : setI(i + 1));
      if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [i, last, onEnd, setI]);

  const pad = 8;
  const hole = box ? { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: Math.min(box.h + pad * 2, vw.h - 24) } : null;
  // the card goes below the element if there is room, otherwise above; centred when nothing is lit
  const cardW = Math.min(360, vw.w - 24);
  const below = hole ? hole.y + hole.h + 230 < vw.h : true;
  const cardX = hole ? Math.max(12, Math.min(vw.w - cardW - 12, hole.x + hole.w / 2 - cardW / 2)) : (vw.w - cardW) / 2;
  const cardY = hole ? (below ? hole.y + hole.h + 14 : Math.max(12, hole.y - 14 - 210)) : vw.h / 2 - 120;
  const fitsBeside = hole && hole.h > vw.h * 0.55;

  return (
    <motion.div className="no-print fixed inset-0 z-[90]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      {/* blockers around the lit element (clicks on it still work) */}
      {hole ? (
        <>
          <div className="absolute left-0 right-0 top-0" style={{ height: Math.max(0, hole.y) }} />
          <div className="absolute left-0 right-0" style={{ top: hole.y + hole.h, bottom: 0 }} />
          <div className="absolute left-0" style={{ top: hole.y, height: hole.h, width: Math.max(0, hole.x) }} />
          <div className="absolute right-0" style={{ top: hole.y, height: hole.h, left: hole.x + hole.w }} />
        </>
      ) : (
        <div className="absolute inset-0 bg-[rgb(2_4_8/0.62)] backdrop-blur-[2px]" />
      )}
      {hole && (
        <motion.div
          className="pointer-events-none absolute rounded-[1.6rem]"
          initial={false}
          animate={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          style={{ boxShadow: "0 0 0 9999px rgb(2 4 8 / 0.62), 0 0 0 2px rgb(253 224 71 / 0.95), 0 0 40px 6px rgb(250 204 21 / 0.35)" }}
        />
      )}
      <motion.div
        key={i}
        className={cx("sheet absolute rounded-[1.6rem] p-4", lang === "hi" && "font-deva")}
        style={{ width: cardW, left: fitsBeside && hole && hole.x + hole.w + cardW + 24 < vw.w ? hole.x + hole.w + 16 : cardX, top: fitsBeside ? Math.max(16, Math.min(vw.h - 260, hole!.y + 24)) : cardY }}
        initial={{ opacity: 0, y: below ? 10 : -10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        role="dialog"
        aria-label={t(step.title[0], step.title[1])}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="chip !py-0.5 text-[11px]">
            <Sparkles size={11} className="text-[var(--st-bright)]" /> {t(`Guide · ${i + 1} of ${steps.length}`, `गाइड · ${steps.length} में से ${i + 1}`)}
          </span>
          <button className="rounded-full p-1 text-[var(--color-ink-3)] hover:bg-[var(--hover)]" onClick={() => onEnd(false)} aria-label={t("Close the guide", "गाइड बंद करें")}>
            <X size={15} />
          </button>
        </div>
        <div className="text-[17px] font-semibold leading-snug tracking-[-0.01em]">{t(step.title[0], step.title[1])}</div>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-ink-2)]">{t(step.body[0], step.body[1])}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden>
            {steps.map((_, k) => (
              <span key={k} className="h-1.5 rounded-full transition-all" style={{ width: k === i ? 18 : 6, background: k <= i ? "var(--st-bright)" : "var(--ring-track)" }} />
            ))}
          </div>
          <div className="flex gap-1.5">
            {i > 0 && (
              <button className="btn btn-glass btn-icon !p-2" onClick={() => setI(i - 1)} aria-label={t("Back", "पीछे")}>
                <ArrowLeft size={15} />
              </button>
            )}
            <button className="btn btn-primary !py-2" onClick={() => (last ? onEnd(true) : setI(i + 1))}>
              {last ? t("Done", "हो गया") : t("Next", "आगे")} {!last && <ArrowRight size={15} />}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
