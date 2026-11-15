// The opening (index.html): the firefly lights up and the name rises while the app loads behind it.
// The app says when it has drawn, so the opening never lifts onto an empty page, and the front page
// waits for it to lift before playing its own entrance.
import { useEffect, useState } from "react";

/** Tell the opening the page underneath is ready. */
export function useReadyForIntro() {
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("jugnu:ready")));
    return () => cancelAnimationFrame(id);
  }, []);
}

/** False while the opening still covers the screen. */
export function useIntroDone(): boolean {
  const [done, setDone] = useState(() => typeof document === "undefined" || !document.getElementById("intro"));
  useEffect(() => {
    if (done) return;
    const on = () => setDone(true);
    window.addEventListener("jugnu:intro-done", on);
    // If it was removed before we listened, don't wait for an event that has gone.
    if (!document.getElementById("intro")) setDone(true);
    return () => window.removeEventListener("jugnu:intro-done", on);
  }, [done]);
  return done;
}
