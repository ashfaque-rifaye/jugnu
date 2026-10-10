import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, MicOff, Phone, PhoneOff, Send, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Glass, SectionTitle, cx } from "../components/ui";
import { HeroMedia } from "../components/media";
import { MEDIA } from "../lib/clips";
import { codeInterview, SCRIPT } from "../engine/interview";
import { PRACTICES, type PracticeId } from "../engine/practices";
import type { Interview, Mention, Turn } from "../engine/types";
import { postJSON, useStatus } from "../lib/api";
import { usePipeline } from "../lib/store";
import { canListen, listen, speak, stopSpeaking } from "../lib/speech";

export default function AskPage() {
  const { state } = usePipeline();
  const [filter, setFilter] = useState<"bright" | "comparison">("bright");
  const list = state.interviews.filter((i) => i.group === filter);
  const [open, setOpen] = useState<string | null>(list[0]?.schoolId ?? null);
  const current = state.interviews.find((i) => i.schoolId === open);
  const nameOf = (id: string) => state.block.schools.find((s) => s.id === id);

  return (
    <div className="space-y-5">
      <HeroMedia video={MEDIA.call} className="p-5 md:p-7">
        <div className="label">Step 2 · Ask</div>
        <h1 className="text-2xl font-extrabold tracking-tight">12-minute calls that capture what good teachers actually do</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-2)]">
          Jugnu calls every verified bright-spot teacher — and matched ordinary schools with the same context — in their language. It asks about concrete routines, and follows up whenever an answer names a practice
          without specifics. Teachers are thanked and credited by name when their practice spreads.
        </p>
      </HeroMedia>

      <LiveInterview />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Glass className="p-4">
          <div className="mb-3 inline-flex rounded-full border border-white/10 bg-black/20 p-1">
            {(["bright", "comparison"] as const).map((g) => (
              <button key={g} className={cx("rounded-full px-3 py-1.5 text-sm", filter === g ? "bg-white/15 text-white" : "text-[var(--color-ink-2)]")} onClick={() => setFilter(g)}>
                {g === "bright" ? `Bright spots (${state.interviews.filter((i) => i.group === "bright").length})` : `Comparison (${state.interviews.filter((i) => i.group === "comparison").length})`}
              </button>
            ))}
          </div>
          <ul className="scroll-thin max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {list.map((i) => {
              const s = nameOf(i.schoolId)!;
              return (
                <li key={i.schoolId}>
                  <button className={cx("glass-inset w-full p-3 text-left transition hover:bg-white/8", open === i.schoolId && "ring-1 ring-amber-200/60")} onClick={() => setOpen(i.schoolId)}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{s.teacher}</span>
                      <span className="text-xs text-[var(--color-ink-3)]">{i.minutes} min</span>
                    </div>
                    <div className="text-xs text-[var(--color-ink-3)]">
                      {s.name} · {s.clusterName}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {i.mentions.filter((m) => m.specificity >= 2).map((m) => (
                        <span key={m.practice} className="chip text-[10px]">
                          {PRACTICES[m.practice].label}
                        </span>
                      ))}
                      {i.mentions.filter((m) => m.specificity >= 2).length === 0 && <span className="text-[11px] text-[var(--color-ink-3)]">no specific routine described</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Glass>
        {current ? <Transcript interview={current} /> : <Glass className="p-6 text-sm text-[var(--color-ink-2)]">No interviews for this block yet.</Glass>}
      </div>
    </div>
  );
}

