// The front door. Instead of explaining modules, it follows ONE practice through the block —
// from a number that looked unusual to a teacher next door trying it — using the live demo
// block, so every step opens the real page where that work happens.
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Clapperboard,
  Footprints,
  Landmark,
  Languages,
  LineChart,
  MapPinned,
  Mic,
  PhoneCall,
  Play,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stars,
  UserCheck,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ActivityFeed } from "../components/ActivityFeed";
import { useDemo } from "../components/Demo";
import { AppBackground } from "../components/kit";
import { LogoMark, Wordmark } from "../components/Logo";
import { LoopFlow } from "../components/LoopFlow";
import { LivingMap } from "../components/maps";
import { cx } from "../components/ui";
import { PRACTICES } from "../engine/practices";
import { MEDIA } from "../lib/clips";
import { usePrefs, useT } from "../lib/prefs";
import { setWelcomed } from "../lib/journey";
import { useRole, type Role } from "../lib/role";
import { meanZ, schoolStatuses } from "../lib/status";
import { usePipeline } from "../lib/store";
import { pickStory, type Story } from "../lib/story";
import { useTasks } from "../lib/tasks";
import { ThemeToggle, useTheme } from "../lib/theme";
import { CountUp, EASE, Tilt, useReveal, usePointerSheen, WordReveal } from "../lib/motion";

