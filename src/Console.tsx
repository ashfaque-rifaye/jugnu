import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  BrainCircuit,
  CalendarCheck2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clapperboard,
  Compass,
  Ellipsis,
  FlaskConical,
  Handshake,
  House,
  Landmark,
  MapPin,
  Info,
  LineChart,
  MessageCircleQuestion,
  MessageSquareHeart,
  Mic,
  Play,
  School as SchoolIcon,
  Search,
  Stars,
  Stethoscope,
  X,
  Zap,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useReveal, usePointerSheen, useScrollingDown } from "./lib/motion";
import { Navigate, NavLink, Route, Routes, useLocation, useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { AgentDock } from "./components/Agent";
import { describeEvent } from "./components/ActivityFeed";
import { DemoProvider, useDemo } from "./components/Demo";
import { FEEDBACK_EVENT, FeedbackButton, useSession } from "./components/Feedback";
import { AppBackground, SPRING } from "./components/kit";
import { Locator } from "./components/Locator";
import { LogoMark, Wordmark } from "./components/Logo";
import { FilmPlayer } from "./components/Film";
import { PasscodeGate } from "./components/Passcode";
import { AIStatus, cx } from "./components/ui";
import { Welcome } from "./components/Welcome";
import { DAMOH, profileFor } from "./engine/district";
import { usePoll } from "./lib/api";
import { markJourney, setWelcomed, useWelcomed } from "./lib/journey";
import { usePrefs, useT } from "./lib/prefs";
import { roleName, useRole, type Role } from "./lib/role";
import { schoolStatuses, STATUS_INFO } from "./lib/status";
import { PipelineProvider, usePipeline } from "./lib/store";
import { loopCounts, pickStory } from "./lib/story";
import { ThemeToggle } from "./lib/theme";
import { ToastProvider, useToast } from "./lib/toast";
import { TourProvider, useTour, type TourStep } from "./lib/tour";

const HomePage = lazy(() => import("./pages/Home"));
const TodayPage = lazy(() => import("./pages/Today"));
const SchoolsPage = lazy(() => import("./pages/Schools"));
const SchoolPage = lazy(() => import("./pages/School"));
const AskPage = lazy(() => import("./pages/Ask"));
const PracticesPage = lazy(() => import("./pages/Practices"));
const PlanPage = lazy(() => import("./pages/Plan"));
const ResultsPage = lazy(() => import("./pages/Results"));
const ReviewPage = lazy(() => import("./pages/Review"));
const TestingPage = lazy(() => import("./pages/Testing"));
const AIPage = lazy(() => import("./pages/AI"));
const MethodPage = lazy(() => import("./pages/Method"));
const DistrictPage = lazy(() => import("./pages/District"));
const AboutPage = lazy(() => import("./pages/About"));

/** While a page loads: glass placeholders in the shape of a page. */
const Loading = () => (
  <div className="space-y-5" aria-busy="true" aria-label="Loading">
    <div className="skeleton h-10 w-56 rounded-full" />
    <div className="skeleton h-44 rounded-[2rem]" />
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="skeleton h-64 rounded-[1.75rem]" />
      <div className="skeleton h-64 rounded-[1.75rem]" />
    </div>
  </div>
);

/** The officer / CRP console. The block is computed only here, never for teachers. */
export default function ConsoleRoot() {
  const { pathname } = useLocation();
  return (
    <ToastProvider>
      <PipelineProvider>
        <TourProvider>
          <DemoProvider>{pathname === "/" ? <Home /> : <Console />}</DemoProvider>
        </TourProvider>
      </PipelineProvider>
    </ToastProvider>
  );
}

/** The front door: a page of its own, without the app's menus. */
function Home() {
  const [tour, setTour] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0); // (newer browsers return a Promise here, which an effect must not return)
  }, []);
  return (
    <>
      <Suspense fallback={<div className="min-h-dvh" />}>
        <HomePage onTour={() => setTour(true)} />
      </Suspense>
      <FilmPlayer open={tour} onClose={() => setTour(false)} />
    </>
  );
}

type NavItem = { to: string; label: string; icon: typeof Stars; badge?: number; n?: string; meta?: string };

