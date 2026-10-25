# Jugnu v2 — the change brief

The request, rewritten so each item has a goal, a definition of done, and a reason. Written 25 Oct 2026.

## The goal

A Block Education Officer who opens Jugnu for the first time should know straight away where they are (state › district › block › cluster › school), trust that the places are real, and be able to *talk* to the app: ask for a briefing, find a school, fill in a form or move between pages by voice or chat. Every screen should feel lighter and calmer, not denser.

## 1. A real map, not a picture of one
- **Goal.** A real basemap (streets, villages, rivers, satellite) with every school on its real village, so the distances and clusters mean something on the ground.
- **Done when:**
  - The 3D night scene is replaced on Today and Schools by an interactive map: pan, zoom, tilt, and switch between Map, Satellite and Dark.
  - Schools are coloured by status. Clicking one opens a side card with: the satellite view of the village, the teacher, enrolment, attendance, grades 1–5, status, the next step, and "Open school".
  - **Distance tools.** Each card shows the nearest bright spot, its straight-line and estimated road distance (km), and travel time by motorbike. "Measure" mode gives the same between any two schools. A "Who learns from whom" toggle draws the peer-visit lines with their distances.
  - The 3D scene stays only as a mood piece on the home page.

## 2. Where the data comes from (an honest answer)
- **Real:**
  - The district (Damoh, Madhya Pradesh).
  - Its 7 blocks and their UDISE+ 2025-26 profiles: number of schools, enrolment, teachers, tribal share, women teachers.
  - The ASER 2024 calibration.
  - From OpenStreetMap: the village names, coordinates and block boundaries.
- **Simulated:**
  - School-level results.
  - Teachers' names.
  - Practices.
  - The reason: UDISE+ and ASER do not publish school-level learning results.
- **"200 schools":** this was the old, fictional default "Sonagaon block". It is replaced by Tendukheda, a real Damoh block, where the 205 schools come from its UDISE+ count.
- **In the app:** one quiet "About this data" line wherever numbers appear. No big "SYNTHETIC" banners.

## 3. The "GPS" prefix
- "GPS" = Government Primary School, the way MP's records name schools. It is noise in a UI where every school is one.
- **Done when:** schools show the village name as the title and "Govt. Primary School" as a small label.

## 4. A new identity
- The "j" mark is retired.
- **Done when:** a new mark that is unmistakably Jugnu (a firefly whose glow links schools, i.e. light that travels) is used in the app, favicon, home page and welcome. It must work at 16 px and in light and dark themes.

## 5. Always say where you are
- **Done when:**
  - Every console page carries a location trail: Madhya Pradesh › Damoh › Tendukheda block (› cluster › school).
  - A locator inset highlights the block inside the district, and the district inside the state.
  - Selecting a block, cluster or school highlights it on the map.
  - The District page is a map of Damoh's 7 blocks you can click.

## 6. Live activity you can read at a glance
- **Done when:**
  - Every follow-up call, spot check and note in the feed expands to a one-line summary, an insight (adopted / barrier and who can remove it / what to do next) and the teacher's words.
  - New follow-ups recorded by people are summarised by Claude (Haiku 5.5) when saved. Playback and offline data use the engine's own summary.

## 7. Google Vertex credits, used only for one-off production work
- **Use them for:**
  - Writing the Hindi (Devanagari) names of villages that OpenStreetMap lacks.
  - Generating the teacher follow-up phrases that power richer activity summaries.
- The scripts live outside the repo and are deleted afterwards. Only the outputs (data) are committed. No Google SDK, keys or endpoints in Jugnu.

## 8. Attendance, grades 1–5, and a lighter UI
- **Done when:**
  - Every school has attendance per year and per grade.
  - It has enrolment, attendance, and reading and maths at grade level for **grades 1–5**. Grade 3 stays the official measured cohort.
  - These are visible on the school page, in the schools list, in the map card and in the agent's tools.
  - **A lighter UI:** softer surfaces, fewer borders, more breathing room, smaller chrome, and calmer motion.

## 9. A voice + chat agent that does the work
- **Done when:**
  - A glowing orb (bottom-right on every console page) starts talking with one tap. A chat panel offers the same agent by typing or dictating, in Hindi or English.
  - The agent can navigate to any page, find and open a school, filter the list, show places on the map, measure distances, fill in and save forms, and click buttons on the current page. Examples of forms and buttons: a spot check, an action status, a note, the follow-up outcome, an invite, an approval.
  - It answers questions from the block's data, using the same read-only tools as Ask Jugnu.
  - **Morning briefing.** "Brief me" reads out what changed since the last visit, the top 3 things to do today, and anything stuck, while the text streams on screen line by line.
  - It runs on Claude Haiku 5.5 and works offline with a rule-based fallback. Speech uses the browser's own recognition and voices (no extra keys).
