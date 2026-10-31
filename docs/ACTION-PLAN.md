# Action plan: saved for later

Work the owner has decided to hold. Nothing here starts until the owner asks.

## Update the outro's screens and labels

**Status:** on hold (owner's decision, 30 Oct 2026). This changes the video only, not the app.

**Cost:** no AI and no credits. The screens are screenshots of our own app, and the music and voices stay as they are.

**What's out of date in `video/out/jugnu-outro.mp4`:**

1. **Third shot:** it says "Tells each officer what to do next", but shows the Schools list. Support plan was empty when the film was made. It works now, so it can show the real plan.
2. **Labels:** the small words above the shots are LISTEN, WHAT WORKS, SHARE and FOLLOW UP. The app now says Talk to teachers, Methods that work, Share with schools and Check progress.
3. **All four screens:** they show the old console. Since then the home page, menu, school pages, approvals and plan have all changed.

**Steps:**

1. Start the app with `npm run dev`.
2. Capture fresh screens with `node video/ui-shots.mjs`, then `node video/ui-shots-sim.mjs` for the phone-line screen and the plan after a simulated term.
3. In `video/outro.js`, change the third panel from `img: "schools"` to `img: "plan"`, and update each `tag` to the app's page name. Check the crop values against the new screens.
4. Check a few frames with `node video/render.mjs outro --stills 2,5,8,11`.
5. Render the film with `node video/render.mjs outro`.
6. Send it to the owner to review.

**Check first:** the intro doesn't use these screens, so it should not need any change. If the owner wants team names in the outro, add them in the same pass.
