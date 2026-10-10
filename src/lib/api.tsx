import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface Status {
  claude: boolean;
  model: string | null;
  checked: boolean;
}

const StatusContext = createContext<Status>({ claude: false, model: null, checked: false });

export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ claude: false, model: null, checked: false });
  useEffect(() => {
    let cancelled = false;
    const attempt = (n: number) =>
      fetch("/api/status")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((s) => !cancelled && setStatus({ claude: !!s.claude, model: s.model ?? null, checked: true }))
        .catch(() => {
          if (cancelled) return;
          if (n < 6) window.setTimeout(() => attempt(n + 1), 1200);
          else setStatus({ claude: false, model: null, checked: true });
        });
    attempt(0);
    return () => {
      cancelled = true;
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

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError((data as { error?: string }).error ?? r.statusText, r.status, data as Record<string, unknown>);
  return data as T;
}
