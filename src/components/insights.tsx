// Panels built from the console's own cards and fields: the photo check on a confirmation visit,
// WhatsApp sending and the plan-board exports. (The teacher coach lives in Coach.tsx, for the light teacher page.)
import { CalendarPlus, Camera, Download, Loader2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { PRACTICES, type PracticeId } from "../engine/practices";
import { download, postJSON, useStatus } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { Card, Field, fieldClass } from "./kit";
import { cx } from "./ui";
const btn = "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50";
const primary = `${btn} bg-[var(--st-bright)] text-[var(--btn-ink)]`;
const ghost = `${btn} border border-[var(--chip-line)] text-[var(--color-ink)] hover:bg-[var(--hover)]`;

function usePracticeLabel() {
  const { lang } = usePrefs();
  return (p: PracticeId) => (lang === "hi" ? PRACTICES[p].labelHi : PRACTICES[p].label);
}

type PhotoResult = { value: { visible: "yes" | "partly" | "no" | "cannot_tell"; seen: string[]; summary_en: string; summary_hi: string; child_faces: boolean }; source: string; warning?: string };

/** Shrink a phone photo to ≤1280 px JPEG before it leaves the device. */
async function shrink(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

/** Spot check by photo: is the practice visible in the classroom? The photo is not kept. */
export function PhotoCheck({ schoolId, blockKey, practices }: { schoolId: string; blockKey: string; practices: PracticeId[] }) {
  const t = useT();
  const { lang } = usePrefs();
  const label = usePracticeLabel();
  const [practice, setPractice] = useState<PracticeId>(practices[0] ?? "print_wall");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<PhotoResult | null>(null);
  const [err, setErr] = useState("");
  const onFile = async (f: File) => {
    setBusy(true);
    setErr("");
    setRes(null);
    try {
      setRes(await postJSON<PhotoResult>("/api/evidence/photo", { image: await shrink(f), practice, schoolId, block: blockKey }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const verdict = res && { yes: t("Visible", "दिख रहा है"), partly: t("Partly visible", "कुछ हद तक दिख रहा है"), no: t("Not visible", "नहीं दिख रहा"), cannot_tell: t("Can't tell", "कह नहीं सकते") }[res.value.visible];
  return (
    <Card title={t("Check a method from a photo", "फ़ोटो से अभ्यास की जाँच")} icon={Camera}>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label={t("Method to look for", "कौन-सा तरीका देखें")}>
          <select className={fieldClass} value={practice} onChange={(e) => setPractice(e.target.value as PracticeId)}>
            {(Object.keys(PRACTICES) as PracticeId[]).map((p) => (
              <option key={p} value={p}>
                {label(p)}
              </option>
            ))}
          </select>
        </Field>
        <label className={cx(primary, "cursor-pointer")}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {t("Take or choose a photo", "फ़ोटो लें या चुनें")}
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </div>
      <p className="mt-2 text-xs text-[var(--color-ink-3)]">{t("Photograph walls, charts and materials — not children's faces. The photo is checked and not stored.", "दीवार, चार्ट और सामग्री की फ़ोटो लें — बच्चों के चेहरे नहीं। फ़ोटो जाँच के बाद रखी नहीं जाती।")}</p>
      {res && (
        <div className="card-inset mt-4 p-4 text-sm">
          <div className="font-semibold">{verdict}</div>
          <p className="mt-1 text-[var(--color-ink-2)]">{lang === "hi" ? res.value.summary_hi : res.value.summary_en}</p>
          {res.value.seen.length > 0 && <p className="mt-2 text-xs text-[var(--color-ink-3)]">{t("Seen: ", "दिखा: ")}{res.value.seen.join(" · ")}</p>}
          {res.value.child_faces && <p className="mt-2 text-xs text-amber-300">{t("Children's faces are visible — please retake from behind or of the wall only.", "बच्चों के चेहरे दिख रहे हैं — कृपया पीछे से या केवल दीवार की फ़ोटो लें।")}</p>}
          {res.source === "offline" && <p className="mt-2 text-xs text-[var(--color-ink-3)]">{t("AI unavailable — nothing was recorded.", "AI उपलब्ध नहीं — कुछ दर्ज नहीं हुआ।")}</p>}
        </div>
      )}
      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
    </Card>
  );
}

/** Send the peer voice note or the day-14 check-in on WhatsApp, straight from Jugnu. */
export function WhatsAppSend({ blockKey, schoolId, teacher, practice, voiceNote }: { blockKey: string; schoolId: string; teacher: string; practice?: PracticeId; voiceNote?: { hi: string; en: string } }) {
  const t = useT();
  const { lang } = usePrefs();
  const status = useStatus();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  if (!status.whatsapp)
    return <p className="text-xs text-[var(--color-ink-3)]">{t("Sending from Jugnu needs WhatsApp to be set up on the server.", "जुगनू से सीधे भेजने के लिए सर्वर पर WhatsApp सेट होना चाहिए।")}</p>;
  const send = async (kind: "voice_note" | "checkin") => {
    setBusy(kind);
    setMsg("");
    try {
      await postJSON("/api/whatsapp/send", {
        to,
        kind,
        text: kind === "voice_note" ? (lang === "en" ? voiceNote?.en : voiceNote?.hi) : undefined,
        block: blockKey,
        schoolId,
        ref: `${schoolId}-${kind === "voice_note" ? "note" : "call"}`,
        teacher,
        practice: practice ? PRACTICES[practice].label : undefined,
        language: lang === "en" ? "en" : "hi",
      });
      setMsg(t("Sent on WhatsApp.", "WhatsApp पर भेज दिया।"));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-2">
      <Field label={t(`${teacher}'s WhatsApp number`, `${teacher} का WhatsApp नंबर`)}>
        <input className={fieldClass} inputMode="tel" placeholder="+91…" value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {voiceNote && (
          <button className={primary} disabled={!to || !!busy} onClick={() => send("voice_note")}>
            {busy === "voice_note" ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />} {t("Send the voice note", "वॉइस नोट भेजें")}
          </button>
        )}
        {!voiceNote && (
          <button className={primary} disabled={!to || !!busy} onClick={() => send("checkin")}>
            {busy === "checkin" ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />} {t("Ask the day-14 question on WhatsApp", "14वें दिन का सवाल WhatsApp पर पूछें")}
          </button>
        )}
      </div>
      {msg && <p className="text-xs text-[var(--color-ink-3)]">{msg}</p>}
    </div>
  );
}

/** The plan board as a spreadsheet, for block offices. Only generated blocks can be rebuilt on the server. */
export function ExportPlanButton({ blockKey, tracked }: { blockKey: string; tracked: boolean }) {
  const t = useT();
  const [err, setErr] = useState("");
  if (!blockKey.startsWith("seed:")) return null;
  return (
    <span className="inline-flex flex-col">
      <button
        className={ghost}
        onClick={() => download(`/api/export/actions.csv?block=${encodeURIComponent(blockKey)}&track=${tracked ? 1 : 0}`, "jugnu-plan.csv").catch((e) => setErr((e as Error).message))}
      >
        <Download size={15} /> {t("Download as spreadsheet", "स्प्रेडशीट डाउनलोड करें")}
      </button>
      {err && <span className="mt-1 text-xs text-rose-300">{err}</span>}
    </span>
  );
}

/** A calendar invite for a school's peer visit. */
export function VisitInviteButton({ blockKey, schoolId, tracked }: { blockKey: string; schoolId: string; tracked: boolean }) {
  const t = useT();
  if (!blockKey.startsWith("seed:")) return null;
  return (
    <button className={ghost} onClick={() => download(`/api/export/visit.ics?block=${encodeURIComponent(blockKey)}&school=${schoolId}&track=${tracked ? 1 : 0}`, "jugnu-visit.ics").catch(() => undefined)}>
      <CalendarPlus size={15} /> {t("Add the visit to a calendar", "यात्रा कैलेंडर में जोड़ें")}
    </button>
  );
}
