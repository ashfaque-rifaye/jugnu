import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { trackPage } from "./lib/track";

// Two entry points, loaded on demand: a teacher opening an interview link on 2G downloads only
// the Talk page; the console (and the simulated block it computes) loads only for officers.
const TalkPage = lazy(() => import("./pages/Talk"));
const Console = lazy(() => import("./Console"));

const Loading = () => <div className="grid min-h-dvh place-items-center bg-[var(--bg)] text-sm text-[var(--color-ink-3)]">…</div>;

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => trackPage(pathname), [pathname]);
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/talk" element={<TalkPage />} />
        <Route path="/talk/:token" element={<TalkPage />} />
        <Route path="*" element={<Console />} />
      </Routes>
    </Suspense>
  );
}
