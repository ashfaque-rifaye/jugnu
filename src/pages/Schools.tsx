import { ArrowDown, ArrowUp, List, Map as MapIcon, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, fieldBase, fieldClass, PageHeader, Segmented, StatusChip } from "../components/kit";
import { LivingMap, MapLegend } from "../components/maps";
import { cx } from "../components/ui";
import { DAMOH, profileFor } from "../engine/district";
import { CYCLES } from "../engine/types";
import { usePrefs, useT } from "../lib/prefs";
import { useRole } from "../lib/role";
import { usePipeline } from "../lib/store";
import { gapPts, meanZ, schoolStatuses, STATUS_INFO, type SchoolStatus } from "../lib/status";

const ORDER: SchoolStatus[] = ["check_due", "bright", "check_data", "revisit", "support", "ok"];

export default function SchoolsPage() {
  const t = useT();
  const nav = useNavigate();
  const { lang } = usePrefs();
  const [role] = useRole();
  const [params, setParams] = useSearchParams();
  const { state, regenerate, select } = usePipeline();
  const status = useMemo(() => schoolStatuses(state), [state]);
  const z = useMemo(() => meanZ(state), [state]);
  const clusters = useMemo(() => [...new Map(state.block.schools.map((s) => [s.cluster, s.clusterName])).entries()].sort((a, b) => a[0] - b[0]), [state.block]);
  const [view, setView] = useState<"list" | "map">(params.get("view") === "map" || params.get("focus") ? "map" : "list");
  const [q, setQ] = useState(params.get("q") ?? "");
  // The assistant searches by linking here with ?q=…
  useEffect(() => {
    const k = params.get("q");
    if (k != null) setQ(k);
  }, [params]);
  const [cluster, setCluster] = useState<number | "all">(role?.kind === "crp" ? role.cluster : "all");
  const [sortBy, setSortBy] = useState<"status" | "reading" | "maths" | "name">("status");
  const filter = (params.get("status") as SchoolStatus | null) ?? null;
  const setFilter = (s: SchoolStatus | null) => {
    if (s) params.set("status", s);
    else params.delete("status");
    setParams(params, { replace: true });
  };
  const last = CYCLES.length - 1;

  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    return state.block.schools
      .filter((s) => cluster === "all" || s.cluster === cluster)
      .filter((s) => !filter || status.get(s.id) === filter)
      .filter((s) => !k || `${s.name} ${s.nameHi ?? ""} ${s.village} ${s.teacher}`.toLowerCase().includes(k))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "reading") return gapPts(state, b.id, "reading") - gapPts(state, a.id, "reading");
        if (sortBy === "maths") return gapPts(state, b.id, "numeracy") - gapPts(state, a.id, "numeracy");
        return ORDER.indexOf(status.get(a.id)!) - ORDER.indexOf(status.get(b.id)!) || z[b.id] - z[a.id];
      });
  }, [state, status, z, q, cluster, filter, sortBy]);
  const inScope = useMemo(() => new Map([...status].filter(([id]) => cluster === "all" || state.block.schools.find((s) => s.id === id)!.cluster === cluster)), [status, cluster, state.block]);

  const open = (id: string) => (select(id), nav(`/schools/${id}`));
  const gap = (n: number) => (
    <span className={cx("tabular-nums text-xs", n >= 8 ? "text-sky-300" : n <= -8 ? "text-rose-300" : "text-[var(--color-ink-3)]")}>
      {n > 0 ? "+" : ""}
      {n} {t("pts vs expected", "अंक, अपेक्षा से")}
    </span>
  );

  return (
    <div>
      <PageHeader
        eyebrow={`${state.block.name} · ${state.block.source === "imported" ? t("your data", "आपका डेटा") : profileFor(state.block.seed) ? t("real UDISE+ schools, simulated results", "असली UDISE+ स्कूल, सिम्युलेटेड नतीजे") : t("demo data, calibrated to ASER 2024", "डेमो डेटा, ASER 2024 के अनुसार")}`}
        title={t("Schools", "स्कूल")}
        sub={t(
          "Every school compared with what its context predicts (multigrade classes, size, attendance, home language…). Tap a school to see its results, checks, interviews and next steps.",
          "हर स्कूल की तुलना उसके हालात (बहु-कक्षा, आकार, उपस्थिति, घर की भाषा…) से अपेक्षित परिणाम से। नतीजे, जाँचें, बातचीत और अगले कदम देखने के लिए स्कूल छुएँ।",
        )}
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                {
                  value: "list",
                  label: (
                    <>
                      <List size={15} /> {t("List", "सूची")}
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
            {state.block.source === "simulated" && (
              <button className="btn btn-glass" onClick={() => regenerate()} title={t("Generate a different simulated block", "दूसरा सिम्युलेटेड ब्लॉक बनाएँ")}>
                <RefreshCw size={15} /> {t("New demo block", "नया डेमो ब्लॉक")}
              </button>
            )}
          </>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
          <div className="relative col-span-2 min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]" />
            <input className={cx(fieldClass, "pl-9")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search by school, village or teacher", "स्कूल, गाँव या शिक्षक से खोजें")} />
          </div>
          <select className={cx(fieldBase, "min-w-0")} value={cluster} onChange={(e) => setCluster(e.target.value === "all" ? "all" : Number(e.target.value))} aria-label={t("Cluster", "क्लस्टर")}>
            <option value="all">{t("All clusters", "सभी क्लस्टर")}</option>
            {clusters.map(([i, n]) => (
              <option key={i} value={i}>
                {n}
              </option>
            ))}
          </select>
          {view === "list" && (
            <select className={cx(fieldBase, "min-w-0")} value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label={t("Sort", "क्रम")}>
              <option value="status">{t("Action first", "काम पहले")}</option>
              <option value="reading">{t("Reading first", "पढ़ना पहले")}</option>
              <option value="maths">{t("Maths first", "गणित पहले")}</option>
              <option value="name">{t("Name A–Z", "नाम से")}</option>
            </select>
          )}
        </div>
        <div className="mt-3">
          <MapLegend status={inScope} active={filter} onPick={setFilter} />
        </div>
      </Card>

      {view === "map" ? (
        <Card>
          <LivingMap
            schools={state.block.schools}
            status={status}
            z={z}
            onSelect={open}
            highlight={new Set(rows.map((r) => r.id))}
            height={620}
            block={profileFor(state.block.seed)?.block}
            links={state.recs.filter((r) => r.wave === 1).map((r) => ({ from: r.demonstratorId, to: r.schoolId }))}
            focusId={params.get("focus")}
            onBlock={(name) => {
              const p = DAMOH.find((x) => x.block === name);
              if (p) regenerate(p.code);
            }}
          />
        </Card>
      ) : (
        <Card pad={false}>
          <div className="px-4 pt-3 text-sm text-[var(--color-ink-2)] md:px-5">{t(`${rows.length} schools`, `${rows.length} स्कूल`)}</div>
          {/* phones: cards */}
          <ul className="space-y-2 p-3 md:hidden">
            {rows.slice(0, 120).map((s) => (
              <li key={s.id}>
                <button className="card-inset w-full p-3 text-left" onClick={() => open(s.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{lang === "hi" && s.nameHi ? s.nameHi : s.name}</div>
                      <div className="text-xs text-[var(--color-ink-3)]">
                        {s.teacher} · {s.clusterName} · {Math.round(s.attendanceByCycle[last] * 100)}% {t("attend", "उपस्थित")}
                      </div>
                    </div>
                    <StatusChip status={status.get(s.id)!} size="sm" />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      {t("Reading", "पढ़ना")} <b className="tabular-nums">{s.reading[last]}%</b> {gap(gapPts(state, s.id, "reading"))}
                    </div>
                    <div>
                      {t("Maths", "गणित")} <b className="tabular-nums">{s.numeracy[last]}%</b> {gap(gapPts(state, s.id, "numeracy"))}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {/* desktop: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="table-clean w-full text-sm">
              <thead>
                <tr>
                  <th>{t("School", "स्कूल")}</th>
                  <th>{t("Cluster", "क्लस्टर")}</th>
                  <th>{t(`Reading (Grade 3, ${CYCLES[last]})`, `पढ़ना (कक्षा 3, ${CYCLES[last]})`)}</th>
                  <th>{t("Maths", "गणित")}</th>
                  <th>{t("Attendance", "उपस्थिति")}</th>
                  <th>{t("3 years vs expected", "3 साल, अपेक्षा से")}</th>
                  <th>{t("Status", "स्थिति")}</th>
                  <th>{t("Next step", "अगला कदम")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const st = status.get(s.id)!;
                  return (
                    <tr key={s.id} onClick={() => open(s.id)}>
                      <td>
                        <div className="font-semibold">{lang === "hi" && s.nameHi ? s.nameHi : s.name}</div>
                        <div className="text-xs text-[var(--color-ink-3)]">{s.teacher}</div>
                      </td>
                      <td className="text-[var(--color-ink-2)]">{s.clusterName}</td>
                      <td>
                        <b className="tabular-nums">{s.reading[last]}%</b> <div>{gap(gapPts(state, s.id, "reading"))}</div>
                      </td>
                      <td>
                        <b className="tabular-nums">{s.numeracy[last]}%</b> <div>{gap(gapPts(state, s.id, "numeracy"))}</div>
                      </td>
                      <td className="tabular-nums">
                        <b>{Math.round(s.attendanceByCycle[last] * 100)}%</b>
                        <div className="text-xs text-[var(--color-ink-3)]">{s.enrolment} {t("enrolled", "नामांकित")}</div>
                      </td>
                      <td>
                        <Trend values={state.find.z[s.id]} />
                      </td>
                      <td>
                        <StatusChip status={st} size="sm" />
                      </td>
                      <td className={cx("max-w-[240px] text-xs text-[var(--color-ink-2)]", lang === "hi" && "font-deva")}>{t(...STATUS_INFO[st].next)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/** Three small bars: above (blue) or below (red) expectation, one per assessment cycle. */
export function Trend({ values }: { values: number[] }) {
  return (
    <div className="flex h-8 items-center gap-1" aria-label={values.map((v) => v.toFixed(1)).join(", ")}>
      {values.map((v, i) => {
        const h = Math.min(14, Math.abs(v) * 7 + 1);
        return (
          <div key={i} className="relative h-8 w-2.5">
            <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
            <div className="absolute left-0 right-0 rounded-sm" style={{ height: h, top: v >= 0 ? 16 - h : 16, background: v >= 0.9 ? "var(--tone-reading)" : v <= -0.5 ? "var(--tone-bad)" : "var(--st-ok-dot)" }} />
          </div>
        );
      })}
      {values.at(-1)! - values[0] > 0.6 ? <ArrowUp size={13} className="text-sky-300" /> : values[0] - values.at(-1)! > 0.6 ? <ArrowDown size={13} className="text-rose-300" /> : null}
    </div>
  );
}
