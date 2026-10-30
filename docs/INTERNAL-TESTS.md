# Internal tests, 30 October 2026

An AI agent (Claude) ran these walkthroughs in a real browser, acting as each role on the screen size that role would use. **They are not user testing.** No teacher, CRP or BEO took part, so this shows bugs and rough edges, not whether real people find Jugnu easy to use. They should be described that way in the submission.

Claude itself was unavailable throughout (usage cap until 1 November), so every AI answer came from the backup rules.

## What was tested

| Role | Setup | Tasks | Result |
|---|---|---|---|
| BEO | Computer, English | Ask about maths; find stuck actions; see why data may be inflated; read Results | All done; 3 problems fixed |
| Teacher | Phone, Hindi | Interview by typing; voice note; practice card | Interview done; 3 problems fixed. The voice note was not played, and the card page was not opened after its link was fixed |
| CRP | Phone, English | Find bright spots; invite a teacher; record a spot check; record a follow-up; review an AI draft | All reached; 5 problems fixed, including 1 serious. Saving a real spot check with counts was not tested |
| First-time visitor | Small phone and computer | Welcome screen; guided tour | Done; 1 problem fixed |

The full set of 11 automated flows also passed afterwards, using the backup. They include starting an interview, approving a draft and recording field work.

## Most important findings

1. **Serious, fixed:** one tap on Save in the spot check form, with nothing entered, recorded 0 of 15 and flagged the school's data as over-reported.
2. **Fixed:** with Claude unavailable, Ask Jugnu replied "Opened schools" to "Which schools need help with maths, and who can show them?" It now names the schools and the nearest teacher who can show each one.
3. **Fixed:** with Claude unavailable, the follow-up reader took "tried it, but short of time" to mean "uses the practice regularly".
4. **Fixed:** the backup missed "जो बच्चा नहीं आया" ("the child who didn't come") as a catch-up practice, so that teacher's answer was lost.
5. **Fixed:** several test tasks opened the wrong page.

All 13 fixes are listed in the app under User testing, in "You said, we changed".

## What this did not test

- **Real people:** whether teachers and officers understand the app, trust it or would use it. The usability survey (SUS) was deliberately left unfilled, because an AI's score would mean nothing.
- **Claude's own answers:** to be re-tested after 1 November.
- **Speaking into the microphone:** answers were typed. Google's listening and speaking were checked separately with `npm run ai:check`.
- **A real phone call** on the new address.
- **Slow networks and low-end phones:** phone screens were emulated on a computer.

## Test data

Test interviews and recorded actions were erased afterwards. That included 20 leftover test interviews from today ("Flow check", empty "Practice school" rows and one test invite). Approvals is back to its three demo drafts.
