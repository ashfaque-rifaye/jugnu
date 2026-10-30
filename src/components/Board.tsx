// The task board. Drag a card to move it, on a computer or a tablet; the buttons on each card do the
// same on a phone or with a keyboard. Each move is recorded with who moved it and from where.
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCheck, CornerUpLeft, GripVertical, History, Loader2, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Action, School } from "../engine/types";
import { STATUS_WORDS, useMoveAction } from "../lib/actions";
import { usePrefs, useT } from "../lib/prefs";
import { tint } from "../lib/status";
import { AuditTrail } from "./Audit";
import { fieldClass, Segmented } from "./kit";
import { cx } from "./ui";

const COLUMNS: { key: Action["status"]; color: string }[] = [
  { key: "todo", color: "var(--tone-muted)" },
  { key: "scheduled", color: "var(--tone-info)" },
  { key: "submitted", color: "var(--tone-warn)" },
  { key: "done", color: "var(--tone-good)" },
  { key: "stuck", color: "var(--tone-bad)" },
];

export function Board({ actions, schools, onlyStuck }: { actions: Action[]; schools: Map<string, School>; onlyStuck?: boolean }) {
  const t = useT();
  const { lang } = usePrefs();
  const hi = lang === "hi" && "font-deva";
  const { move } = useMoveAction();
  const [col, setCol] = useState<Action["status"]>(onlyStuck ? "stuck" : "todo");
  const [dragging, setDragging] = useState<string | null>(null);
  const [asking, setAsking] = useState<Action | null>(null);
  const [history, setHistory] = useState<Action | null>(null);
  const [last, setLast] = useState<{ action: Action; from: Action["status"]; to: Action["status"] } | null>(null);
  const [more, setMore] = useState<Partial<Record<Action["status"], boolean>>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }), useSensor(KeyboardSensor));
  const byId = useMemo(() => new Map(actions.map((a) => [a.id, a])), [actions]);

  const shift = async (a: Action, to: Action["status"], note?: string) => {
    if (to === "stuck" && !note) return setAsking(a);
    const landed = await move(a, to, note);
    if (landed && landed !== a.status) setLast({ action: a, from: a.status, to: landed });
  };
  const onEnd = (e: DragEndEvent) => {
    setDragging(null);
    const a = byId.get(String(e.active.id));
    const to = e.over?.id as Action["status"] | undefined;
    if (a && to && to !== a.status) void shift(a, to);
  };
  useEffect(() => {
    if (!last) return;
    const id = window.setTimeout(() => setLast(null), 9000);
    return () => window.clearTimeout(id);
  }, [last]);

  const active = dragging ? byId.get(dragging) : null;
  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(String(e.active.id))} onDragCancel={() => setDragging(null)} onDragEnd={onEnd}>
      <p className={cx("mb-3 hidden text-sm text-[var(--color-ink-2)] lg:block", hi)}>
        {t("Drag a card to move it. A school reports work as done; a coordinator or the BEO signs it off.", "काम बदलने के लिए कार्ड खींचें। स्कूल काम पूरा बताता है; समन्वयक या BEO पुष्टि करते हैं।")}
      </p>
      <div className="mb-3 overflow-x-auto no-scrollbar lg:hidden">
        <Segmented size="sm" value={col} onChange={setCol} options={COLUMNS.map((c) => ({ value: c.key, label: t(...STATUS_WORDS[c.key]), count: actions.filter((a) => a.status === c.key).length }))} />
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        {COLUMNS.map((c) => {
          const items = actions.filter((a) => a.status === c.key);
          return (
            <Column key={c.key} id={c.key} color={c.color} title={t(...STATUS_WORDS[c.key])} count={items.length} hidden={c.key !== col} dragging={!!dragging}>
              {items.length === 0 && <p className={cx("px-1 py-6 text-center text-xs text-[var(--color-ink-3)]", hi)}>{dragging ? t("Drop here", "यहाँ छोड़ें") : t("Nothing here", "यहाँ कुछ नहीं")}</p>}
              {items.slice(0, more[c.key] ? 200 : 25).map((a) => (
                <TaskCard key={a.id} action={a} school={schools.get(a.schoolId)} onMove={(to) => void shift(a, to)} onHistory={() => setHistory(a)} />
              ))}
              {items.length > 25 && !more[c.key] && (
                <button className={cx("btn btn-glass w-full justify-center !py-1.5 text-xs", hi)} onClick={() => setMore((m) => ({ ...m, [c.key]: true }))}>
                  {t(`Show ${items.length - 25} more`, `${items.length - 25} और दिखाएँ`)}
                </button>
              )}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 180 }}>{active ? <div className="rotate-[1.5deg] shadow-2xl"><CardBody action={active} school={schools.get(active.schoolId)} /></div> : null}</DragOverlay>

      {/* what just happened, with a way to explain or undo it */}
      <AnimatePresence>
        {last && <MovedBar key={last.action.id + last.to} last={last} onClose={() => setLast(null)} onNote={(n) => void move({ ...last.action, status: last.to }, last.to, n).then(() => setLast(null))} onUndo={() => void move({ ...last.action, status: last.to }, last.from).then(() => setLast(null))} />}
      </AnimatePresence>
      {asking && <StuckDialog action={asking} onClose={() => setAsking(null)} onSave={(note) => void shift(asking, "stuck", note).then(() => setAsking(null))} />}
      {history && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="dialog" aria-modal aria-label={t("History of this task", "इस काम का इतिहास")}>
          <div className="scrim absolute inset-0" onClick={() => setHistory(null)} />
          <div className="sheet scroll-thin relative max-h-[80dvh] w-full max-w-xl overflow-y-auto rounded-[1.6rem] p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className={cx("label", hi)}>{t("History of this task", "इस काम का इतिहास")}</div>
                <div className="mt-1 font-semibold">{history.task}</div>
              </div>
              <button className="btn btn-glass btn-icon !p-2" onClick={() => setHistory(null)} aria-label={t("Close", "बंद करें")}>
                <X size={15} />
              </button>
            </div>
            <AuditTrail actionId={history.id} compact />
          </div>
        </div>
      )}
    </DndContext>
  );
}

