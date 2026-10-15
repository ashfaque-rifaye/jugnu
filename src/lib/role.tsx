// Who is using the console. A Block Education Officer sees the whole block; a cluster resource
// person (CRP) sees their own cluster first. Kept on the device; anyone can switch.
import { useCallback, useSyncExternalStore } from "react";
import type { Block } from "../engine/types";

export type Role = { kind: "beo" } | { kind: "crp"; cluster: number } | { kind: "guest" };

const KEY = "jugnu-role";
const listeners = new Set<() => void>();

function read(): Role | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Role) : null;
  } catch {
    return null;
  }
}

let current: Role | null = read();

function write(r: Role | null) {
  current = r;
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: keep it in memory */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

export function useRole(): [Role | null, (r: Role | null) => void] {
  const role = useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
  return [role, useCallback(write, [])];
}

/** The name an action is recorded under, e.g. "CRP Anita Patel (Sonagaon)". */
export function roleName(role: Role | null, block?: Block): string | null {
  if (!role) return null;
  if (role.kind === "beo") return "BEO";
  if (role.kind === "guest") return "Visitor";
  const s = block?.schools.find((x) => x.cluster === role.cluster);
  return s ? `CRP ${s.crp} (${s.clusterName})` : `CRP, cluster ${role.cluster + 1}`;
}

/** Is this school in the user's own patch? (BEOs and visitors: every school.) */
export const inMyPatch = (role: Role | null, cluster: number) => role?.kind !== "crp" || role.cluster === cluster;
