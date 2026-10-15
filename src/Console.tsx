import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  BrainCircuit,
  CalendarCheck2,
  ClipboardCheck,
  Clapperboard,
  FlaskConical,
  Handshake,
  House,
  Info,
  LineChart,
  Menu,
  MessageCircleQuestion,
  Mic,
  School as SchoolIcon,
  Search,
  Stars,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AskJugnu } from "./components/AskJugnu";
import { FeedbackButton, useSession } from "./components/Feedback";
import { Wordmark } from "./components/Logo";
import { TutorialPlayer } from "./components/media";
import { PasscodeGate } from "./components/Passcode";
import { AIStatus, cx } from "./components/ui";
import { usePoll } from "./lib/api";
import { TOUR } from "./lib/clips";
import { usePrefs, useT } from "./lib/prefs";
import { roleName, useRole, type Role } from "./lib/role";
import { PipelineProvider, usePipeline } from "./lib/store";
import { ThemeToggle } from "./lib/theme";

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
const AboutPage = lazy(() => import("./pages/About"));

const Loading = () => <div className="grid min-h-[40vh] place-items-center text-sm text-[var(--color-ink-3)]">…</div>;

/** The officer / CRP console. The block is computed only here, never for teachers. */
export default function ConsoleRoot() {
  const { pathname } = useLocation();
  return <PipelineProvider>{pathname === "/" ? <Home /> : <Console />}</PipelineProvider>;
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
      <TutorialPlayer clips={TOUR} open={tour} onClose={() => setTour(false)} />
    </>
  );
}

type NavItem = { to: string; label: string; icon: typeof Stars; badge?: number };