function Console() {
  const t = useT();
  const { lang } = usePrefs();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [film, setFilm] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const [more, setMore] = useState(false);
  const [role] = useRole();
  const [roleSheet, setRoleSheet] = useState(false);
  const welcomed = useWelcomed();
  const { state, select, followUps } = usePipeline();
  const session = useSession();
  const mainRef = useRef<HTMLElement>(null);
  useReveal(mainRef);
  usePointerSheen();
  const tucked = useScrollingDown();
  const tour = useTour();
  const demo = useDemo();
  const [pending] = usePoll<unknown[]>("/api/reviews?status=pending", 15000);
  const c = loopCounts(state, followUps);
  const tourSteps = useTourSteps();
  const startTour = () => (setMore(false), tour.start(tourSteps));

  useEffect(() => {
    if (params.get("ask") === "1") {
      setAsk(true);
      params.delete("ask");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);
  useEffect(() => setMore(false), [location.pathname]);
  useJourneyMarks();

  const wave1 = state.recs.filter((r) => r.wave === 1).length;
  const LOOP: NavItem[] = [
    { to: "/schools", n: "1", label: t("Schools", "स्कूल"), icon: SchoolIcon, meta: c.checksDue ? t(`${c.checksDue} due`, `${c.checksDue} बाकी`) : String(c.bright) },
    { to: "/interviews", n: "2", label: t("Interviews", "बातचीत"), icon: Mic, meta: String(c.heard) },
    { to: "/practices", n: "3", label: t("What works", "क्या काम करता है"), icon: Stars, meta: String(c.practices) },
    { to: "/plan", n: "4", label: t("Support plan", "मदद की योजना"), icon: Handshake, meta: `${c.reached}/${wave1}` },
    { to: "/results", n: "5", label: t("Results", "नतीजे"), icon: LineChart, meta: `${c.calls}/${wave1}` },
  ];
  const TOP: NavItem[] = [
    { to: "/today", label: t("Today", "आज"), icon: CalendarCheck2 },
    { to: "/review", label: t("Approvals", "मंज़ूरी"), icon: ClipboardCheck, badge: pending?.length ?? 0 },
    { to: "/district", label: t("District (Damoh)", "ज़िला (दमोह)"), icon: Landmark },
  ];
  const TOOLS: NavItem[] = [
    { to: "/", label: t("Home page", "होम पेज"), icon: House },
    { to: "/testing", label: t("User testing", "उपयोगकर्ता परीक्षण"), icon: FlaskConical },
    { to: "/ai", label: t("AI & safety checks", "AI व सुरक्षा जाँच"), icon: BrainCircuit },
    { to: "/method", label: t("Data & method", "डेटा व पद्धति"), icon: BookOpen },
    { to: "/about", label: t("About Jugnu", "जुगनू के बारे में"), icon: Info },
  ];

  const showTools = toolsOpen || TOOLS.some((x) => x.to !== "/" && location.pathname.startsWith(x.to));

  const navLink = ({ to, label, icon: Icon, badge, n, meta }: NavItem, group: string) => (
    <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => cx("nav-item", isActive && to !== "/" && "active")}>
      {({ isActive }) => (
        <>
          {isActive && to !== "/" && <motion.span layoutId={`nav-${group}`} className="nav-pill" transition={SPRING} />}
          {n ? (
            <span className={cx("grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-xs font-bold", isActive ? "text-[#0b1308]" : "text-[var(--color-ink-2)]")} style={{ background: isActive ? "var(--grad-flat)" : "var(--chip)" }}>
              {n}
            </span>
          ) : (
            <Icon size={18} aria-hidden />
          )}
          <span className={cx("flex-1 truncate", lang === "hi" && "font-deva")}>{label}</span>
          {!!badge && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#fcd34d] px-1.5 text-xs font-bold text-[#0b1308]">{badge}</span>}
          {meta && <span className="text-xs font-medium tabular-nums text-[var(--color-ink-3)]">{meta}</span>}
        </>
      )}
    </NavLink>
  );

  const sidebar = (
    <div className="flex h-full flex-col gap-3 p-3">
      <NavLink to="/" className="px-1.5 pt-1" title={t("Home page", "होम पेज")}>
        <Wordmark sub={`${state.block.name} · ${state.block.source === "simulated" ? t("demo data", "डेमो डेटा") : t("your data", "आपका डेटा")}`} />
      </NavLink>
      <nav className="space-y-0.5" aria-label={t("Main", "मुख्य")}>
        {TOP.map((x) => navLink(x, "main"))}
      </nav>
      <div data-tour="nav-loop">
        <div className="label mb-1.5 flex items-center justify-between px-3">
          <span>{t("The loop", "चक्र")}</span>
          <span className="normal-case tracking-normal">{t("this term", "इस सत्र")}</span>
        </div>
        <nav className="space-y-0.5" aria-label={t("The loop", "चक्र")}>
          {LOOP.map((x) => navLink(x, "main"))}
        </nav>
      </div>
      <button className="btn btn-primary justify-center" onClick={() => setAsk(true)}>
        <MessageCircleQuestion size={16} /> {t("Ask Jugnu", "जुगनू से पूछें")}
      </button>
      <nav className="space-y-0.5 border-t border-[var(--line)] pt-3" aria-label={t("More", "और")}>
        <button className="nav-item w-full" onClick={() => setToolsOpen((v) => !v)} aria-expanded={showTools}>
          <Ellipsis size={18} aria-hidden /> <span className="flex-1 text-left">{t("More", "और")}</span>
          <ChevronRight size={16} aria-hidden className={cx("transition-transform", showTools && "rotate-90")} />
        </button>
        {showTools && (
          <>
        <button className="nav-item w-full" onClick={startTour}>
          <Compass size={18} aria-hidden /> <span className="flex-1 text-left">{t("Guide me", "गाइड करें")}</span>
        </button>
        {demo.available && (
          <button className="nav-item w-full" onClick={demo.start}>
            <Play size={18} aria-hidden /> <span className="flex-1 text-left">{t("Play the term", "सत्र चलाकर देखें")}</span>
          </button>
        )}
        {TOOLS.map((x) => navLink(x, "tools"))}
          </>
        )}
      </nav>
      <div className="mt-auto space-y-2.5">
        <RoleBadge role={role} onChange={() => setRoleSheet(true)} />
        <PrefsRow />
      </div>
    </div>
  );

  const TABS: NavItem[] = [
    { to: "/today", label: t("Today", "आज"), icon: CalendarCheck2 },
    { to: "/schools", label: t("Schools", "स्कूल"), icon: SchoolIcon },
    { to: "/plan", label: t("Support plan", "मदद की योजना"), icon: Handshake },
    { to: "/results", label: t("Results", "नतीजे"), icon: LineChart },
  ];
  const tabMatch = TABS.find((x) => location.pathname === x.to || location.pathname.startsWith(`${x.to}/`));

  return (
    <>
      <AppBackground />
      {/* desktop: floating glass sidebar */}
      <aside className="chrome no-print scroll-thin fixed bottom-3 left-3 top-3 z-30 hidden w-[256px] overflow-y-auto rounded-[1.9rem] lg:block">{sidebar}</aside>

      <div className="lg:pl-[268px]">
        <header className={cx("no-print sticky top-0 z-20 px-3 pt-3 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:px-5", tucked && !more && "max-lg:-translate-y-[120%]")}>
          <div className="chrome mx-auto flex max-w-[1400px] items-center gap-2 rounded-full py-1.5 pl-2 pr-1.5">
            <NavLink to="/" className="shrink-0 lg:hidden" title={t("Home page", "होम पेज")}>
              <LogoMark size={34} />
            </NavLink>
            <SchoolSearch
              onPick={(id) => {
                select(id);
                navigate(`/schools/${id}`);
              }}
            />
            <LiveIndicator />
            <span className="hidden md:inline-flex">
              <AIStatus />
            </span>
            <button className="btn btn-glass !px-3 !py-2" onClick={startTour} data-tour="guide" title={t("Show me around", "मुझे घुमाएँ")}>
              <Compass size={16} /> <span className="hidden sm:inline">{t("Guide", "गाइड")}</span>
            </button>
            <button className="btn btn-glass !hidden !px-3 !py-2 lg:!inline-flex" onClick={() => window.dispatchEvent(new Event(FEEDBACK_EVENT))}>
              <MessageSquareHeart size={16} /> {t("Feedback", "राय दें")}
            </button>
            <button className="btn btn-glass btn-icon !p-2 lg:hidden" onClick={() => setAsk(true)} aria-label={t("Ask Jugnu", "जुगनू से पूछें")}>
              <MessageCircleQuestion size={17} />
            </button>
          </div>
          {session.id && (
            <div className="chrome mx-auto mt-2 flex max-w-[1400px] items-center justify-between gap-2 rounded-full px-4 py-1.5 text-sm">
              <span>
                <FlaskConical size={14} className="mr-1 inline text-[var(--st-bright)]" /> {t("Testing session running", "परीक्षण सत्र जारी")} · {session.role}
              </span>
              <NavLink to="/testing" className="font-semibold text-[var(--st-bright)]">
                {t("Tasks & survey", "काम व सर्वे")} →
              </NavLink>
            </div>
          )}
        </header>

        <main ref={mainRef} className="mx-auto max-w-[1400px] px-3 pb-36 pt-5 md:px-5 lg:pb-14">
          {/* only movement here: the page's cards fade in themselves (see useReveal), so the glass keeps blurring */}
          <motion.div key={location.pathname} initial={{ y: 18 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 30 }}>
            <WhereBar />
            <Suspense fallback={<Loading />}>
              <Routes location={location}>
                <Route path="/today" element={<TodayPage onAsk={() => setAsk(true)} onRole={() => setRoleSheet(true)} onTour={startTour} />} />
                <Route path="/schools" element={<SchoolsPage />} />
                <Route path="/schools/:id" element={<SchoolPage />} />
                <Route path="/interviews" element={<AskPage />} />
                <Route path="/practices" element={<PracticesPage />} />
                <Route path="/plan" element={<PlanPage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/review" element={<ReviewPage />} />
                <Route path="/testing" element={<TestingPage />} />
                <Route path="/ai" element={<AIPage />} />
                <Route path="/method" element={<MethodPage />} />
                <Route path="/district" element={<DistrictPage />} />
                <Route path="/about" element={<AboutPage onTour={() => setFilm(true)} />} />
                {/* older links */}
                <Route path="/find" element={<Navigate to="/schools" replace />} />
                <Route path="/ask" element={<Navigate to="/interviews" replace />} />
                <Route path="/spread" element={<Navigate to="/plan" replace />} />
                <Route path="/track" element={<Navigate to="/results" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </motion.div>
        </main>
        <footer className="no-print mx-auto max-w-[1400px] px-6 pb-28 text-xs leading-relaxed text-[var(--color-ink-3)] lg:pb-8">
          {t("Schools are real (UDISE+). Learning results and teacher names are simulated. Live interviews are real.", "स्कूल असली हैं (UDISE+)। सीखने के नतीजे और शिक्षकों के नाम सिम्युलेटेड हैं। लाइव बातचीत असली है।")}{" "}
          <NavLink to="/method" className="font-semibold underline underline-offset-2 hover:text-[var(--color-ink)]">
            {t("Data & method", "डेटा व पद्धति")}
          </NavLink>
        </footer>
      </div>

      {/* phones: floating glass tab bar */}
      {/* phones: floating glass tab bar — it shrinks while you scroll down, like iOS */}
      <nav className="no-print fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 lg:hidden" aria-label={t("Main", "मुख्य")} data-tour="nav-loop">
        <motion.div
          className="chrome mx-auto flex rounded-full p-1.5"
          initial={false}
          animate={{ maxWidth: tucked ? 300 : 448, y: tucked ? 4 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {TABS.map(({ to, label, icon: Icon }) => {
            const on = tabMatch?.to === to;
            return (
              <NavLink key={to} to={to} className={cx("relative isolate flex flex-auto flex-col items-center justify-center rounded-full px-1.5 py-1.5 text-xs font-semibold transition-colors", on ? "text-[var(--color-ink)]" : "text-[var(--color-ink-3)]", lang === "hi" && "font-deva")}>
                {on && <motion.span layoutId="tab-pill" className="seg-on absolute inset-0 -z-10 rounded-full" transition={SPRING} />}
                <motion.span key={String(on)} initial={on ? { scale: 0.7, y: 2 } : false} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
                  <Icon size={20} strokeWidth={on ? 2.3 : 1.9} aria-hidden style={on ? { color: "var(--st-bright)" } : undefined} />
                </motion.span>
                <motion.span className="overflow-hidden whitespace-nowrap" initial={false} animate={{ height: tucked ? 0 : 15, opacity: tucked ? 0 : 1, marginTop: tucked ? 0 : 2 }} transition={{ duration: 0.25 }}>
                  {label}
                </motion.span>
              </NavLink>
            );
          })}
          <button className={cx("relative isolate flex flex-auto flex-col items-center justify-center rounded-full px-1.5 py-1.5 text-xs font-semibold", more ? "text-[var(--color-ink)]" : "text-[var(--color-ink-3)]")} onClick={() => setMore(true)}>
            <Ellipsis size={20} aria-hidden />
            <motion.span className="overflow-hidden" initial={false} animate={{ height: tucked ? 0 : 15, opacity: tucked ? 0 : 1, marginTop: tucked ? 0 : 2 }} transition={{ duration: 0.25 }}>
              {t("More", "और")}
            </motion.span>
          </button>
        </motion.div>
      </nav>

      {/* phones: the rest of the menu as a sheet */}
      <AnimatePresence>
        {more && (
          <motion.div className="no-print fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="scrim absolute inset-0" onClick={() => setMore(false)} />
            <motion.div
              className="sheet absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] max-h-[86dvh] overflow-y-auto rounded-[2rem] p-3"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, i) => i.offset.y > 90 && setMore(false)}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--ring-track)]" />
              <div className="mb-2 flex items-center justify-between px-1">
                <Wordmark size={30} sub={state.block.name} />
                <button className="btn btn-glass btn-icon !p-2" onClick={() => setMore(false)} aria-label={t("Close", "बंद करें")}>
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-primary justify-center" onClick={() => (setMore(false), setAsk(true))}>
                  <MessageCircleQuestion size={16} /> {t("Ask Jugnu", "पूछें")}
                </button>
                <button className="btn btn-glass justify-center" onClick={startTour}>
                  <Compass size={16} /> {t("Guide me", "गाइड करें")}
                </button>
              </div>
              {demo.available && (
                <button className="card-inset mt-2 flex w-full items-center gap-3 p-3 text-left" onClick={() => (setMore(false), demo.start())}>
                  <span className="grid h-9 w-9 place-items-center rounded-full text-[#0b1308]" style={{ background: "var(--grad-flat)" }}>
                    <Play size={16} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{t("Play the term", "सत्र चलाकर देखें")}</span>
                    <span className="block text-xs text-[var(--color-ink-3)]">{t("14 days of field work in 40 seconds", "14 दिन का काम 40 सेकंड में")}</span>
                  </span>
                  <ChevronRight size={16} className="text-[var(--color-ink-3)]" />
                </button>
              )}
              <div className="mt-3 rounded-[1.4rem] bg-[var(--inset-bg)] p-1.5">
                <div className="label px-3 pb-1 pt-1.5">{t("The loop", "चक्र")}</div>
                {[TOP[1], ...LOOP].map((x) => navLink(x, "sheet"))}
              </div>
              <div className="mt-2 rounded-[1.4rem] bg-[var(--inset-bg)] p-1.5">
                {TOOLS.map((x) => navLink(x, "sheet-tools"))}
                <button className="nav-item w-full" onClick={() => (setMore(false), setFilm(true))}>
                  <Clapperboard size={18} aria-hidden /> <span className="flex-1 text-left">{t("2-minute film", "2 मिनट की फ़िल्म")}</span>
                </button>
                <button className="nav-item w-full" onClick={() => (setMore(false), window.dispatchEvent(new Event(FEEDBACK_EVENT)))}>
                  <MessageSquareHeart size={18} aria-hidden /> <span className="flex-1 text-left">{t("Give feedback", "राय दें")}</span>
                </button>
              </div>
              <div className="mt-3 space-y-2.5">
                <RoleBadge role={role} onChange={() => (setMore(false), setRoleSheet(true))} />
                <PrefsRow />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <FilmPlayer open={film} onClose={() => setFilm(false)} />
      <AgentDock open={ask} onOpen={() => setAsk(true)} onClose={() => setAsk(false)} />
      <LiveToasts />
      <FeedbackButton />
      <Welcome
        open={!welcomed || roleSheet}
        mode={welcomed ? "role" : "full"}
        onDone={(withTour) => {
          setRoleSheet(false);
          if (!welcomed) setWelcomed(true);
          if (withTour) window.setTimeout(() => tour.start(tourSteps), 350);
        }}
      />
      <PasscodeGate />
    </>
  );
}

/** Where you are, always: state › district › block (› cluster › school), with the block lit on a
 *  tiny map and a switcher to any of Damoh's 7 real blocks. */
function WhereBar() {
  const t = useT();
  const { lang } = usePrefs();
  const { state, regenerate } = usePipeline();
  const school = useMatch("/schools/:id");
  const s = school ? state.block.schools.find((x) => x.id === school.params.id) : undefined;
  const profile = profileFor(state.block.seed);
  const crumb = "text-[var(--color-ink-3)]";
  const sep = <ChevronRight size={12} className="shrink-0 opacity-50" aria-hidden />;
  if (!profile)
    return (
      <div className="no-print mb-3 flex items-center gap-1.5 text-xs text-[var(--color-ink-3)]">
        <MapPin size={13} /> {state.block.name} · {state.block.source === "imported" ? t("your data", "आपका डेटा") : t("simulated block (not a real place)", "सिम्युलेटेड ब्लॉक (असली जगह नहीं)")}
      </div>
    );
  return (
    <nav className="no-print mb-3 flex min-w-0 items-center gap-2 text-xs" aria-label={t("Where you are", "आप कहाँ हैं")}>
      <Locator block={profile.block} size={0.5} className="hidden sm:inline-flex" />
      <span className="flex min-w-0 flex-wrap items-center gap-1">
        <span className={crumb}>{t("Madhya Pradesh", "मध्य प्रदेश")}</span>
        {sep}
        <NavLink to="/district" className={cx(crumb, "tap-link hover:text-[var(--color-ink)] hover:underline")}>
          {t("Damoh district", "दमोह ज़िला")}
        </NavLink>
        {sep}
        <label className="relative inline-flex items-center">
          <select
            className="cursor-pointer appearance-none rounded-full bg-[var(--chip)] py-0.5 pl-2 pr-5 font-semibold max-lg:py-2.5 text-[var(--color-ink)] outline-none"
            value={profile.code}
            onChange={(e) => regenerate(Number(e.target.value))}
            aria-label={t("Block", "ब्लॉक")}
          >
            {DAMOH.map((p) => (
              <option key={p.code} value={p.code}>
                {t(`${p.block} block`, `${p.block} ब्लॉक`)}
              </option>
            ))}
          </select>
          <ChevronDown size={11} className="pointer-events-none absolute right-1.5" />
        </label>
        {s && (
          <>
            {sep}
            <span className={crumb}>
              {s.clusterName} {t("cluster", "क्लस्टर")}
            </span>
            {sep}
            <span className="font-semibold">{lang === "hi" && s.nameHi ? s.nameHi : s.name}</span>
          </>
        )}
      </span>
    </nav>
  );
}

/** Marks pages as seen for the "first 10 minutes" checklist. */
function useJourneyMarks() {
  const { pathname } = useLocation();
  const school = useMatch("/schools/:id");
  const { state } = usePipeline();
  const id = school?.params.id;
  useEffect(() => {
    markJourney(`seen:${pathname}`);
    if (id && schoolStatuses(state).get(id) === "bright") markJourney("seen:bright");
  }, [pathname, id, state]);
}

/** The guided tour, written for the person's role. */
function useTourSteps(): TourStep[] {
  const [role] = useRole();
  const { state, followUps } = usePipeline();
  return useMemo(() => {
    const status = schoolStatuses(state);
    const story = pickStory(state, followUps);
    const inPatch = (id: string) => role?.kind !== "crp" || state.block.schools.find((s) => s.id === id)?.cluster === role.cluster;
    const crpSchool = [...status].filter(([id, v]) => inPatch(id) && (v === "check_due" || v === "bright")).sort((a, b) => (a[1] === "check_due" ? -1 : 1) - (b[1] === "check_due" ? -1 : 1))[0]?.[0];
    const school = role?.kind === "crp" ? (crpSchool ?? story?.bright.id) : story?.bright.id;
    const st = school ? status.get(school) : undefined;
    const nextBody: [string, string] =
      st === "check_due"
        ? ["Record the spot check right here — 15 children, 15 minutes. The school's status changes the moment you save.", "जाँच यहीं दर्ज करें — 15 बच्चे, 15 मिनट। सहेजते ही स्कूल की स्थिति बदल जाती है।"]
        : st === "bright"
          ? ["For a bright spot the next step is a 12-minute voice interview: one button creates the WhatsApp link and QR code for the teacher.", "अच्छे स्कूल के लिए अगला कदम 12 मिनट की बातचीत है: एक बटन से शिक्षक के लिए WhatsApp लिंक और QR बनता है।"]
          : ["Every school page opens with one clear next step, and the action to take it.", "हर स्कूल का पेज एक साफ़ अगले कदम से शुरू होता है।"];
    const steps: TourStep[] = [
      {
        route: "/today",
        target: "hero-next",
        title: ["Start here, every day", "हर दिन, यहीं से शुरू करें"],
        body: ["Jugnu puts your most important next step at the top — one tap opens the school and the form you need.", "जुगनू आपका सबसे ज़रूरी अगला कदम सबसे ऊपर रखता है — एक टैप में स्कूल और ज़रूरी फ़ॉर्म खुलता है।"],
      },
      {
        target: "rings",
        title: ["This term at a glance", "इस सत्र की झलक"],
        body: [
          "Three rings fill as the term moves: candidates checked on the spot, struggling schools reached with a practice, and teachers called back on day 14.",
          "सत्र आगे बढ़ते ही तीन घेरे भरते हैं: मौके पर जाँचे स्कूल, तरीका पहुँचे स्कूल, और 14वें दिन फ़ोन किए गए शिक्षक।",
        ],
      },
      {
        target: "journey",
        title: ["Your first 10 minutes", "आपके पहले 10 मिनट"],
        body: ["Five steps for your role. Each one ticks itself off as you do it — no setup needed.", "आपकी भूमिका के पाँच कदम। करते ही हर कदम अपने-आप पूरा हो जाता है।"],
      },
      {
        target: "nav-loop",
        title: ["The loop, in order", "चक्र, क्रम से"],
        body: ["Schools → Interviews → What works → Support plan → Results. Each page is one step; the numbers show what is waiting.", "स्कूल → बातचीत → क्या काम करता है → मदद की योजना → नतीजे। हर पेज एक कदम है; अंक बताते हैं क्या बाकी है।"],
      },
      {
        target: "map",
        title: ["Your block on the map", "नक्शे पर आपका ब्लॉक"],
        body: ["Every dot is a real government school (UDISE+), coloured by how it is doing. Tap one for its card; the ruler measures the road between two schools.", "हर बिंदु एक असली सरकारी स्कूल है (UDISE+), रंग बताता है हाल। कार्ड के लिए छुएँ; पैमाना दो स्कूलों के बीच की दूरी नापता है।"],
      },
    ];
    if (school)
      steps.push(
        {
          route: `/schools/${school}`,
          target: "school-tracker",
          title: ["Every school has a tracker", "हर स्कूल का ट्रैकर"],
          body: ["Like a parcel on its way: where this school is in the loop, what is done, and what comes next.", "जैसे रास्ते में पार्सल: स्कूल चक्र में कहाँ है, क्या हो चुका, आगे क्या है।"],
        },
        { target: "school-next", title: ["One clear next step", "एक साफ़ अगला कदम"], body: nextBody },
      );
    steps.push(
      {
        target: "live",
        title: ["Live on every screen", "हर स्क्रीन पर लाइव"],
        body: ["What anyone records — on a phone in the field or here — reaches every screen within seconds, with a notification.", "कोई भी जो दर्ज करे — मैदान में फ़ोन पर या यहाँ — कुछ ही सेकंड में हर स्क्रीन पर सूचना के साथ पहुँचता है।"],
      },
      {
        target: "guide",
        title: ["Replay any time", "कभी भी दोबारा"],
        body: ["Open this guide again from here. To watch a whole term in 40 seconds, press “Play the term” on Today.", "यह गाइड यहाँ से फिर खोलें। पूरा सत्र 40 सेकंड में देखने के लिए ‘आज’ पर “सत्र चलाकर देखें” दबाएँ।"],
      },
    );
    return steps;
  }, [role, state, followUps]);
}

/** "Live · 2 s": the shared log is being kept up to date. */
function LiveIndicator() {
  const t = useT();
  const { lastSync, syncError, demoEvents } = usePipeline();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ago = lastSync ? Math.max(0, Math.round((Date.now() - lastSync) / 1000)) : null;
  const ok = !syncError && ago !== null && ago < 40;
  const connecting = lastSync === null && !syncError;
  const tone = demoEvents.length ? "var(--tone-teal)" : connecting ? "var(--tone-muted)" : ok ? "var(--tone-good)" : "var(--tone-warn)";
  return (
    <span
      className="chip shrink-0 !py-1.5"
      data-tour="live"
      title={
        syncError
          ? t(`Can't reach the server — retrying (${syncError})`, `सर्वर तक नहीं पहुँच पा रहे — फिर कोशिश (${syncError})`)
          : t("Changes anyone records appear on every screen within seconds.", "कोई भी जो दर्ज करे, कुछ सेकंड में हर स्क्रीन पर दिखता है।")
      }
    >
      <span className="live-dot" style={{ color: tone }} />
      <span style={{ color: tone }}>{demoEvents.length ? t("Playback", "प्लेबैक") : connecting ? t("Connecting", "जुड़ रहे") : ok ? t("Live", "लाइव") : t("Offline", "ऑफ़लाइन")}</span>
      {ok && !demoEvents.length && <span className="hidden tabular-nums text-[var(--color-ink-3)] sm:inline">{ago}s</span>}
    </span>
  );
}

/** Banners for what other people just did (any device), and "what next" after your own action. */
function LiveToasts() {
  const t = useT();
  const toast = useToast();
  const [role] = useRole();
  const { incoming, events, state, allActions } = usePipeline();
  const me = roleName(role, state.block);
  const status = useMemo(() => schoolStatuses(state), [state]);
  const school = (id: string) => state.block.schools.find((s) => s.id === id);

  useEffect(() => {
    if (!incoming.seq) return;
    for (const e of incoming.events.filter((x) => x.actor !== me).slice(-3)) {
      const d = describeEvent(e, t, allActions);
      const s = school(d.schoolId);
      toast({ meta: t("Live · just now", "लाइव · अभी"), title: s?.name ?? t("Block update", "ब्लॉक अपडेट"), body: d.text, icon: d.icon, tone: d.tone, to: s ? `/schools/${s.id}` : undefined, action: t("Open school", "स्कूल खोलें") });
    }
    for (const r of incoming.interviews.slice(-2)) {
      const s = school(r.school_id);
      const n = new Set(r.codings.map((x) => x.practice ?? x.new_name)).size;
      toast({
        meta: t("Live · interview", "लाइव · बातचीत"),
        title: t(`${s?.teacher ?? "A teacher"} finished the interview`, `${s?.teacher ?? "एक शिक्षक"} ने बातचीत पूरी की`),
        body: t(`${n} practice${n === 1 ? "" : "s"} described${s ? ` · ${s.name}` : ""}. Jugnu has added them to “What works”.`, `${n} तरीके बताए${s ? ` · ${s.name}` : ""}। जुगनू ने इन्हें “क्या काम करता है” में जोड़ा।`),
        icon: Mic,
        tone: "var(--tone-teal)",
        to: "/interviews",
        action: t("Read it", "पढ़ें"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming.seq]);

  // your own saved actions: say what changed and what comes next
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(events.map((e) => String(e.id)));
      return;
    }
    for (const e of events) {
      const id = String(e.id);
      if (seen.current.has(id) || e.pending || e.demo) continue;
      seen.current.add(id);
      if (e.actor !== me) continue;
      const s = school(e.kind === "action" ? e.ref.split("-")[0] : e.ref);
      if (!s) continue;
      const st = status.get(s.id);
      if (e.kind === "spotcheck" && st)
        toast({
          icon: Stethoscope,
          tone: STATUS_INFO[st].color,
          title: t(`Saved — ${s.name} is now “${STATUS_INFO[st].en}”`, `सहेजा — ${s.name} अब “${STATUS_INFO[st].hi}”`),
          body: t(`Next: ${STATUS_INFO[st].next[0]}`, `अगला: ${STATUS_INFO[st].next[1]}`),
        });
      else if (e.kind === "followup")
        toast({ icon: LineChart, tone: "var(--tone-good)", title: t("Follow-up saved for everyone", "फ़ॉलो-अप सबके लिए सहेजा"), body: t("Results and the support plan are updated.", "नतीजे और योजना अपडेट हो गए।"), to: "/results", action: t("See results", "नतीजे देखें") });
      else if (e.kind === "action" && (e.payload as { status?: string }).status === "stuck")
        toast({ icon: X, tone: "var(--tone-bad)", title: t("Escalated", "ऊपर भेजा"), body: t("The Block Education Officer sees it at the top of Today.", "BEO को यह ‘आज’ में सबसे ऊपर दिखेगा।") });
      else if (e.kind === "action" && e.ref.endsWith("-visit") && (e.payload as { status?: string }).status === "done")
        toast({ icon: Handshake, tone: "var(--tone-visit)", title: t("Visit done", "दौरा पूरा"), body: t("Next: Jugnu calls the teacher on day 14 — “Did you try it?”", "अगला: 14वें दिन जुगनू शिक्षक को फ़ोन करेगा — “क्या आज़माया?”") });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);
  return null;
}

function RoleBadge({ role, onChange }: { role: Role | null; onChange: () => void }) {
  const t = useT();
  const { state } = usePipeline();
  const name = roleName(role, state.block);
  const initials = role?.kind === "crp" ? (state.block.schools.find((s) => s.cluster === role.cluster)?.crp ?? "C").split(" ").map((w) => w[0]).slice(0, 2).join("") : role?.kind === "beo" ? "BEO" : "👋";
  return (
    <button className="card-inset flex w-full items-center gap-3 px-2.5 py-2 text-left transition hover:bg-[var(--hover)]" onClick={onChange}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-[#0b1308]" style={{ background: "var(--grad-flat)" } as CSSProperties}>
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-[var(--color-ink-3)]">{t("Using Jugnu as", "आप इस रूप में")}</span>
        <span className="block truncate text-[13px] font-semibold">{name ?? t("Choose your role", "अपनी भूमिका चुनें")}</span>
      </span>
      <span className="text-xs font-semibold text-[var(--st-bright)]">{t("Switch", "बदलें")}</span>
    </button>
  );
}

function PrefsRow() {
  const t = useT();
  const { lang, setLang, lite, setLite, liteReason } = usePrefs();
  return (
    <div className="flex items-center gap-2">
      <button className="btn btn-glass flex-1 justify-center !py-1.5 font-deva" onClick={() => setLang(lang === "hi" ? "en" : "hi")} title={t("Switch to Hindi", "Switch to English")}>
        {lang === "hi" ? "English" : "हिंदी"}
      </button>
      <button
        className={cx("btn !px-3 !py-1.5", lite ? "btn-primary" : "btn-glass")}
        onClick={() => setLite(!lite)}
        title={lite ? t(`Low-data mode on${liteReason ? ` — ${liteReason}` : ""}`, "कम-डेटा मोड चालू") : t("Low-data mode: no video, no 3D, no blur", "कम-डेटा मोड: न वीडियो, न 3D")}
        aria-pressed={lite}
        aria-label={t("Low-data mode", "कम-डेटा मोड")}
      >
        <Zap size={15} />
      </button>
      <ThemeToggle labels={{ dark: t("Dark mode", "डार्क मोड"), light: t("Light mode", "लाइट मोड") }} />
    </div>
  );
}

function SchoolSearch({ onPick }: { onPick: (id: string) => void }) {
  const t = useT();
  const { state } = usePipeline();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (k.length < 2) return [];
    return state.block.schools.filter((s) => `${s.name} ${s.nameHi ?? ""} ${s.village} ${s.teacher} ${s.clusterName}`.toLowerCase().includes(k)).slice(0, 8);
  }, [q, state.block]);
  const status = useMemo(() => schoolStatuses(state), [state]);
  useEffect(() => {
    const off = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        box.current?.querySelector("input")?.focus();
      }
    };
    window.addEventListener("mousedown", off);
    window.addEventListener("keydown", key);
    return () => (window.removeEventListener("mousedown", off), window.removeEventListener("keydown", key));
  }, []);
  return (
    <div ref={box} className="relative min-w-0 flex-1 md:max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]" />
      <input
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && hits[0]) (onPick(hits[0].id), setQ(""), setOpen(false));
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={window.innerWidth < 768 ? t("Search", "खोजें") : t("Search school, village, teacher", "स्कूल, गाँव, शिक्षक खोजें")}
        className="w-full rounded-full border border-transparent bg-[var(--inset-bg)] py-2 pl-10 pr-4 text-sm outline-none md:pr-12 transition focus:border-[color-mix(in_srgb,var(--st-bright)_60%,transparent)]"
        aria-label={t("Search schools", "स्कूल खोजें")}
      />
      {q ? (
        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]" onClick={() => setQ("")} aria-label={t("Clear", "साफ़ करें")}>
          <X size={15} />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--chip-line)] px-1.5 text-xs text-[var(--color-ink-3)] md:block">Ctrl K</kbd>
      )}
      <AnimatePresence>
        {open && hits.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={SPRING}
            className="sheet absolute inset-x-0 top-12 z-50 max-h-80 overflow-y-auto rounded-[1.4rem] p-1.5"
          >
            {hits.map((s) => {
              const st = status.get(s.id)!;
              return (
                <li key={s.id}>
                  <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-[var(--hover)]" onClick={() => (onPick(s.id), setQ(""), setOpen(false))}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_INFO[st].color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{s.name}</span>
                      <span className="block truncate text-xs text-[var(--color-ink-3)]">
                        {s.teacher} · {s.clusterName} {t("cluster", "क्लस्टर")}
                      </span>
                    </span>
                    <ChevronRight size={15} className="text-[var(--color-ink-3)]" />
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
