// "Needs you": the concrete next steps for the person using the console, from the block's state.
import { useMemo } from "react";
import type { PipelineState } from "../engine/pipeline";
import type { Action } from "../engine/types";
import { isMySchool, type Role } from "./role";
import { schoolStatuses } from "./status";

export type TaskKind = "spotcheck" | "interview" | "visit" | "stuck" | "data" | "review" | "signoff" | "weekly";

export interface Task {
  id: string;
  kind: TaskKind;
  title: [string, string];
  schoolId?: string;
  action?: Action;
  priority: number;
}

export function useTasks(state: PipelineState, role: Role | null, pendingReviews: number): Task[] {
  return useMemo(() => {
    const status = schoolStatuses(state);
    const school = (id: string) => state.block.schools.find((s) => s.id === id)!;
    const mine = (id: string) => isMySchool(role, id, school(id).cluster);
    const interviewed = new Set(state.interviews.map((i) => i.schoolId));
    const out: Task[] = [];
    for (const [id, st] of status) {
      if (!mine(id)) continue;
      const s = school(id);
      if (st === "check_due") out.push({ id: `sc-${id}`, kind: "spotcheck", schoolId: id, priority: 1, title: [`Visit ${s.name} to confirm its results`, `${s.name} जाकर नतीजों की पुष्टि करें`] });
      if (st === "bright" && !interviewed.has(id))
        out.push({ id: `iv-${id}`, kind: "interview", schoolId: id, priority: 2, title: [`Interview ${s.teacher} — a school newly confirmed as doing well`, `${s.teacher} से बातचीत — नया अच्छा स्कूल`] });
      if (st === "check_data" && role?.kind !== "crp")
        out.push({ id: `dt-${id}`, kind: "data", schoolId: id, priority: 4, title: [`Data may be over-reported at ${s.name}`, `${s.name} का डेटा ज़्यादा दर्ज हो सकता है`] });
    }
    for (const r of state.recs) {
      if (!mine(r.schoolId)) continue;
      for (const a of r.actions) {
        if (a.status === "stuck") out.push({ id: `st-${a.id}`, kind: "stuck", schoolId: r.schoolId, action: a, priority: 0, title: [`Stuck: ${a.task}`, `अटका: ${a.task}`] });
        else if (a.status === "submitted" && role?.kind !== "head" && (role?.kind !== "crp" || a.ownerRole !== "CRP"))
          out.push({ id: `so-${a.id}`, kind: "signoff", schoolId: r.schoolId, action: a, priority: 1, title: [`Sign off: ${a.task}`, `पुष्टि करें: ${a.task}`] });
        else if (role?.kind === "head" && r.wave === 1 && a.ownerRole !== "BEO" && (a.status === "todo" || a.status === "scheduled"))
          out.push({ id: `vs-${a.id}`, kind: "visit", schoolId: r.schoolId, action: a, priority: 3, title: [a.task, a.task] });
        else if (a.ownerRole === "CRP" && r.wave === 1 && (a.status === "todo" || a.status === "scheduled") && role?.kind !== "beo")
          out.push({ id: `vs-${a.id}`, kind: "visit", schoolId: r.schoolId, action: a, priority: 3, title: [a.task, a.task] });
      }
    }
    if (role?.kind === "head")
      out.push({ id: `wk-${role.schoolId}`, kind: "weekly", schoolId: role.schoolId, priority: 1, title: ["File this week's school report: 2 minutes", "इस हफ़्ते की स्कूल रिपोर्ट भरें: 2 मिनट"] });
    if (pendingReviews > 0 && role?.kind !== "crp" && role?.kind !== "head")
      out.push({
        id: "reviews",
        kind: "review",
        priority: 1,
        title: [`${pendingReviews} AI draft${pendingReviews === 1 ? "" : "s"} waiting for your approval`, `${pendingReviews} AI ड्राफ़्ट आपकी मंज़ूरी का इंतज़ार कर रहे हैं`],
      });
    if (pendingReviews > 0 && role?.kind === "crp")
      out.push({
        id: "reviews",
        kind: "review",
        priority: 2,
        title: [`Check ${pendingReviews} method card${pendingReviews === 1 ? "" : "s"} before they reach teachers`, `शिक्षकों तक जाने से पहले ${pendingReviews} कार्ड जाँचें`],
      });
    return out.sort((a, b) => a.priority - b.priority);
  }, [state, role, pendingReviews]);
}