function Column({ id, color, title, count, hidden, dragging, children }: { id: string; color: string; title: string; count: number; hidden: boolean; dragging: boolean; children: React.ReactNode }) {
  const { lang } = usePrefs();
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cx("card min-w-0 p-2.5 transition-colors", hidden && "max-lg:hidden")} style={isOver ? { borderColor: color, background: tint(color, 10) } : dragging ? { borderColor: tint(color, 45) } : undefined}>
      <div className={cx("mb-2 flex items-center justify-between gap-2 px-1.5 pt-1 text-[13.5px] font-semibold", lang === "hi" && "font-deva")}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} /> <span className="truncate">{title}</span>
        </span>
        <span className="text-xs tabular-nums text-[var(--color-ink-3)]">{count}</span>
      </div>
      <div className="scroll-thin space-y-2 lg:max-h-[640px] lg:overflow-y-auto lg:pr-0.5">{children}</div>
    </div>
  );
}

function CardBody({ action: a, school, footer, handle, onHistory }: { action: Action; school?: School; footer?: React.ReactNode; handle?: React.ReactNode; onHistory?: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  return (
    <div className={cx("card-inset !bg-[var(--chrome-solid)] p-2.5", a.status === "stuck" && "border-[color-mix(in_srgb,var(--tone-bad)_50%,transparent)]")}>
      <div className="flex items-start gap-1">
        {handle}
        <div className="min-w-0 flex-1">
          {school && <div className="truncate text-xs font-semibold text-[var(--color-ink-2)]">{lang === "hi" && school.nameHi ? school.nameHi : school.name}</div>}
          <div className="mt-0.5 text-[13.5px] font-medium leading-snug">{a.task}</div>
          <div className="mt-1 text-xs text-[var(--color-ink-3)]">
            {a.owner} · {t(`day ${a.due}`, `दिन ${a.due}`)}
          </div>
          {a.note && <div className="mt-1 line-clamp-2 font-deva text-xs italic text-[var(--color-ink-2)]">“{a.note}”</div>}
        </div>
        {onHistory && (
          <button className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--color-ink-3)] hover:bg-[var(--hover)] hover:text-[var(--color-ink)]" onClick={onHistory} aria-label={t("History of this task", "इस काम का इतिहास")} title={t("History", "इतिहास")}>
            <History size={13} />
          </button>
        )}
      </div>
      {footer}
    </div>
  );
}

