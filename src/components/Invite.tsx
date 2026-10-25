// Inviting a teacher to a Jugnu interview: a link (QR, WhatsApp, copy) or a call to a basic phone.
import { Check, Copy, ExternalLink, Loader2, MessageCircle, PhoneCall, Send, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { School } from "../engine/types";
import { postJSON, useStatus } from "../lib/api";
import { useT } from "../lib/prefs";
import { Glass } from "./ui";
import { markJourney } from "../lib/journey";

export interface PilotRow {
  id: string;
  token: string;
  teacher_name: string | null;
  school_name: string | null;
  grp: "bright" | "comparison" | "live";
  channel: "web" | "phone";
  language: "hi" | "en";
  status: "invited" | "in_progress" | "completed" | "declined";
  call_status: string | null;
  call_sid: string | null;
  consent: number;
  created_at: string;
  turns: number;
  practices: string[];
}

export function InviteCard({ link, row }: { link: string; row: PilotRow }) {
  const t = useT();
  const status = useStatus();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState("+91");
  const [calling, setCalling] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: "#0b0b0f", light: "#fef9c3" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [link]);
  const message =
    row.language === "hi"
      ? `नमस्ते ${row.teacher_name ? `${row.teacher_name} जी` : ""}, ब्लॉक शिक्षा कार्यालय की ओर से जुगनू आपकी कक्षा के रोज़ के तरीकों के बारे में 12 मिनट बात करना चाहता है, ताकि पास के स्कूल भी सीख सकें। फ़ोन पर यह लिंक खोलें: ${link}`
      : `Namaste ${row.teacher_name ?? ""}, Jugnu from the Block Education Office would like a 12-minute conversation about your classroom routines so nearby schools can learn. Open this link on your phone: ${link}`;
  const call = async () => {
    setCalling(t("Calling…", "कॉल लग रही है…"));
    try {
      await postJSON("/api/ivr/call", { to: phone, interviewId: row.id });
      setCalling(t("Ringing the teacher's phone. The interview appears on the right as it happens.", "शिक्षक के फ़ोन पर घंटी जा रही है। बातचीत दाईं ओर दिखेगी।"));
    } catch (e) {
      setCalling((e as Error).message);
    }
  };
  return (
    <Glass className="p-5">
      <div className="label mb-2">
        {t("Link ready", "लिंक तैयार")} · {row.teacher_name || t("teacher", "शिक्षक")}
      </div>
      <div className="flex gap-4">
        {qr && <img src={qr} alt="QR code for the interview link" className="h-32 w-32 rounded-xl" />}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="glass-inset truncate px-3 py-2 font-mono text-xs">{link}</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-glass !py-1.5" onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {t("Copy", "कॉपी")}
            </button>
            <a className="btn btn-primary !py-1.5" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              <MessageCircle size={14} /> WhatsApp
            </a>
            <a className="btn btn-glass !py-1.5" href={link} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> {t("Open", "खोलें")}
            </a>
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="label mb-2">{t("Or call a basic phone", "या साधारण फ़ोन पर कॉल करें")}</div>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm outline-none"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={!status.ivr}
          />
          <button className="btn btn-glass" onClick={call} disabled={!status.ivr || phone.length < 10}>
            <PhoneCall size={15} /> {t("Call", "कॉल")}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--color-ink-3)]">
          {status.ivr
            ? calling
            : t("Telephony is not configured on this server (set EXOTEL_* or PLIVO_* and PUBLIC_URL).", "इस सर्वर पर टेलीफ़ोनी सेट नहीं है (EXOTEL_* या PLIVO_* और PUBLIC_URL सेट करें)।")}
        </p>
      </div>
    </Glass>
  );
}

/** One button on a school's page: creates an interview linked to that school, then shows the link. */
export function InviteForSchool({ school, group, onCreated }: { school: School; group: "bright" | "comparison" | "live"; onCreated?: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ link: string; row: PilotRow } | null>(null);
  const [language, setLanguage] = useState<"hi" | "en">("hi");
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await postJSON<{ interview: PilotRow; link: string }>("/api/interviews", { teacherName: school.teacher, schoolName: school.name, schoolId: school.id, group, language });
      setMade({ link: `${location.origin}${r.link}`, row: r.interview });
      markJourney("invite");
      onCreated?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (made) return <InviteCard link={made.link} row={made.row} />;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={create} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{" "}
          {t(`Invite ${school.teacher.split(" ")[0]} for a 12-minute interview`, `${school.teacher.split(" ")[0]} को 12 मिनट की बातचीत के लिए बुलाएँ`)}
        </button>
        <select
          className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm"
          value={language}
          onChange={(e) => setLanguage(e.target.value as "hi" | "en")}
          aria-label={t("Language", "भाषा")}
        >
          <option value="hi">हिंदी</option>
          <option value="en">English</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <p className="flex items-start gap-2 text-xs text-[var(--color-ink-3)]">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-teal-300" />
        {t(
          "Jugnu asks for consent first; if the teacher says no, nothing is kept. When the interview is done, what the teacher described is added to this school and to “What works”.",
          "जुगनू पहले अनुमति लेता है; मना करने पर कुछ नहीं रखा जाता। बातचीत पूरी होने पर शिक्षक के बताए तरीके इस स्कूल और “क्या काम करता है” में जुड़ जाते हैं।",
        )}
      </p>
    </div>
  );
}