function Console() {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tour, setTour] = useState(false);
  const [ask, setAsk] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [role, setRole] = useRole();
  const [chooseRole, setChooseRole] = useState(false);
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
  useEffect(() => setDrawer(false), [location.pathname]);

  const MAIN: NavItem[] = [
    { to: "/today", label: t("Today", "आज"), icon: CalendarCheck2 },
    { to: "/schools", label: t("Schools", "स्कूल"), icon: SchoolIcon },
    { to: "/interviews", label: t("Interviews", "बातचीत"), icon: Mic },
    { to: "/practices", label: t("What works", "क्या काम करता है"), icon: Stars },
    { to: "/plan", label: t("Support plan", "मदद की योजना"), icon: Handshake },
    { to: "/results", label: t("Results", "नतीजे"), icon: LineChart },
    { to: "/review", label: t("Review", "समीक्षा"), icon: ClipboardCheck, badge: pending?.length ?? 0 },
  ];
  const TOOLS: NavItem[] = [
    { to: "/testing", label: t("User testing", "उपयोगकर्ता परीक्षण"), icon: FlaskConical },
    { to: "/ai", label: t("AI & safety checks", "AI व सुरक्षा जाँच"), icon: BrainCircuit },
    { to: "/method", label: t("Data & method", "डेटा व पद्धति"), icon: BookOpen },
    { to: "/about", label: t("About Jugnu", "जुगनू के बारे में"), icon: Info },
  ];

  const nav = (items: NavItem[]) =>
    items.map(({ to, label, icon: Icon, badge }) => (
      <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => cx("nav-item", isActive && "active")}>
        <Icon size={18} aria-hidden />
        <span className="flex-1">{label}</span>
        {!!badge && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#fcd34d] px-1.5 text-[11px] font-bold text-[#0b1308]">{badge}</span>}
      </NavLink>
    ));

  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-4">
      <NavLink to="/" className="px-1" title={t("Home page", "होम पेज")}>
        <Wordmark sub={`${state.block.name} · ${state.block.source === "simulated" ? t("demo data", "डेमो डेटा") : t("your data", "आपका डेटा")}`} />
      </NavLink>
      <nav className="space-y-0.5" aria-label={t("Main", "मुख्य")}>
        {nav(MAIN)}
      </nav>
      <button className="btn btn-primary justify-center" onClick={() => setAsk(true)}>
        <MessageCircleQuestion size={16} /> {t("Ask Jugnu", "जुगनू से पूछें")}
      </button>
      <nav className="space-y-0.5 border-t border-[var(--chrome-line)] pt-3" aria-label={t("More", "और")}>
        <NavLink to="/" end className="nav-item">
          <House size={18} aria-hidden /> <span className="flex-1">{t("Home page", "होम पेज")}</span>
        </NavLink>
        {nav(TOOLS)}
        <button className="nav-item w-full" onClick={() => setTour(true)}>
          <Clapperboard size={18} aria-hidden /> <span className="flex-1 text-left">{t("Watch the 2-minute tour", "2 मिनट का टूर देखें")}</span>
        </button>
      </nav>
      <div className="mt-auto space-y-3">
        <RoleCard role={role} onChange={() => setChooseRole(true)} />
        <PrefsRow />
      </div>
    </div>
  );

  const BOTTOM: NavItem[] = [MAIN[0], MAIN[1], MAIN[4], MAIN[2]];

  return (
    <>
      <div className="app-bg" aria-hidden />
      {/* desktop sidebar */}
      <aside className="chrome no-print fixed inset-y-0 left-0 z-30 hidden w-[264px] overflow-y-auto border-r lg:block">{sidebar}</aside>
      {/* mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-[#020617]/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside
              className="chrome-solid fixed inset-y-0 left-0 z-50 w-[290px] overflow-y-auto border-r lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "tween", duration: 0.2 }}
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-[264px]">
        <header className="chrome no-print sticky top-0 z-20 border-b">
          <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-2.5 md:px-6">
            <button className="btn btn-glass !p-2 lg:hidden" onClick={() => setDrawer(true)} aria-label={t("Menu", "मेनू")}>
              <Menu size={18} />
            </button>
            <NavLink to="/" className="lg:hidden" title={t("Home page", "होम पेज")}>
              <Wordmark size={28} />
            </NavLink>
            <SchoolSearch
              onPick={(id) => {
                select(id);
                navigate(`/schools/${id}`);
              }}
            />
            <button className="btn btn-glass hidden !py-2 md:inline-flex lg:hidden" onClick={() => setAsk(true)}>
              <MessageCircleQuestion size={16} /> {t("Ask", "पूछें")}
            </button>
            <AIStatus />
          </div>
          {session.id && (
            <div className="flex items-center justify-between gap-2 border-t border-amber-200/20 bg-amber-200/10 px-4 py-1.5 text-sm md:px-6">
              <span>
                <FlaskConical size={14} className="mr-1 inline" /> {t("Testing session running", "परीक्षण सत्र जारी")} · {session.role}
              </span>
              <NavLink to="/testing" className="underline">
                {t("Tasks & survey", "काम व सर्वे")}
              </NavLink>
            </div>
          )}
        </header>

        <main className="mx-auto max-w-[1400px] px-3 pb-28 pt-5 md:px-6 lg:pb-12">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <Suspense fallback={<Loading />}>
              <Routes location={location}>
                <Route path="/today" element={<TodayPage onAsk={() => setAsk(true)} onRole={() => setChooseRole(true)} />} />
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
                <Route path="/about" element={<AboutPage onTour={() => setTour(true)} />} />
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
        <footer className="no-print mx-auto max-w-[1400px] px-6 pb-24 text-xs text-[var(--color-ink-3)] lg:pb-8">
          {t(
            "Jugnu · AI for Foundational Learning Hackathon, Challenge 4. Adults only, with consent; no child-level data. The demo block is simulated (calibrated to ASER 2024); live interviews are real. Background videos are AI-generated (Google Veo).",
            "जुगनू · AI for Foundational Learning हैकाथॉन, चुनौती 4। सिर्फ़ वयस्क, सहमति से; बच्चों का कोई व्यक्तिगत डेटा नहीं। डेमो ब्लॉक सिम्युलेटेड है (ASER 2024 के अनुसार); लाइव बातचीत असली है। पृष्ठभूमि वीडियो AI से बने हैं (Google Veo)।",
          )}
        </footer>
      </div>

      {/* phone bottom bar */}
      <nav className="chrome no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t lg:hidden" aria-label={t("Main", "मुख्य")}>
        {BOTTOM.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive ? "text-amber-200" : "text-[var(--color-ink-3)]")}
          >
            <Icon size={20} aria-hidden />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
        <button className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-[var(--color-ink-3)]" onClick={() => setAsk(true)}>
          <MessageCircleQuestion size={20} aria-hidden />
          {t("Ask", "पूछें")}
        </button>
      </nav>

      <TutorialPlayer clips={TOUR} open={tour} onClose={() => setTour(false)} />
      <AskJugnu
        open={ask}
        onClose={() => setAsk(false)}
        onSchool={(name) => {
          const s = state.block.schools.find((x) => x.name === name);
          if (s) {
            select(s.id);
            navigate(`/schools/${s.id}`);
          }
        }}
      />
      <FeedbackButton />
      <PasscodeGate />
      <RoleChooser open={chooseRole || role === null} onClose={() => setChooseRole(false)} onPick={(r) => (setRole(r), setChooseRole(false))} />
    </>
  );
}

