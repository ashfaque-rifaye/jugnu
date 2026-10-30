// Who is using the console. A Block Education Officer sees the whole block; a cluster coordinator
// (CRP) their own cluster; a school head their own school. Kept on the device; anyone can switch.
import { useCallback, useSyncExternalStore } from "react";
import type { Action, Block } from "../engine/types";

export type Role = { kind: "beo" } | { kind: "crp"; cluster: number } | { kind: "head"; schoolId: string; cluster: number } | { kind: "guest" };

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
  if (role.kind === "guest") return "Guest";
  if (role.kind === "head") {
    const s = block?.schools.find((x) => x.id === role.schoolId);
    const head = s?.staff.find((p) => p.role === "head");
    return s ? `Head ${head?.name ?? ""}, ${s.name}`.replace("  ", " ") : "School head";
  }
  const s = block?.schools.find((x) => x.cluster === role.cluster);
  return s ? `CRP ${s.crp} (${s.clusterName})` : `CRP, cluster ${role.cluster + 1}`;
}

/** Is this cluster in the user's own patch? (BEOs and guests: every school.) */
export const inMyPatch = (role: Role | null, cluster: number) => (role?.kind !== "crp" && role?.kind !== "head") || role.cluster === cluster;

/** Is this school one the user answers for? */
export const isMySchool = (role: Role | null, schoolId: string, cluster: number) => (role?.kind === "head" ? role.schoolId === schoolId : inMyPatch(role, cluster));

/** Who may sign off finished work. A school reports it done; someone outside the school confirms it.
 *  A coordinator confirms schools' work, and the BEO confirms the coordinator's. */
export function canSignOff(role: Role | null, action: Pick<Action, "ownerRole">): boolean {
  if (role?.kind === "beo" || role?.kind === "guest" || !role) return true;
  if (role.kind === "crp") return action.ownerRole !== "CRP";
  return false;
}
