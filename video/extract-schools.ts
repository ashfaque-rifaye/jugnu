// Writes the real Damoh school points (lat/lon per block) for the intro/outro films.
import { writeFileSync } from "node:fs";
import { UDISE } from "../src/engine/udise";

const out = Object.entries(UDISE).map(([block, b]) => ({
  block,
  schools: b.schools.map((s) => [s[3], s[4], s[7]]),
}));
writeFileSync(new URL("./assets/schools.json", import.meta.url), JSON.stringify(out));
for (const b of out) console.log(b.block, b.schools.length);
console.log("total", out.reduce((n, b) => n + b.schools.length, 0));
