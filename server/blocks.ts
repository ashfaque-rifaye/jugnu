// The server recomputes the same pipeline the console shows: a simulated block is fully determined
// by its seed (the engine is shared TypeScript), an imported block is posted once. This lets the
// officer agent query the block through tools instead of trusting a JSON dump from the browser.
import { generateBlock } from "../src/engine/block";
import { DEFAULT_SEED } from "../src/engine/district";
import { runFind } from "../src/engine/find";
import { runPipeline, runTrackStage, type PipelineState } from "../src/engine/pipeline";
import type { Block } from "../src/engine/types";
import { runVerify } from "../src/engine/verify";

const cache = new Map<string, PipelineState>();

function remember(key: string, state: PipelineState) {
  cache.set(key, state);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return state;
}

export function pipelineFor(args: { seed?: number; block?: Block; track?: boolean }): PipelineState {
  if (args.block) {
    const key = `import:${args.block.name}:${args.block.schools.length}:${args.block.schools[0]?.id}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const find = runFind(args.block);
    const verify = runVerify(args.block, find, () => null);
    return remember(key, { block: args.block, find, verify, bright: [], comparison: [], interviews: [], evidence: [], recs: [], track: null, adopted: [] });
  }
  const seed = args.seed ?? DEFAULT_SEED;
  const key = `seed:${seed}:${args.track ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = runPipeline(generateBlock(seed));
  return remember(key, args.track ? runTrackStage(base) : base);
}
