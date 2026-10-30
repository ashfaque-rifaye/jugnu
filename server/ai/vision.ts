// VERIFY, with a photo: during a spot check the CRP photographs what a practice leaves behind — a
// print-rich wall, level-group charts, number sticks on the desks — and Claude says whether the
// practice is visible, listing only what it can actually see. The photo is never stored; only the
// verdict reaches the block's log. People are never identified, and a photo that shows children's
// faces is flagged so the CRP retakes it from behind or of the wall alone.
import { z } from "zod";
import { PRACTICES, type PracticeId } from "../../src/engine/practices";
import { askClaude } from "../claude";
import type { Check } from "./guardrails";
import { SAFETY } from "./interviewer";
import { runAI, type AIResult } from "./run";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

export interface PhotoCheck {
  visible: "yes" | "partly" | "no" | "cannot_tell";
  seen: string[];
  summary_en: string;
  summary_hi: string;
  child_faces: boolean;
}

const Schema = z.object({
  visible: z.enum(["yes", "partly", "no", "cannot_tell"]),
  seen: z.array(z.string()).max(6).describe("Concrete objects or displays in the photo that bear on the method, a few words each"),
  summary_en: z.string().describe("One sentence for the officer"),
  summary_hi: z.string().describe("The same sentence in Hindi (Devanagari)"),
  child_faces: z.boolean().describe("True if any child's face is recognisable in the photo"),
});

export function offlinePhotoCheck(): PhotoCheck {
  return {
    visible: "cannot_tell",
    seen: [],
    summary_en: "The AI photo check is unavailable right now; the CRP's own judgement stands.",
    summary_hi: "अभी AI फ़ोटो जाँच उपलब्ध नहीं है; CRP का अपना आकलन मान्य है।",
    child_faces: false,
  };
}

export async function checkPhoto(args: { image: string; mediaType: PhotoType; practice: PracticeId; ref?: string }): Promise<AIResult<PhotoCheck>> {
  const p = PRACTICES[args.practice];
  return runAI({
    task: "verify.photo",
    ref: args.ref,
    timeoutMs: 30000,
    offline: offlinePhotoCheck,
    claude: (signal) =>
      askClaude({
        system: `${SAFETY}
You look at one photo a cluster resource person took in a government primary school classroom during a confirmation visit, and judge whether a teaching method is visibly in use.
- List only what you can actually see. Never guess at what is outside the frame or what happens on other days.
- "yes" needs at least two concrete signs of the method; "partly" for one; "no" when the photo shows the room and none appear; "cannot_tell" when the photo is too dark, blurred or shows the wrong thing.
- Never identify or describe people (no names, ages, castes, appearance). Children may be present; describe materials and displays, not them.
- Set child_faces true if any child's face is recognisable, so the photo can be retaken.`,
        content: [
          { type: "image", source: { type: "base64", media_type: args.mediaType, data: args.image } },
          { type: "text", text: `Method to look for: ${p.label}. What it involves: ${p.what}` },
        ],
        schema: Schema,
        effort: "low",
        maxTokens: 1500,
        signal,
      }),
    guard: (out) => {
      const checks: Check[] = [
        { name: "'yes' backed by two visible signs", passed: out.visible !== "yes" || out.seen.length >= 2 },
        { name: "'partly' backed by a visible sign", passed: out.visible !== "partly" || out.seen.length >= 1 },
        { name: "summary present in both languages", passed: out.summary_en.trim().length > 0 && /[ऀ-ॿ]/.test(out.summary_hi) },
      ];
      return { value: out, checks, accept: checks.every((c) => c.passed) };
    },
  });
}
