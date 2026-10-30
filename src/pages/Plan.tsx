// Share with schools: an approved method's rollout, the task board that carries it out, the audit
// trail of everything that changed, and the map of who learns from whom.
import { Columns3, Handshake, History, Layers, Map as MapIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuditTrail } from "../components/Audit";
import { Board } from "../components/Board";
import { ExportPlanButton } from "../components/insights";
import { Card, Empty, fieldBase, PageHeader, Segmented } from "../components/kit";
import { LivingMap } from "../components/maps";
import { RolloutPanel } from "../components/Rollout";
import { profileFor } from "../engine/district";
import { useT } from "../lib/prefs";
import { isMySchool, useRole } from "../lib/role";
import { usePipeline } from "../lib/store";
import { meanZ, schoolStatuses } from "../lib/status";

export default function PlanPage() {
  const t = useT();
  const nav = useNavigate();
  const [role] = useRole();
  const [params] = useSearchParams();
  const { state, select, blockKey, tracked } = usePipeline();
  const onlyStuck = params.get("status") === "stuck";
  const [view, setView] = useState<"rollout" | "board" | "history" | "map">(onlyStuck || role?.kind === "head" ? "board" : ((params.get("view") as "board" | null) ?? "rollout"));
  const [wave, setWave] = useState<1 | 2>(1);
  const [owner, setOwner] = useState<"all" | "CRP" | "BEO" | "Jugnu AI">("all");
  const status = useMemo(() => schoolStatuses(state), [state]);
  const z = useMemo(() => meanZ(state), [state]);
  const byId = useMemo(() => new Map(state.block.schools.map((s) => [s.id, s])), [state.block]);
  const recs = state.recs.filter((r) => isMySchool(role, r.schoolId, byId.get(r.schoolId)!.cluster));
  const waveRecs = recs.filter((r) => r.wave === wave);
  const actions = waveRecs.flatMap((r) => r.actions).filter((a) => owner === "all" || a.ownerRole === owner);

  if (!state.recs.length)
    return (
      <div>
        <PageHeader title={t("Share with schools", "स्कूलों तक पहुँचाएँ")} />
        <Empty icon={Handshake} title={t("Nothing to share yet", "अभी पहुँचाने को कुछ नहीं")}>
          {t("Jugnu first needs to talk to teachers at schools doing well. Then it can match each school that needs help with a teacher nearby.", "पहले अच्छा कर रहे स्कूलों के शिक्षकों से बात ज़रूरी है। फिर जुगनू मदद चाहने वाले हर स्कूल को पास के शिक्षक से जोड़ सकता है।")}
        </Empty>
      </div>
    );

  return (
    <div>
      <PageHeader
        title={t("Share with schools", "स्कूलों तक पहुँचाएँ")}
        sub={t(
          "How each approved method reaches other schools: who does what, week by week, and how far it has got. Every school that needs help is matched with a teacher nearby who already does it.",
          "मंज़ूर तरीका दूसरे स्कूलों तक कैसे पहुँचता है: कौन क्या करेगा, हफ़्ते-दर-हफ़्ते, और अब तक कितना हुआ। मदद चाहने वाले हर स्कूल को पास के उस शिक्षक से जोड़ा जाता है जो यह पहले से करता है।",
        )}
        actions={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "rollout", label: (<><Layers size={15} /> {t("Rollout", "रोलआउट")}</>) },
              { value: "board", label: (<><Columns3 size={15} /> {t("Task board", "काम")}</>) },
              { value: "history", label: (<><History size={15} /> {t("History", "इतिहास")}</>) },
              { value: "map", label: (<><MapIcon size={15} /> {t("Map", "नक्शा")}</>) },
            ]}
          />
        }
      />

      {view === "rollout" && <RolloutPanel initial={params.get("method")} />}

      {view === "board" && (
        <>
          <Card className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                value={wave}
                onChange={setWave}
                options={[
                  { value: 1, label: t("This term", "इस सत्र"), count: recs.filter((r) => r.wave === 1).length },
                  { value: 2, label: t("Next term", "अगले सत्र"), count: recs.filter((r) => r.wave === 2).length },
                ]}
              />
              <select className={fieldBase} value={owner} onChange={(e) => setOwner(e.target.value as typeof owner)} aria-label={t("Whose tasks", "किसके काम")}>
                <option value="all">{t("Everyone's tasks", "सबके काम")}</option>
                <option value="CRP">{t("Coordinators' tasks", "समन्वयकों के काम")}</option>
                <option value="BEO">{t("BEO's tasks", "BEO के काम")}</option>
                <option value="Jugnu AI">{t("Done by Jugnu", "जुगनू के अपने-आप होने वाले काम")}</option>
              </select>
              <span className="ml-auto">
                <ExportPlanButton blockKey={blockKey} tracked={tracked} />
              </span>
            </div>
          </Card>
          <Board actions={actions} schools={byId} onlyStuck={onlyStuck} />
        </>
      )}

      {view === "history" && <AuditTrail />}

      {view === "map" && (
        <Card title={t("Who learns from whom", "कौन किससे सीखता है")}>
          <LivingMap schools={state.block.schools} status={status} z={z} links={recs.filter((r) => r.wave === 1).map((r) => ({ from: r.demonstratorId, to: r.schoolId }))} onSelect={(id) => (select(id), nav(`/schools/${id}`))} height={580} showLinks block={profileFor(state.block.seed)?.block} />
          <p className="mt-2 text-xs text-[var(--color-ink-3)]">{t("Each line runs from a teacher who already does a method to a school learning it from them.", "हर रेखा उस शिक्षक से, जो तरीका पहले से करता है, उस स्कूल तक जाती है जो उनसे सीख रहा है।")}</p>
        </Card>
      )}
    </div>
  );
}