export default function HomePage({ onTour }: { onTour: () => void }) {
  const t = useT();
  const nav = useNavigate();
  const { lang, setLang, lite } = usePrefs();
  const { mode } = useTheme();
  const [role, setRole] = useRole();
  const { state, followUps, events } = usePipeline();
  const story = useMemo(() => pickStory(state, followUps), [state, followUps]);
  const hi = lang === "hi" && "font-deva";
  const demo = useDemo();
  /** Straight into the playback: a visitor who asked for it skips the welcome. */
  const play = () => {
    if (!role) setRole({ kind: "guest" });
    setWelcomed(true);
    demo.start();
  };

  /** Open the app; a visitor arriving from here is a guest until they pick a role. */
  const enter = (to: string, as?: Role) => {
    if (as) setRole(as);
    else if (!role) setRole({ kind: "guest" });
    nav(to);
  };

  const video = mode === "light" ? MEDIA.dawn : MEDIA.welcome;
  const poster = mode === "light" ? MEDIA.dawnPoster : MEDIA.welcomePoster;

  // motion: the first visit of a session opens like the Lodge reference — the frame draws itself
  // with a counter, then the words arrive; the video drifts in slowly and lags behind on scroll.
  const mainRef = useRef<HTMLElement>(null);
  useReveal(mainRef);
  usePointerSheen();
  const [intro, setIntro] = useState(() => {
    try {
      return !lite && !matchMedia("(prefers-reduced-motion: reduce)").matches && !sessionStorage.getItem("jugnu-intro");
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!intro) return;
    try {
      sessionStorage.setItem("jugnu-intro", "1");
    } catch {
      /* private mode */
    }
    const id = window.setTimeout(() => setIntro(false), 1650);
    return () => window.clearTimeout(id);
  }, [intro]);
  const d = useRef(intro ? 1.3 : 0.1).current;
  const hero = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "9%"]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const textFade = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  return (
    <div className="min-h-dvh">
      <AppBackground />

      {/* top bar: a floating glass pill over the hero */}
      <header className="sticky top-0 z-40 px-3 pt-3 md:px-5">
        <div className="chrome mx-auto flex max-w-[1240px] items-center gap-3 rounded-full py-1.5 pl-2.5 pr-1.5 md:pl-4">
          <Link to="/" aria-label="Jugnu">
            <LogoMark size={34} className="sm:hidden" />
            <span className="hidden sm:block">
              <Wordmark size={32} />
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 text-sm text-[var(--color-ink-2)] md:flex" aria-label={t("On this page", "इस पेज पर")}>
            <a href="#story" className="rounded-full px-3 py-1.5 hover:bg-[var(--hover)] hover:text-[var(--color-ink)]">
              {t("How it works", "कैसे काम करता है")}
            </a>
            <a href="#start" className="rounded-full px-3 py-1.5 hover:bg-[var(--hover)] hover:text-[var(--color-ink)]">
              {t("Who it is for", "किसके लिए")}
            </a>
            <button onClick={() => enter("/about")} className="rounded-full px-3 py-1.5 hover:bg-[var(--hover)] hover:text-[var(--color-ink)]">
              {t("About", "परिचय")}
            </button>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn btn-glass !px-3 !py-1.5 font-deva" onClick={() => setLang(lang === "hi" ? "en" : "hi")} aria-label={lang === "hi" ? "English" : "हिंदी"}>
              <span className="sm:hidden">{lang === "hi" ? "EN" : "हिं"}</span>
              <span className="hidden sm:inline">{lang === "hi" ? "English" : "हिंदी"}</span>
            </button>
            <ThemeToggle labels={{ dark: t("Dark mode", "डार्क मोड"), light: t("Light mode", "लाइट मोड") }} />
            <button className="btn btn-primary whitespace-nowrap !px-3.5 !py-2" onClick={() => (role ? enter("/today") : document.getElementById("start")?.scrollIntoView({ behavior: "smooth" }))}>
              {t("Open Jugnu", "जुगनू खोलें")} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* hero: a framed, cinematic window — dusk in dark mode, dawn in light mode */}
      <div className="-mt-[66px] px-2 md:px-3">
      <section ref={hero} className="relative isolate overflow-hidden rounded-b-[2.4rem] md:rounded-[2.4rem]">
        {lite ? (
          <img className="welcome-video" src={poster} alt="" aria-hidden />
        ) : (
          <motion.video
            key={video}
            className="welcome-video"
            src={video}
            poster={poster}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
            style={{ y: videoY }}
            initial={{ scale: 1.32 }}
            animate={{ scale: 1.14 }}
            transition={{ duration: 3.2, ease: EASE }}
          />
        )}
        <div className={cx("home-shade", mode === "light" ? "home-shade-light" : "home-shade-dark")} />
        <HeroFrame intro={intro} />
        <motion.div style={{ y: textY }} className="relative mx-auto grid min-h-[min(92svh,820px)] max-w-[1240px] items-center gap-10 px-5 pb-20 pt-28 md:px-8 lg:grid-cols-[1.15fr_0.85fr]">
          <motion.div style={{ opacity: textFade }} className="min-w-0">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: d, ease: EASE }} className="chip mb-5 w-fit !bg-[var(--chrome)] backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--st-bright-fill)]" />
              {t(`Live demo · ${state.block.name} · ${state.block.schools.length} schools`, `लाइव डेमो · ${state.block.name} · ${state.block.schools.length} स्कूल`)}
            </motion.div>
            <h1 className={cx("display-xl max-w-[15ch] text-[2.9rem] md:text-[4.2rem] lg:text-[5.1rem]", hi && "!max-w-[18ch] !leading-[1.2]")}>
              <WordReveal text={t("Somewhere in your block, a teacher has", "आपके ब्लॉक में कहीं, कोई शिक्षक")} delay={d + 0.05} stagger={0.07} />{" "}
              <WordReveal text={t("already cracked it.", "यह कर दिखा चुका है।")} delay={d + 0.55} stagger={0.08} className="font-semibold" wordClassName="gradient-text" />
            </h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: d + 0.8, ease: EASE }} className={cx("mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--color-ink-2)] md:text-lg", hi)}>
              {t(
                "Jugnu finds the teachers whose children read and count better than anyone expected, learns exactly what they do by talking to them, and carries it to the school next door — teacher to teacher. Then it checks that it worked.",
                "जुगनू उन शिक्षकों को ढूँढता है जिनके बच्चे उम्मीद से बेहतर पढ़ते-गिनते हैं, उनसे बात करके समझता है कि वे ठीक-ठीक क्या करते हैं, और उसे पास के स्कूल तक पहुँचाता है — शिक्षक से शिक्षक। फिर जाँचता है कि असर हुआ।",
              )}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: d + 0.95, ease: EASE }} className="mt-8 flex flex-wrap gap-3">
              <a href="#start" className="btn btn-primary !px-5 !py-3 text-base">
                {t("Find your way in", "अपनी भूमिका चुनें")} <ArrowRight size={17} />
              </a>
              {demo.available && (
                <button className="btn btn-glass !px-5 !py-3 text-base" onClick={play}>
                  <Play size={17} /> {t("Play a whole term · 40 s", "पूरा सत्र चलाएँ · 40 से.")}
                </button>
              )}
              <button className="btn btn-ghost !px-4 !py-3 text-base" onClick={onTour}>
                <Clapperboard size={17} /> {t("2-minute film", "2 मिनट की फ़िल्म")}
              </button>
            </motion.div>
            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: d + 0.5 }} className={cx("mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[15px] font-medium text-[var(--color-ink)]", hi)}>
              {[
                [Smartphone, t("Any phone, even 2G", "कोई भी फ़ोन, 2G पर भी")],
                [Languages, t("Hindi first", "पहले हिंदी")],
                [ShieldCheck, t("No data about children", "बच्चों का कोई डेटा नहीं")],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Smartphone;
                return (
                  <li key={String(label)} className="flex items-center gap-1.5">
                    <I size={15} className="text-[var(--st-bright)]" aria-hidden /> {label as string}
                  </li>
                );
              })}
            </motion.ul>
            {story && <MomentsStrip story={story} delay={d + 1.1} />}
          </motion.div>
          {story && <HeroMoments story={story} delay={d + 0.7} />}
        </motion.div>
      </section>
      </div>

      <main ref={mainRef} className="mx-auto max-w-[1240px] space-y-24 px-4 pb-16 pt-16 md:px-6">
        {/* who it is for */}
        <section id="start" className="scroll-mt-24">
          <SectionHead
            eyebrow={t("Start where you are", "जहाँ आप हैं, वहीं से")}
            title={t("One block, three people, one loop", "एक ब्लॉक, तीन लोग, एक चक्र")}
            sub={t("Pick who you are. Jugnu opens on the work that is yours — you can switch any time.", "आप कौन हैं, चुनें। जुगनू आपके काम से खुलेगा — आप कभी भी बदल सकते हैं।")}
          />
          <Doors onEnter={enter} />
        </section>

        {/* the story of one practice */}
        {story && (
          <section id="story" className="scroll-mt-24">
            <SectionHead
              eyebrow={t("How it works — one real example from the demo block", "कैसे काम करता है — डेमो ब्लॉक से एक असली उदाहरण")}
              title={
                <>
                  {t("Follow one practice from ", "एक तरीके का सफ़र: ")}
                  <span className="gradient-text">{story.bright.name}</span>
                  {t(" to the school next door", " से पास के स्कूल तक")}
                </>
              }
              sub={t(
                "Every block already has teachers who get results others don't. Here is how Jugnu finds one, learns from her and passes it on — each step opens the real page in the app.",
                "हर ब्लॉक में ऐसे शिक्षक हैं जिनके नतीजे दूसरों से बेहतर हैं। देखिए जुगनू कैसे एक को ढूँढता है, उनसे सीखता है और आगे पहुँचाता है — हर कदम ऐप का असली पेज खोलता है।",
              )}
            />
            <Journey story={story} onEnter={enter} />
          </section>
        )}

        {/* the whole block, right now */}
        <section>
          <SectionHead
            eyebrow={t("The whole block, right now", "पूरा ब्लॉक, अभी")}
            title={t("Now the same, for every school at once", "अब यही, हर स्कूल के लिए एक साथ")}
            sub={t("From data the state already collects to a named teacher, a visit and a follow-up call. Tap a step to open it.", "राज्य के पास पहले से मौजूद डेटा से — नाम वाले शिक्षक, दौरे और फ़ॉलो-अप कॉल तक। कोई भी कदम छूकर खोलें।")}
          />
          <LoopFlow onEnter={() => !role && setRole({ kind: "guest" })} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <BlockMap onOpen={(id) => enter(`/schools/${id}`)} />
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className={cx("font-semibold", hi)}>{t("Recorded in the field", "मैदान से दर्ज")}</h3>
                <span className="chip text-xs">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--tone-good)]" /> {t("shared by everyone", "सबके लिए")}
                </span>
              </div>
              {events.length ? (
                <ActivityFeed events={events} limit={5} />
              ) : (
                <p className={cx("text-sm text-[var(--color-ink-2)]", hi)}>
                  {t(
                    "When a cluster resource person records a spot check, a visit or a follow-up call, it shows here for the whole block. Open the app to see what has been recorded.",
                    "जब कोई CRP मौके की जाँच, दौरा या फ़ॉलो-अप कॉल दर्ज करता है, वह पूरे ब्लॉक को यहाँ दिखता है। जो दर्ज हुआ है, उसे देखने के लिए ऐप खोलें।",
                  )}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {demo.available && (
                  <button className="btn btn-primary" onClick={play}>
                    <Play size={15} /> {t("Play the term", "सत्र चलाकर देखें")}
                  </button>
                )}
                <button className="btn btn-glass" onClick={() => enter("/today")}>
                  {t("Open today's work", "आज का काम खोलें")} <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* meet the assistant */}
        <section className="card on-dark relative isolate overflow-hidden">
          <div className="grid items-center gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="relative mx-auto aspect-square w-full max-w-[420px] [mask-image:radial-gradient(circle,#000_52%,transparent_71%)]">
              {lite ? <img src={MEDIA.orbPoster} alt="" aria-hidden className="h-full w-full object-cover mix-blend-screen" /> : <video src={MEDIA.orb} poster={MEDIA.orbPoster} autoPlay muted loop playsInline aria-hidden className="h-full w-full object-cover mix-blend-screen" />}
            </div>
            <div className="p-6 md:p-10 md:pl-2">
              <span className="chip text-xs">{t("Meet Jugnu", "जुगनू से मिलिए")}</span>
              <h2 className={cx("mt-4 text-3xl font-bold leading-tight text-white md:text-4xl", hi)}>{t("Just talk to it — in your language.", "बस बात कीजिए — अपनी भाषा में।")}</h2>
              <p className={cx("mt-3 max-w-xl leading-relaxed text-white/75", hi)}>
                {t(
                  "Ask in Hindi, English, Tamil or any Indian language. Jugnu briefs you on your block, answers from the block's own data, and does the work on screen: opens a school, shows it on the map, records a visit. You see your words as you speak, and its answer as it talks.",
                  "हिंदी, अंग्रेज़ी, तमिल या किसी भी भारतीय भाषा में पूछिए। जुगनू आपके ब्लॉक की ब्रीफ़िंग देता है, ब्लॉक के अपने डेटा से जवाब देता है, और स्क्रीन पर काम भी करता है: स्कूल खोलना, नक्शे पर दिखाना, दौरा दर्ज करना। बोलते समय आपके शब्द दिखते हैं, और जवाब देते समय उसके।",
                )}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    enter("/today");
                    setTimeout(() => window.dispatchEvent(new CustomEvent("jugnu:ask", { detail: "brief" })), 900);
                  }}
                >
                  <Mic size={15} /> {t("Brief me now", "अभी ब्रीफ़ करो")}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* made for a real block */}
        <section>
          <SectionHead eyebrow={t("Made for a real block", "असली ब्लॉक के लिए बना")} title={t("Built around the people who will use it", "उन लोगों के हिसाब से, जो इसे चलाएँगे")} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                [Smartphone, t("Works where they are", "जहाँ वे हैं, वहीं चले"), t("A teacher needs only a link or a phone call. Low-data mode turns off video and 3D on slow networks.", "शिक्षक को सिर्फ़ एक लिंक या फ़ोन कॉल चाहिए। धीमे नेटवर्क पर कम-डेटा मोड वीडियो और 3D बंद कर देता है।"), "/testing"],
                [Languages, t("Hindi first", "पहले हिंदी"), t("Interviews, voice notes and the whole app in Hindi or English — one tap to switch.", "बातचीत, आवाज़-संदेश और पूरा ऐप हिंदी या अंग्रेज़ी में — एक टैप में बदलें।"), "/interviews"],
                [UserCheck, t("A person approves every AI draft", "हर AI ड्राफ़्ट को इंसान मंज़ूर करे"), t("Practice cards and voice notes wait in Review until a CRP or the BEO says yes.", "तरीकों के कार्ड और आवाज़-संदेश तब तक 'समीक्षा' में रुकते हैं जब तक CRP या BEO हाँ न कहें।"), "/review"],
                [ShieldCheck, t("Adults only, with consent", "सिर्फ़ वयस्क, सहमति से"), t("No child-level data is stored. Names and numbers are removed from notes; any interview can be deleted.", "बच्चों का कोई व्यक्तिगत डेटा नहीं। नोट्स से नाम और नंबर हटाए जाते हैं; कोई भी बातचीत मिटाई जा सकती है।"), "/ai"],
              ] as const
            ).map(([Icon, title, text, to]) => (
              <button key={to} onClick={() => enter(to)} className="card card-hover p-5 text-left">
                <span className="icon-tile h-10 w-10 rounded-[0.9rem]">
                  <Icon size={19} aria-hidden />
                </span>
                <h3 className={cx("mt-3 font-semibold", hi)}>{title}</h3>
                <p className={cx("mt-1 text-sm leading-relaxed text-[var(--color-ink-2)]", hi)}>{text}</p>
              </button>
            ))}
          </div>
        </section>

        {/* closing band */}
        <section className="card on-dark relative overflow-hidden">
          {lite ? <img className="welcome-video" src={MEDIA.networkPoster} alt="" aria-hidden /> : <video className="welcome-video" src={MEDIA.network} poster={MEDIA.networkPoster} autoPlay muted loop playsInline aria-hidden />}
          <div className="welcome-shade" />
          <div className="relative flex flex-col items-start gap-5 p-7 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="max-w-xl">
              <LogoMark size={44} />
              <h2 className={cx("mt-4 text-3xl font-bold md:text-4xl", hi)}>{t("Every block already has its fireflies.", "हर ब्लॉक में जुगनू पहले से हैं।")}</h2>
              <p className={cx("mt-2 text-[var(--color-ink-2)]", hi)}>{t("Jugnu helps the light travel from one classroom to the next.", "जुगनू उनकी रोशनी को एक कक्षा से अगली तक पहुँचाता है।")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="#start" className="btn btn-primary !px-5 !py-3">
                {t("Open Jugnu", "जुगनू खोलें")} <ArrowRight size={16} />
              </a>
              <a href="/talk" target="_blank" rel="noreferrer" className="btn btn-glass !px-5 !py-3">
                <Mic size={16} /> {t("Talk to Jugnu as a teacher", "शिक्षक बनकर बात करें")}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-4 py-8 text-sm text-[var(--color-ink-3)] md:flex-row md:items-start md:justify-between md:px-6">
          <div className="max-w-xl">
            <Wordmark size={26} />
            <p className={cx("mt-3 text-xs leading-relaxed", hi)}>
              {t(
                "AI for Foundational Learning Hackathon · Challenge 4. Schools are real: Damoh's 7 blocks and their 1,365 government schools from UDISE+ (names, locations, clusters, enrolment, teachers). Learning results, attendance and teachers' names are simulated, calibrated to ASER 2024; live interviews are real. Background videos are AI-generated (Google Veo).",
                "AI for Foundational Learning हैकाथॉन · चुनौती 4। स्कूल असली हैं: दमोह के 7 ब्लॉक और उनके 1,365 सरकारी स्कूल UDISE+ से (नाम, जगह, संकुल, नामांकन, शिक्षक)। सीखने के नतीजे, उपस्थिति और शिक्षकों के नाम सिम्युलेटेड हैं (ASER 2024 के अनुसार); लाइव बातचीत असली है। पृष्ठभूमि वीडियो AI से बने हैं (Google Veo)।",
              )}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t("More", "और")}>
            {(
              [
                ["/about", t("About Jugnu", "जुगनू के बारे में")],
                ["/ai", t("AI & safety checks", "AI व सुरक्षा जाँच")],
                ["/method", t("Data & method", "डेटा व पद्धति")],
                ["/testing", t("User testing", "उपयोगकर्ता परीक्षण")],
              ] as const
            ).map(([to, label]) => (
              <button key={to} onClick={() => enter(to)} className="tap-link hover:text-[var(--color-ink)]">
                {label}
              </button>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: ReactNode; sub?: string }) {
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  return (
    <div className="mb-6 max-w-3xl" data-reveal>
      <div className={cx("label mb-2", hi)}>{eyebrow}</div>
      <h2 className={cx("text-3xl font-bold leading-tight md:text-[2.4rem]", hi)}>{title}</h2>
      {sub && <p className={cx("mt-3 text-[16px] leading-relaxed text-[var(--color-ink-2)]", hi)}>{sub}</p>}
    </div>
  );
}

/** The frame inset in the hero, drawn in on the first visit with a counter (as in the Lodge reference). */
function HeroFrame({ intro }: { intro: boolean }) {
  return (
    <>
      <svg className="pointer-events-none absolute inset-3 z-[1] hidden h-[calc(100%-24px)] w-[calc(100%-24px)] overflow-visible md:block" aria-hidden>
        <motion.rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="32"
          fill="none"
          stroke="rgb(var(--fg) / 0.2)"
          strokeWidth="1.2"
          initial={intro ? { pathLength: 0, opacity: 0.4 } : false}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
      <AnimatePresence>
        {intro && (
          <motion.div
            className="display-xl pointer-events-none fixed bottom-8 left-6 z-[2] text-[3.4rem] text-[rgb(var(--fg)/0.8)] md:bottom-10 md:left-12 md:text-[4.6rem]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, filter: "blur(8px)", transition: { duration: 0.5 } }}
            aria-hidden
          >
            <CountUp value={100} duration={1.35} />%
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function useMoments(story: Story) {
  const t = useT();
  const { lang } = usePrefs();
  const y = story.years[story.years.length - 1];
  const items: { icon: typeof Stars; tone: string; title: string; text: string }[] = [
    {
      icon: Stars,
      tone: "var(--st-bright)",
      title: t("Bright spot verified", "अच्छा स्कूल — जाँच पूरी"),
      text: t(
        `${story.bright.name}: ${y.actual}% of Class 3 ${story.measure === "reading" ? "read" : "do subtraction"}, where ${y.expected}% was expected`,
        `${story.bright.name}: कक्षा 3 के ${y.actual}% बच्चे ${story.measure === "reading" ? "पढ़ लेते हैं" : "घटाव कर लेते हैं"}, अपेक्षा ${y.expected}% थी`,
      ),
    },
    {
      icon: Mic,
      tone: "var(--tone-teal)",
      title: t(`${story.bright.teacher} talked to Jugnu · 12 min`, `${story.bright.teacher} ने जुगनू से बात की · 12 मिनट`),
      text: lang === "hi" ? story.quote.hi : (story.quote.en ?? story.quote.hi),
    },
    {
      icon: Volume2,
      tone: "var(--st-support)",
      title: t("Voice note on its way", "आवाज़-संदेश भेजा जा रहा है"),
      text: t(`To ${story.recipient.teacher} at ${story.recipient.name}, ${story.rec.distanceKm.toFixed(1)} km away`, `${story.recipient.name} की ${story.recipient.teacher} को, ${story.rec.distanceKm.toFixed(1)} किमी दूर`),
    },
  ];
  return items;
}

/** Phones: the same three moments as cards you swipe through. */
function MomentsStrip({ story, delay }: { story: Story; delay: number }) {
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const items = useMoments(story);
  return (
    <div className="no-scrollbar -mx-5 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 lg:hidden" aria-hidden>
      {items.map((it, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: delay + i * 0.12, ease: EASE }}
          className="glass w-[78%] shrink-0 snap-start !rounded-[1.4rem] p-4"
        >
          <div className="flex gap-3">
            <span className="icon-tile h-9 w-9 rounded-full" style={{ "--tile": it.tone } as CSSProperties}>
              <it.icon size={17} />
            </span>
            <span className="min-w-0">
              <span className={cx("block text-sm font-semibold", hi)}>{it.title}</span>
              <span className={cx("mt-0.5 line-clamp-3 block text-[13px] leading-snug text-[var(--color-ink-2)]", (hi || i === 1) && "font-deva")}>{it.text}</span>
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Three moments from the story, floating over the hero like notifications on an officer's phone. */
function HeroMoments({ story, delay }: { story: Story; delay: number }) {
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const items = useMoments(story);
  return (
    <div className="relative hidden h-[420px] lg:block" aria-hidden>
      {items.map((it, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 40, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: delay + i * 0.35, duration: 1, ease: EASE }}
          className="absolute w-[360px]"
          style={{ top: 18 + i * 128, left: i === 1 ? 48 : i === 2 ? 12 : 0 }}
        >
          <Tilt className="glass !rounded-[1.4rem] p-4">
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }} className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${it.tone} 16%, transparent)`, color: it.tone }}>
              <it.icon size={17} />
            </span>
            <span className="min-w-0">
              <span className={cx("block text-sm font-semibold", hi)}>{it.title}</span>
              <span className={cx("mt-0.5 line-clamp-2 block text-[13px] leading-snug text-[var(--color-ink-2)]", (hi || i === 1) && "font-deva")}>{it.text}</span>
            </span>
          </motion.div>
          </Tilt>
        </motion.div>
      ))}
    </div>
  );
}

function Doors({ onEnter }: { onEnter: (to: string, as?: Role) => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const { state } = usePipeline();
  const beoTasks = useTasks(state, { kind: "beo" }, 0);
  const clusters = useMemo(() => {
    const m = new Map<number, { name: string; crp: string; n: number }>();
    for (const s of state.block.schools) m.set(s.cluster, { name: s.clusterName, crp: s.crp, n: (m.get(s.cluster)?.n ?? 0) + 1 });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [state.block]);
  const [cluster, setCluster] = useState(clusters[0]?.[0] ?? 0);
  const crpTasks = useTasks(state, { kind: "crp", cluster }, 0);
  const door = "card flex flex-col p-6";
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className={door}>
        <DoorHead icon={Landmark} tone="var(--st-bright)" who={t("Block Education Officer", "ब्लॉक शिक्षा अधिकारी")} />
        <p className={cx("mt-3 flex-1 text-[15px] leading-relaxed text-[var(--color-ink-2)]", hi)}>
          {t("Monday morning, the whole block on one page: which schools to act on, who owns each step, what is stuck, and whether it worked.", "सोमवार सुबह, पूरा ब्लॉक एक पेज पर: किन स्कूलों पर काम करना है, हर कदम किसके ज़िम्मे, क्या अटका है, और असर हुआ या नहीं।")}
        </p>
        <div className={cx("mt-4 text-sm", hi)}>
          <b className="font-display text-lg tabular-nums">{beoTasks.length}</b> <span className="text-[var(--color-ink-3)]">{t("things waiting for the BEO today", "काम आज BEO का इंतज़ार कर रहे")}</span>
        </div>
        <button className="btn btn-primary mt-4 justify-center" onClick={() => onEnter("/today", { kind: "beo" })}>
          {t("Open as BEO", "BEO के रूप में खोलें")} <ArrowRight size={15} />
        </button>
      </div>

      <div className={door}>
        <DoorHead icon={Footprints} tone="var(--tone-info)" who={t("Cluster resource person", "क्लस्टर संसाधन व्यक्ति (CRP)")} />
        <p className={cx("mt-3 flex-1 text-[15px] leading-relaxed text-[var(--color-ink-2)]", hi)}>
          {t("Your week in your cluster: 15-minute spot checks, teacher interviews, peer visits and follow-up calls — in the order that matters.", "आपके क्लस्टर में आपका हफ़्ता: 15 मिनट की मौके की जाँच, शिक्षकों से बातचीत, साथी-दौरे और फ़ॉलो-अप कॉल — सही क्रम में।")}
        </p>
        <label className="mt-4 block text-xs text-[var(--color-ink-3)]">
          {t("Your cluster", "आपका क्लस्टर")}
          <select
            className="mt-1 w-full rounded-xl border border-[var(--chip-line)] bg-[var(--inset-bg)] px-3 py-2 text-sm text-[var(--color-ink)]"
            value={cluster}
            onChange={(e) => setCluster(Number(e.target.value))}
          >
            {clusters.map(([i, c]) => (
              <option key={i} value={i}>
                {c.name} — {c.crp} ({c.n} {t("schools", "स्कूल")})
              </option>
            ))}
          </select>
        </label>
        <div className={cx("mt-2 text-sm", hi)}>
          <b className="font-display text-lg tabular-nums">{crpTasks.length}</b> <span className="text-[var(--color-ink-3)]">{t("tasks in this cluster", "काम इस क्लस्टर में")}</span>
        </div>
        <button className="btn btn-primary mt-4 justify-center" onClick={() => onEnter("/today", { kind: "crp", cluster })}>
          {t("Open my cluster", "मेरा क्लस्टर खोलें")} <ArrowRight size={15} />
        </button>
      </div>

      <div className={door}>
        <DoorHead icon={Mic} tone="var(--tone-teal)" who={t("Teacher", "शिक्षक")} />
        <p className={cx("mt-3 flex-1 text-[15px] leading-relaxed text-[var(--color-ink-2)]", hi)}>
          {t("A 12-minute conversation in Hindi about what happens in your classroom. No app, no login — a link on WhatsApp or a phone call.", "आपकी कक्षा में क्या होता है, इस पर हिंदी में 12 मिनट की बातचीत। न ऐप, न लॉगिन — WhatsApp पर एक लिंक या एक फ़ोन कॉल।")}
        </p>
        <div className={cx("mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-ink-3)]", hi)}>
          <span className="chip">
            <PhoneCall size={12} /> {t("or a normal phone call", "या साधारण फ़ोन कॉल")}
          </span>
          <span className="chip">{t("your words reach other teachers", "आपकी बात दूसरे शिक्षकों तक")}</span>
        </div>
        <a href="/talk" target="_blank" rel="noreferrer" className="btn btn-glass mt-4 justify-center">
          <Mic size={15} /> {t("Try the teacher interview", "शिक्षक वाली बातचीत आज़माएँ")}
        </a>
      </div>

      <button onClick={() => onEnter("/today", { kind: "guest" })} className={cx("text-left text-sm text-[var(--color-ink-2)] hover:text-[var(--color-ink)] lg:col-span-3", hi)}>
        {t("Just looking — a judge or a visitor? ", "सिर्फ़ देख रहे हैं — जज या मेहमान? ")}
        <span className="font-semibold text-[var(--st-bright)] underline decoration-dotted underline-offset-4">{t("Explore everything as a visitor →", "मेहमान के रूप में सब कुछ देखें →")}</span>
      </button>
    </div>
  );
}

function DoorHead({ icon: Icon, tone, who }: { icon: typeof Mic; tone: string; who: string }) {
  const { lang } = usePrefs();
  return (
    <div className="flex items-center gap-3">
      <span className="icon-tile h-11 w-11 rounded-[1rem]" style={{ "--tile": tone } as CSSProperties}>
        <Icon size={20} />
      </span>
      <h3 className={cx("text-lg font-bold", lang === "hi" && "font-deva")}>{who}</h3>
    </div>
  );
}

/** The six moments of the story, joined by the firefly's dotted path. */
function Journey({ story, onEnter }: { story: Story; onEnter: (to: string) => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const p = PRACTICES[story.practice];
  const practice = lang === "hi" ? p.labelHi : p.label;
  const b = story.bright;
  const r = story.recipient;
  const y = story.years[story.years.length - 1];
  const verb = story.measure === "reading" ? t("read a Class 2 text", "कक्षा 2 का पाठ पढ़ पाए") : t("do a two-digit subtraction", "दो अंकों का घटाव कर पाए");
  const ev = story.evidence;
  const pct = (k: number, n: number) => (n ? Math.round((k / n) * 100) : 0);
  const outcomeText: Record<string, [string, string]> = {
    adopted: ["is doing it regularly", "इसे नियमित कर रहे हैं"],
    trying: ["is trying it", "इसे आज़मा रहे हैं"],
    barrier: ["hit a barrier — it went back to the CRP", "रुकावट आई — बात CRP तक गई"],
    no_answer: ["did not answer — Jugnu will call again", "जवाब नहीं मिला — जुगनू फिर कॉल करेगा"],
  };

  const trail = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: trail, offset: ["start 70%", "end 60%"] });
  const lit = useSpring(scrollYProgress, { stiffness: 110, damping: 26 });

  const steps: { icon: typeof Stars; tone: string; verb: string; who: string; title: string; body: string; visual: ReactNode; to: string; link: string }[] = [
    {
      icon: MapPinned,
      tone: "var(--st-check-due)",
      verb: t("Noticed", "पहचाना"),
      who: t("Jugnu, from results the state already collects", "जुगनू, राज्य के मौजूदा नतीजों से"),
      title: t(`${b.name} does better than a school like it should`, `${b.name} अपने जैसे स्कूल से कहीं बेहतर करता है`),
      body: t(
        `${b.enrolment} children in ${b.village}${b.multigrade ? ", one room for several classes" : ""}${b.langMismatch >= 0.3 ? `, ${Math.round(b.langMismatch * 100)}% speak another language at home` : ""}. From that context, about ${y.expected}% of Class 3 children are expected to ${verb}. Here it is ${y.actual}% — well above expectation in ${story.yearsAbove} of the last 3 years.`,
        `${b.village} में ${b.enrolment} बच्चे${b.multigrade ? ", कई कक्षाएँ एक कमरे में" : ""}${b.langMismatch >= 0.3 ? `, ${Math.round(b.langMismatch * 100)}% के घर की भाषा अलग` : ""}। ऐसे हालात में कक्षा 3 के करीब ${y.expected}% बच्चों से उम्मीद होती है। यहाँ ${y.actual}% हैं — पिछले 3 में से ${story.yearsAbove} साल अपेक्षा से काफ़ी ऊपर।`,
      ),
      visual: <YearBars story={story} />,
      to: `/schools/${b.id}`,
      link: t("Open the school page", "स्कूल का पेज खोलें"),
    },
    {
      icon: BadgeCheck,
      tone: "var(--st-bright)",
      verb: t("Checked", "जाँचा"),
      who: t(`${b.crp}, cluster resource person`, `${b.crp}, क्लस्टर संसाधन व्यक्ति`),
      title: t("Then someone went to see", "फिर कोई खुद देखने गया"),
      body: t(
        `Reported numbers can be inflated, so the CRP spent 15 minutes with ${story.spot.sampled} children: ${story.spot.proficient} could ${verb}. That matches what the school reported (${story.spot.reported}%), so it is a real bright spot.`,
        `दर्ज आँकड़े बढ़ा-चढ़ाकर हो सकते हैं, इसलिए CRP ने ${story.spot.sampled} बच्चों के साथ 15 मिनट बिताए: ${story.spot.proficient} ${verb}। यह स्कूल के दर्ज आँकड़े (${story.spot.reported}%) से मेल खाता है — यह सच में अच्छा स्कूल है।`,
      ),
      visual: <SpotDots sampled={story.spot.sampled} proficient={story.spot.proficient} />,
      to: `/schools/${b.id}`,
      link: t("See the spot check", "जाँच देखें"),
    },
    {
      icon: Mic,
      tone: "var(--tone-teal)",
      verb: t("Listened", "सुना"),
      who: t("Jugnu's voice interview, 12 minutes in Hindi", "जुगनू की आवाज़-बातचीत, 12 मिनट, हिंदी में"),
      title: t(`Jugnu asked ${b.teacher} what actually happens in class`, `जुगनू ने ${b.teacher} से पूछा कि कक्षा में असल में क्या होता है`),
      body: t(
        "Never “why are your results good?” — only what happens, how many minutes, with what. When an answer is vague, Jugnu asks for the details.",
        "कभी “आपके नतीजे अच्छे क्यों हैं?” नहीं — सिर्फ़ क्या होता है, कितने मिनट, किस चीज़ से। जवाब अधूरा हो तो जुगनू विस्तार से पूछता है।",
      ),
      visual: <Quote story={story} />,
      to: "/interviews",
      link: t("Read the interviews", "बातचीत पढ़ें"),
    },
    {
      icon: Sparkles,
      tone: "var(--tone-lime)",
      verb: t("Compared", "तुलना की"),
      who: t("Jugnu, across every interview in the block", "जुगनू, ब्लॉक की सारी बातचीत मिलाकर"),
      title: t(`“${practice}” is what sets bright spots apart`, `“${practice}” ही अच्छे स्कूलों को अलग बनाता है`),
      body: t(
        `Jugnu also talks to teachers in similar, ordinary schools. ${ev.bright.k} of ${ev.bright.n} bright-spot teachers described this routine in detail; in similar schools, ${ev.comparison.k} of ${ev.comparison.n}. It costs nothing extra.`,
        `जुगनू उन जैसे सामान्य स्कूलों के शिक्षकों से भी बात करता है। ${ev.bright.n} में से ${ev.bright.k} अच्छे स्कूलों के शिक्षकों ने यह तरीका विस्तार से बताया; वैसे ही दूसरे स्कूलों में ${ev.comparison.n} में से ${ev.comparison.k}। इसमें कोई अतिरिक्त खर्च नहीं।`,
      ),
      visual: (
        <div className="space-y-3">
          <Bar label={t("Bright spots", "अच्छे स्कूल")} k={ev.bright.k} n={ev.bright.n} tone="var(--st-bright-fill)" />
          <Bar label={t("Similar schools", "उन जैसे स्कूल")} k={ev.comparison.k} n={ev.comparison.n} tone="var(--st-ok)" />
          <div className="text-xs text-[var(--color-ink-3)]">
            {pct(ev.bright.k, ev.bright.n)}% vs {pct(ev.comparison.k, ev.comparison.n)}%
          </div>
        </div>
      ),
      to: "/practices",
      link: t("See what works", "क्या काम करता है, देखें"),
    },
    {
      icon: Volume2,
      tone: "var(--st-support)",
      verb: t("Shared", "पहुँचाया"),
      who: t(`Jugnu and ${b.crp}`, `जुगनू और ${b.crp}`),
      title: t(`Passed sideways, to ${r.name}`, `बगल के स्कूल तक: ${r.name}`),
      body: t(
        `${r.name} is ${story.rec.distanceKm.toFixed(1)} km away and its children are behind. ${r.teacher} gets a 60-second voice note in ${b.teacher}'s own words — after a person approves it — and ${story.visit?.owner ?? r.crp} takes ${r.teacher} to watch the routine in ${b.teacher}'s class.`,
        `${r.name} ${story.rec.distanceKm.toFixed(1)} किमी दूर है और वहाँ बच्चे पीछे हैं। ${r.teacher} को ${b.teacher} की अपनी बातों में 60 सेकंड का आवाज़-संदेश मिलता है — इंसान की मंज़ूरी के बाद — और ${story.visit?.owner ?? r.crp} ${r.teacher} को ${b.teacher} की कक्षा में यह तरीका दिखाने ले जाते हैं।`,
      ),
      visual: <VoiceNote story={story} />,
      to: `/schools/${r.id}`,
      link: t(`Open ${r.name}'s plan`, `${r.name} की योजना खोलें`),
    },
    {
      icon: LineChart,
      tone: "var(--tone-good)",
      verb: t("Followed up", "फ़ॉलो-अप"),
      who: t("Jugnu, on day 14 — then the next assessment", "जुगनू, 14वें दिन — फिर अगली परीक्षा"),
      title: story.followUp ? t(`${r.teacher} ${outcomeText[story.followUp.outcome][0]}`, `${r.teacher} ${outcomeText[story.followUp.outcome][1]}`) : t("Two weeks later, a call: did you try it?", "दो हफ़्ते बाद एक कॉल: क्या आपने आज़माया?"),
      body: story.followUp
        ? t(
            `On the follow-up call: “${story.followUp.saidEn || story.followUp.said}”. At the next assessment, Jugnu compares the schools that got a practice with those still waiting — so the block learns what really transfers.`,
            `फ़ॉलो-अप कॉल में: “${story.followUp.said || story.followUp.saidEn}”। अगली परीक्षा में जुगनू तरीका पाने वाले स्कूलों की तुलना बाकी स्कूलों से करता है — ताकि ब्लॉक सीखे कि सच में क्या काम आता है।`,
          )
        : t(
            `Jugnu calls ${r.teacher} to ask what happened. If something is in the way, it goes back to the CRP or the BEO with a name next to it. At the next assessment, schools that got a practice are compared with those still waiting.`,
            `जुगनू ${r.teacher} को कॉल करके पूछता है कि क्या हुआ। कोई रुकावट हो तो वह नाम के साथ CRP या BEO तक जाती है। अगली परीक्षा में तरीका पाने वाले स्कूलों की तुलना बाकी स्कूलों से होती है।`,
          ),
      visual: <FollowUpVisual story={story} />,
      to: "/results",
      link: t("See the results", "नतीजे देखें"),
    },
  ];

  return (
    <ol ref={trail} className="relative">
      {/* the firefly's path: dotted, and lit up as far as you have read */}
      <svg className="pointer-events-none absolute left-[21px] top-6 hidden h-[calc(100%-48px)] w-2 md:block" preserveAspectRatio="none" viewBox="0 0 2 100" aria-hidden>
        <line x1="1" y1="0" x2="1" y2="100" stroke="var(--st-bright-fill)" strokeOpacity="0.35" strokeWidth="2" vectorEffect="non-scaling-stroke" className="trail-line" />
      </svg>
      <motion.span
        className="pointer-events-none absolute left-[21px] top-6 hidden h-[calc(100%-48px)] w-[2px] origin-top rounded-full md:block"
        style={{ scaleY: lit, background: "linear-gradient(180deg, var(--st-bright-fill), var(--tone-lime) 60%, var(--tone-teal))", boxShadow: "0 0 14px var(--glow)" }}
        aria-hidden
      />
      {steps.map((s, i) => (
        <li key={i} className="relative pb-5 md:pl-16">
          <motion.span
            className="absolute left-0 top-5 z-10 hidden h-11 w-11 place-items-center rounded-full border-2 bg-[var(--chrome-solid)] md:grid"
            style={{ borderColor: s.tone, color: s.tone, boxShadow: `0 0 22px -4px ${s.tone}` }}
            initial={{ scale: 0.3, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-25% 0px" }}
            transition={{ type: "spring", stiffness: 380, damping: 16 }}
          >
            <s.icon size={18} />
          </motion.span>
          <div className="card grid gap-5 p-5 md:grid-cols-[1.2fr_1fr] md:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-xs font-bold uppercase tracking-[0.14em]" style={{ color: s.tone }}>
                  {i + 1} · {s.verb}
                </span>
                <span className={cx("text-xs text-[var(--color-ink-3)]", hi)}>{s.who}</span>
              </div>
              <h3 className={cx("mt-2 text-xl font-bold leading-snug", hi)}>{s.title}</h3>
              <p className={cx("mt-2 text-[15px] leading-relaxed text-[var(--color-ink-2)]", hi)}>{s.body}</p>
              <button onClick={() => onEnter(s.to)} className="tap-link mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--st-bright)] hover:underline">
                {s.link} <ArrowRight size={14} />
              </button>
            </div>
            <div className="card-inset flex flex-col justify-center p-4">{s.visual}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function YearBars({ story }: { story: Story }) {
  const t = useT();
  const max = Math.max(100, ...story.years.map((y) => Math.max(y.actual, y.expected)));
  return (
    <div>
      <div className="flex h-36 items-end justify-around gap-4">
        {story.years.map((y) => (
          <div key={y.cycle} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-28 w-full items-end justify-center gap-1.5">
              <div className="w-1/3 max-w-7 rounded-t-md bg-[rgb(var(--fg)/0.16)]" style={{ height: `${(y.expected / max) * 100}%` }} title={`expected ${y.expected}%`} />
              <div className="relative w-1/3 max-w-7 rounded-t-md" style={{ height: `${(y.actual / max) * 100}%`, background: "var(--st-bright-fill)" }}>
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold tabular-nums">{y.actual}</span>
              </div>
            </div>
            <div className="text-xs tabular-nums text-[var(--color-ink-3)]">{y.cycle}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs text-[var(--color-ink-3)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[rgb(var(--fg)/0.16)]" /> {t("expected for its context", "हालात के हिसाब से अपेक्षा")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: "var(--st-bright-fill)" }} /> {t("reported, % of Class 3", "दर्ज, कक्षा 3 का %")}
        </span>
      </div>
    </div>
  );
}

function SpotDots({ sampled, proficient }: { sampled: number; proficient: number }) {
  const t = useT();
  return (
    <div className="text-center">
      <div className="mx-auto grid w-fit grid-cols-5 gap-2.5">
        {Array.from({ length: sampled }, (_, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0.4, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="h-6 w-6 rounded-full border-2"
            style={i < proficient ? { background: "var(--st-bright-fill)", borderColor: "var(--st-bright-fill)", boxShadow: "0 0 12px -2px var(--st-bright-fill)" } : { borderColor: "rgb(var(--fg) / 0.25)" }}
          />
        ))}
      </div>
      <div className="mt-3 text-sm">
        <b className="font-display text-lg tabular-nums">
          {proficient}/{sampled}
        </b>{" "}
        <span className="text-[var(--color-ink-3)]">{t("children, checked in 15 minutes", "बच्चे, 15 मिनट में जाँचे")}</span>
      </div>
    </div>
  );
}

function Quote({ story }: { story: Story }) {
  const { lang } = usePrefs();
  return (
    <figure>
      <blockquote className="relative rounded-2xl rounded-bl-sm bg-[color-mix(in_srgb,var(--tone-teal)_12%,transparent)] px-4 py-3 font-deva text-[15px] leading-relaxed">“{story.quote.hi}”</blockquote>
      {story.quote.en && lang !== "hi" && <figcaption className="mt-2 text-[13px] italic leading-snug text-[var(--color-ink-2)]">“{story.quote.en}”</figcaption>}
      <div className="mt-2 text-xs text-[var(--color-ink-3)]">— {story.bright.teacher}, {story.bright.name}</div>
    </figure>
  );
}

function Bar({ label, k, n, tone }: { label: string; k: number; n: number; tone: string }) {
  const { lang } = usePrefs();
  const w = n ? (k / n) * 100 : 0;
  return (
    <div>
      <div className={cx("mb-1 flex justify-between text-xs", lang === "hi" && "font-deva")}>
        <span className="text-[var(--color-ink-2)]">{label}</span>
        <span className="tabular-nums text-[var(--color-ink-3)]">
          {k} / {n}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[rgb(var(--fg)/0.08)]">
        <motion.div initial={{ width: 0 }} whileInView={{ width: `${w}%` }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="h-full rounded-full" style={{ background: tone }} />
      </div>
    </div>
  );
}

function VoiceNote({ story }: { story: Story }) {
  const t = useT();
  const { lang } = usePrefs();
  const bars = useMemo(() => Array.from({ length: 34 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 0.75), []);
  const text = lang === "hi" ? story.rec.voiceNoteHi : story.rec.voiceNoteEn;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--st-support)_12%,transparent)] px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--st-support)", color: "var(--chrome-solid)" }}>
          <Volume2 size={16} />
        </span>
        <div className="flex h-8 flex-1 items-center gap-[3px]">
          {bars.map((h, i) => (
            <span key={i} className="w-[3px] flex-1 rounded-full" style={{ height: `${h * 100}%`, background: "var(--st-support)", opacity: 0.75 }} />
          ))}
        </div>
        <span className="text-xs tabular-nums text-[var(--color-ink-3)]">0:60</span>
      </div>
      <p className={cx("line-clamp-3 text-[13px] leading-snug text-[var(--color-ink-2)]", lang === "hi" && "font-deva")}>{text}</p>
      <div className="flex items-center gap-2 text-xs text-[var(--color-ink-3)]">
        <span className="truncate font-semibold text-[var(--color-ink)]">{story.bright.name}</span>
        <span className="h-px flex-1 border-t border-dashed border-[rgb(var(--fg)/0.3)]" />
        <span className="shrink-0">{story.rec.distanceKm.toFixed(1)} km</span>
        <span className="h-px flex-1 border-t border-dashed border-[rgb(var(--fg)/0.3)]" />
        <span className="truncate font-semibold text-[var(--color-ink)]">{story.recipient.name}</span>
      </div>
      <div className="text-xs text-[var(--color-ink-3)]">{t("Sent only after a CRP or the BEO approves it", "CRP या BEO की मंज़ूरी के बाद ही भेजा जाता है")}</div>
    </div>
  );
}

function FollowUpVisual({ story }: { story: Story }) {
  const t = useT();
  const { lang } = usePrefs();
  const OUT: [string, string, string, string][] = [
    ["adopted", "var(--tone-good)", "Doing it regularly", "नियमित कर रहे हैं"],
    ["trying", "var(--tone-warn)", "Trying it", "आज़मा रहे हैं"],
    ["barrier", "var(--tone-bad)", "Something is in the way", "रुकावट"],
    ["no_answer", "var(--tone-muted)", "No answer — call again", "जवाब नहीं — फिर कॉल"],
  ];
  return (
    <div className="space-y-2">
      <div className={cx("text-xs text-[var(--color-ink-3)]", lang === "hi" && "font-deva")}>{t("Day 14 · “Did you try it? What happened?”", "14वाँ दिन · “क्या आपने आज़माया? क्या हुआ?”")}</div>
      {OUT.map(([k, tone, en, hiText]) => {
        const on = story.followUp?.outcome === k;
        return (
          <div
            key={k}
            className={cx("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition", lang === "hi" && "font-deva", on ? "font-semibold" : "opacity-60")}
            style={{ borderColor: on ? tone : "var(--inset-line)", background: on ? `color-mix(in srgb, ${tone} 12%, transparent)` : undefined }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: tone }} /> {t(en, hiText)}
          </div>
        );
      })}
      {!story.followUp && <div className="text-xs text-[var(--color-ink-3)]">{t("The call has not happened yet in the demo — the answer will light up here.", "डेमो में यह कॉल अभी नहीं हुई — जवाब यहाँ दिखेगा।")}</div>}
    </div>
  );
}

/** The 3D night map, loaded only when it scrolls into view (it is the heaviest part of the page). */
function BlockMap({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const { state } = usePipeline();
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const status = useMemo(() => schoolStatuses(state), [state]);
  const z = useMemo(() => meanZ(state), [state]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setShow(true), io.disconnect()), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="card on-dark overflow-hidden p-3">
      <div className="flex items-center justify-between px-2 pb-2">
        <h3 className={cx("font-semibold", lang === "hi" && "font-deva")}>{t(`${state.block.name} tonight`, `आज रात ${state.block.name}`)}</h3>
        <span className={cx("text-xs text-[var(--color-ink-3)]", lang === "hi" && "font-deva")}>{t("fireflies = bright spots · arcs = who learns from whom", "जुगनू = अच्छे स्कूल · रेखाएँ = कौन किससे सीखता है")}</span>
      </div>
      {show ? (
        <LivingMap mode="3d" schools={state.block.schools} status={status} z={z} links={state.recs.filter((r) => r.wave === 1).map((r) => ({ from: r.demonstratorId, to: r.schoolId }))} onSelect={onOpen} height={380} autoRotate />
      ) : (
        <div className="h-[380px]" />
      )}
    </div>
  );
}
