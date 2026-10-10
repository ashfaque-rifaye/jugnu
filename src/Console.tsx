import { motion } from "framer-motion";
import { BookOpen, BrainCircuit, ChevronDown, ClipboardCheck, Clapperboard, FlaskConical, Handshake, LineChart, MapPinned, MessageCircleQuestion, Mic, Sparkles, Stars, Zap } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AskJugnu } from "./components/AskJugnu";
import { FeedbackButton, useSession } from "./components/Feedback";
import { BackgroundVideo, TutorialPlayer } from "./components/media";
import { PasscodeGate } from "./components/Passcode";
import { AIStatus, cx } from "./components/ui";
import { usePoll } from "./lib/api";
import { MEDIA, TOUR } from "./lib/clips";
import { usePrefs, useT } from "./lib/prefs";
import { PipelineProvider, usePipeline } from "./lib/store";
import { ThemeToggle, useTheme } from "./lib/theme";

const AIPage = lazy(() => import("./pages/AI"));
const AskPage = lazy(() => import("./pages/Ask"));
const FindPage = lazy(() => import("./pages/Find"));
const HomePage = lazy(() => import("./pages/Home"));
const MethodPage = lazy(() => import("./pages/Method"));
const PracticesPage = lazy(() => import("./pages/Practices"));
const ReviewPage = lazy(() => import("./pages/Review"));
const SpreadPage = lazy(() => import("./pages/Spread"));
const TestingPage = lazy(() => import("./pages/Testing"));
const TrackPage = lazy(() => import("./pages/Track"));

const Loading = () => <div className="grid min-h-[40vh] place-items-center text-sm text-[var(--color-ink-3)]">…</div>;

/** The officer / CRP console. The simulated block is computed only here, never for teachers. */
export default function ConsoleRoot() {
  return (
    <PipelineProvider>
      <Console />
    </PipelineProvider>
  );
}

