import { motion } from "framer-motion";
import { BookOpen, Clapperboard, Handshake, LineChart, MapPinned, Mic, Sparkles, Stars } from "lucide-react";
import { useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BackgroundVideo, TutorialPlayer } from "./components/media";
import { AIStatus, cx } from "./components/ui";
import { MEDIA, TOUR } from "./lib/clips";
import { ThemeToggle, useTheme } from "./lib/theme";
import AskPage from "./pages/Ask";
import FindPage from "./pages/Find";
import HomePage from "./pages/Home";
import MethodPage from "./pages/Method";
import PracticesPage from "./pages/Practices";
import SpreadPage from "./pages/Spread";
import TrackPage from "./pages/Track";

const NAV = [
  { to: "/", label: "Overview", icon: Sparkles },
  { to: "/find", label: "1 · Find & verify", icon: MapPinned },
  { to: "/ask", label: "2 · Ask teachers", icon: Mic },
  { to: "/practices", label: "3 · What works", icon: Stars },
  { to: "/spread", label: "4 · Spread", icon: Handshake },
  { to: "/track", label: "5 · Track", icon: LineChart },
  { to: "/method", label: "Data & method", icon: BookOpen },
];

export default function App() {
  const location = useLocation();
  const [tour, setTour] = useState(false);
  const { theme } = useTheme();
  return (
    <>
      <div className="aurora" aria-hidden>
        <div className="blob a" />
        <div className="blob b" />
        <div className="blob c" />
        <BackgroundVideo key={theme} src={theme === "mono" ? MEDIA.ribbonsMono : MEDIA.fireflies} opacity={theme === "mono" ? 0.14 : 0.3} className="mix-blend-screen" />
        <div className="grid" />
        <div className="grain" />
      </div>
      <header className="no-print sticky top-0 z-40 px-3 pt-3 md:px-6">
        <nav className="glass-strong mx-auto flex max-w-[1440px] items-center gap-2 rounded-full px-3 py-2">
          <NavLink to="/" className="mr-2 flex items-center gap-2 pl-1">
            <span className="relative grid h-9 w-9 place-items-center rounded-full bg-amber-200/10 glow-ring" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-amber-200 shadow-[0_0_18px_7px_rgba(253,224,71,0.6)]" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Jugnu <span className="font-deva text-sm font-semibold text-[var(--color-ink-3)]">जुगनू</span>
            </span>
          </NavLink>
          <div className="scroll-thin flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cx(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition",
                    isActive ? "bg-white/15 text-white shadow-inner" : "text-[var(--color-ink-2)] hover:bg-white/8 hover:text-white",
                  )
                }
              >
                <Icon size={15} aria-hidden />
                <span className="hidden md:inline">{label}</span>
              </NavLink>
            ))}
          </div>
          <button className="btn btn-glass hidden !py-1.5 lg:inline-flex" onClick={() => setTour(true)}>
            <Clapperboard size={15} /> Tour
          </button>
          <ThemeToggle />
          <AIStatus />
        </nav>
      </header>
      <main className="mx-auto max-w-[1440px] px-3 pb-16 pt-6 md:px-6">
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Routes location={location}>
            <Route path="/" element={<HomePage onTour={() => setTour(true)} />} />
            <Route path="/find" element={<FindPage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/practices" element={<PracticesPage />} />
            <Route path="/spread" element={<SpreadPage />} />
            <Route path="/track" element={<TrackPage />} />
            <Route path="/method" element={<MethodPage />} />
          </Routes>
        </motion.div>
      </main>
      <TutorialPlayer clips={TOUR} open={tour} onClose={() => setTour(false)} />
      <footer className="no-print mx-auto max-w-[1440px] px-6 pb-8 text-xs text-[var(--color-ink-3)]">
        Jugnu · AI for Foundational Learning Hackathon · Challenge 4 (Data to Action). Adults only, with consent — no child-level data. Block data simulated and calibrated to ASER 2024; import your own CSV on Data &amp; method.
        Cinematic clips generated with Google Flow (Veo 3.1).
      </footer>
    </>
  );
}
