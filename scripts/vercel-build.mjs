// Builds Jugnu for Vercel with the Build Output API (https://vercel.com/docs/build-output-api):
//   .vercel/output/static/           the web app (vite build)
//   .vercel/output/functions/api.func  the whole Express API bundled into one Node function
//   .vercel/output/config.json       routing: /api/* → the function, everything else → the app
// Deploy with `npm run deploy:vercel` (vercel deploy --prebuilt --prod).
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const out = path.resolve(".vercel/output");
const fn = path.join(out, "functions/api.func");

if (!process.argv.includes("--skip-web")) execSync("npm run build", { stdio: "inherit" });

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(fn, { recursive: true });

// 1. The web app, as static files.
fs.cpSync(path.resolve("dist"), path.join(out, "static"), { recursive: true });

// 2. The API as one ES module. Dependencies are bundled in; CommonJS packages (Express) get a real
//    `require` for Node built-ins. node:sqlite stays external and is only loaded without Turso.
await build({
  entryPoints: ["server/vercel.ts"],
  outfile: path.join(fn, "index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  minify: false,
  sourcemap: false,
  legalComments: "none",
  banner: { js: 'import { createRequire as __jugnuRequire } from "node:module"; const require = __jugnuRequire(import.meta.url);' },
  logLevel: "warning",
});

// Files the API reads at run time (the function's working directory is its own folder).
for (const f of ["data/changes.json", "data/eval/results.json"]) {
  if (!fs.existsSync(f)) continue;
  fs.mkdirSync(path.join(fn, path.dirname(f)), { recursive: true });
  fs.copyFileSync(f, path.join(fn, f));
}

fs.writeFileSync(
  path.join(fn, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      maxDuration: 60,
      regions: ["bom1"], // Mumbai — closest to the teachers and officers
    },
    null,
    2,
  ),
);

// 3. Routing and caching. The service worker and the app shell always revalidate so a new deploy
//    reaches phones; hashed assets are cached for a year.
fs.writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/(sw\\.js|manifest\\.webmanifest)$", headers: { "Cache-Control": "no-cache" }, continue: true },
        { src: "^/assets/(.*)$", headers: { "Cache-Control": "public, max-age=31536000, immutable" }, continue: true },
        { src: "^/api(/.*)?$", dest: "/api" },
        { handle: "filesystem" },
        { src: "^/(.*)$", dest: "/index.html", headers: { "Cache-Control": "no-cache" } },
      ],
    },
    null,
    2,
  ),
);

const kb = (p) => Math.round(fs.statSync(p).size / 1024);
console.log(`Vercel output ready: function ${kb(path.join(fn, "index.mjs"))} KB, static app in .vercel/output/static`);
