// Jugnu on Vercel: the same Express app as one function behind /api/*. The web app is served as
// static files; data lives in Turso (TURSO_DATABASE_URL), because a function's disk does not last.
// Bundled by scripts/vercel-build.mjs.
import { app } from "./app";

export default app;
