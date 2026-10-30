// How you come into Jugnu: not a form or a pop-up, but five doors in a filmstrip, one for each person
// in the block. Pointing at a door opens it onto that person's world and their real work today;
// choosing it, it fills the screen and the app is behind it. Skip goes straight in as a guest.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Eye, Footprints, Landmark, Mic, School, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { usePoll } from "../lib/api";
import { MEDIA } from "../lib/clips";
import { setWelcomed } from "../lib/journey";
import { usePrefs, useT } from "../lib/prefs";
import { useRole, type Role } from "../lib/role";
import { usePipeline } from "../lib/store";
import { useTasks } from "../lib/tasks";
import { LogoMark } from "./Logo";
import { cx } from "./ui";

type DoorId = "beo" | "crp" | "head" | "teacher" | "guest";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export function Threshold({ open, closable, onClose }: { open: boolean; closable?: boolean; onClose?: () => void }) {
  const t = useT();
  const nav = useNavigate();
  const { lang, setLang, lite } = usePrefs();
  const { state } = usePipeline();
  const [role, setRole] = useRole();
  const [pending] = usePoll<unknown[]>("/api/reviews?status=pending", 30000);
  const reviews = pending?.length ?? 0;
  const hi = lang === "hi" && "font-deva";

  const clusters = useMemo(() => {
    const m = new Map<number, { name: string; crp: string; n: number }>();
    for (const s of state.block.schools) m.set(s.cluster, { name: s.clusterName, crp: s.crp, n: (m.get(s.cluster)?.n ?? 0) + 1 });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [state.block]);
  const schools = useMemo(() => [...state.block.schools].sort((a, b) => a.name.localeCompare(b.name)), [state.block]);
  const [cluster, setCluster] = useState(role?.kind === "crp" ? role.cluster : (clusters[3]?.[0] ?? clusters[0]?.[0] ?? 0));
  const firstHelped = state.recs.find((r) => r.wave === 1)?.schoolId ?? schools[0]?.id ?? "";
  const [schoolId, setSchoolId] = useState(role?.kind === "head" ? role.schoolId : firstHelped);
  const school = schools.find((s) => s.id === schoolId) ?? schools[0];

  const beoTasks = useTasks(state, { kind: "beo" }, reviews);
  const crpTasks = useTasks(state, { kind: "crp", cluster }, reviews);
  const headRole: Role = { kind: "head", schoolId: school?.id ?? "", cluster: school?.cluster ?? 0 };
  const headTasks = useTasks(state, headRole, 0);

  const [active, setActive] = useState<DoorId>(role && role.kind !== "guest" ? role.kind : "beo");
  const [entering, setEntering] = useState<DoorId | null>(null);
  useEffect(() => {
    if (open) setEntering(null);
  }, [open]);

  const go = useCallback(
    (id: DoorId) => {
      if (entering) return;
      setEntering(id);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(
        () => {
          setWelcomed(true);
          if (id === "teacher") {
            window.location.assign("/talk");
            return;
          }
          setRole(id === "beo" ? { kind: "beo" } : id === "crp" ? { kind: "crp", cluster } : id === "head" ? { kind: "head", schoolId: school?.id ?? "", cluster: school?.cluster ?? 0 } : { kind: "guest" });
          nav("/today");
          onClose?.();
        },
        reduced ? 0 : 720,
      );
    },
    [entering, cluster, school, setRole, nav, onClose],
  );

  const doors: { id: DoorId; icon: LucideIcon; video: string; poster: string; who: string; line: string; facts?: string[]; control?: ReactNode; cta: string }[] = [
    {
      id: "beo",
      icon: Landmark,
      video: MEDIA.doorOfficer,
      poster: MEDIA.doorOfficerPoster,
      who: t("Block Education Officer", "ब्लॉक शिक्षा अधिकारी"),
      line: t("The whole block on one page: what to act on, who owns it, what is stuck and whether it worked.", "पूरा ब्लॉक एक पेज पर: किस पर काम करना है, किसके ज़िम्मे है, क्या अटका है और असर हुआ या नहीं।"),
      facts: beoTasks.slice(0, 3).map((x) => t(x.title[0], x.title[1])),
      cta: t("Open the block", "ब्लॉक खोलें"),
    },
    {
      id: "crp",
      icon: Footprints,
      video: MEDIA.doorCoordinator,
      poster: MEDIA.doorCoordinatorPoster,
      who: t("Cluster coordinator (CRP)", "क्लस्टर समन्वयक (CRP)"),
      line: t("Your week, in the order that matters: school visits, teacher conversations and follow-ups.", "आपका हफ़्ता, सही क्रम में: स्कूल के दौरे, शिक्षकों से बातचीत और फ़ॉलो-अप।"),
      facts: crpTasks.slice(0, 2).map((x) => t(x.title[0], x.title[1])),
      control: (
        <label className="block">
          <span className={cx("mb-1 block text-xs font-medium text-white/70", hi)}>{t("Your cluster", "आपका क्लस्टर")}</span>
          <select className="door-select" value={cluster} onChange={(e) => setCluster(Number(e.target.value))} onClick={(e) => e.stopPropagation()}>
            {clusters.map(([i, c]) => (
              <option key={i} value={i}>
                {c.name} · {c.crp} · {c.n} {t("schools", "स्कूल")}
              </option>
            ))}
          </select>
        </label>
      ),
      cta: t("Open my cluster", "मेरा क्लस्टर खोलें"),
    },
    {
      id: "head",
      icon: School,
      video: MEDIA.doorHead,
      poster: MEDIA.doorHeadPoster,
      who: t("School head or correspondent", "प्रधानाध्यापक या संचालक"),
      line: t("Your school: who answers for which class, this week's short report, and the work to mark as done.", "आपका स्कूल: कौन-सी कक्षा किसके ज़िम्मे, इस हफ़्ते की छोटी रिपोर्ट, और पूरे हुए काम।"),
      facts: headTasks.slice(0, 2).map((x) => t(x.title[0], x.title[1])),
      control: (
        <label className="block">
          <span className={cx("mb-1 block text-xs font-medium text-white/70", hi)}>{t("Your school", "आपका स्कूल")}</span>
          <select className="door-select" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} onClick={(e) => e.stopPropagation()}>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.clusterName}
              </option>
            ))}
          </select>
        </label>
      ),
      cta: t("Open my school", "मेरा स्कूल खोलें"),
    },
    {
      id: "teacher",
      icon: Mic,
      video: MEDIA.doorTeacher,
      poster: MEDIA.doorTeacherPoster,
      who: t("Teacher", "शिक्षक"),
      line: t("A 12-minute conversation in Hindi about what happens in your classroom. No app and no login: a link or a phone call.", "आपकी कक्षा में क्या होता है, इस पर हिंदी में 12 मिनट की बातचीत। न ऐप, न लॉगिन: बस एक लिंक या फ़ोन कॉल।"),
      cta: t("Start the conversation", "बातचीत शुरू करें"),
    },
    {
      id: "guest",
      icon: Eye,
      video: MEDIA.doorClassroom,
      poster: MEDIA.doorClassroomPoster,
      who: t("Guest", "मेहमान"),
      line: t("Look around everything in the demo block, the way an officer sees it. Nothing to set up.", "डेमो ब्लॉक में सब कुछ देखें, जैसे अधिकारी देखते हैं। कुछ सेट नहीं करना।"),
      cta: t("Look around", "देखना शुरू करें"),
    },
  ];
  const order = doors.map((d) => d.id);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closable) onClose?.();
      if ((e.target as HTMLElement).tagName === "SELECT") return;
      const i = order.indexOf(active);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") (e.preventDefault(), setActive(order[(i + 1) % order.length]));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") (e.preventDefault(), setActive(order[(i + order.length - 1) % order.length]));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="on-dark no-print fixed inset-0 z-[90] flex flex-col bg-[#05070b] text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          role="dialog"
          aria-modal
          aria-label={t("Who is opening Jugnu?", "जुगनू कौन खोल रहा है?")}
        >
          <header className={cx("flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 px-4 pb-3 pt-3 transition-opacity duration-300 md:px-6 md:pt-5", entering && "opacity-0")}>
            <span className="flex items-center gap-2">
              <LogoMark size={32} />
              <span className="font-display text-lg font-bold">Jugnu</span>
            </span>
            <h2 className={cx("order-3 w-full text-[1.5rem] font-light leading-tight tracking-[-0.03em] md:order-none md:w-auto md:flex-1 md:text-[1.9rem]", hi)}>{t("Who is opening Jugnu today?", "आज जुगनू कौन खोल रहा है?")}</h2>
            <div className="ml-auto flex items-center gap-1.5">
              <button className="door-link font-deva" onClick={() => setLang(lang === "hi" ? "en" : "hi")}>
                {lang === "hi" ? "English" : "हिंदी"}
              </button>
              <button className={cx("door-link", hi)} onClick={() => go("guest")}>
                {t("Skip", "छोड़ें")}
              </button>
              {closable && (
                <button className="door-link !px-2.5" onClick={onClose} aria-label={t("Close", "बंद करें")}>
                  <X size={16} />
                </button>
              )}
            </div>
          </header>

          <div className={cx("flex min-h-0 flex-1 flex-col gap-1.5 px-2 pb-2 transition-[padding,gap] duration-500 lg:flex-row md:px-3 md:pb-3", entering && "!gap-0 !p-0")} onMouseLeave={() => undefined}>
            {doors.map((d, i) => (
              <Door
                key={d.id}
                index={i + 1}
                door={d}
                active={active === d.id}
                entering={entering}
                lite={lite}
                hi={!!hi}
                onPoint={() => !entering && setActive(d.id)}
                onEnter={() => go(d.id)}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Door({
  door,
  index,
  active,
  entering,
  lite,
  hi,
  onPoint,
  onEnter,
}: {
  door: { id: DoorId; icon: LucideIcon; video: string; poster: string; who: string; line: string; facts?: string[]; control?: ReactNode; cta: string };
  index: number;
  active: boolean;
  entering: DoorId | null;
  lite: boolean;
  hi: boolean;
  onPoint: () => void;
  onEnter: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const chosen = entering === door.id;
  const gone = entering && !chosen;
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (active || chosen) void v.play().catch(() => {});
    else v.pause();
  }, [active, chosen]);
  const Icon = door.icon;
  const open = active || chosen;
  return (
    <div
      className={cx("door group relative isolate min-h-[60px] min-w-0 cursor-pointer overflow-hidden", open && "door-open")}
      style={{ flexGrow: gone ? 0 : chosen ? 1 : active ? 4.2 : 1, flexBasis: 0, opacity: gone ? 0 : 1, transition: `flex-grow 0.75s ${EASE}, opacity 0.4s ease, border-radius 0.5s ease, min-height 0.5s ease`, minHeight: gone ? 0 : undefined, borderRadius: chosen ? 0 : undefined }}
      onMouseEnter={onPoint}
      onFocus={onPoint}
      onClick={() => (active ? onEnter() : onPoint())}
    >
      {lite ? (
        <img src={door.poster} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover" />
      ) : (
        <video ref={video} src={door.video} poster={door.poster} muted loop playsInline preload={active ? "auto" : "metadata"} aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover" />
      )}
      <span className={cx("absolute inset-0 -z-10 transition-opacity duration-500", open ? "door-shade-open" : "door-shade")} aria-hidden />

      {/* closed: the door's name, read up the strip on a computer */}
      <button
        className={cx("absolute inset-0 flex items-center gap-3 px-4 text-left transition-opacity duration-300 lg:flex-col lg:items-center lg:justify-end lg:px-0 lg:pb-6", open ? "pointer-events-none opacity-0" : "opacity-100")}
        tabIndex={open ? -1 : 0}
        aria-label={door.who}
      >
        <span className="door-num">{String(index).padStart(2, "0")}</span>
        <span className={cx("door-title lg:[writing-mode:vertical-rl] lg:rotate-180", hi && "font-deva")}>{door.who}</span>
      </button>

      {/* open: their world and their work today */}
      <div className={cx("absolute inset-x-0 bottom-0 p-4 transition-all duration-500 md:p-7", open && !chosen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")} aria-hidden={!open}>
        <div className="max-w-[520px]">
          <div className="flex items-center gap-2 text-white/75">
            <Icon size={16} aria-hidden /> <span className="door-num">{String(index).padStart(2, "0")}</span>
          </div>
          <h3 className={cx("mt-1.5 text-[1.55rem] font-semibold leading-tight tracking-[-0.02em] md:text-[2rem]", hi && "font-deva")}>{door.who}</h3>
          <p className={cx("mt-2 text-[15px] leading-relaxed text-white/85", hi && "font-deva")}>{door.line}</p>
          {!!door.facts?.length && (
            <ul className="mt-3 hidden space-y-1 md:block">
              {door.facts.map((f) => (
                <li key={f} className={cx("flex items-baseline gap-2 text-[13.5px] text-white/75", hi && "font-deva")}>
                  <span className="h-1 w-1 shrink-0 translate-y-[-2px] rounded-full bg-[var(--st-bright-fill)]" /> <span className="truncate">{f}</span>
                </li>
              ))}
            </ul>
          )}
          {door.control && <div className="mt-3 max-w-sm" onClick={(e) => e.stopPropagation()}>{door.control}</div>}
          <button
            className={cx("door-cta mt-4", hi && "font-deva")}
            tabIndex={open ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              onEnter();
            }}
          >
            {door.cta} <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
