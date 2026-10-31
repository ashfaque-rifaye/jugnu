// The front door. Instead of explaining modules, it follows ONE practice through the block —
// from a number that looked unusual to a teacher next door trying it — using the live demo
// block, so every step opens the real page where that work happens.
import { motion, useScroll, useSpring } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Languages,
  LineChart,
  MapPinned,
  Mic,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stars,
  UserCheck,
  Volume2,
} from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDemo } from "../components/Demo";
import { AppBackground } from "../components/kit";
import { LogoMark, Wordmark } from "../components/Logo";
import { HeroPoster } from "../components/HeroPoster";
import { LoopFlow } from "../components/LoopFlow";
import { SpreadMap } from "../components/SpreadMap";
import { Threshold } from "../components/Threshold";
import { cx } from "../components/ui";
import { PRACTICES } from "../engine/practices";
import { MEDIA } from "../lib/clips";
import { usePrefs, useT } from "../lib/prefs";
import { setWelcomed } from "../lib/journey";
import { useRole, type Role } from "../lib/role";
import { usePipeline } from "../lib/store";
import { pickStory, type Story } from "../lib/story";
import { ThemeToggle } from "../lib/theme";
import { useReveal, usePointerSheen } from "../lib/motion";

export default function HomePage({ onTour }: { onTour: () => void }) {
  const t = useT();
  const nav = useNavigate();
  const { lang, setLang, lite } = usePrefs();
  const [role, setRole] = useRole();
  const { state, followUps } = usePipeline();
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

  const [doors, setDoors] = useState(false);
  const openDoors = () => (role ? enter("/today") : setDoors(true));
  const mainRef = useRef<HTMLElement>(null);
  useReveal(mainRef);
  usePointerSheen();

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
            <button onClick={() => setDoors(true)} className="rounded-full px-3 py-1.5 hover:bg-[var(--hover)] hover:text-[var(--color-ink)]">
              {t("Who it is for", "किसके लिए")}
            </button>
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
            <button className="btn btn-primary whitespace-nowrap !px-3.5 !py-2" onClick={openDoors}>
              {t("Open Jugnu", "जुगनू खोलें")} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* hero: the name, huge, with one teacher in front of it */}
      <div className="-mt-[66px] px-2 md:px-3">
        <HeroPoster onOpen={openDoors} onPlay={play} onFilm={onTour} canPlay={demo.available} />
      </div>

      <main ref={mainRef} className="mx-auto max-w-[1240px] space-y-24 px-4 pb-16 pt-16 md:px-6">
        {/* the story of one practice */}
        {story && (
          <section id="story" className="scroll-mt-24">
            <SectionHead
              eyebrow={t("How it works — one real example from the demo block", "कैसे काम करता है — डेमो ब्लॉक से एक असली उदाहरण")}
              title={
                <>
                  {t("Follow one method from ", "एक तरीके का सफ़र: ")}
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
        </section>

        {/* how a method travels, on the real map */}
        <SpreadMap onOpen={(id) => enter(`/schools/${id}`)} />

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
                [Smartphone, t("Works where they are", "जहाँ वे हैं, वहीं चले"), t("A teacher needs only a link or a phone call. Low-data mode turns off video on slow networks.", "शिक्षक को सिर्फ़ एक लिंक या फ़ोन कॉल चाहिए। धीमे नेटवर्क पर कम-डेटा मोड वीडियो बंद कर देता है।"), "/testing"],
                [Languages, t("Hindi first", "पहले हिंदी"), t("Interviews, voice notes and the whole app in Hindi or English — one tap to switch.", "बातचीत, आवाज़-संदेश और पूरा ऐप हिंदी या अंग्रेज़ी में — एक टैप में बदलें।"), "/interviews"],
                [UserCheck, t("A person approves every AI draft", "हर AI ड्राफ़्ट को इंसान मंज़ूर करे"), t("Method cards and voice notes wait in Approvals until a coordinator or the BEO says yes.", "तरीकों के कार्ड और आवाज़-संदेश तब तक 'मंज़ूरी' में रुकते हैं जब तक समन्वयक या BEO हाँ न कहें।"), "/review"],
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
          {lite ? <img className="welcome-video" src={MEDIA.doorHeadPoster} alt="" aria-hidden /> : <video className="welcome-video" src={MEDIA.doorHead} poster={MEDIA.doorHeadPoster} autoPlay muted loop playsInline aria-hidden />}
          <div className="welcome-shade" />
          <div className="relative flex flex-col items-start gap-5 p-7 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="max-w-xl">
              <LogoMark size={44} />
              <h2 className={cx("mt-4 text-3xl font-bold md:text-4xl", hi)}>{t("Every block already has its fireflies.", "हर ब्लॉक में जुगनू पहले से हैं।")}</h2>
              <p className={cx("mt-2 text-[var(--color-ink-2)]", hi)}>{t("Jugnu helps the light travel from one classroom to the next.", "जुगनू उनकी रोशनी को एक कक्षा से अगली तक पहुँचाता है।")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary !px-5 !py-3" onClick={openDoors}>
                {t("Open Jugnu", "जुगनू खोलें")} <ArrowRight size={16} />
              </button>
              <a href="/talk" target="_blank" rel="noreferrer" className="btn btn-glass !px-5 !py-3">
                <Mic size={16} /> {t("Talk to Jugnu as a teacher", "शिक्षक बनकर बात करें")}
              </a>
            </div>
          </div>
        </section>
      </main>

      <Threshold open={doors} closable onClose={() => setDoors(false)} />
      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-4 py-8 text-sm text-[var(--color-ink-3)] md:flex-row md:items-start md:justify-between md:px-6">
          <div className="max-w-xl">
            <Wordmark size={26} />
            <p className={cx("mt-3 text-xs leading-relaxed", hi)}>
              {t(
                "AI for Foundational Learning Hackathon · Challenge 4. Schools are real: Damoh's 7 blocks and their 1,365 government schools from UDISE+ (names, locations, clusters, enrolment, teachers). Learning results, attendance and teachers' names are simulated, calibrated to ASER 2024; live interviews are real.",
                "AI for Foundational Learning हैकाथॉन · चुनौती 4। स्कूल असली हैं: दमोह के 7 ब्लॉक और उनके 1,365 सरकारी स्कूल UDISE+ से (नाम, जगह, संकुल, नामांकन, शिक्षक)। सीखने के नतीजे, उपस्थिति और शिक्षकों के नाम सिम्युलेटेड हैं (ASER 2024 के अनुसार); लाइव बातचीत असली है।",
              )}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t("More", "और")}>
            {(
              [
                ["/about", t("About Jugnu", "जुगनू के बारे में")],
                ["/ai", t("Safety", "सुरक्षा")],
                ["/testing", t("Test lab", "टेस्ट लैब")],
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
        `Reported numbers can be inflated, so the CRP spent 15 minutes with ${story.spot.sampled} children: ${story.spot.proficient} could ${verb}. That matches what the school reported (${story.spot.reported}%), so it is a real school doing well.`,
        `दर्ज आँकड़े बढ़ा-चढ़ाकर हो सकते हैं, इसलिए CRP ने ${story.spot.sampled} बच्चों के साथ 15 मिनट बिताए: ${story.spot.proficient} ${verb}। यह स्कूल के दर्ज आँकड़े (${story.spot.reported}%) से मेल खाता है — यह सच में अच्छा स्कूल है।`,
      ),
      visual: <SpotDots sampled={story.spot.sampled} proficient={story.spot.proficient} />,
      to: `/schools/${b.id}`,
      link: t("See the confirmation visit", "जाँच देखें"),
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
      title: t(`“${practice}” is what sets schools doing well apart`, `“${practice}” ही अच्छे स्कूलों को अलग बनाता है`),
      body: t(
        `Jugnu also talks to teachers in similar, ordinary schools. ${ev.bright.k} of ${ev.bright.n} teachers at schools doing well described this routine in detail; in similar schools, ${ev.comparison.k} of ${ev.comparison.n}. It costs nothing extra.`,
        `जुगनू उन जैसे सामान्य स्कूलों के शिक्षकों से भी बात करता है। ${ev.bright.n} में से ${ev.bright.k} अच्छे स्कूलों के शिक्षकों ने यह तरीका विस्तार से बताया; वैसे ही दूसरे स्कूलों में ${ev.comparison.n} में से ${ev.comparison.k}। इसमें कोई अतिरिक्त खर्च नहीं।`,
      ),
      visual: (
        <div className="space-y-3">
          <Bar label={t("Schools doing well", "अच्छे स्कूल")} k={ev.bright.k} n={ev.bright.n} tone="var(--st-bright-fill)" />
          <Bar label={t("Similar schools", "उन जैसे स्कूल")} k={ev.comparison.k} n={ev.comparison.n} tone="var(--st-ok)" />
          <div className="text-xs text-[var(--color-ink-3)]">
            {pct(ev.bright.k, ev.bright.n)}% vs {pct(ev.comparison.k, ev.comparison.n)}%
          </div>
        </div>
      ),
      to: "/practices",
      link: t("See what works", "जो तरीके काम करते हैं, देखें"),
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
            `On the follow-up call: “${story.followUp.saidEn || story.followUp.said}”. At the next assessment, Jugnu compares the schools that got a method with those still waiting — so the block learns what really transfers.`,
            `फ़ॉलो-अप कॉल में: “${story.followUp.said || story.followUp.saidEn}”। अगली परीक्षा में जुगनू तरीका पाने वाले स्कूलों की तुलना बाकी स्कूलों से करता है — ताकि ब्लॉक सीखे कि सच में क्या काम आता है।`,
          )
        : t(
            `Jugnu calls ${r.teacher} to ask what happened. If something is in the way, it goes back to the CRP or the BEO with a name next to it. At the next assessment, schools that got a method are compared with those still waiting.`,
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
      <div className="text-xs text-[var(--color-ink-3)]">{t("Sent only after a coordinator or the BEO approves it", "CRP या BEO की मंज़ूरी के बाद ही भेजा जाता है")}</div>
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
