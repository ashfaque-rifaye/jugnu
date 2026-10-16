// Jugnu Motion: one set of motion rules for the whole app, after the references —
// content rises into place as it scrolls into view (in a cascade), numbers count up, headlines
// arrive word by word, glass catches the light under the pointer, floating cards tilt.
// Everything respects "reduce motion" and low-data mode.
import { animate, motion, useInView, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cx } from "../components/ui";

/** Expo-out: fast start, long soft landing (the curve used everywhere). */
export const EASE = [0.16, 1, 0.3, 1] as const;

const quiet = () => typeof window !== "undefined" && (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.lite === "1");

/**
 * Cards (and anything marked data-reveal) inside `root` rise into place when they first scroll
 * into view; those that appear together arrive in a short cascade. New content (another page,
 * a lazy section) is picked up automatically.
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const box = root.current;
    if (!box || quiet()) return;
    // once it has landed, step aside so hover and press effects work as usual
    const done = (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      if (e.target !== el || (e as TransitionEvent).propertyName !== "opacity") return;
      el.dataset.rv = "done";
      el.removeEventListener("transitionend", done);
    };
    const io = new IntersectionObserver(
      (entries) => {
        const shown = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
        shown.forEach((e, i) => {
          const el = e.target as HTMLElement;
          el.style.setProperty("--rv-delay", `${Math.min(i, 8) * 70}ms`);
          el.addEventListener("transitionend", done);
          el.dataset.rv = "in";
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -4% 0px", threshold: 0 },
    );
    const scan = () =>
      box.querySelectorAll<HTMLElement>(".card, [data-reveal]").forEach((el) => {
        if (el.dataset.rv) return;
        el.dataset.rv = "wait";
        io.observe(el);
      });
    scan();
    let frame = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    mo.observe(box, { childList: true, subtree: true });
    // never leave anything hidden: whatever is still waiting after a moment simply appears
    const safety = window.setInterval(() => {
      box.querySelectorAll<HTMLElement>('[data-rv="wait"]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight && r.width > 0) el.dataset.rv = "in";
      });
    }, 1500);
    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(frame);
      window.clearInterval(safety);
    };
  }, [root]);
}

/** Glass catches the light where the pointer is (desktop only). */
export function usePointerSheen() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    let el: HTMLElement | null = null;
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      el = (e.target as Element | null)?.closest?.(".card, .sheen") as HTMLElement | null;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${x - r.left}px`);
        el.style.setProperty("--my", `${y - r.top}px`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
}

const fmt = (v: number, decimals: number) => (decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-IN"));

/** A number that counts up the first time it is seen, then glides to new values. */
export function CountUp({ value, decimals = 0, className, duration }: { value: number; decimals?: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -5% 0px" });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduce || quiet()) {
      el.textContent = fmt(value, decimals);
      shown.current = value;
      return;
    }
    const from = shown.current ?? 0;
    const c = animate(from, value, {
      duration: duration ?? (shown.current === null ? 1.3 : 0.7),
      ease: EASE,
      onUpdate: (v) => {
        el.textContent = fmt(v, decimals);
        shown.current = v;
      },
    });
    return () => c.stop();
  }, [value, decimals, inView, reduce, duration]);
  return (
    <span ref={ref} className={cx("tabular-nums", className)}>
      {fmt(reduce ? value : 0, decimals)}
    </span>
  );
}

/** Text with numbers in it ("6.4 km", "73/240", "+3.5 pts"): every number counts up. */
export function CountText({ children }: { children: ReactNode }) {
  if (typeof children === "number") return <CountUp value={children} decimals={Number.isInteger(children) ? 0 : 1} />;
  if (typeof children !== "string") return <>{children}</>;
  const parts = children.split(/(\d+(?:\.\d+)?)/);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <CountUp key={i} value={Number(p)} decimals={p.includes(".") ? p.split(".")[1].length : 0} /> : p))}
    </>
  );
}

/** A headline that arrives word by word, each word rising out of its own line. */
export function WordReveal({ text, className, delay = 0, stagger = 0.06, wordClassName }: { text: string; className?: string; delay?: number; stagger?: number; wordClassName?: string }) {
  const reduce = useReducedMotion();
  const words = text.split(" ").filter(Boolean);
  if (reduce) return <span className={className}>{text}</span>;
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
          <motion.span
            className={cx("inline-block will-change-transform", wordClassName)}
            initial={{ y: "108%", rotate: 4, opacity: 0 }}
            animate={{ y: "0%", rotate: 0, opacity: 1 }}
            transition={{ delay: delay + i * stagger, duration: 1, ease: EASE }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}

/** A floating card that leans toward the pointer, like a phone in the hand. */
export function Tilt({ children, className, max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const rx = useSpring(0, { stiffness: 160, damping: 16 });
  const ry = useSpring(0, { stiffness: 160, damping: 16 });
  const [fine] = useState(() => typeof window !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches);
  if (!fine) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 2 * max);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * max);
      }}
      onPointerLeave={() => (rx.set(0), ry.set(0))}
    >
      {children}
    </motion.div>
  );
}

/** True while the person is scrolling down the page (phones tuck the bars away). */
export function useScrollingDown(after = 90) {
  const [down, setDown] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setDown(y > after && y > last);
      last = y;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [after]);
  return down;
}
