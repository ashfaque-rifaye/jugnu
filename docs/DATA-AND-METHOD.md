# Data, method and AI: for the presentation

This is the technical material that used to sit inside the app. It belongs in the presentation, not in front of teachers and officers.

## What is real and what is simulated

**Real**

- The schools: Damoh's 7 blocks and their 1,365 government schools from UDISE+ (names, locations, clusters, enrolment, teacher counts), via the India Data Portal.
- Blocks and clusters: Tendukheda and the others are real administrative units.
- Live interviews and phone calls, when they are run.

**Simulated**

- Learning results in every class and subject. They are calibrated to ASER 2024 for class 3 Hindi and maths. Science, English and Spoken English have no public school-level source, so those are modelled from the reading and maths results and are illustrative only.
- Teacher, head and coordinator names, because UDISE+ does not publish them. They belong to no real person.
- Attendance by class, and the schools' hidden practices.

**Figures used to calibrate (ASER 2024, rural India; Pratham / ASER Centre, January 2025)**

- Class 3 reading at class 2 level, government schools: 23.4%
- Class 3 subtraction, all schools: 33.7%
- Government primary schools with fewer than 60 students: 52.1%
- Class 1 and 2 classrooms that are multigrade: two-thirds
- Average student attendance: 75.9%
- Library books in use: 51.3%
- Schools with an FLN directive: 83.2%

## How a school is judged

1. **Find:** a context model predicts each school's class 3 results from size, attendance, multigrade classes, home language and pupil-teacher ratio, using robust residuals. A school is a candidate if it beats its prediction in 2 of 3 years.
2. **Confirm (called "verify" in the code):** consistency checks, plus a binomial test on a 15-child visit, catch inflated data.
3. **Ask:** an AI interviewer talks to teachers at schools doing well and at matched schools.
4. **Compare:** a Beta-Binomial contrast keeps only practices that are more common at schools doing well, cost little and are described in detail.
5. **Share:** each school that needs help gets one method, a teacher nearby who does it, and owned tasks.
6. **Check:** schools start in two groups (a stepped-wedge design). The result is a difference-in-differences between them, with bootstrap intervals.

In the simulated block, ~9% of schools run 2 to 3 effective practices well, 6 report inflated scores, and decoy practices (lesson-plan compliance, worksheets, weekly tests) have zero effect, so every step can be scored against a known answer. `npm run eval` runs this.

## The AI tasks, layer by layer

Every task runs the same five layers: input, model, deterministic checks, evaluation, output. Claude answers first and Gemini through Vertex AI takes over when it does not. If no model answers in time, one declines, or the answer fails a check, the offline engine answers instead. Every call is logged.

### Adaptive interviewer (`interview.next`)

- **Input:** Transcript so far, script areas already covered, interview language
- **Processing:** Claude, structured output: next utterance + kind (question / follow-up / clarify / closing) + area; 8 s deadline on the phone, 15 s on the web
- **Checks:** On classroom routines only (no caste, religion, politics, pay, personal life) · under 40 words · in the teacher's language · never repeats a question · may not close before 5 areas
- **Evaluation:** Coverage of script areas and follow-up rate per interview; replayed against the simulated teachers
- **Output:** Spoken by Google Chirp TTS in the browser or over an Exotel/Plivo call; stored as a turn
- **Fallback:** Scripted interviewer with one follow-up on vague answers

### Transcript coding (`interview.code`)

- **Input:** Teacher turns only + the practice taxonomy
- **Processing:** Claude reads meaning in code-mixed Hindi/English; also proposes brand-new practices
- **Checks:** Every quote must be verbatim in what the teacher said (else dropped) · specificity re-scored deterministically · agreement with the keyword coder recorded
- **Evaluation:** Precision/recall vs labelled transcripts (npm run eval); grounding rate
- **Output:** Practice mentions with quotes → Contrast (Beta-Binomial)
- **Fallback:** Keyword lexicon coder

### Practice-card writer (`spread.card`)