function TaskCard({ action: a, school, onMove, onHistory }: { action: Action; school?: School; onMove: (to: Action["status"]) => void; onHistory: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const { approver } = useMoveAction();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: a.id });
  const can = approver(a);
  const small = cx("inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-2 py-1 text-xs font-medium transition hover:bg-[var(--hover)]", lang === "hi" && "font-deva");
  return (
    <div ref={setNodeRef} className={cx(isDragging && "opacity-30")}>
      <CardBody
        action={a}
        school={school}
        onHistory={onHistory}
        handle={
          <button className="-ml-1 grid h-7 w-5 shrink-0 cursor-grab touch-none place-items-center text-[var(--color-ink-3)] active:cursor-grabbing" aria-label={t(`Move: ${a.task}`, `बदलें: ${a.task}`)} {...attributes} {...listeners}>
            <GripVertical size={14} />
          </button>
        }
        footer={
          <div className="mt-2 flex flex-wrap gap-1">
            {a.status === "submitted" ? (
              can ? (
                <>
                  <button className={small} style={{ color: "var(--tone-good)" }} onClick={() => onMove("done")}>
                    <CheckCheck size={12} /> {t("Sign off", "पुष्टि करें")}
                  </button>
                  <button className={small} onClick={() => onMove("scheduled")}>
                    <CornerUpLeft size={12} /> {t("Send back", "वापस भेजें")}
                  </button>
                </>
              ) : (
                <span className={cx("text-xs text-[var(--color-ink-3)]", lang === "hi" && "font-deva")}>{t("A coordinator or the BEO will confirm", "समन्वयक या BEO पुष्टि करेंगे")}</span>
              )
            ) : a.status === "done" ? (
              can && (
                <button className={small} onClick={() => onMove("todo")}>
                  <RotateCcw size={12} /> {t("Reopen", "फिर खोलें")}
                </button>
              )
            ) : (
              <>
                <button className={small} onClick={() => onMove("done")}>
                  <Check size={12} /> {t("Done", "पूरा")}
                </button>
                {a.status === "stuck" ? (
                  <button className={small} onClick={() => onMove("todo")}>
                    <RotateCcw size={12} /> {t("Unstick", "खोलें")}
                  </button>
                ) : (
                  <button className={small} onClick={() => onMove("stuck")}>
                    <TriangleAlert size={12} /> {t("Stuck", "अटका")}
                  </button>
                )}
              </>
            )}
          </div>
        }
      />
    </div>
  );
}

function MovedBar({ last, onClose, onNote, onUndo }: { last: { action: Action; from: Action["status"]; to: Action["status"] }; onClose: () => void; onNote: (n: string) => void; onUndo: () => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const [note, setNote] = useState("");
  const [writing, setWriting] = useState(false);
  return (
    <motion.div
      className="sheet fixed bottom-[calc(92px+env(safe-area-inset-bottom))] left-1/2 z-[65] w-[min(620px,calc(100vw-24px))] -translate-x-1/2 rounded-[1.3rem] p-3 lg:bottom-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={cx("min-w-0 flex-1", lang === "hi" && "font-deva")}>
          <b>{t(...STATUS_WORDS[last.to])}</b> <span className="text-[var(--color-ink-2)]">· {last.action.task}</span>
        </span>
        <button className="btn btn-glass !px-3 !py-1 text-xs" onClick={() => setWriting((v) => !v)}>
          {t("Add a note", "टिप्पणी जोड़ें")}
        </button>
        <button className="btn btn-glass !px-3 !py-1 text-xs" onClick={onUndo}>
          <RotateCcw size={12} /> {t("Undo", "वापस")}
        </button>
        <button className="grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--hover)]" onClick={onClose} aria-label={t("Close", "बंद करें")}>
          <X size={14} />
        </button>
      </div>
      {writing && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) onNote(note.trim());
          }}
        >
          <input className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("What changed, or what should happen next?", "क्या बदला, या आगे क्या होना चाहिए?")} autoFocus />
          <button className="btn btn-primary" disabled={!note.trim()}>
            {t("Save", "सहेजें")}
          </button>
        </form>
      )}
    </motion.div>
  );
}

function StuckDialog({ action, onClose, onSave }: { action: Action; onClose: () => void; onSave: (note: string) => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="dialog" aria-modal aria-label={t("What is in the way?", "क्या रुकावट है?")}>
      <div className="scrim absolute inset-0" onClick={onClose} />
      <form
        className="sheet relative w-full max-w-md rounded-[1.6rem] p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!note.trim()) return;
          setBusy(true);
          onSave(note.trim());
        }}
      >
        <h3 className={cx("text-lg font-semibold", lang === "hi" && "font-deva")}>{t("What is in the way?", "क्या रुकावट है?")}</h3>
        <p className="mt-1 text-sm text-[var(--color-ink-2)]">{action.task}</p>
        <input className={cx(fieldClass, "mt-3")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("And who can fix it?", "और इसे कौन ठीक कर सकता है?")} autoFocus />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="btn btn-glass" onClick={onClose}>
            {t("Cancel", "रद्द करें")}
          </button>
          <button className="btn btn-primary" disabled={!note.trim() || busy}>
            {busy && <Loader2 size={14} className="animate-spin" />} {t("Tell the BEO", "BEO को बताएँ")}
          </button>
        </div>
      </form>
    </div>
  );
}
