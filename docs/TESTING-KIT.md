# Jugnu — user-testing kit

Goal: 6–8 short sessions with real users before **25 Oct** (≥ 2 teachers, ≥ 2 CRPs, ≥ 1 BEO or block
team member), then change Jugnu based on what they say — and record each change. Judges score
"proof of testing and refinement basis user input" inside the largest criterion (35%).

Everything is recorded inside the app (**User testing** in the left menu). No names or phone numbers are stored.

---

## 1. Invite people (WhatsApp message)

> नमस्ते {नाम} जी, मैं एक नए साधन "जुगनू" पर काम कर रहा/रही हूँ — यह ब्लॉक के अच्छे शिक्षकों के
> तरीके दूसरे स्कूलों तक पहुँचाने में मदद करता है। क्या आप 20 मिनट दे सकते हैं, फ़ोन पर या मिलकर?
> हम आपको नहीं, साधन को परख रहे हैं। आपका नाम कहीं दर्ज नहीं होगा। धन्यवाद!
>
> Namaste {name}, I'm testing a new tool called Jugnu that helps good classroom practices travel
> between schools in a block. Could you spare 20 minutes, by phone or in person? We're testing the
> tool, not you, and your name won't be recorded. Thank you!

## 2. Before the session (2 minutes)

- Open the app → **User testing → Clear recorded actions** (so every tester starts from the same demo
  block), then **Start a session**: choose the role, read the consent text aloud, tick the box. A yellow "Testing session running" bar appears at the top.
- Teachers: send them the teacher link (`/talk`) on their own phone if possible — that is the real
  setting. CRPs/BEOs: let them use the console on a phone or laptop.
- At the bottom of the left menu (☰ on a phone): **हिंदी** for Hindi, **⚡** for low-data mode on a slow phone.
- When Jugnu asks *Who is using Jugnu?*, pick the tester's real role (a CRP picks their cluster).

## 3. During the session (15 minutes)

- Give each task from the Testing page, one at a time. **Do not help** for the first minute.
- Ask them to think aloud: *"जो सोच रहे हैं, बोलते जाइए।"*
- Type or dictate what they say in the task's comment box, then press
  **Done easily / Done with help / Couldn't do it**.
- Useful prompts: *"यह क्या बता रहा है?" · "आप यहाँ क्या ढूँढ रहे थे?" · "इसमें क्या बदलें?"*

| Role | Tasks |
|---|---|
| Teacher | 12-minute voice interview with Jugnu · listen to a peer voice note · read a practice card |
| CRP | find bright spots in a cluster · invite a teacher on WhatsApp · record a spot check · record a follow-up call · approve a practice card · next step for a struggling school |
| BEO | ask Jugnu which schools need maths help · find stuck actions · why a school's data may be inflated · did it work (Results) |

## 4. After the tasks (3 minutes)

- The 10-question usability survey (SUS) on the Testing page, in Hindi or English.
- One open question: *"अगर आप एक चीज़ बदल सकें, तो क्या?"* — record it with the **Feedback** button.

## 5. After all sessions — turn feedback into changes

1. Testing page → **CSV** downloads every comment.
2. Group comments by theme; pick the 3–5 that matter most.
3. Tell Claude (in this project) what you heard; we make the change together.
4. Add one line per change to `data/changes.json` — it appears in the app as *"You said → we changed"*:

```json
[
  { "date": "2026-10-18", "from": "CRP, Sehore", "heard": "I could not tell which schools are mine.", "changed": "Find page now filters by cluster and remembers my cluster." }
]
```

5. Re-test the changed part with one new person if time allows.

## 6. What goes into the deck

- Number of sessions by role, mean SUS score, task success rates (Testing page).
- 3–5 quotes, each paired with the change it caused (the change log).
- One before/after screenshot.

## Consent and data

- Adults only. Participation is voluntary; anyone can stop at any time.
- Recorded: role, optional block/district, device type, task results, comments, survey answers.
- Not recorded: names, phone numbers, faces, audio. Comments are scrubbed of phone/ID numbers.
- Interview transcripts from real teachers are kept only with their spoken consent and can be
  deleted on request (Interviews → open the interview → 🗑).
