# Jugnu (जुगनू) — finds the fireflies

**The answer to a block's learning gap is often already in the block.**
AI for Foundational Learning Hackathon · Challenge 4 (Data to Action).

Dashboards tell a Block Education Officer *where* learning is low. Jugnu finds the few teachers who — with the
same poverty, languages and staff shortages — already get children reading and counting, learns exactly what they
do through AI voice interviews, spreads it teacher-to-teacher with owned actions, and checks whether it worked.

## Run it

```bash
npm install
npm run dev          # web on http://localhost:5190 (or $PORT), API on :8788 (or $API_PORT)
npm test             # engine tests on four simulated blocks
```

Optional — connect Claude for the adaptive AI interviewer, transcript coding, voice-note polishing and officer Q&A:

```bash
cp .env.example .env   # then set ANTHROPIC_API_KEY=...
```

Without a key everything runs on the offline engine (scripted interviewer with follow-ups, lexicon coding).

## The loop (`src/engine`)

| Step | What happens | Module |
|---|---|---|
| **Find** | OLS on context the state already holds (multigrade, size, library, attendance, home-language mismatch, PTR), pooled over 3 cycles with year effects; robust (MAD) residuals; candidates beat expectation in ≥ 2 of 3 cycles | `find.ts` |
| **Verify** | Noise-aware jump check, consistency, plausibility, and a 15-child spot check (reading + subtraction, binomial test). Only field evidence can mark data as inflated | `verify.ts` |
| **Ask** | 12-minute interview script about concrete routines; one follow-up whenever a practice is named without specifics; matched comparison schools interviewed too | `interview.ts` |
| **Contrast** | Beta-Binomial comparison of *specific* descriptions in bright-spot vs comparison interviews; decoys "common everywhere" are set aside | `contrast.ts` |
| **Spread** | One practice per struggling school (fit to gap + context), nearest demonstrator, 60-second voice note in their words, owned actions (CRP, BEO, Jugnu AI), two waves | `spread.ts` |
| **Track** | Day-14 follow-up calls; wave 1 vs wave 2 difference-in-differences with bootstrap intervals | `track.ts` |

Evaluation (Data & method page, `npm test`): candidates include the planted bright spots, most planted inflated
schools are caught by the spot check, no decoy practice is ever promoted, and the overall effect estimate is
positive on average — reported with honest, wide intervals for a single term.

## Real vs simulated

- **Real:** ASER 2024 national figures used to calibrate the block (Std III reading 23.4% in government schools,
  52.1% small schools, two-thirds multigrade, 75.9% student attendance, 51.3% library use, 83.2% FLN directive).
- **Simulated:** the 200-school block, its hidden practices, 6 inflated schools and decoy practices — so every step
  can be scored against known truth.
- **Your data:** Data & method → CSV template / Import CSV runs Find + Verify on a real block immediately.

## Design, 3D and video

- **Glass UI**, *Black & white* by default with a gold-teal *Vibrant* theme (toggle in the nav).
- **3D block** (`src/components/Block3D.tsx`): every school a pillar at its position, height = results vs
  expectation, verified bright spots glowing gold with fireflies — built from the live pipeline. Orbit, hover, click.
- **12 cinematic clips generated with Google Flow (Veo 3.1)** in `public/media/`: hero, page headers, ambient
  backdrop and a captioned guided **Tour** with optional Hindi narration.

## Safety

Adults only, with consent; no child-level personal data (school aggregates + an anonymous spot check). No public
ranking; bright-spot teachers credited only with permission; suspected inflation leads to a respectful revisit, not a
penalty. LLM outputs are schema-constrained; if Claude is unavailable, the offline engine continues.
