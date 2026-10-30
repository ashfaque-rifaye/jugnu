// The first minute in Jugnu, like setting up a new phone: what it does in three screens,
// who you are, then an offer of the guided tour. Shown once per device; replay from Guide.
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Compass, Eye, Landmark, Mic, Search, Share2, Users, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { MEDIA } from "../lib/clips";
import { usePrefs, useT } from "../lib/prefs";
import { useRole, type Role } from "../lib/role";
import { usePipeline } from "../lib/store";
import { loopCounts } from "../lib/story";
import { AIVideoLabel, SPRING } from "./kit";
import { LogoMark } from "./Logo";
import { cx } from "./ui";

type Slide = { key: string; video?: string; poster?: string; icon?: LucideIcon; tone: string; kicker: [string, string]; title: [string, string]; body: [string, string] };

/** mode "role": only the "who is using Jugnu?" step (switching role later). */
export function Welcome({ open, onDone, mode = "full" }: { open: boolean; onDone: (tour: boolean) => void; mode?: "full" | "role" }) {
  const t = useT();
  const { lang, setLang, lite } = usePrefs();
  const { state, followUps } = usePipeline();
  const [role, setRole] = useRole();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const c = loopCounts(state, followUps);
  const clusters = useMemo(() => {
    const m = new Map<number, { name: string; crp: string; n: number }>();
    for (const s of state.block.schools) m.set(s.cluster, { name: s.clusterName, crp: s.crp, n: (m.get(s.cluster)?.n ?? 0) + 1 });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [state.block]);
  const [cluster, setCluster] = useState(role?.kind === "crp" ? role.cluster : (clusters[3]?.[0] ?? 0));
  const [pick, setPick] = useState<Role["kind"] | null>(role?.kind ?? null);

  const slides: Slide[] = [
    {
      key: "hello",
      video: MEDIA.welcome,
      poster: MEDIA.welcomePoster,
      tone: "var(--st-bright)",
      kicker: ["Welcome", "स्वागत है"],
      title: ["Somewhere in your block, a teacher has already cracked it.", "आपके ब्लॉक में कहीं, किसी शिक्षक ने यह कर दिखाया है।"],
      body: [
        "Jugnu finds those teachers, learns exactly what they do, and helps the school next door do it too.",
        "जुगनू उन शिक्षकों को ढूँढता है, ठीक-ठीक सीखता है कि वे क्या करते हैं, और पास के स्कूल को भी वैसा करने में मदद करता है।",
      ],
    },
    {
      key: "find",
      video: MEDIA.map,
      icon: Search,
      tone: "var(--st-check-due)",
      kicker: ["1 · Schools", "1 · स्कूल"],
      title: [`${c.candidates} of ${c.schools} schools beat their context`, `${c.schools} में से ${c.candidates} स्कूल अपने हालात से आगे`],
      body: [
        "Every term Jugnu compares each school with what its context predicts. A 15-child spot check by the CRP makes sure a bright spot is real.",
        "हर सत्र जुगनू हर स्कूल की तुलना उसके हालात से अपेक्षित परिणाम से करता है। CRP की 15 बच्चों की जाँच पक्का करती है कि अच्छा स्कूल सच में अच्छा है।",
      ],
    },
    {
      key: "learn",
      video: MEDIA.call,
      icon: Mic,
      tone: "var(--tone-teal)",
      kicker: ["2 · Interviews & what works", "2 · बातचीत व क्या काम करता है"],
      title: ["A 12-minute voice call, in Hindi", "हिंदी में 12 मिनट की बातचीत"],
      body: [
        `The teacher describes her routines; Jugnu keeps only what bright spots do and ordinary schools don't — ${c.practices} practices so far.`,
        `शिक्षक अपने तरीके बताती हैं; जुगनू वही रखता है जो अच्छे स्कूल करते हैं और बाकी नहीं — अब तक ${c.practices} तरीके।`,
      ],
    },
    {
      key: "spread",
      video: MEDIA.spread,
      icon: Share2,
      tone: "var(--tone-lime)",
      kicker: ["3 · Support plan & results", "3 · मदद की योजना व नतीजे"],
      title: [`${c.support} schools learn from a teacher nearby`, `${c.support} स्कूल पास के शिक्षक से सीखते हैं`],
      body: [
        "One practice, a 60-second voice note in a peer's own words, a visit with the CRP — and a call on day 14: “Did you try it?”",
        "एक तरीका, साथी की आवाज़ में 60 सेकंड का संदेश, CRP के साथ दौरा — और 14वें दिन कॉल: “क्या आपने आज़माया?”",
      ],
    },
  ];
  const ROLE = slides.length;
  const READY = slides.length + 1;
  const total = slides.length + 2;

  const roleOnly = mode === "role";
  useEffect(() => {
    if (open) setI(roleOnly ? ROLE : 0);
    if (open) setPick(role?.kind ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roleOnly]);
  const go = (n: number) => {
    setDir(n > i ? 1 : -1);
    setI(Math.max(0, Math.min(total - 1, n)));
  };
  const chooseRole = () => {
    if (!pick) return;
    setRole(pick === "crp" ? { kind: "crp", cluster } : pick === "beo" ? { kind: "beo" } : { kind: "guest" });
    if (roleOnly) onDone(false);
    else go(READY);
  };
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && i < ROLE) go(i + 1);
      if (e.key === "ArrowLeft" && i > 0) go(i - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const onDrag = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 && i < ROLE) go(i + 1);
    if (info.offset.x > 60 && i > 0) go(i - 1);
  };
  const slide = slides[i];
  const hi = lang === "hi" && "font-deva";

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="no-print fixed inset-0 z-[85] grid place-items-end sm:place-items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="scrim absolute inset-0" onClick={() => roleOnly && onDone(false)} />
          <motion.div
            className="sheet relative flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-[2.2rem] sm:max-w-[880px] sm:rounded-[2.2rem] md:grid md:min-h-[540px] md:grid-cols-[1.05fr_1fr]"
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={SPRING}
            role="dialog"
            aria-modal
            aria-label={t("Welcome to Jugnu", "जुगनू में स्वागत है")}
          >
            {/* media */}
            <div className="on-dark relative h-[34dvh] min-h-[200px] shrink-0 overflow-hidden md:h-auto">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div key={slide?.key ?? (i === ROLE ? "role" : "ready")} className="absolute inset-0" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
                  {!lite ? (
                    <video
                      className="welcome-video"
                      src={slide?.video ?? (i === ROLE ? MEDIA.network : MEDIA.dawn)}
                      poster={slide ? slide.poster : i === ROLE ? MEDIA.networkPoster : MEDIA.dawnPoster}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="auto"
                      aria-hidden
                    />
                  ) : (
                    <div className="absolute inset-0" style={{ background: "radial-gradient(80% 70% at 70% 20%, rgb(250 204 21 / 0.35), transparent 60%), radial-gradient(70% 60% at 10% 90%, rgb(45 212 191 / 0.3), transparent 60%), #05070c" }} />
                  )}
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgb(4 6 10 / 0.1) 0%, rgb(4 6 10 / 0.25) 55%, rgb(4 6 10 / 0.75) 100%)" }} />
              <div className="absolute left-5 top-5 flex items-center gap-2">
                <LogoMark size={34} />
                <span className="font-display text-lg font-bold text-white">
                  Jugnu <span className="font-deva text-sm font-semibold text-white/60">जुगनू</span>
                </span>
              </div>
              {slide?.icon && (
                <span className="absolute bottom-5 left-5 grid h-14 w-14 place-items-center rounded-[1.1rem] border border-white/20 bg-white/10 text-white backdrop-blur-xl">
                  <slide.icon size={24} />
                </span>
              )}
              {i >= ROLE && (
                <div className="absolute inset-x-5 bottom-5 grid grid-cols-3 gap-2">
                  {[
                    [c.bright, t("bright spots", "अच्छे स्कूल")],
                    [c.practices, t("practices", "तरीके")],
                    [c.support, t("schools helped", "स्कूलों की मदद")],
                  ].map(([n, l]) => (
                    <div key={String(l)} className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-white backdrop-blur-xl">
                      <div className="font-display text-2xl font-bold">{n}</div>
                      <div className="text-xs text-white/70">{l}</div>
                    </div>
                  ))}
                </div>
              )}
              {!lite && <AIVideoLabel className="absolute right-4 top-5" />}
            </div>

            {/* words */}
            <div className="flex min-h-0 flex-1 flex-col p-6 md:p-8">
              <div className="mb-4 flex items-center justify-between">
                <div className={cx("flex gap-1.5", roleOnly && "invisible")} aria-hidden>
                  {Array.from({ length: total }, (_, k) => (
                    <span key={k} className="h-1.5 rounded-full transition-all duration-300" style={{ width: k === i ? 22 : 6, background: k <= i ? "var(--st-bright)" : "var(--ring-track)" }} />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button className="btn btn-ghost !px-2.5 !py-1 font-deva text-xs" onClick={() => setLang(lang === "hi" ? "en" : "hi")}>
                    {lang === "hi" ? "English" : "हिंदी"}
                  </button>
                  {i < ROLE && (
                    <button className="btn btn-ghost !px-2.5 !py-1 text-xs" onClick={() => go(ROLE)}>
                      {t("Skip", "छोड़ें")}
                    </button>
                  )}
                  {roleOnly && (
                    <button className="btn btn-ghost !px-2.5 !py-1 text-xs" onClick={() => onDone(false)}>
                      {t("Cancel", "रद्द करें")}
                    </button>
                  )}
                </div>
              </div>

              <div className="relative min-h-0 flex-1 overflow-y-auto">
                <AnimatePresence mode="wait" custom={dir} initial={false}>
                  <motion.div
                    key={i}
                    custom={dir}
                    initial={{ opacity: 0, x: 28 * dir }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -28 * dir }}
                    transition={{ type: "spring", stiffness: 320, damping: 32 }}
                    drag={i < ROLE ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={onDrag}
                    className={cx("h-full", hi)}
                  >
                    {slide && (
                      <>
                        <div className="label mb-2" style={{ color: slide.tone }}>
                          {t(...slide.kicker)}
                        </div>
                        <h2 className="text-[1.65rem] font-semibold leading-[1.12] tracking-[-0.03em] md:text-[2rem]">{t(...slide.title)}</h2>
                        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-ink-2)]">{t(...slide.body)}</p>
                      </>
                    )}
                    {i === ROLE && (
                      <>
                        <div className="label mb-2">{t("One question", "एक सवाल")}</div>
                        <h2 className="text-[1.65rem] font-semibold leading-tight tracking-[-0.03em]">{t("Who is using Jugnu?", "जुगनू कौन चला रहा है?")}</h2>
                        <p className="mt-1.5 text-sm text-[var(--color-ink-2)]">{t("Jugnu shows you the work that is yours. Switch any time.", "जुगनू आपको आपका काम दिखाएगा। कभी भी बदलें।")}</p>
                        <div className="mt-4 space-y-2">
                          <RoleOption icon={Landmark} tone="var(--st-bright)" on={pick === "beo"} onClick={() => setPick("beo")} title={t("Block Education Officer", "ब्लॉक शिक्षा अधिकारी (BEO)")} sub={t("The whole block: where to act, what is stuck, did it work", "पूरा ब्लॉक: कहाँ काम, क्या अटका, क्या असर हुआ")} />
                          <RoleOption icon={Users} tone="var(--tone-teal)" on={pick === "crp"} onClick={() => setPick("crp")} title={t("Cluster resource person (CRP)", "क्लस्टर संसाधन व्यक्ति (CRP)")} sub={t("Your cluster: spot checks, interviews, visits, calls", "आपका क्लस्टर: जाँच, बातचीत, दौरे, कॉल")}>
                            {pick === "crp" && (
                              <select
                                className="mt-2 w-full rounded-xl border border-[var(--chip-line)] bg-[var(--inset-bg)] px-3 py-2 text-sm"
                                value={cluster}
                                onChange={(e) => setCluster(Number(e.target.value))}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={t("Your cluster", "आपका क्लस्टर")}
                              >
                                {clusters.map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v.name} — {v.crp} ({v.n} {t("schools", "स्कूल")})
                                  </option>
                                ))}
                              </select>
                            )}
                          </RoleOption>
                          <RoleOption icon={Eye} tone="var(--tone-visit)" on={pick === "guest"} onClick={() => setPick("guest")} title={t("Just looking (judge or visitor)", "सिर्फ़ देख रहे हैं (जज या मेहमान)")} sub={t("Everything in the demo block, as the officer sees it", "डेमो ब्लॉक का सब कुछ, जैसे अधिकारी देखते हैं")} />
                        </div>
                      </>
                    )}
                    {i === READY && (
                      <>
                        <div className="label mb-2" style={{ color: "var(--tone-lime)" }}>
                          {t("You're all set", "सब तैयार है")}
                        </div>
                        <h2 className="text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] md:text-[2rem]">{t("Want a 1-minute guide?", "1 मिनट का गाइड देखें?")}</h2>
                        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
                          {t(
                            "A spotlight walks you through the real screens: your first task, the term rings, a school's tracker, and where everyone's work shows up live.",
                            "एक रोशनी आपको असली स्क्रीन दिखाती है: आपका पहला काम, सत्र के घेरे, स्कूल का ट्रैकर, और जहाँ सबका काम लाइव दिखता है।",
                          )}
                        </p>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                {i > 0 && i !== READY && !roleOnly ? (
                  <button className="btn btn-glass btn-icon !p-2.5" onClick={() => go(i - 1)} aria-label={t("Back", "पीछे")}>
                    <ArrowLeft size={17} />
                  </button>
                ) : (
                  <span />
                )}
                {i < ROLE && (
                  <button className="btn btn-primary !px-6 !py-3 text-[15px]" onClick={() => go(i + 1)}>
                    {i === 0 ? t("Get started", "शुरू करें") : t("Continue", "आगे")} <ArrowRight size={17} />
                  </button>
                )}
                {i === ROLE && (
                  <button className="btn btn-primary !px-6 !py-3 text-[15px]" onClick={chooseRole} disabled={!pick}>
                    {t("Continue", "आगे")} <ArrowRight size={17} />
                  </button>
                )}
                {i === READY && (
                  <div className="flex w-full flex-wrap justify-end gap-2">
                    <button className="btn btn-glass !px-5 !py-3" onClick={() => onDone(false)}>
                      {t("Explore on my own", "खुद देखूँगा")}
                    </button>
                    <button className="btn btn-primary !px-6 !py-3 text-[15px]" onClick={() => onDone(true)}>
                      <Compass size={17} /> {t("Start the guide", "गाइड शुरू करें")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RoleOption({ icon: Icon, tone, on, onClick, title, sub, children }: { icon: LucideIcon; tone: string; on: boolean; onClick: () => void; title: string; sub: string; children?: ReactNode }) {
  return (
    <div
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={cx("card-inset card-hover cursor-pointer p-3.5 transition", on && "!border-[color-mix(in_srgb,var(--st-bright)_70%,transparent)]")}
      style={on ? { background: "color-mix(in srgb, var(--st-bright) 9%, var(--inset-bg))" } : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="icon-tile h-10 w-10 rounded-[0.9rem]" style={{ "--tile": tone } as CSSProperties}>
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="block text-[13px] leading-snug text-[var(--color-ink-3)]">{sub}</span>
        </span>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border" style={on ? { background: "var(--grad-flat)", borderColor: "transparent", color: "#0b1308" } : { borderColor: "var(--chip-line)" }}>
          {on && <Check size={13} strokeWidth={3} />}
        </span>
      </div>
      {children}
    </div>
  );
}
