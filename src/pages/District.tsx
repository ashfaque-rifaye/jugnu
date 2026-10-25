import { ArrowRight, Landmark, Stars } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, PageHeader, Stat } from "../components/kit";
import { cx } from "../components/ui";
import { DISTRICT } from "../engine/district";
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
        eyebrow={t(`${DISTRICT.name}, ${DISTRICT.state} · real block profiles, ${DISTRICT.source}`, `${DISTRICT.name}, मध्य प्रदेश · असली ब्लॉक आँकड़े, UDISE+ 2025-26`)}
        title={t("District", "ज़िला")}
        sub={t(
          "Each of Damoh's 7 blocks is built from its real UDISE+ profile: number of government schools, tribal share, pupils per teacher and women teachers. The schools inside are simulated, because UDISE+ does not publish school results. Open a block to work in it.",
          "दमोह के 7 ब्लॉक उनके असली UDISE+ आँकड़ों से बने हैं: सरकारी स्कूलों की संख्या, जनजातीय हिस्सा, प्रति शिक्षक बच्चे और महिला शिक्षक। अंदर के स्कूल सिम्युलेटेड हैं, क्योंकि UDISE+ स्कूलों के नतीजे नहीं छापता। किसी ब्लॉक में काम करने के लिए उसे खोलें।",
        )}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Schools (all, UDISE+)", "स्कूल (सभी, UDISE+)")} value={fmt(sum((b) => b.profile.schools))} hint={t(`${num(sum((b) => b.schools))} government primary simulated`, `${num(sum((b) => b.schools))} सरकारी प्राथमिक सिम्युलेटेड`)} />
        <Stat label={t("Children enrolled", "नामांकित बच्चे")} value={fmt(sum((b) => b.profile.enrolment))} hint={t(`${num(sum((b) => b.profile.teachers))} teachers`, `${num(sum((b) => b.profile.teachers))} शिक्षक`)} />
        <Stat label={t("Verified bright spots", "जाँचे गए अच्छे स्कूल")} value={d ? sum((b) => b.verified) : "…"} tone="var(--st-bright)" hint={t(`${d ? sum((b) => b.inflation) : "…"} flagged as possibly inflated`, `${d ? sum((b) => b.inflation) : "…"} पर बढ़ा-चढ़ाकर लिखने का शक`)} />
        <Stat label={t("Schools that need support", "जिन्हें मदद चाहिए")} value={d ? sum((b) => b.struggling) : "…"} hint={t("below what their context predicts", "हालात से अपेक्षित से नीचे")} />
      </div>

      <Card title={t("Blocks", "ब्लॉक")} icon={Landmark} pad={false} className="mb-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-[var(--color-ink-3)]">
              <tr>
                <th className="px-4 py-2 font-medium md:px-5">{t("Block", "ब्लॉक")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Govt primary", "सरकारी प्राथमिक")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("ST enrolment", "ST नामांकन")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Women teachers", "महिला शिक्षक")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Std III reading", "कक्षा 3 पढ़ना")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("Bright spots", "अच्छे स्कूल")}</th>
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

      <Card title={t("Practices that stand out, and where", "जो तरीके अलग दिखे, और कहाँ")} icon={Stars}>
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
            "A practice that is distinctive in several blocks is the best candidate for a district-wide push; one found in a single block is shared within that block first.",
            "जो तरीका कई ब्लॉक में अलग दिखे, वह पूरे ज़िले में फैलाने का सबसे अच्छा उम्मीदवार है; जो एक ही ब्लॉक में मिले, उसे पहले उसी ब्लॉक में बाँटें।",
          )}
        </p>
      </Card>
    </div>
  );
}
