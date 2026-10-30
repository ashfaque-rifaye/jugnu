// "Play the term": a floating player that replays one term of the demo block on this screen —
// spot checks, voice notes, peer visits, day-14 calls, the next assessment — while the rings,
// map, tasks and activity update like they would in a real block. Labelled as playback, never saved.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, ChevronUp, Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getPasscode, useStatus } from "../lib/api";
import { buildTerm, type DemoBeat } from "../lib/demo";
import { markJourney } from "../lib/journey";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";
import { loopCounts } from "../lib/story";
import { SPRING } from "./kit";
import { cx } from "./ui";

interface Run {
  beats: DemoBeat[];
  beat: number;
  phase: "intro" | "emit" | "outro" | "done";
  emitted: number;
  paused: boolean;
}

interface DemoCtx {
  start: () => void;
  stop: () => void;
  active: boolean;
  available: boolean;
}
const Ctx = createContext<DemoCtx>({ start: () => {}, stop: () => {}, active: false, available: false });
export const useDemo = () => useContext(Ctx);

const PLAY_AFTER_PASSCODE = "jugnu-play-after-passcode";
const INTRO_MS = 2200;
const TICK_MS = 340;
const OUTRO_MS = 1500;

export function DemoProvider({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const { state, demoEvents, addDemoEvents, clearDemo, runTrack } = usePipeline();
  const [run, setRun] = useState<Run | null>(null);
  const [want, setWant] = useState(false);
  const available = !!state.block.truth && state.recs.length > 0;

  const status = useStatus();
  const start = useCallback(() => {
    clearDemo();
    setRun(null);
    nav("/today");
    // The passcode prompt reloads the page once it is accepted: remember to play after that.
    if (status.passcode && !getPasscode()) {
      try {
        sessionStorage.setItem(PLAY_AFTER_PASSCODE, "1");
      } catch {
        /* private mode */
      }
      return;
    }
    setWant(true);
  }, [clearDemo, nav, status.passcode]);
  useEffect(() => {
    if (!status.checked || (status.passcode && !getPasscode())) return;
    try {
      if (sessionStorage.getItem(PLAY_AFTER_PASSCODE) !== "1") return;
      sessionStorage.removeItem(PLAY_AFTER_PASSCODE);
    } catch {
      return;
    }
    setWant(true);
  }, [status.checked, status.passcode]);
  const stop = useCallback(() => {
    clearDemo();
    setRun(null);
    setWant(false);
  }, [clearDemo]);

  // Build the script once the previous playback has been cleared from the state.
  useEffect(() => {
    if (!want || demoEvents.length) return;
    const beats = buildTerm(state);
    setWant(false);
    if (beats) setRun({ beats, beat: 0, phase: "intro", emitted: 0, paused: false });
  }, [want, demoEvents.length, state]);

  // The clock.
  useEffect(() => {
    if (!run || run.paused || run.phase === "done") return;
    const beat = run.beats[run.beat];
    let ms = TICK_MS;
    let next: () => void;
    if (run.phase === "intro") {
      ms = INTRO_MS;
      next = () => setRun((r) => r && { ...r, phase: beat.events.length ? "emit" : "outro" });
    } else if (run.phase === "emit") {
      const chunk = Math.max(1, Math.ceil(beat.events.length / 12));
      next = () => {
        addDemoEvents(beat.events.slice(run.emitted, run.emitted + chunk));
        setRun((r) => r && { ...r, emitted: r.emitted + chunk, phase: r.emitted + chunk >= beat.events.length ? "outro" : "emit" });
      };
    } else {
      ms = OUTRO_MS;
      next = () => {
        if (beat.track) runTrack();
        const last = run.beat === run.beats.length - 1;
        if (last) markJourney("demo");
        setRun((r) => r && (last ? { ...r, phase: "done" } : { ...r, beat: r.beat + 1, phase: "intro", emitted: 0 }));
      };
    }
    const id = window.setTimeout(next, ms);
    return () => window.clearTimeout(id);
  }, [run, addDemoEvents, runTrack]);

  const skip = () =>
    setRun((r) => {
      if (!r || r.phase === "done") return r;
      const beat = r.beats[r.beat];
      if (r.emitted < beat.events.length) addDemoEvents(beat.events.slice(r.emitted));
      return { ...r, emitted: beat.events.length, phase: "outro", paused: false };
    });

  return (
    <Ctx.Provider value={{ start, stop, active: !!run, available }}>
      {children}
      <AnimatePresence>
        {run && (
          <Player
            run={run}
            onPause={() => setRun((r) => r && { ...r, paused: !r.paused })}
            onSkip={skip}
            onReplay={start}
            onClose={stop}
            onResults={() => nav("/results")}
          />
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

function Player({ run, onPause, onSkip, onReplay, onClose, onResults }: { run: Run; onPause: () => void; onSkip: () => void; onReplay: () => void; onClose: () => void; onResults: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const { state, followUps } = usePipeline();
  const beat = run.beats[run.beat];
  const done = run.phase === "done";
  const c = loopCounts(state, followUps);
  const total = run.beats.length;
  const progress = useMemo(() => {
    const within = beat.events.length ? run.emitted / beat.events.length : run.phase === "intro" ? 0.3 : 1;
    return done ? 1 : (run.beat + Math.min(1, within)) / total;
  }, [beat, run, total, done]);
  const [small, setSmall] = useState(false);
  const { pathname } = useLocation();
  // once the term is over and Results is open, step out of the way
  useEffect(() => {
    if (done && pathname === "/results") setSmall(true);
  }, [done, pathname]);

  if (small)
    return (
      <motion.div
        layout
        className="no-print fixed bottom-[calc(92px+env(safe-area-inset-bottom))] left-1/2 z-[75] -translate-x-1/2 lg:bottom-6 lg:left-[calc(50%+134px)]"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={SPRING}
      >
        <div className="sheet flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-2">
          <span className="grid h-8 w-8 place-items-center rounded-full text-[#0b1308]" style={{ background: "var(--grad-flat)" }}>
            {done ? <Check size={15} strokeWidth={3} /> : <span className="font-display text-xs font-bold">{`${run.beat + 1}/${total}`}</span>}
          </span>
          <span className={cx("whitespace-nowrap text-[13px] font-semibold", lang === "hi" && "font-deva")}>
            {done ? t("Playback · term complete", "प्लेबैक · सत्र पूरा") : `${t(beat.day[0], beat.day[1])} · ${t(beat.title[0], beat.title[1])}`}
          </span>
          {done && (
            <button className="rounded-full p-1.5 text-[var(--color-ink-2)] hover:bg-[var(--hover)]" onClick={onReplay} aria-label={t("Play again", "फिर चलाएँ")}>
              <RotateCcw size={14} />
            </button>
          )}
          <button className="rounded-full p-1.5 text-[var(--color-ink-2)] hover:bg-[var(--hover)]" onClick={() => setSmall(false)} aria-label={t("Show the player", "प्लेयर दिखाएँ")}>
            <ChevronUp size={15} />
          </button>
          <button className="rounded-full p-1.5 text-[var(--color-ink-3)] hover:bg-[var(--hover)]" onClick={onClose} aria-label={t("Stop and clear the playback", "प्लेबैक रोकें व हटाएँ")}>
            <X size={14} />
          </button>
        </div>
      </motion.div>
    );

  return (
    <motion.div
      layout
      className="no-print fixed inset-x-3 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[75] mx-auto max-w-[620px] lg:bottom-6 lg:left-[calc(268px+1.5rem)] lg:right-6"
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.97 }}
      transition={SPRING}
    >
      <div className="sheet overflow-hidden rounded-[1.8rem]">
        <div className="flex items-start gap-3 p-4 pb-3">
          <span className="relative mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--grad-flat)" }}>
            {done ? <Check size={20} strokeWidth={3} className="text-[#0b1308]" /> : <span className="font-display text-xs font-bold leading-none text-[#0b1308]">{`${run.beat + 1}/${total}`}</span>}
          </span>
          <div className={cx("min-w-0 flex-1", lang === "hi" && "font-deva")}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
              <span className="inline-flex items-center gap-1.5 text-[var(--tone-teal)]">
                <span className="live-dot !h-1.5 !w-1.5" /> {t("Playback · simulated term", "प्लेबैक · सिम्युलेटेड सत्र")}
              </span>
              <span>·</span>
              <span>{done ? t("Term complete", "सत्र पूरा") : t(beat.day[0], beat.day[1])}</span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={done ? "done" : run.beat} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                <div className="mt-0.5 text-[16px] font-semibold leading-snug tracking-[-0.01em]">
                  {done ? t(`${c.working} of ${c.calls} teachers say it is working`, `${c.calls} में से ${c.working} शिक्षक कहते हैं असर हो रहा है`) : t(beat.title[0], beat.title[1])}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[var(--color-ink-2)]">
                  {done
                    ? t("Results now compares wave 1 with wave 2, practice by practice.", "‘नतीजे’ अब हर तरीके के लिए पहली और दूसरी लहर की तुलना दिखाता है।")
                    : t(beat.sub[0], beat.sub[1])}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex">
            <button className="rounded-full p-1.5 text-[var(--color-ink-3)] hover:bg-[var(--hover)]" onClick={() => setSmall(true)} aria-label={t("Make smaller", "छोटा करें")}>
              <ChevronDown size={16} />
            </button>
            <button className="rounded-full p-1.5 text-[var(--color-ink-3)] hover:bg-[var(--hover)]" onClick={onClose} aria-label={t("Stop and clear the playback", "प्लेबैक रोकें व हटाएँ")}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 pb-4">
          <div className="flex flex-1 gap-1" aria-hidden>
            {run.beats.map((b, i) => (
              <div key={b.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ring-track)]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "var(--grad-flat)" }}
                  initial={false}
                  animate={{ width: `${Math.max(0, Math.min(1, progress * total - i)) * 100}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                />
              </div>
            ))}
          </div>
          {done ? (
            <>
              <button className="btn btn-glass btn-icon !p-2" onClick={onReplay} aria-label={t("Play again", "फिर चलाएँ")}>
                <RotateCcw size={15} />
              </button>
              <button className="btn btn-primary !py-2" onClick={onResults}>
                {t("See the results", "नतीजे देखें")} <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-glass btn-icon !p-2" onClick={onPause} aria-label={run.paused ? t("Play", "चलाएँ") : t("Pause", "रोकें")}>
                {run.paused ? <Play size={15} /> : <Pause size={15} />}
              </button>
              <button className="btn btn-glass btn-icon !p-2" onClick={onSkip} aria-label={t("Next step", "अगला चरण")}>
                <SkipForward size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
