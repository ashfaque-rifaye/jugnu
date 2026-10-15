import { Columns3, Footprints, Handshake, List, Map as MapIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ActionRow } from "../components/field";
import { Card, Empty, fieldBase, MediaHeader, PageHeader, Segmented, Stat } from "../components/kit";
import { LivingMap } from "../components/maps";
import { cx } from "../components/ui";
import { PRACTICES } from "../engine/practices";
import { MEDIA } from "../lib/clips";
import type { Action } from "../engine/types";
import { usePrefs, useT } from "../lib/prefs";
import { inMyPatch, useRole } from "../lib/role";
import { usePipeline } from "../lib/store";
import { meanZ, schoolStatuses } from "../lib/status";

const COLUMNS: { key: Action["status"]; en: string; hi: string }[] = [
  { key: "todo", en: "To do", hi: "करना है" },
  { key: "scheduled", en: "Scheduled", hi: "तय है" },
  { key: "stuck", en: "Stuck — needs the BEO", hi: "अटका — BEO की ज़रूरत" },
  { key: "done", en: "Done", hi: "पूरा" },
];

export default function PlanPage() {
  const t = useT();
  const nav = useNavigate();
  const { lang } = usePrefs();
  const [role] = useRole();
  const [params] = useSearchParams();
  const { state, select } = usePipeline();
  const [wave, setWave] = useState<1 | 2>(1);
  const [view, setView] = useState<"board" | "schools" | "map">("board");
  const [owner, setOwner] = useState<"all" | "CRP" | "BEO" | "Jugnu AI">("all");
  const [onlyStuck, setOnlyStuck] = useState(params.get("status") === "stuck");
  const status = useMemo(() => schoolStatuses(state), [state]);
  const z = useMemo(() => meanZ(state), [state]);
  const byId = useMemo(() => new Map(state.block.schools.map((s) => [s.id, s])), [state.block]);
  const recs = state.recs.filter((r) => inMyPatch(role, byId.get(r.schoolId)!.cluster));
  const waveRecs = recs.filter((r) => r.wave === wave);
  const actions = waveRecs
    .flatMap((r) => r.actions)
    .filter((a) => owner === "all" || a.ownerRole === owner)
    .filter((a) => !onlyStuck || a.status === "stuck");
  const all = recs.flatMap((r) => r.actions);
  const done = all.filter((a) => a.status === "done").length;
  const stuck = all.filter((a) => a.status === "stuck").length;
  const avgKm = recs.length ? recs.reduce((a, r) => a + r.distanceKm, 0) / recs.length : 0;
  const hi = lang === "hi" && "font-deva";

  if (!state.recs.length)
    return (
      <div>
        <PageHeader title={t("Support plan", "मदद की योजना")} />
        <Empty icon={Handshake} title={t("Nothing to spread yet", "अभी फैलाने को कुछ नहीं")}>
          {t(
            "Jugnu needs interviews with bright-spot teachers first — then it can match each school that needs support with a nearby teacher.",
            "पहले अच्छे स्कूलों के शिक्षकों से बातचीत ज़रूरी है — फिर जुगनू हर स्कूल को पास के शिक्षक से जोड़ सकता है।",
          )}
        </Empty>
      </div>
    );

  return (
    <div>
      <MediaHeader video={MEDIA.network} poster={MEDIA.networkPoster}>
        <PageHeader
          title={t("Support plan", "मदद की योजना")}
          sub={t(
            "Each school that needs support gets one practice that fits its gap, a teacher nearby who already does it, and people who own each step. Schools start in two waves, so wave 2 shows fairly whether wave 1 improved.",
            "मदद चाहने वाले हर स्कूल को उसकी कमी के हिसाब से एक तरीका, पास का एक शिक्षक जो यह पहले से करता है, और हर कदम के ज़िम्मेदार लोग। स्कूल दो लहरों में शुरू करते हैं, ताकि लहर 2 से साफ़ पता चले कि लहर 1 में सुधार हुआ या नहीं।",
          )}
          actions={
            <Segmented
              value={view}
              onChange={setView}
              options={[
                {
                  value: "board",
                  label: (
                    <>
                      <Columns3 size={15} /> {t("Actions", "काम")}
                    </>
                  ),
                },
                {
                  value: "schools",
                  label: (
                    <>
                      <List size={15} /> {t("By school", "स्कूल के हिसाब से")}
                    </>
                  ),
                },
                {
                  value: "map",
                  label: (
                    <>
                      <MapIcon size={15} /> {t("Map", "नक्शा")}
                    </>
                  ),
                },
              ]}
            />
          }
        />
      </MediaHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={t("Schools getting support", "मदद पा रहे स्कूल")}
          value={recs.length}
          hint={t(
            `${recs.filter((r) => r.wave === 1).length} now · ${recs.filter((r) => r.wave === 2).length} next term`,
            `${recs.filter((r) => r.wave === 1).length} अभी · ${recs.filter((r) => r.wave === 2).length} अगले सत्र`,
          )}
        />
        <Stat label={t("Distance to a teacher who does it", "करने वाले शिक्षक तक दूरी")} value={`${avgKm.toFixed(1)} km`} hint={t("on average", "औसतन")} tone="var(--tone-warn)" />
        <Stat label={t("Actions done", "पूरे काम")} value={`${done}/${all.length}`} tone="var(--tone-good)" />
        <button className="text-left" onClick={() => (setOnlyStuck((v) => !v), setView("board"))}>
          <Stat
            label={t("Stuck — needs someone", "अटके — किसी की ज़रूरत")}
            value={stuck}
            hint={onlyStuck ? t("showing only these · tap to show all", "सिर्फ़ ये दिख रहे · सब दिखाने को छुएँ") : t("tap to show only these", "सिर्फ़ ये देखने को छुएँ")}
            tone="var(--tone-bad)"
          />
        </button>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={wave}
            onChange={setWave}
            options={[
              { value: 1, label: t("Wave 1 · now", "लहर 1 · अभी"), count: recs.filter((r) => r.wave === 1).length },
              { value: 2, label: t("Wave 2 · next term", "लहर 2 · अगला सत्र"), count: recs.filter((r) => r.wave === 2).length },
            ]}
          />
          {view === "board" && (
            <select className={fieldBase} value={owner} onChange={(e) => setOwner(e.target.value as typeof owner)} aria-label={t("Owner", "ज़िम्मेदार")}>
              <option value="all">{t("Everyone's actions", "सबके काम")}</option>
              <option value="CRP">{t("CRP actions", "CRP के काम")}</option>
              <option value="BEO">{t("BEO actions", "BEO के काम")}</option>
              <option value="Jugnu AI">{t("Jugnu's automatic actions", "जुगनू के अपने-आप होने वाले काम")}</option>
            </select>
          )}
          {onlyStuck && (
            <button className="chip" onClick={() => setOnlyStuck(false)}>
              {t("Only stuck ✕", "सिर्फ़ अटके ✕")}
            </button>
          )}
        </div>
      </Card>

      {view === "board" && (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = actions.filter((a) => a.status === col.key);
            return (
              <div key={col.key} className="card p-3">
                <div className={cx("mb-2 flex items-center justify-between px-1 text-sm font-semibold", hi)}>
                  {t(col.en, col.hi)} <span className="chip">{items.length}</span>
                </div>
                <div className="scroll-thin max-h-[560px] space-y-2 overflow-y-auto pr-1">
                  {items.length === 0 && <p className="px-1 text-xs text-[var(--color-ink-3)]">{t("Nothing here.", "यहाँ कुछ नहीं।")}</p>}
                  {items.slice(0, 60).map((a) => (
                    <ActionRow key={a.id} action={a} school={byId.get(a.schoolId)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "schools" && (
        <div className="grid gap-3 md:grid-cols-2">
          {waveRecs.map((r) => {
            const s = byId.get(r.schoolId)!;
            const d = byId.get(r.demonstratorId)!;
            const n = r.actions.filter((a) => a.status === "done").length;
            return (
              <Link key={r.schoolId} to={`/schools/${s.id}`} onClick={() => select(s.id)} className="card card-hover block p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-[var(--color-ink-3)]">
                      {s.teacher} · {s.clusterName}
                    </div>
                  </div>
                  <span className="chip">
                    {n}/{r.actions.length} {t("done", "पूरे")}
                  </span>
                </div>
                <div className="mt-2 text-sm">
                  <Footprints size={14} className="mr-1 inline text-amber-200" />
                  <b>{lang === "hi" ? PRACTICES[r.practice].labelHi : PRACTICES[r.practice].label}</b> {t("from", "—")} {d.teacher} ({r.distanceKm} km)
                </div>
                {r.actions.some((a) => a.status === "stuck") && <div className="mt-1 text-xs text-rose-300">{t("Something is stuck", "कुछ अटका है")}</div>}
              </Link>
            );
          })}
        </div>
      )}

      {view === "map" && (
        <Card title={t("Who learns from whom", "कौन किससे सीखता है")}>
          <LivingMap
            schools={state.block.schools}
            status={status}
            z={z}
            links={waveRecs.map((r) => ({ from: r.demonstratorId, to: r.schoolId }))}
            onSelect={(id) => (select(id), nav(`/schools/${id}`))}
            height={540}
          />
          <p className="mt-2 text-xs text-[var(--color-ink-3)]">
            {t("Each arc runs from a bright-spot teacher to a school learning that practice from them.", "हर रेखा अच्छे स्कूल के शिक्षक से उस स्कूल तक जाती है जो उनसे वह तरीका सीख रहा है।")}
          </p>
        </Card>
      )}
    </div>
  );
}