function RoleCard({ role, onChange }: { role: Role | null; onChange: () => void }) {
  const t = useT();
  const { state } = usePipeline();
  return (
    <button className="card-inset flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--hover)]" onClick={onChange}>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-200/12 text-amber-200">
        <UserRound size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-[var(--color-ink-3)]">{t("You are using Jugnu as", "आप जुगनू इस रूप में चला रहे हैं")}</span>
        <span className="block truncate text-sm font-semibold">{roleName(role, state.block) ?? t("Choose your role", "अपनी भूमिका चुनें")}</span>
      </span>
      <span className="text-xs text-amber-200">{t("Change", "बदलें")}</span>
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
        title={lite ? t(`Low-data mode on${liteReason ? ` — ${liteReason}` : ""}`, "कम-डेटा मोड चालू") : t("Low-data mode: no video, no 3D", "कम-डेटा मोड: न वीडियो, न 3D")}
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
    return state.block.schools.filter((s) => `${s.name} ${s.village} ${s.teacher} ${s.clusterName}`.toLowerCase().includes(k)).slice(0, 8);
  }, [q, state.block]);
  useEffect(() => {
    const off = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", off);
    return () => window.removeEventListener("mousedown", off);
  }, []);
  return (
    <div ref={box} className="relative ml-auto w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]" />
      <input
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && hits[0]) (onPick(hits[0].id), setQ(""), setOpen(false));
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={t("Find a school, village or teacher…", "स्कूल, गाँव या शिक्षक खोजें…")}
        className="w-full rounded-full border border-[var(--chip-line)] bg-[var(--inset-bg)] py-2 pl-9 pr-8 text-sm outline-none focus:border-amber-200/60"
        aria-label={t("Search schools", "स्कूल खोजें")}
      />
      {q && (
        <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]" onClick={() => setQ("")} aria-label={t("Clear", "साफ़ करें")}>
          <X size={15} />
        </button>
      )}
      {open && hits.length > 0 && (
        <ul className="card absolute inset-x-0 top-11 z-50 max-h-80 overflow-y-auto p-1.5">
          {hits.map((s) => (
            <li key={s.id}>
              <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--hover)]" onClick={() => (onPick(s.id), setQ(""), setOpen(false))}>
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="text-xs text-[var(--color-ink-3)]">
                  {s.teacher} · {s.clusterName} {t("cluster", "क्लस्टर")}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoleChooser({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (r: Role) => void }) {
  const t = useT();
  const { state } = usePipeline();
  const [role] = useRole();
  const clusters = useMemo(() => {
    const m = new Map<number, { name: string; crp: string; n: number }>();
    for (const s of state.block.schools) m.set(s.cluster, { name: s.clusterName, crp: s.crp, n: (m.get(s.cluster)?.n ?? 0) + 1 });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [state.block]);
  const [cluster, setCluster] = useState(role?.kind === "crp" ? role.cluster : (clusters[0]?.[0] ?? 0));
  if (!open) return null;
  const option = "card card-hover w-full p-4 text-left";
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#020617]/70 p-4 backdrop-blur-sm">
      <div className="card max-h-[94dvh] w-full max-w-lg overflow-y-auto">
        <div className="on-dark relative h-36 overflow-hidden">
          <video className="welcome-video" src="/media/jugnu-welcome.mp4" poster="/media/jugnu-welcome.jpg" autoPlay muted loop playsInline />
          <div className="welcome-shade" />
          <div className="absolute bottom-3 left-4">
            <Wordmark size={40} />
          </div>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <h2 className="text-xl font-bold">{t("Who is using Jugnu?", "जुगनू कौन चला रहा है?")}</h2>
            <p className="text-sm text-[var(--color-ink-2)]">{t("Jugnu shows you the tasks that are yours. You can switch any time.", "जुगनू आपको आपके काम दिखाएगा। आप कभी भी बदल सकते हैं।")}</p>
          </div>
          <button className={option} onClick={() => onPick({ kind: "beo" })}>
            <div className="font-semibold">{t("Block Education Officer", "ब्लॉक शिक्षा अधिकारी (BEO)")}</div>
            <div className="text-sm text-[var(--color-ink-2)]">{t("The whole block: where to act, what is stuck, did it work.", "पूरा ब्लॉक: कहाँ काम करना है, क्या अटका है, क्या असर हुआ।")}</div>
          </button>
          <div className={cx(option, "space-y-2")}>
            <div className="font-semibold">{t("Cluster resource person (CRP)", "क्लस्टर संसाधन व्यक्ति (CRP)")}</div>
            <div className="text-sm text-[var(--color-ink-2)]">{t("Your cluster: spot checks, interviews, peer visits, follow-ups.", "आपका क्लस्टर: मौके की जाँच, बातचीत, साथी-दौरे, फ़ॉलो-अप।")}</div>
            <div className="flex gap-2">
              <select
                className="min-w-0 flex-1 rounded-xl border border-[var(--chip-line)] bg-[var(--inset-bg)] px-3 py-2 text-sm"
                value={cluster}
                onChange={(e) => setCluster(Number(e.target.value))}
                aria-label={t("Your cluster", "आपका क्लस्टर")}
              >
                {clusters.map(([i, c]) => (
                  <option key={i} value={i}>
                    {c.name} — {c.crp} ({c.n} {t("schools", "स्कूल")})
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={() => onPick({ kind: "crp", cluster })}>
                {t("Continue", "आगे")}
              </button>
            </div>
          </div>
          <button className={option} onClick={() => onPick({ kind: "guest" })}>
            <div className="font-semibold">{t("Just looking (judge or visitor)", "सिर्फ़ देख रहा/रही हूँ (जज या मेहमान)")}</div>
            <div className="text-sm text-[var(--color-ink-2)]">{t("See everything in the demo block, as the Block Education Officer would.", "डेमो ब्लॉक का सब कुछ देखें, जैसे ब्लॉक शिक्षा अधिकारी देखते हैं।")}</div>
          </button>
          {role && (
            <button className="w-full text-center text-sm text-[var(--color-ink-3)] underline" onClick={onClose}>
              {t("Cancel", "रद्द करें")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
