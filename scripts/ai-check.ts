// Is the AI really working? `npm run ai:check` makes one tiny real call to Claude, to Gemini and to Google speech.
// Exits with an error code if anything is down.
import "dotenv/config";

const { runChecks } = await import("../server/ai/health");
const h = await runChecks();
for (const [name, c] of [["Claude", h.claude], ["Gemini", h.gemini], ["Speaking", h.speaking], ["Listening", h.listening]] as const) {
  console.log(`${c.ok ? "OK  " : "DOWN"}  ${name}: ${c.detail}`);
}
process.exit(h.ok ? 0 : 1);