- **Input:** Verbatim quotes from bright-spot teachers for one distinctive practice
- **Processing:** Claude turns quotes into 3–5 steps, materials, time — citing quote ids
- **Checks:** Every step cites a real quote · no number that is not in the cited quotes · Hindi · on-topic
- **Evaluation:** Reviewer approve / edit / reject rate
- **Output:** Human review queue → approved cards reach teachers
- **Fallback:** Card built directly from the quotes

### Peer voice-note writer (`spread.voice_note`)

- **Input:** Draft note in the demonstrator's own words + practice
- **Processing:** Claude rewrites into a warm 60-second spoken note
- **Checks:** Keeps every number · invents none · ≤ 170 words · Hindi · on-topic
- **Evaluation:** Reviewer edits; teacher clarity rating in testing
- **Output:** Review queue → WhatsApp/IVR voice note
- **Fallback:** The original draft

### Follow-up reader (`track.follow_up`)

- **Input:** Teacher's answer to the day-14 call
- **Processing:** Claude classifies adopted / trying / barrier / not tried, extracts the barrier and who can remove it
- **Checks:** Evidence quote must be verbatim · a barrier must have an owner
- **Evaluation:** Agreement with CRP's own reading in pilot
- **Output:** Action board status; stuck items escalate to the BEO
- **Fallback:** Keyword rules

### Officer Q&A agent (`officer.ask`)

- **Input:** The officer's question (typed or spoken)
- **Processing:** Claude agent with 6 read-only tools over the block's data and live interviews (adaptive thinking, up to 8 steps)
- **Checks:** Must look data up before answering · school names checked against the block · no ranking or shaming
- **Evaluation:** Tool-use rate; unknown-name rate
- **Output:** Answer, schools, one next step with an owner
- **Fallback:** Rule-based answers for common questions

### Confirmation-visit photo check (`verify.photo`)

- **Input:** A CRP's classroom photo + the practice being checked
- **Processing:** Claude Haiku (vision): is the practice visible — yes / partly / no / cannot tell — and only what is seen
- **Checks:** Never identifies people · flags recognisable children's faces for a retake · the photo is never stored, only the verdict
- **Evaluation:** Agreement with the CRP's own judgement in pilot
- **Output:** Verdict in the school's log next to the confirmation visit
- **Fallback:** \

### Teacher coach (`coach.answer`)

- **Input:** A teacher's classroom problem, in Hindi or English
- **Processing:** Claude Haiku answers only with practices proven in the teacher's own block
- **Checks:** Practice must be distinctive in this block · one quote, verbatim from a bright-spot teacher · answer in the teacher's language · names the nearest school that does it
- **Evaluation:** Grounding rate; teacher usefulness rating in testing
- **Output:** 2–3 sentences, steps for tomorrow, a peer's words and who to visit
- **Fallback:** Keyword match to the block's proven practices

### State-data column mapper (`import.map_columns`)

- **Input:** Headers and 3 sample rows of a district's own spreadsheet (UDISE+ export, Hindi headers…)
- **Processing:** Claude Haiku says which source column fills each Jugnu column, and any unit change (0–100 → 0–1)
- **Checks:** Every named column exists in the file · no column used twice · scales plausible
- **Evaluation:** Unit tests on real header sets
- **Output:** The file is re-shaped and runs through Find + Verify
- **Fallback:** Synonym table (English and Hindi names)

## Commitments

- Adults only, with consent. No child-level personal data, only school-level results and anonymous counts from a 15-child visit.
- No public ranking. Schools that need help are never named outside the block team, and teachers at schools doing well are credited only with permission.
- A school is never celebrated before it is confirmed, and suspected inflation leads to a respectful revisit, not a penalty.
- Methods are hypotheses until the next assessment confirms them.
- Model outputs are constrained to a schema, and a person approves anything that reaches a teacher.

## Live numbers

The API still reports them: `GET /api/ai/trace` (every AI call), `GET /api/ai/eval` (the last evaluation), `npm run credits` (spend), `npm run ai:check` (whether each service is answering).
