// District roll-up: run the full pipeline on every real Damoh block profile and summarise each, so
// a district officer can see where the bright spots are and which practices travel across blocks.
import { generateBlock } from "./block";
import { DAMOH, type BlockProfile } from "./district";
import { runPipeline } from "./pipeline";
import type { PracticeId } from "./practices";

export interface BlockSummary {
  profile: BlockProfile;
  schools: number;
  tribalSchools: number;
  reading: number; // mean Std III reading, latest cycle (%)
  struggling: number;
  candidates: number;
  verified: number;
  inflation: number;
  distinctive: PracticeId[];
  recs: number;
}

export interface DistrictSummary {
  blocks: BlockSummary[];
  /** practices found distinctive, with the blocks they were found in */
  practices: { practice: PracticeId; blocks: string[] }[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function summariseBlock(profile: BlockProfile): BlockSummary {
  const st = runPipeline(generateBlock(profile.code));
  const schools = st.block.schools;
  return {
    profile,
    schools: schools.length,
    tribalSchools: schools.filter((s) => s.langMismatch >= 0.45).length,
    reading: Math.round(mean(schools.map((s) => s.reading[s.reading.length - 1])) * 10) / 10,
    struggling: st.find.struggling.length,
    candidates: st.find.candidates.length,
    verified: st.verify.filter((v) => v.verdict === "verified").length,
    inflation: st.verify.filter((v) => v.verdict === "inflation_suspected").length,
    distinctive: st.evidence.filter((e) => e.verdict === "distinctive").map((e) => e.practice),
    recs: st.recs.length,
  };
}

export function summariseDistrict(profiles = DAMOH): DistrictSummary {
  const blocks = profiles.map(summariseBlock);
  const where = new Map<PracticeId, string[]>();
  for (const b of blocks) for (const p of b.distinctive) where.set(p, [...(where.get(p) ?? []), b.profile.block]);
  const practices = [...where].map(([practice, bs]) => ({ practice, blocks: bs })).sort((a, b) => b.blocks.length - a.blocks.length);
  return { blocks, practices };
}