function Console() {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tour, setTour] = useState(false);
  const [ask, setAsk] = useState(false);
  const { theme } = useTheme();
  const { lang, setLang, lite, setLite, liteReason } = usePrefs();
  const { state, select } = usePipeline();
  const session = useSession();
  const [pending] = usePoll<unknown[]>("/api/reviews?status=pending", 15000);

  useEffect(() => {
    if (params.get("ask") === "1") {
      setAsk(true);
      params.delete("ask");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const NAV = [
    { to: "/", label: t("Overview", "सारांश"), icon: Sparkles },
    { to: "/find", label: t("1 Find", "1 खोजें"), icon: MapPinned },
    { to: "/ask", label: t("2 Ask", "2 पूछें"), icon: Mic },
    { to: "/practices", label: t("3 What works", "3 क्या काम करता"), icon: Stars },
    { to: "/spread", label: t("4 Spread", "4 फैलाएँ"), icon: Handshake },
    { to: "/track", label: t("5 Track", "5 ट्रैक"), icon: LineChart },
  ];
  const MORE = [
    { to: "/review", label: t("Review", "समीक्षा"), icon: ClipboardCheck, badge: pending?.length ?? 0 },
    { to: "/testing", label: t("Testing", "परीक्षण"), icon: FlaskConical, badge: 0 },
    { to: "/ai", label: t("AI & guardrails", "AI व जाँच"), icon: BrainCircuit, badge: 0 },
    { to: "/method", label: t("Data & method", "डेटा व पद्धति"), icon: BookOpen, badge: 0 },
  ];
  const link = (isActive: boolean) =>
    cx("relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition", isActive ? "bg-white/15 text-white shadow-inner" : "text-[var(--color-ink-2)] hover:bg-white/8 hover:text-white");

  return (
    <>
      <div className="aurora" aria-hidden>
        <div className="blob a" />
        <div className="blob b" />
        <div className="blob c" />
        {!lite && <BackgroundVideo key={theme} src={theme === "mono" ? MEDIA.ribbonsMono : MEDIA.fireflies} opacity={theme === "mono" ? 0.14 : 0.3} className="mix-blend-screen" />}
        <div className="grid" />
        <div className="grain" />
      </div>
      <header className="no-print sticky top-0 z-40 px-3 pt-3 md:px-6">
        <nav className="glass-strong mx-auto flex max-w-[1500px] items-center gap-2 rounded-full px-3 py-2">
          <NavLink to="/" className="mr-1 flex items-center gap-2 pl-1">
            <span className="relative grid h-9 w-9 place-items-center rounded-full bg-amber-200/10 glow-ring" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-amber-200 shadow-[0_0_18px_7px_rgba(253,224,71,0.6)]" />
            </span>
            <span className="hidden font-display text-lg font-bold tracking-tight sm:inline">
              Jugnu <span className="font-deva text-sm font-semibold text-[var(--color-ink-3)]">जुगनू</span>
            </span>
          </NavLink>
          <div className="scroll-thin flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => link(isActive)} title={label}>
                <Icon size={15} aria-hidden />
                <span className={cx("hidden lg:inline", lang === "hi" && "font-deva")}>{label}</span>
              </NavLink>
            ))}
          </div>
          <MoreMenu items={MORE} lang={lang} label={t("More", "और")} />
          <button className="btn btn-primary !py-1.5" onClick={() => setAsk(true)} title="Ask Jugnu">
            <MessageCircleQuestion size={15} /> <span className="hidden md:inline">Ask Jugnu</span>
          </button>
          <button className="btn btn-glass hidden !py-1.5 2xl:inline-flex" onClick={() => setTour(true)}>
            <Clapperboard size={15} /> {t("Tour", "टूर")}
          </button>
          <button className="btn btn-glass !px-3 !py-1.5 font-deva" onClick={() => setLang(lang === "hi" ? "en" : "hi")} title={t("Switch to Hindi", "Switch to English")}>
            {lang === "hi" ? "EN" : "हिं"}
          </button>
          <button
            className={cx("btn !px-3 !py-1.5", lite ? "btn-primary" : "btn-glass")}
            onClick={() => setLite(!lite)}
            title={lite ? t(`Low-data mode on${liteReason ? ` — ${liteReason}` : ""}`, "कम-डेटा मोड चालू") : t("Low-data mode: no video, no 3D", "कम-डेटा मोड: न वीडियो, न 3D")}
            aria-pressed={lite}
          >
            <Zap size={15} />
          </button>
          <ThemeToggle />
          <AIStatus />
        </nav>
        {session.id && (
          <div className="mx-auto mt-2 flex max-w-[1500px] items-center justify-between gap-2 rounded-full border border-amber-200/30 bg-amber-200/10 px-4 py-1.5 text-sm">
            <span>
              <FlaskConical size={14} className="mr-1 inline" /> {t("Testing session running", "परीक्षण सत्र जारी")} · {session.role}
            </span>
            <NavLink to="/testing" className="underline">
              {t("Tasks & survey", "काम व सर्वे")}
            </NavLink>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-[1500px] px-3 pb-24 pt-6 md:px-6">
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Suspense fallback={<Loading />}>
          <Routes location={location}>
            <Route path="/" element={<HomePage onTour={() => setTour(true)} />} />
            <Route path="/find" element={<FindPage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/practices" element={<PracticesPage />} />
            <Route path="/spread" element={<SpreadPage />} />
            <Route path="/track" element={<TrackPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/testing" element={<TestingPage />} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/method" element={<MethodPage />} />
          </Routes>
          </Suspense>
        </motion.div>
      </main>
      <TutorialPlayer clips={TOUR} open={tour} onClose={() => setTour(false)} />
      <AskJugnu
        open={ask}
        onClose={() => setAsk(false)}
        onSchool={(name) => {
          const s = state.block.schools.find((x) => x.name === name);
          if (s) select(s.id);
          navigate("/find");
        }}
      />
      <FeedbackButton />
      <PasscodeGate />
      <footer className="no-print mx-auto max-w-[1500px] px-6 pb-8 text-xs text-[var(--color-ink-3)]">
        {t(
          "Jugnu · AI for Foundational Learning Hackathon · Challenge 4 (Data to Action). Adults only, with consent — no child-level data. The demo block is simulated and calibrated to ASER 2024; live pilot interviews are real. Cinematic clips generated with Google Flow (Veo 3.1).",
          "जुगनू · AI for Foundational Learning हैकाथॉन · चुनौती 4 (डेटा से कार्य)। सिर्फ़ वयस्क, सहमति से — बच्चों का कोई व्यक्तिगत डेटा नहीं। डेमो ब्लॉक सिम्युलेटेड है (ASER 2024 के अनुसार); लाइव पायलट बातचीत असली है।",
        )}
      </footer>
    </>
  );
}

function MoreMenu({ items, lang, label }: { items: { to: string; label: string; icon: typeof Sparkles; badge: number }[]; lang: string; label: string }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const total = items.reduce((a, b) => a + b.badge, 0);
  const active = items.some((i) => location.pathname.startsWith(i.to));
  return (
    <div className="relative">
      <button className={cx("btn !py-1.5", active ? "btn-primary" : "btn-glass")} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ChevronDown size={15} /> <span className={cx("hidden sm:inline", lang === "hi" && "font-deva")}>{label}</span>
        {total > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-200 px-1 text-[10px] font-bold text-black">{total}</span>}
      </button>
      {open && (
        <div className="glass-strong absolute right-0 top-11 z-50 w-56 p-2">
          {items.map(({ to, label: l, icon: Icon, badge }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx("flex items-center gap-2 rounded-xl px-3 py-2 text-sm", isActive ? "bg-white/15" : "hover:bg-white/8")}>
              <Icon size={15} /> <span className={cx("flex-1", lang === "hi" && "font-deva")}>{l}</span>
              {badge > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-200 px-1 text-[10px] font-bold text-black">{badge}</span>}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
