import { ArrowRight, Landmark, Map as MapIcon, Stars } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, PageHeader, Stat } from "../components/kit";
import { cx } from "../components/ui";
import { DISTRICT } from "../engine/district";
import { BLOCK_HQ } from "../engine/villages";
import { DAMOH_BLOCKS, type Ring } from "../lib/geo-shapes";
import { PRACTICES } from "../engine/practices";
import { summariseDistrict, type DistrictSummary } from "../engine/rollup";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";

// An element, not a string: the count-up animation would split "2,090" at the comma.
const num = (n: number) => n.toLocaleString("en-IN");
const fmt = (n: number) => <>{num(n)}</>;

export default function DistrictPage() {
  const t = useT();
  const nav = useNavigate();
  const { lang } = usePrefs();
  const { seed, regenerate } = usePipeline();
  const [d, setD] = useState<DistrictSummary | null>(null);

  // Seven full pipelines take about half a second: let the page paint first.
  useEffect(() => {
    const id = setTimeout(() => setD(summariseDistrict()), 30);
    return () => clearTimeout(id);
  }, []);

  const open = (code: number) => {
    regenerate(code);
    nav("/schools");
  };
  const sum = (f: (b: DistrictSummary["blocks"][number]) => number) => (d ? d.blocks.reduce((a, b) => a + f(b), 0) : 0);
  const label = (p: keyof typeof PRACTICES) => (lang === "hi" ? PRACTICES[p].labelHi : PRACTICES[p].label);

  return (
    <div>
      <PageHeader
        eyebrow={t(`${DISTRICT.name}, ${DISTRICT.state} · ${DISTRICT.source}`, `${DISTRICT.name}, मध्य प्रदेश · असली ब्लॉक आँकड़े, UDISE+ 2025-26`)}
        title={t("District", "ज़िला")}
        sub={t(
          "Each of Damoh's 7 blocks holds its real government schools from UDISE+ — names, locations, clusters, enrolment and teachers — and its real tribal share and women teachers. Learning results are simulated, because UDISE+ does not publish them. Open a block to work in it.",
          "दमोह के हर ब्लॉक में उसके असली सरकारी स्कूल हैं, UDISE+ से — नाम, जगह, संकुल, नामांकन और शिक्षक — और असली जनजातीय हिस्सा और महिला शिक्षक। सीखने के नतीजे सिम्युलेटेड हैं, क्योंकि UDISE+ उन्हें नहीं छापता। किसी ब्लॉक में काम करने के लिए उसे खोलें।",
        )}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Schools (all, UDISE+)", "स्कूल (सभी, UDISE+)")} value={fmt(sum((b) => b.profile.schools))} hint={t(`${num(sum((b) => b.schools))} real government schools`, `${num(sum((b) => b.schools))} असली सरकारी स्कूल`)} />
        <Stat label={t("Children enrolled", "नामांकित बच्चे")} value={fmt(sum((b) => b.profile.enrolment))} hint={t(`${num(sum((b) => b.profile.teachers))} teachers`, `${num(sum((b) => b.profile.teachers))} शिक्षक`)} />
        <Stat label={t("Confirmed doing well", "जाँचे गए अच्छे स्कूल")} value={d ? sum((b) => b.verified) : "…"} tone="var(--st-bright)" hint={t(`${d ? sum((b) => b.inflation) : "…"} worth a second visit`, `${d ? sum((b) => b.inflation) : "…"} पर बढ़ा-चढ़ाकर लिखने का शक`)} />
        <Stat label={t("Schools that need support", "जिन्हें मदद चाहिए")} value={d ? sum((b) => b.struggling) : "…"} hint={t("below what their context predicts", "हालात से अपेक्षित से नीचे")} />
      </div>

      <Card title={t("The district on the map", "नक्शे पर ज़िला")} icon={MapIcon} className="mb-5">
        <DistrictMap d={d} seed={seed} onOpen={open} />
      </Card>

      <Card title={t("Blocks", "ब्लॉक")} icon={Landmark} pad={false} className="mb-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-[var(--color-ink-3)]">
              <tr>
                <th className="px-4 py-2 font-medium md:px-5">{t("Block", "ब्लॉक")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Govt primary", "सरकारी प्राथमिक")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("ST enrolment", "ST नामांकन")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Women teachers", "महिला शिक्षक")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Class 3 reading", "कक्षा 3 पढ़ना")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Schools doing well", "अच्छे स्कूल")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Data to check", "जाँचने लायक")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Need support", "मदद चाहिए")}</th>
                <th className="px-4 py-2 md:px-5" />
              </tr>
            </thead>
            <tbody>
              {(d?.blocks ?? []).map((b) => (
                <tr key={b.profile.code} className={cx("border-t border-[var(--line)]", seed === b.profile.code && "bg-[var(--hover)]")}>
                  <td className="px-4 py-2.5 md:px-5">
                    <div className="font-semibold">{b.profile.block}</div>
                    <div className="text-xs text-[var(--color-ink-3)]">UDISE+ {b.profile.code}</div>
                  </td>
                  <td className="px-2 text-right tabular-nums">{b.schools}</td>
                  <td className="px-2 text-right tabular-nums">{b.profile.stEnrolmentPct}%</td>
                  <td className="px-2 text-right tabular-nums">{b.profile.femaleTeacherPct}%</td>
                  <td className="px-2 text-right tabular-nums">{b.reading}%</td>
                  <td className="px-2 text-right font-semibold tabular-nums text-[var(--st-bright)]">{b.verified}</td>
                  <td className="px-2 text-right tabular-nums">{b.inflation}</td>
                  <td className="px-2 text-right tabular-nums">{b.struggling}</td>
                  <td className="px-4 text-right md:px-5">
                    {seed === b.profile.code ? (
                      <button className="btn btn-glass" onClick={() => nav("/schools")}>
                        {t("Open", "खोलें")} <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button className="btn btn-glass" onClick={() => open(b.profile.code)} title={t("Work in this block (resets the demo block)", "इस ब्लॉक में काम करें (डेमो ब्लॉक बदल जाएगा)")}>
                        {t("Open block", "ब्लॉक खोलें")} <ArrowRight size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!d &&
                Array.from({ length: 7 }, (_, i) => (
                  <tr key={i} className="border-t border-[var(--line)]">
                    <td colSpan={9} className="px-4 py-3 md:px-5">
                      <div className="skeleton h-6 rounded-full" />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t("Methods that stand out, and where", "जो तरीके अलग दिखे, और कहाँ")} icon={Stars}>
        {d ? (
          <ul className="space-y-2.5">
            {d.practices.map((p) => (
              <li key={p.practice} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{label(p.practice)}</span>
                <span className="text-sm text-[var(--color-ink-2)]">
                  {p.blocks.length} {t(p.blocks.length === 1 ? "block" : "blocks", "ब्लॉक")} · {p.blocks.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="skeleton h-24 rounded-2xl" />
        )}
        <p className="mt-4 text-xs text-[var(--color-ink-3)]">
          {t(
            "A method that is distinctive in several blocks is the best candidate for a district-wide push; one found in a single block is shared within that block first.",
            "जो तरीका कई ब्लॉक में अलग दिखे, वह पूरे ज़िले में फैलाने का सबसे अच्छा उम्मीदवार है; जो एक ही ब्लॉक में मिले, उसे पहले उसी ब्लॉक में बाँटें।",
          )}
        </p>
      </Card>
    </div>
  );
}

/** Damoh's 7 real blocks (OpenStreetMap outlines), shaded by Std III reading; tap one to work in it. */
function DistrictMap({ d, seed, onOpen }: { d: DistrictSummary | null; seed: number; onOpen: (code: number) => void }) {
  const t = useT();
  const [hover, setHover] = useState<string | null>(null);
  const W = 640;
  const H = 460;
  const proj = useMemo(() => {
    const pts = Object.values(DAMOH_BLOCKS).flat();
    const lat0 = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const xs = pts.map((p) => p[0] * k);
    const ys = pts.map((p) => p[1]);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const s = Math.min((W - 24) / (maxX - minX), (H - 24) / (maxY - minY));
    const ox = (W - (maxX - minX) * s) / 2;
    const oy = (H - (maxY - minY) * s) / 2;
    const xy = (lon: number, lat: number) => [ox + (lon * k - minX) * s, oy + (maxY - lat) * s] as const;
    return { xy, path: (r: Ring) => "M" + r.map(([lon, lat]) => xy(lon, lat).map((v) => v.toFixed(1)).join(",")).join("L") + "Z" };
  }, []);
  const byName = new Map((d?.blocks ?? []).map((b) => [b.profile.block, b]));
  const readings = (d?.blocks ?? []).map((b) => b.reading);
  const [lo, hi] = [Math.min(...readings, 100), Math.max(...readings, 0)];
  const shade = (r: number) => `color-mix(in srgb, var(--st-bright) ${Math.round(18 + ((r - lo) / Math.max(1, hi - lo)) * 62)}%, transparent)`;
  const hb = hover ? byName.get(hover) : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Map of Damoh district's 7 blocks", "दमोह ज़िले के 7 ब्लॉक का नक्शा")}>
        {Object.entries(DAMOH_BLOCKS).map(([name, ring]) => {
          const b = byName.get(name);
          const current = b?.profile.code === seed;
          return (
            <path
              key={name}
              d={proj.path(ring)}
              fill={b ? shade(b.reading) : "var(--chip)"}
              stroke={current ? "var(--st-bright)" : "var(--color-ink-3)"}
              strokeWidth={current ? 3 : hover === name ? 2 : 1}
              strokeOpacity={current || hover === name ? 1 : 0.55}
              className="cursor-pointer transition-[stroke-width]"
              onMouseEnter={() => setHover(name)}
              onMouseLeave={() => setHover(null)}
              onClick={() => b && onOpen(b.profile.code)}
            />
          );
        })}
        {Object.keys(DAMOH_BLOCKS).map((name) => {
          const [lat, lon] = BLOCK_HQ[name];
          const [x, y] = proj.xy(lon, lat);
          const b = byName.get(name);
          return (
            <g key={name} className="pointer-events-none" transform={`translate(${x},${y})`}>
              <circle r={3.5} fill="var(--color-ink)" />
              <text y={-9} textAnchor="middle" className="fill-[var(--color-ink)] text-[13px] font-semibold" style={{ paintOrder: "stroke", stroke: "var(--bg)", strokeWidth: 3 }}>
                {name}
                {b ? ` · ${b.verified} ★` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {hb && (
        <div className="chrome pointer-events-none absolute left-3 top-3 rounded-2xl px-3 py-2 text-xs">
          <div className="text-sm font-semibold">{t(`${hb.profile.block} block`, `${hb.profile.block} ब्लॉक`)}</div>
          <div className="text-[var(--color-ink-2)]">
            {t(`Std III reading ${hb.reading}% · ${hb.verified} schools doing well · ${hb.struggling} need support`, `कक्षा 3 पढ़ना ${hb.reading}% · ${hb.verified} अच्छे स्कूल · ${hb.struggling} को मदद चाहिए`)}
          </div>
          <div className="text-[var(--color-ink-3)]">{t("Tap to open this block", "यह ब्लॉक खोलने के लिए छुएँ")}</div>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-ink-3)]">
        <span>{t("Class 3 reading", "कक्षा 3 पढ़ना")}</span>
        <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${shade(lo)}, ${shade(hi)})` }} />
        <span className="tabular-nums">
          {d ? `${lo}% – ${hi}%` : "…"}
        </span>
        <span className="ml-auto">{t("Outlines: OpenStreetMap", "सीमाएँ: OpenStreetMap")}</span>
      </div>
    </div>
  );
}
