// Officer-console passcode prompt (only when the server sets DEMO_PASSCODE).
import { KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PASSCODE_EVENT, postJSON, setPasscode, useStatus } from "../lib/api";
import { useT } from "../lib/prefs";

export function PasscodeGate() {
  const t = useT();
  const status = useStatus();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(PASSCODE_EVENT, show);
    return () => window.removeEventListener(PASSCODE_EVENT, show);
  }, []);
  useEffect(() => {
    if (status.passcode && !localStorage.getItem("jugnu-pass")) setOpen(true);
  }, [status.passcode]);
  if (!open) return null;
  const submit = async () => {
    setBusy(true);
    const r = await postJSON<{ ok: boolean }>("/api/auth/check", { passcode: value }).catch(() => ({ ok: false }));
    setBusy(false);
    if (!r.ok) return setWrong(true);
    setPasscode(value);
    setOpen(false);
    window.location.reload();
  };
  return (
    <div className="scrim fixed inset-0 z-[95] grid place-items-center p-4">
      <form
        className="sheet w-full max-w-sm rounded-[2rem] p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <KeyRound className="mb-3 text-amber-200" />
        <h2 className="text-lg font-bold">{t("Officer console", "अधिकारी कंसोल")}</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-2)]">{t("Enter the passcode shared with you. Teachers don't need one — they join from their interview link.", "आपको दिया गया पासकोड डालें। शिक्षकों को इसकी ज़रूरत नहीं — वे अपने लिंक से जुड़ते हैं।")}</p>
        <input autoFocus type="password" value={value} onChange={(e) => (setValue(e.target.value), setWrong(false))} className="mt-4 w-full rounded-2xl border border-[var(--chip-line)] bg-[var(--inset-bg)] px-3.5 py-2.5 outline-none" />
        {wrong && <p className="mt-2 text-sm text-red-300">{t("That passcode is not right.", "पासकोड सही नहीं है।")}</p>}
        <button className="btn btn-primary mt-4 w-full justify-center" disabled={busy || !value}>
          {busy && <Loader2 size={15} className="animate-spin" />} {t("Open", "खोलें")}
        </button>
      </form>
    </div>
  );
}