function Transcript({ interview }: { interview: Interview }) {
  const { state } = usePipeline();
  const s = state.block.schools.find((x) => x.id === interview.schoolId)!;
  const [en, setEn] = useState(false);
  return (
    <Glass className="p-5">
      <SectionTitle
        eyebrow={`${interview.group === "bright" ? "Verified bright spot" : "Comparison school"} · coded by ${interview.codedBy}`}
        title={`${s.teacher} · ${s.name}`}
        right={
          <button className="btn btn-glass" onClick={() => setEn((v) => !v)}>
            {en ? "हिंदी" : "English"}
          </button>
        }
      />
      <div className="scroll-thin max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {interview.turns.map((t, i) => {
          const coded = t.speaker === "teacher" ? codeInterview([t]) : [];
          return (
            <div key={i} className={cx("flex", t.speaker === "teacher" ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[80%] rounded-2xl px-4 py-2 text-sm", t.speaker === "teacher" ? "rounded-br-sm bg-amber-200/12" : "rounded-bl-sm bg-white/8")}>
                <div className={cx(!en && "font-deva")}>{en ? t.textEn ?? t.text : t.text}</div>
                {coded.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {coded.map((m) => (
                      <span key={m.practice} className="chip text-[10px]" style={{ borderStyle: m.specificity >= 2 ? "solid" : "dashed" }}>
                        {PRACTICES[m.practice].label} · {m.specificity >= 2 ? "specific" : "vague"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Glass>
  );
}

function LiveInterview() {
  const status = useStatus();
  const { addLiveInterview } = usePipeline();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [done, setDone] = useState(false);
  const stopRef = useRef<() => void>(() => {});
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // scrollIntoView returns a Promise in newer browsers — never return it from an effect.
    void bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);

  const ask = async (history: Turn[]) => {
    setBusy(true);
    const out = await postJSON<{ text: string; text_en: string; done: boolean }>("/api/interview/next", { turns: history, language: "hi" }).catch(() => null);
    const next: Turn = out ? { speaker: "jugnu", text: out.text, textEn: out.text_en } : { speaker: "jugnu", text: SCRIPT[0].hi, textEn: SCRIPT[0].en };
    const all = [...history, next];
    setTurns(all);
    setBusy(false);
    if (out?.done) finish(all);
    if (voiceOn) speak(next.text, "hi-IN");
  };

  const start = () => {
    const opening: Turn = { speaker: "jugnu", text: "नमस्ते! मैं जुगनू हूँ, ब्लॉक शिक्षा कार्यालय की ओर से। आपके स्कूल के बच्चे अच्छा सीख रहे हैं — हम आपसे सीखना चाहते हैं।", textEn: "Namaste! I'm Jugnu, from the Block Education Office. Your children are learning well — we'd like to learn from you." };
    setTurns([opening]);
    setMentions([]);
    setDone(false);
    setActive(true);
    ask([opening]);
  };

  const finish = async (history: Turn[]) => {
    setDone(true);
    setActive(false);
    stopSpeaking();
    const coded = await postJSON<{ mentions: Mention[] }>("/api/interview/code", { turns: history }).catch(() => ({ mentions: codeInterview(history) }));
    setMentions(coded.mentions);
    addLiveInterview({ schoolId: "live", group: "live", language: "hi", turns: history, mentions: coded.mentions, codedBy: status.claude ? "claude" : "offline", minutes: Math.max(1, Math.round(history.length / 2)) });
  };

  const reply = async (text: string) => {
    if (!text.trim()) return;
    const history = [...turns, { speaker: "teacher" as const, text }];
    setTurns(history);
    setDraft("");
    setMentions(codeInterview(history));
    await ask(history);
  };

  const mic = async () => {
    if (listening) return stopRef.current();
    stopSpeaking();
    const h = listen("hi-IN", setDraft);
    stopRef.current = h.stop;
    setListening(true);
    try {
      const text = await h.promise;
      setListening(false);
      if (text) await reply(text);
    } catch {
      setListening(false);
    }
  };

  const liveCodes = useMemo(() => mentions.filter((m) => m.practice in PRACTICES), [mentions]);
  const samples = [
    "रोज़ पहले 45 मिनट बच्चों को स्तर के हिसाब से चार समूहों में बाँटते हैं, हर सोमवार समूह बदलते हैं।",
    "हाँ, कभी-कभी समूह बना देते हैं।",
    "रोज़ 10 मिनट तीलियों के बंडल से गिनती-बातचीत, बच्चे खुद समझाते हैं।",
    "हम पाठ योजना के हिसाब से ही पढ़ाते हैं।",
  ];

  return (
    <Glass className="relative overflow-hidden p-5">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <SectionTitle
            eyebrow="Try it · you are the teacher"
            title="A live AI interview"
            sub={status.claude ? "Claude runs the interview and codes your answers." : "Offline interviewer follows the script and follows up on vague answers. Connect Claude for a fully adaptive interviewer."}
            right={
              !active ? (
                <button className="btn btn-primary" onClick={start}>
                  <Phone size={16} /> {turns.length ? "Call again" : "Start the call"}
                </button>
              ) : (
                <button className="btn btn-glass" onClick={() => finish(turns)}>
                  <PhoneOff size={16} /> End call
                </button>
              )
            }
          />
          <div className="glass-inset scroll-thin h-80 space-y-2 overflow-y-auto p-3">
            {turns.length === 0 && <div className="grid h-full place-items-center text-sm text-[var(--color-ink-3)]">Press “Start the call” and answer like a teacher would — speak or type.</div>}
            <AnimatePresence initial={false}>
              {turns.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cx("flex", t.speaker === "teacher" ? "justify-end" : "justify-start")}>
                  <div className={cx("max-w-[85%] rounded-2xl px-4 py-2 text-sm", t.speaker === "teacher" ? "rounded-br-sm bg-amber-200/15" : "rounded-bl-sm bg-white/10")}>
                    <div className="font-deva">{t.text}</div>
                    {t.textEn && t.speaker === "jugnu" && <div className="mt-0.5 text-[11px] text-[var(--color-ink-3)]">{t.textEn}</div>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {busy && <Loader2 size={16} className="animate-spin text-amber-200" />}
            <div ref={bottom} />
          </div>
          {active && (
            <>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  reply(draft);
                }}
              >
                <button type="button" className={cx("btn", listening ? "btn-primary" : "btn-glass")} onClick={mic} disabled={!canListen()} title={canListen() ? "Answer by voice (Hindi)" : "Voice needs Chrome or Edge"}>
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Answer as the teacher…"
                  className="flex-1 rounded-full border border-white/15 bg-black/25 px-4 py-2 font-deva text-sm outline-none focus:border-amber-200/60"
                />
                <button className="btn btn-primary" disabled={busy || !draft.trim()}>
                  <Send size={16} />
                </button>
                <button type="button" className="btn btn-glass" onClick={() => setVoiceOn((v) => !v)} title="Jugnu speaks its questions">
                  <Volume2 size={16} className={voiceOn ? "" : "opacity-40"} />
                </button>
              </form>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {samples.map((s) => (
                  <button key={s} className="chip max-w-full truncate font-deva font-normal hover:bg-white/15" onClick={() => reply(s)}>
                    {s.slice(0, 48)}…
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div>
          <div className="label mb-2">What Jugnu is hearing {done && "· final coding"}</div>
          {liveCodes.length === 0 ? (
            <div className="glass-inset p-4 text-sm text-[var(--color-ink-3)]">Practices appear here as they are described. Solid = specific enough to spread; dashed = vague (Jugnu will ask a follow-up).</div>
          ) : (
            <ul className="space-y-2">
              {liveCodes.map((m) => (
                <li key={m.practice} className="glass-inset p-3" style={{ borderStyle: m.specificity >= 2 ? "solid" : "dashed" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{PRACTICES[m.practice as PracticeId].label}</span>
                    <span className={cx("chip", m.specificity >= 2 ? "text-emerald-300" : "text-[var(--color-ink-3)]")}>{m.specificity >= 2 ? `specific · ${m.specificity} cues` : "vague"}</span>
                  </div>
                  <div className="mt-1 font-deva text-xs text-[var(--color-ink-2)]">“{m.quote}”</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Glass>
  );
}
