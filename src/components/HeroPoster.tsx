// The front page as a poster: the name, huge, in the script of the people it is for, with one teacher
// standing in front of it. The strip along the bottom is the idea in motion: real schools, real distances.
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Clapperboard, Play } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { PRACTICES } from "../engine/practices";
import { MEDIA } from "../lib/clips";
import { EASE, WordReveal } from "../lib/motion";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";
import { cx } from "./ui";

const SOFT = { stiffness: 60, damping: 18, mass: 0.6 };

export function HeroPoster({ onOpen, onPlay, onFilm, canPlay }: { onOpen: () => void; onPlay: () => void; onFilm: () => void; canPlay: boolean }) {
  const t = useT();
  const { lang, lite } = usePrefs();
  const { state } = usePipeline();
  const hi = lang === "hi" && "font-deva";
  const reduce = useReducedMotion();
  const still = reduce || lite;
  const root = useRef<HTMLElement>(null);

  // The name and the teacher move at different speeds, so she stands clear of it.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, SOFT);
  const sy = useSpring(my, SOFT);
  const { scrollYProgress } = useScroll({ target: root, offset: ["start start", "end start"] });
  const wordScroll = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const figureScroll = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const wordX = useTransform(sx, (v) => v * -14);
  const figureX = useTransform(sx, (v) => v * 18);
  const figureY = useTransform([sy, figureScroll], ([a, b]: number[]) => a * 8 + b);

  useEffect(() => {
    if (still) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      mx.set(e.clientX / innerWidth - 0.5);
      my.set(e.clientY / innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [still, mx, my]);

  const strip = useMemo(() => {
    const byId = new Map(state.block.schools.map((s) => [s.id, s]));
    const facts = [t("Jugnu means firefly", "जुगनू यानी firefly"), t("1,365 real government schools in Damoh", "दमोह के 1,365 असली सरकारी स्कूल"), t("Works on 2G: a link or an ordinary call", "2G पर चले: एक लिंक या साधारण कॉल"), t("No data about children", "बच्चों का कोई डेटा नहीं"), t("A person approves everything before it is sent", "भेजने से पहले हर चीज़ इंसान मंज़ूर करे")];
    const moves = [...state.recs]
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .filter((_, i) => i % 5 === 0)
      .slice(0, 8)
      .map((r) => {
        const a = byId.get(r.demonstratorId);
        const b = byId.get(r.schoolId);
        if (!a || !b) return null;
        const name = (s: typeof a) => (lang === "hi" && s.nameHi ? s.nameHi : s.name);
        return `${name(a)} → ${name(b)} · ${r.distanceKm.toFixed(1)} ${t("km", "किमी")} · ${lang === "hi" ? PRACTICES[r.practice].labelHi : PRACTICES[r.practice].label}`;
      })
      .filter((x): x is string => !!x);
    const mixed: string[] = [];
    for (let i = 0; i < Math.max(facts.length, moves.length); i++) {
      if (facts[i]) mixed.push(facts[i]);
      if (moves[i]) mixed.push(moves[i]);
    }
    return mixed;
  }, [state, lang, t]);

  return (
    <section ref={root} className="hero-poster">
      <div className="hero-sun" aria-hidden />
      <motion.div
        aria-hidden
        className="hero-word"
        style={still ? undefined : { x: wordX, y: wordScroll }}
        initial={still ? false : { opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: EASE }}
      >
        जुगनू
      </motion.div>

      <div className="hero-body">
        <motion.img
          src={MEDIA.heroTeacher}
          alt=""
          aria-hidden
          decoding="async"
          fetchPriority="high"
          className="hero-figure"
          style={still ? undefined : { x: figureX, y: figureY }}
          initial={still ? false : { opacity: 0, translateY: 70 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ duration: 1.3, delay: 0.25, ease: EASE }}
        />
        <div className="hero-copy">
          <h1 className={cx("hero-title", hi)}>
            <WordReveal text={t("Somewhere in your block, a teacher has", "आपके ब्लॉक में कहीं, कोई शिक्षक")} delay={0.45} stagger={0.05} />{" "}
            <span className={cx("hero-accent", hi && "hero-accent-hi")}>
              {t("already cracked it.", "यह कर दिखा चुका है।")}
              <svg viewBox="0 0 300 14" preserveAspectRatio="none" aria-hidden>
                <motion.path d="M3 9 C 60 3, 120 12, 170 7 S 260 4, 297 8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 1.3, ease: EASE }} />
              </svg>
            </span>
          </h1>
          <motion.p initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.0, ease: EASE }} className={cx("hero-lede", hi)}>
            {t(
              "Jugnu finds the teachers whose children learn better than anyone expected, asks them exactly what they do, and helps the school next door do it too. Then it checks that it worked.",
              "जुगनू उन शिक्षकों को ढूँढता है जिनके बच्चे उम्मीद से बेहतर सीखते हैं, उनसे पूछता है कि वे ठीक-ठीक क्या करते हैं, और पास के स्कूल को भी वही करने में मदद करता है। फिर जाँचता है कि असर हुआ।",
            )}
          </motion.p>
          <motion.div initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.15, ease: EASE }} className={cx("hero-actions", hi)}>
            <button className="hero-cta" onClick={onOpen}>
              {t("Open Jugnu", "जुगनू खोलें")} <ArrowRight size={18} />
            </button>
            {canPlay && (
              <button className="hero-link" onClick={onPlay}>
                <Play size={15} /> {t("Watch a whole term · 40 s", "पूरा सत्र देखें · 40 से.")}
              </button>
            )}
            <button className="hero-link" onClick={onFilm}>
              <Clapperboard size={15} /> {t("2-minute film", "2 मिनट की फ़िल्म")}
            </button>
          </motion.div>
        </div>
      </div>

      <div className={cx("hero-strip", hi)}>
        <div className={cx("hero-strip-run", still && "hero-strip-still")}>
          {[0, 1].map((n) => (
            <span key={n} aria-hidden={n === 1} className="hero-strip-set">
              {strip.map((x) => (
                <span key={x} className="hero-strip-item">{x}</span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
