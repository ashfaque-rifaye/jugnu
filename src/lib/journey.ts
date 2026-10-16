// The guided journey: what this person has already seen and done in Jugnu (kept on the device).
// Pages mark steps as they happen; the "first 10 minutes" checklist and the welcome read them.
import { useSyncExternalStore } from "react";

const KEY = "jugnu-journey";
const WELCOME = "jugnu-welcomed";
const listeners = new Set<() => void>();

function readSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
let done = readSet();
let welcomed = (() => {
  try {
    return localStorage.getItem(WELCOME) === "1";
  } catch {
    return false;
  }
})();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

export function markJourney(...keys: string[]) {
  const fresh = keys.filter((k) => !done.has(k));
  if (!fresh.length) return;
  done = new Set([...done, ...fresh]);
  try {
    localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch {
    /* private mode: keep it in memory */
  }
  emit();
}

export function resetJourney() {
  done = new Set();
  welcomed = false;
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(WELCOME);
  } catch {
    /* ignore */
  }
  emit();
}

export function setWelcomed(v = true) {
  welcomed = v;
  try {
    if (v) localStorage.setItem(WELCOME, "1");
    else localStorage.removeItem(WELCOME);
  } catch {
    /* ignore */
  }
  emit();
}

export const useJourney = () =>
  useSyncExternalStore(
    subscribe,
    () => done,
    () => done,
  );

export const useWelcomed = () =>
  useSyncExternalStore(
    subscribe,
    () => welcomed,
    () => welcomed,
  );
