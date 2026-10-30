// Moving a task along, with the rule behind it: the school or owner says it is done, and someone else
// signs it off. Every move is written to the shared log with where it came from, so it can be audited.
import { Check, CornerUpLeft, TriangleAlert } from "lucide-react";
import { useCallback } from "react";
import type { Action } from "../engine/types";
import { useT } from "./prefs";
import { canSignOff, useRole } from "./role";
import { usePipeline } from "./store";
import { useToast } from "./toast";

export const STATUS_WORDS: Record<Action["status"], [string, string]> = {
  todo: ["To do", "करना है"],
  scheduled: ["Scheduled", "तय है"],
  submitted: ["Waiting for sign-off", "पुष्टि का इंतज़ार"],
  done: ["Done", "पूरा"],
  stuck: ["Stuck", "अटका"],
};

export function useMoveAction() {
  const t = useT();
  const toast = useToast();
  const [role] = useRole();
  const { record } = usePipeline();
  const approver = useCallback((a: Pick<Action, "ownerRole">) => canSignOff(role, a), [role]);

  /** Returns where the task ended up: "done" becomes "submitted" for anyone who cannot sign it off. */
  const move = useCallback(
    async (a: Action, to: Action["status"], note?: string): Promise<Action["status"] | null> => {
      if (to === a.status && !note) return null;
      if (a.status === "submitted" && to !== "stuck" && !approver(a)) {
        toast({ icon: TriangleAlert, tone: "var(--tone-warn)", title: t("Waiting for sign-off", "पुष्टि का इंतज़ार"), body: t("A coordinator or the BEO needs to confirm this one.", "इसकी पुष्टि समन्वयक या BEO करेंगे।") });
        return null;
      }
      if (a.status === "done" && !approver(a)) {
        toast({ icon: TriangleAlert, tone: "var(--tone-warn)", title: t("Already signed off", "पुष्टि हो चुकी"), body: t("Only the person who signs off can reopen it.", "इसे वही खोल सकते हैं जो पुष्टि करते हैं।") });
        return null;
      }
      const target: Action["status"] = to === "done" && !approver(a) ? "submitted" : to;
      await record("action", a.id, { status: target, from: a.status, ...(note ? { note } : {}) });
      if (to === "done" && target === "submitted")
        toast({ icon: Check, tone: "var(--tone-info)", title: t("Sent for sign-off", "पुष्टि के लिए भेजा"), body: t("It counts as done once a coordinator or the BEO confirms it.", "समन्वयक या BEO की पुष्टि के बाद यह पूरा माना जाएगा।") });
      else if (a.status === "submitted" && target === "done") toast({ icon: Check, tone: "var(--tone-good)", title: t("Signed off", "पुष्टि हुई"), body: a.task });
      else if (a.status === "submitted") toast({ icon: CornerUpLeft, tone: "var(--tone-warn)", title: t("Sent back", "वापस भेजा"), body: a.task });
      return target;
    },
    [approver, record, t, toast],
  );
  return { move, approver };
}
