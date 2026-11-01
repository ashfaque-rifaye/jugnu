import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface Status {
  claude: boolean;
  model: string | null;
  /** Google speech (Chirp) is configured on the server. */
  voice: boolean;
  ivr: boolean;
  /** WhatsApp Cloud API is configured on the server. */
  whatsapp: boolean;
  checked: boolean;
  online: boolean;
}

const initial: Status = { claude: false, model: null, voice: false, ivr: false, whatsapp: false, checked: false, online: true };
const StatusContext = createContext<Status>(initial);

export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(initial);
  useEffect(() => {
    let cancelled = false;
    const attempt = (n: number) =>
      fetch("/api/status")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((s) => !cancelled && setStatus({ claude: !!s.claude, model: s.model ?? null, voice: !!s.voice, ivr: !!(s.ivr && (s.ivr === true || s.ivr.active)), whatsapp: !!s.whatsapp?.configured, checked: true, online: true }))
        .catch(() => {
          if (cancelled) return;
          if (n < 6) window.setTimeout(() => attempt(n + 1), 1200);
          else setStatus((s) => ({ ...s, checked: true, online: false }));
        });
    attempt(0);
    const on = () => setStatus((s) => ({ ...s, online: true }));
    const off = () => setStatus((s) => ({ ...s, online: false }));
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      cancelled = true;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return <StatusContext.Provider value={status}>{children}</StatusContext.Provider>;
}

export const useStatus = () => useContext(StatusContext);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError((data as { error?: string }).error ?? r.statusText, r.status, data as Record<string, unknown>);
  return data as T;
}

/** Download a file from the server under the name it gives. */
export async function download(url: string, fallbackName: string) {
  const r = await fetch(url);
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new ApiError((data as { error?: string }).error ?? r.statusText, r.status, data as Record<string, unknown>);
  }
  const name = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await r.blob());
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const postJSON = <T,>(url: string, body: unknown) => request<T>("POST", url, body);
export const getJSON = <T,>(url: string) => request<T>("GET", url);
export const delJSON = <T,>(url: string) => request<T>("DELETE", url);

/** Poll a GET endpoint; returns [data, error, reload]. */
export function usePoll<T>(url: string | null, everyMs = 0): [T | null, string | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const load = () =>
      getJSON<T>(url)
        .then((d) => {
          if (!alive) return;
          setData(d);
          setError(null);
        })
        .catch((e: Error) => alive && setError(e.message));
    load();
    const id = everyMs ? window.setInterval(load, everyMs) : 0;
    return () => {
      alive = false;
      if (id) window.clearInterval(id);
    };
  }, [url, everyMs, tick]);
  return [data, error, reload];
}
