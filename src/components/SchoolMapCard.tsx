// The card for a school picked on the map: what the place looks like from above, who teaches there,
// attendance and grades 1–5, and how far it is to the nearest bright spot (and to the teacher it
// learns from) — straight line, by road and by motorbike.
import { motion } from "framer-motion";
import { ArrowRight, Bike, Footprints, Navigation, Sparkles, Users, X } from "lucide-react";
import { useMemo } from "react";
import { nearest, trip } from "../engine/geo";
import type { School } from "../engine/types";
import { usePrefs, useT } from "../lib/prefs";
import { STATUS_INFO, type SchoolStatus } from "../lib/status";
import { StatusChip } from "./kit";
import { cx } from "./ui";

/** A satellite view centred on a point, stitched from Esri World Imagery tiles. */
export function SatThumb({ lat, lon, zoom = 16, className }: { lat: number; lon: number; zoom?: number; className?: string }) {
  const n = 2 ** zoom;
  const fx = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const [tx, ty] = [Math.floor(fx), Math.floor(fy)];
  const tiles: { x: number; y: number; dx: number; dy: number }[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) tiles.push({ x: tx + dx, y: ty + dy, dx, dy });
  // tile px (256) offset so the point sits in the middle of the frame
  const ox = (fx - tx) * 256;
  const oy = (fy - ty) * 256;
  return (
    <div className={cx("relative overflow-hidden bg-[#1a2333]", className)}>
      <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(${-ox}px, ${-oy}px)` }}>
        {tiles.map((t) => (
          <img
            key={`${t.x}-${t.y}`}
            src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${t.y}/${t.x}`}
            alt=""
            loading="lazy"
            draggable={false}
            className="absolute max-w-none"
            style={{ width: 256, height: 256, left: t.dx * 256, top: t.dy * 256 }}
          />
        ))}
      </div>
      <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#22d3ee] shadow-[0_0_0_6px_rgba(34,211,238,0.3)]" />
    </div>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function SchoolMapCard({
  school: s,
  status,
  schools,
  statuses,
  links,
  onClose,
  onOpen,
  onRoute,
  onPick,
}: {
  school: School;
  status: SchoolStatus;
  schools: School[];
  statuses: Map<string, SchoolStatus>;
  links: { from: string; to: string }[];
  onClose: () => void;
  onOpen?: (id: string) => void;
  onRoute: (from: string, to: string) => void;
  onPick: (id: string) => void;
}) {
  const t = useT();
  const { lang } = usePrefs();
  const byId = useMemo(() => new Map(schools.map((x) => [x.id, x])), [schools]);
  const bright = useMemo(() => nearest(s, schools.filter((x) => statuses.get(x.id) === "bright")), [s, schools, statuses]);
  const mentor = links.find((l) => l.to === s.id);
  const mentorSchool = mentor ? byId.get(mentor.from) : undefined;
  const learners = links.filter((l) => l.from === s.id).map((l) => byId.get(l.to)!).filter(Boolean);
  const last = s.attendanceByCycle.length - 1;
  const att = s.attendanceByCycle[last] ?? s.attendance;
  const prev = s.attendanceByCycle[last - 1];
  const name = lang === "hi" && s.nameHi ? s.nameHi : s.name;

  const tripRow = (to: School, label: string, Icon: typeof Sparkles) => {
    const tr = trip(s, to);
    return (
      <div className="card-inset p-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-3)]">
          <Icon size={12} /> {label}
        </div>
        <button className="mt-0.5 block truncate text-left font-semibold hover:underline" onClick={() => onPick(to.id)}>
          {lang === "hi" && to.nameHi ? to.nameHi : to.name} <span className="font-normal text-[var(--color-ink-3)]">· {to.teacher}</span>
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-2)]">
          <span>
            <b className="tabular-nums text-[var(--color-ink)]">{tr.km} km</b> {t("away", "दूर")}
          </span>
          <span>
            <Footprints size={11} className="mr-0.5 inline" />~{tr.roadKm} km {t("road", "सड़क")}
          </span>
          <span>
            <Bike size={11} className="mr-0.5 inline" />~{tr.minutes} min
          </span>
          <button className="ml-auto inline-flex items-center gap-1 font-semibold text-[var(--st-check-due)]" onClick={() => onRoute(s.id, to.id)}>
            <Navigation size={11} /> {t("Show", "दिखाएँ")}
          </button>
        </div>
      </div>
    );
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="sheet scroll-thin absolute inset-x-2 bottom-2 z-20 max-h-[62%] overflow-y-auto rounded-[1.4rem] sm:inset-x-auto sm:bottom-3 sm:right-14 sm:top-3 sm:max-h-none sm:w-[330px]"
      aria-label={name}
    >
      {s.lat != null && s.lon != null && (
        <div className="relative">
          <SatThumb lat={s.lat} lon={s.lon} className="h-32 w-full" />
          <span className="absolute bottom-1.5 left-2 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white/85">
            {t(`${s.village} from above · Esri imagery`, `${s.nameHi ?? s.village} ऊपर से · Esri`)}
          </span>
          <button className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75" onClick={onClose} aria-label={t("Close", "बंद करें")}>
            <X size={15} />
          </button>
        </div>
      )}
      <div className="space-y-3 p-3.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold leading-tight">{name}</div>
              <div className="text-xs text-[var(--color-ink-3)]">
                {t("Govt. Primary School", "शासकीय प्राथमिक शाला")} · {s.clusterName} {t("cluster", "क्लस्टर")}
              </div>
            </div>
            <StatusChip status={status} size="sm" />
          </div>
          <div className="mt-2 text-sm text-[var(--color-ink-2)]">
            {s.teacher} · {s.enrolment} {t("children", "बच्चे")} · CRP {s.crp}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="card-inset p-2.5">
            <div className="text-xs text-[var(--color-ink-3)]">{t("Attendance (avg day)", "उपस्थिति (औसत दिन)")}</div>
            <div className="text-lg font-semibold tabular-nums">
              {pct(att)}
              {prev != null && <span className={cx("ml-1 text-xs", att >= prev ? "text-emerald-400" : "text-rose-400")}>{att >= prev ? "▲" : "▼"} {Math.abs(Math.round((att - prev) * 100))}</span>}
            </div>
            <div className="text-xs text-[var(--color-ink-3)]">
              ~{Math.round(s.enrolment * att)} {t(`of ${s.enrolment} present`, `/${s.enrolment} मौजूद`)}
            </div>
          </div>
          <div className="card-inset p-2.5">
            <div className="text-xs text-[var(--color-ink-3)]">{t("Class 3 reading · maths", "कक्षा 3 पढ़ना · गणित")}</div>
            <div className="text-lg font-semibold tabular-nums">
              {Math.round(s.reading[s.reading.length - 1])}% · {Math.round(s.numeracy[s.numeracy.length - 1])}%
            </div>
            <div className="text-xs text-[var(--color-ink-3)]">{t("at grade level", "स्तर पर")}</div>
          </div>
        </div>

        {s.grades.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-3)]">{t("Grades 1–5 · reading at grade level", "कक्षा 1–5 · स्तर पर पढ़ना")}</div>
            <div className="flex h-16 items-end gap-1.5">
              {s.grades.map((g) => (
                <div key={g.grade} className="flex flex-1 flex-col items-center gap-1" title={`${t("Class", "कक्षा")} ${g.grade}: ${g.enrolled} ${t("children", "बच्चे")}, ${pct(g.attendance)} ${t("attend", "उपस्थित")}, ${Math.round(g.reading)}% ${t("read", "पढ़ते")}, ${Math.round(g.numeracy)}% ${t("maths", "गणित")}`}>
                  <span className="text-xs tabular-nums text-[var(--color-ink-2)]">{Math.round(g.reading)}</span>
                  <span className="w-full rounded-t-[4px]" style={{ height: Math.max(3, g.reading * 0.4), background: STATUS_INFO[status].color, opacity: 0.35 + g.attendance * 0.6 }} />
                  <span className="text-xs text-[var(--color-ink-3)]">{g.grade}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {mentorSchool && tripRow(mentorSchool, t("Learns from", "इनसे सीखता है"), Users)}
        {bright && status !== "bright" && bright.school.id !== mentorSchool?.id && tripRow(bright.school, t("Nearest school doing well", "सबसे पास का अच्छा स्कूल"), Sparkles)}
        {status === "bright" && learners.length > 0 && (
          <div className="card-inset p-2.5 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-3)]">{t("Teaches nearby schools", "पास के स्कूलों को सिखाता है")}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {learners.slice(0, 8).map((l) => (
                <button key={l.id} className="chip !text-xs" onClick={() => onPick(l.id)}>
                  {lang === "hi" && l.nameHi ? l.nameHi : l.name} · {trip(s, l).km} km
                </button>
              ))}
            </div>
          </div>
        )}

        {onOpen && (
          <button className="btn btn-primary w-full justify-center" onClick={() => onOpen(s.id)}>
            {t("Open school", "स्कूल खोलें")} <ArrowRight size={15} />
          </button>
        )}
      </div>
    </motion.aside>
  );
}
