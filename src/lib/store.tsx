import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { generateBlock } from "../engine/block";
import { runFind } from "../engine/find";
import { evaluate, runPipeline, runTrackStage, type Evaluation, type PipelineState } from "../engine/pipeline";
import type { Block, Interview } from "../engine/types";
import { runVerify } from "../engine/verify";

interface Store {
  state: PipelineState;
  evaluation: Evaluation | null;
  seed: number;
  regenerate: (seed?: number) => void;
  runTrack: () => void;
  importBlock: (block: Block) => void;
  liveInterviews: Interview[];
  addLiveInterview: (i: Interview) => void;
  selected: string | null;
  select: (id: string | null) => void;
}

const Ctx = createContext<Store | null>(null);

function pipelineFor(block: Block): PipelineState {
  if (block.truth) return runPipeline(block);
  // Imported real data: Find + consistency checks only; interviews and spot checks happen in the field.
  const find = runFind(block);
  const verify = runVerify(block, find, () => null);
  return { block, find, verify, bright: [], comparison: [], interviews: [], evidence: [], recs: [], track: null, adopted: [] };
}

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [seed, setSeed] = useState(2024);
  const [state, setState] = useState<PipelineState>(() => pipelineFor(generateBlock(2024)));
  const [liveInterviews, setLive] = useState<Interview[]>([]);
  const [selected, select] = useState<string | null>(null);

  const regenerate = useCallback((s?: number) => {
    const next = s ?? Math.floor(Math.random() * 100000);
    setSeed(next);
    setState(pipelineFor(generateBlock(next)));
    select(null);
  }, []);
  const runTrack = useCallback(() => setState((st) => (st.track || !st.block.truth ? st : runTrackStage(st))), []);
  const importBlock = useCallback((block: Block) => {
    setState(pipelineFor(block));
    select(null);
  }, []);
  const evaluation = useMemo(() => evaluate(state), [state]);

  return (
    <Ctx.Provider value={{ state, evaluation, seed, regenerate, runTrack, importBlock, liveInterviews, addLiveInterview: (i) => setLive((l) => [i, ...l]), selected, select }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePipeline(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePipeline outside provider");
  return c;
}
