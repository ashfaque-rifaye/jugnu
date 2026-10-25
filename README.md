# Jugnu (जुगनू) — finds the fireflies

**The answer to a block's learning gap is often already in the block.**
AI for Foundational Learning Hackathon · Challenge 4 (Data to Action) · Build stage.

Dashboards tell a Block Education Officer *where* learning is low. Jugnu finds the few teachers who —
with the same poverty, languages and staff shortages — already get children reading and counting,
**talks to them** (web voice call or an ordinary phone call, in Hindi) to learn exactly what they do,
keeps only what separates them from similar schools, spreads it **teacher-to-teacher** with owned
actions, and checks whether it worked.

## Try it

| Who | Where | What |
|---|---|---|
| Everyone | `/` | **Home page** — one real practice followed from a bright spot to the school next door, the whole block as one flow from data to action, and a door for each role |
| Teacher | `/talk` | A 12-minute Hindi voice interview on any Android phone — no app, no login |
| Officer / CRP | `/today` | **Today** (the next step, term rings, my first 10 minutes, live activity, tasks, the block's 3D night map) · the loop in order: **Find & check** (schools, a page per school with its tracker) → **Listen** (interviews) → **What works** → **Share** (support plan) → **Follow up** (results) · **Approvals** · **Ask Jugnu** |
| Phone line | `/ask` → *Phone line* | The same interview on a basic phone: a real outbound call (Exotel today, Plivo when an Indian number is added), Chirp speech both ways over the provider's audio stream |
| Judges | `/ai` | Where AI is used, layer by layer, the live trace of every call, and the evaluation |
| Testers | `/testing` | Consented sessions, role tasks, Hindi/English SUS, results and the change log |

**First time in the app?** A short welcome (what Jugnu does in three screens, then *who is using it*)
offers a 1-minute **guide**: a spotlight walks over the real screens — the next step, the term rings,
a school's tracker, the live indicator. **Guide** in the top bar replays it. **Play the term**
(Today, the menu, or the home page) replays one term of the demo block in about 40 seconds — spot
checks, voice notes, peer visits, day-14 calls, then the next assessment — while the rings, map,
tasks and activity update. Playback is labelled, stays on that screen and is never saved.

**Live:** anything someone records (a spot check on a phone in the field, a visit marked done, a
follow-up call, a finished interview) reaches every open screen within seconds, with a notification.

## Where AI is used (read the code here)

Every AI task goes through **`server/ai/run.ts`** — the same five layers in the same order:

```
input ──► Claude (structured output, deadline) ──► deterministic guardrails ──► value
                     │ unavailable / slow / declined / fails a check
                     └──────────────► offline engine ──────────────────────► value
every call ──► ai_calls trace (task, model, latency, tokens, each check passed/failed)
```

| Task | File | What Claude does | Guardrails (`server/ai/guardrails.ts`) | Offline fallback |
|---|---|---|---|---|
| Adaptive interviewer | `server/ai/interviewer.ts` | next question; follows up when an answer is vague; mirrors the teacher's language | on classroom routines only · ≤ 40 words · right language · never repeats · can't close early | scripted interviewer |
| Transcript coding | `server/ai/coder.ts` | maps code-mixed Hindi/English answers to the practice taxonomy; finds new practices | quote must be **verbatim** in what the teacher said · specificity counts only details found in the quote | keyword lexicon |
| Practice card | `server/ai/writer.ts` | 3–5 steps from teachers' own quotes | every step cites a quote · **no invented numbers** · Hindi · then **human review** | card built from quotes |
| Peer voice note | `server/ai/writer.ts` | 60-second spoken note in the demonstrator's words | keeps every number · invents none · ≤ 170 words · then **human review** | the draft |
| Follow-up reader | `server/ai/followup.ts` | adopted / trying / barrier / not tried; who can remove the barrier | evidence quote verbatim · barrier has an owner | keyword rules |
| Officer agent | `server/ai/officer.ts` | answers questions by calling 6 read-only tools over the block (Tool Runner, adaptive thinking) | must look data up · school names checked against the block | rule-based answers |

Statistics does the counting — `src/engine/` (shared by browser and server):
`find.ts` (robust regression on context, 3 cycles), `verify.ts` (jump checks + 15-child spot check,
binomial test), `contrast.ts` (Beta-Binomial bright vs comparison), `spread.ts` (fit + nearest
demonstrator + waves), `track.ts` (difference-in-differences, bootstrap intervals).

## Evaluation

```bash
npm test        # 36 tests: engine on simulated blocks, the home story, term playback, guardrails, interview service (SQLite + Turso), telephony webhook signing
npm run eval    # coding vs 30 hand-labelled answers + guardrails under attack + interviewer behaviour
npm run smoke   # end-to-end interview against a running server (consent → 7 topics → coding)
```

`npm run eval` writes `data/eval/results.json` (shown on `/ai`). It attacks every guardrail with
deliberately bad outputs — fabricated quotes, changed or dropped numbers, caste/religion/politics
/pay/personal questions, wrong language, invented school names, phone/ID numbers — and counts false
alarms on good outputs. With a Claude key it also scores the Claude coder against the keyword coder.

## Works in real conditions

- **Voice first, Hindi first:** questions are spoken (Google Chirp TTS, browser voices as fallback),
  answers are heard (Chirp STT / Web Speech `hi-IN`); on a phone the same voices run over the
  provider's audio stream; typing is a fallback; the console has a Hindi toggle.
- **Low connectivity:** service worker caches the app shell; the teacher page keeps an unsent
  answer on the phone and resends it when the network returns; the teacher link loads ~90 KB.
- **Low-cost phones:** low-data mode (auto on data-saver, 2G/3G or ≤ 2 GB RAM) removes video, 3D
  and blur; basic phones are reached by an ordinary call.
- **Bright sunlight, projectors:** light and dark mode (☾ / ☀ in the menu and on the home page);
  dark is the default, and videos and the 3D night map stay dark in both. Panels are frosted glass;
  low-data mode turns the blur off.
- **Claude down or slow:** every task degrades to the offline engine; on the phone Claude gets
  8 s per turn so the caller never waits.

## Privacy and safety

Adults only, with spoken consent; a "no" deletes the conversation. Phone numbers are stored only as
a salted hash; phone/ID numbers are scrubbed from transcripts; transcripts can be erased on request.
No child-level data (school aggregates + an anonymous 15-child spot check). No public ranking;
suspected inflation leads to a respectful revisit, never a penalty. AI drafts reach teachers only
after a CRP or BEO approves them. The interviewer never asks about caste, religion, politics, pay,
transfers or personal life.

## Data

- **Simulated demo block** (200 schools) calibrated to ASER 2024 national figures, with planted
  bright spots, inflated schools and decoy practices so every step can be scored against truth.
- **Live pilot:** real interviews from teachers (web or phone) are stored in SQLite and coded.
- **Your block:** Data & method → CSV template / Import CSV runs Find + Verify on real data.

## Run it

```bash
npm install
cp .env.example .env      # add ANTHROPIC_API_KEY to switch on Claude; everything works without it
npm run dev               # web http://localhost:5190, API :8788
npm run build && npm start   # production: one server on $PORT serving the app and the API
```

Optional: `DEMO_PASSCODE` (officer console passcode), `GOOGLE_CLOUD_API_KEY` (Chirp speech),
`EXOTEL_*` or `PLIVO_*` + `PUBLIC_URL` (real phone line; the provider needs a public WebSocket, so
run the API on a long-lived host or a tunnel — Vercel functions cannot carry the audio),
`JUGNU_DB` (database path). There is no phone simulator.

### Deploy

- **Vercel (free; live demo):** `npm run deploy:vercel` builds the web app as static files and the
  whole API as one Node function in Mumbai (`bom1`) with the Build Output API
  (`scripts/vercel-build.mjs`), then deploys it. Data lives in **Turso** (SQLite over HTTPS, free)
  when `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` are set — add Turso from the Vercel Marketplace and
  redeploy. Without Turso the function falls back to a temporary database (`/api/status` →
  `"storage": "temporary"`). Git-triggered builds are off (`vercel.json`); deploys come from the CLI.
- **Any long-running Node host (free tier):** `npm run build && npm start`, with `JUGNU_DB` on a
  persistent volume (health check `/api/status`). This is the host that can also carry phone calls.

Both run the same Express app (`server/app.ts`) and the same SQL; `server/db.ts` picks node:sqlite or
Turso. `npm test` runs the interview service against both.

## Repository

```
server/            Express API (app.ts), SQLite or Turso (db.ts), interview service, phone line, review queue, testing
server/ai/         run.ts (the five layers) · guardrails · interviewer · coder · writer · followup · officer
src/engine/        Find / Verify / Contrast / Spread / Track statistics + the block simulator
src/pages/         Talk (teacher) · Today · Schools · School · Ask (Interviews) · Practices · Plan · Results · Review · Testing · AI · Method · About
scripts/           eval.ts · smoke.mjs
data/eval/         hand-labelled coding set and the latest evaluation results
docs/TESTING-KIT.md   how to run field sessions and record "you said → we changed"
```

Built with Claude (Anthropic). Explainer clips generated with Google Flow (Veo 3.1).
