// Bring in a block's own data: a CSV with school-level results and UDISE+ details. If the columns have
// other names, Jugnu maps them first.
import { Download, Upload, X } from "lucide-react";
import { useState } from "react";
import { DEFAULT_SEED } from "../engine/district";
import { postJSON } from "../lib/api";
import { CSV_COLUMNS, headerAndSample, parseCsv, remapCsv, templateCsv } from "../lib/csv";
import { useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";

export function ImportData() {
  const t = useT();
  const { state, importBlock, regenerate } = usePipeline();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([templateCsv(state.block)], { type: "text/csv" }));
    a.download = "jugnu-block-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const onFile = async (f: File) => {
    setErr("");
    setInfo("");
    const text = await f.text();
    try {
      importBlock(parseCsv(text));
      setOpen(false);
    } catch (e) {
      if (!(e as Error).message.startsWith("Missing columns")) return setErr((e as Error).message);
      try {
        setInfo(t("Reading your columns…", "आपके कॉलम पढ़ रहे हैं…"));
        const { headers, sample } = headerAndSample(text);
        const r = await postJSON<{ value: { mapping: Record<string, string | null>; scale: Record<string, number>; notes: string[] }; source: string }>("/api/import/map", { target: CSV_COLUMNS, headers, sample });
        importBlock(parseCsv(remapCsv(text, r.value.mapping, r.value.scale)));
        setOpen(false);
      } catch (e2) {
        setErr((e2 as Error).message);
      }
    }
  };
  return (
    <>
      <button className="btn btn-glass" onClick={() => setOpen(true)}>
        <Upload size={15} /> {t("Use your own data", "अपना डेटा जोड़ें")}
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="dialog" aria-modal aria-label={t("Use your own data", "अपना डेटा जोड़ें")}>
          <div className="scrim absolute inset-0" onClick={() => setOpen(false)} />
          <div className="sheet relative w-full max-w-md rounded-[1.6rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold">{t("Use your own data", "अपना डेटा जोड़ें")}</h3>
              <button className="btn btn-glass btn-icon !p-2" onClick={() => setOpen(false)} aria-label={t("Close", "बंद करें")}>
                <X size={15} />
              </button>
            </div>
            <p className="mt-1 text-sm text-[var(--color-ink-2)]">{t("Upload school-level results for three years from your state's records. Jugnu then finds the schools doing well in your own block.", "अपने राज्य के रिकॉर्ड से तीन साल के स्कूल-वार नतीजे अपलोड करें। जुगनू आपके अपने ब्लॉक में अच्छा कर रहे स्कूल ढूँढेगा।")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-glass" onClick={download}>
                <Download size={15} /> {t("Blank template", "खाली टेम्पलेट")}
              </button>
              <label className="btn btn-primary cursor-pointer">
                <Upload size={15} /> {t("Choose a CSV file", "CSV फ़ाइल चुनें")}
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
              {state.block.source === "imported" && (
                <button className="btn btn-glass" onClick={() => (regenerate(DEFAULT_SEED), setOpen(false))}>
                  {t("Back to Damoh", "दमोह पर लौटें")}
                </button>
              )}
            </div>
            {info && <p className="mt-2 text-xs text-[var(--color-ink-3)]">{info}</p>}
            {err && <p className="mt-2 text-xs" style={{ color: "var(--tone-bad)" }}>{err}</p>}
          </div>
        </div>
      )}
    </>
  );
}
