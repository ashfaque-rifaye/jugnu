import { ArrowDown, ArrowUp, List, Map as MapIcon, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ImportData } from "../components/ImportData";
import { Card, fieldBase, fieldClass, PageHeader, Segmented, StatusChip } from "../components/kit";
import { LivingMap, MapLegend } from "../components/maps";
import { LevelCell } from "../components/SchoolCharts";
import { cx } from "../components/ui";
import { DAMOH, profileFor } from "../engine/district";
import { schoolOverall, schoolScore, SUBJECT_INFO, SUBJECTS, type Subject } from "../engine/subjects";
import { CYCLES } from "../engine/types";
import { usePrefs, useT } from "../lib/prefs";
import { useRole } from "../lib/role";
import { usePipeline } from "../lib/store";
import { meanZ, schoolStatuses, STATUS_INFO, type SchoolStatus } from "../lib/status";

const ORDER: SchoolStatus[] = ["check_due", "bright", "check_data", "revisit", "support", "ok"];
const GRADES = [1, 2, 3, 4, 5];
type SortBy = "status" | "name" | "overall" | Subject;

export default function SchoolsPage() {
  const t = useT();
  const nav = useNavigate();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
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
  const [cluster, setCluster] = useState<number | "all">(role?.kind === "crp" || role?.kind === "head" ? role.cluster : "all");
  const [sortBy, setSortBy] = useState<SortBy>("status");
  const [down, setDown] = useState(true);
  const [grade, setGrade] = useState<number | null>(null);
  const filter = (params.get("status") as SchoolStatus | null) ?? null;
  const setFilter = (s: SchoolStatus | null) => {
    if (s) params.set("status", s);
    else params.delete("status");
    setParams(params, { replace: true });
  };
  const last = CYCLES.length - 1;
  const sortOn = (k: SortBy) => {
    if (sortBy === k) setDown((v) => !v);
    else {
      setSortBy(k);
      setDown(k !== "name");
    }
  };

  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    const sign = down ? 1 : -1;
    return state.block.schools
      .filter((s) => cluster === "all" || s.cluster === cluster)
      .filter((s) => !filter || status.get(s.id) === filter)
      .filter((s) => !k || `${s.name} ${s.nameHi ?? ""} ${s.village} ${s.teacher}`.toLowerCase().includes(k))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name) * (down ? 1 : -1);
        if (sortBy === "overall") return ((schoolOverall(b, grade ?? undefined) ?? 0) - (schoolOverall(a, grade ?? undefined) ?? 0)) * sign;
        if (sortBy !== "status") return ((schoolScore(b, sortBy, grade ?? undefined) ?? 0) - (schoolScore(a, sortBy, grade ?? undefined) ?? 0)) * sign;
        return ORDER.indexOf(status.get(a.id)!) - ORDER.indexOf(status.get(b.id)!) || z[b.id] - z[a.id];
      });
  }, [state, status, z, q, cluster, filter, sortBy, down, grade]);
  const inScope = useMemo(() => new Map([...status].filter(([id]) => cluster === "all" || state.block.schools.find((s) => s.id === id)!.cluster === cluster)), [status, cluster, state.block]);

  const open = (id: string) => (select(id), nav(`/schools/${id}`));
  const head = (k: SortBy, label: string) => (
    <th key={k} aria-sort={sortBy === k ? (down ? "descending" : "ascending") : undefined} className="!text-center">
      <button className="tap-link inline-flex items-center gap-0.5 font-[inherit] uppercase tracking-[inherit]" onClick={() => sortOn(k)}>
        {label} {sortBy === k && (down ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    </th>
  );

  return (
    <div>
      <PageHeader
        eyebrow={`${state.block.name} · ${state.block.source === "imported" ? t("your data", "आपका डेटा") : t("real government schools (UDISE+), simulated results", "असली सरकारी स्कूल (UDISE+), सिम्युलेटेड नतीजे")}`}
        title={t("Schools", "स्कूल")}
        sub={t(
          "Every school, class by class and subject by subject. Each number is the share of children at the level expected for their class. Tap a school to see how it is doing and what to do next.",
          "हर स्कूल, कक्षा और विषय के हिसाब से। हर अंक बताता है कितने प्रतिशत बच्चे अपनी कक्षा के स्तर पर हैं। हाल और अगला कदम देखने के लिए स्कूल छुएँ।",
        )}
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: (<><List size={15} /> {t("List", "सूची")}</>) },
                { value: "map", label: (<><MapIcon size={15} /> {t("Map", "नक्शा")}</>) },
              ]}
            />
            <ImportData />
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
            <select className={cx(fieldBase, "min-w-0")} value={sortBy} onChange={(e) => (setSortBy(e.target.value as SortBy), setDown(e.target.value !== "name"))} aria-label={t("Sort", "क्रम")}>
              <option value="status">{t("Action first", "काम पहले")}</option>
              <option value="overall">{t("Highest overall", "कुल में सबसे ऊपर")}</option>
              {SUBJECTS.map((x) => (
                <option key={x} value={x}>
                  {t(SUBJECT_INFO[x].en, SUBJECT_INFO[x].hi)}
                </option>
              ))}
              <option value="name">{t("Name A–Z", "नाम से")}</option>
            </select>
          )}
        </div>
        {view === "list" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={cx("text-sm text-[var(--color-ink-2)]", hi)}>{t("Class", "कक्षा")}</span>
            <Segmented size="sm" value={grade ?? 0} onChange={(v) => setGrade(v === 0 ? null : v)} options={[{ value: 0, label: t("All 1–5", "सभी 1–5") }, ...GRADES.map((g) => ({ value: g, label: String(g) }))]} />
          </div>
        )}
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
          <div className={cx("px-4 pt-3 text-sm text-[var(--color-ink-2)] md:px-5", hi)}>
            {t(`${rows.length} schools · ${grade ? `class ${grade}` : "classes 1 to 5"}`, `${rows.length} स्कूल · ${grade ? `कक्षा ${grade}` : "कक्षा 1 से 5"}`)}
          </div>
          {rows.length === 0 && (
            <div className="px-4 pb-4 pt-2 text-sm text-[var(--color-ink-2)] md:px-5">
              {t("Nothing here in this view right now.", "इस दृश्य में अभी कुछ नहीं है।")}
              <button
                className="btn btn-glass mt-3 block"
                onClick={() => {
                  setQ("");
                  setCluster("all");
                  if (cluster === "all") setFilter(null);
                }}
              >
                {t("See all schools", "सभी स्कूल देखें")}
              </button>
            </div>
          )}
          {/* phones: cards */}
          <ul className="space-y-2 p-3 md:hidden">
            {rows.slice(0, 120).map((s) => (
              <li key={s.id}>
                <button className="card-inset w-full p-3 text-left" onClick={() => open(s.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">{lang === "hi" && s.nameHi ? s.nameHi : s.name}</div>
                      <div className={cx("text-xs text-[var(--color-ink-3)]", hi)}>
                        {s.clusterName} · {t(`${s.enrolment} children`, `${s.enrolment} बच्चे`)} · {Math.round(s.attendanceByCycle[last] * 100)}% {t("attend", "उपस्थित")}
                      </div>
                    </div>
                    <StatusChip status={status.get(s.id)!} size="sm" />
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-1 text-center">
                    {SUBJECTS.map((x) => (
                      <div key={x}>
                        <div className={cx("mb-0.5 truncate text-xs text-[var(--color-ink-3)]", hi)}>{t(...SUBJECT_INFO[x].short)}</div>
                        <LevelCell value={schoolScore(s, x, grade ?? undefined)} />
                      </div>
                    ))}
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
                  <th>
                    <button className="tap-link inline-flex items-center gap-0.5 font-[inherit] uppercase tracking-[inherit]" onClick={() => sortOn("name")}>
                      {t("School", "स्कूल")} {sortBy === "name" && (down ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                    </button>
                  </th>
                  <th>{t("Cluster", "क्लस्टर")}</th>
                  {SUBJECTS.map((x) => head(x, t(...SUBJECT_INFO[x].short)))}
                  {head("overall", t("Overall", "कुल"))}
                  <th>{t("Attends", "उपस्थिति")}</th>
                  <th>{t("Status", "स्थिति")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} onClick={() => open(s.id)}>
                    <td>
                      <div className="font-semibold">{lang === "hi" && s.nameHi ? s.nameHi : s.name}</div>
                      <div className={cx("text-xs text-[var(--color-ink-3)]", hi)}>
                        {t(`${s.enrolment} children · ${s.teacherCount} teachers`, `${s.enrolment} बच्चे · ${s.teacherCount} शिक्षक`)}
                      </div>
                    </td>
                    <td className="text-[var(--color-ink-2)]">{s.clusterName}</td>
                    {SUBJECTS.map((x) => (
                      <td key={x} className="!px-1">
                        <LevelCell value={schoolScore(s, x, grade ?? undefined)} />
                      </td>
                    ))}
                    <td className="!px-1">
                      <LevelCell value={schoolOverall(s, grade ?? undefined)} strong />
                    </td>
                    <td className="tabular-nums">{Math.round(s.attendanceByCycle[last] * 100)}%</td>
                    <td>
                      <StatusChip status={status.get(s.id)!} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {view === "list" && <p className={cx("mt-2 px-1 text-xs text-[var(--color-ink-3)]", hi)}>{t(`${STATUS_INFO.bright.en}: above what similar schools reach, in class 3 Hindi and maths, and confirmed by a visit.`, `${STATUS_INFO.bright.hi}: वैसे ही दूसरे स्कूलों से ऊपर, कक्षा 3 की हिंदी और गणित में, और दौरे से पुष्टि।`)}</p>}
    </div>
  );
}
