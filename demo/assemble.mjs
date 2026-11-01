// The finished film: intro, the demo, outro, with soft crossfades. Writes video/out/jugnu-demo.mp4 and checks the 3-minute limit.
//   node demo/assemble.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAKES = process.env.DEMO_TAKES ?? "E:/jugnu-takes";
const length = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());
const intro = join(ROOT, "video/out/jugnu-intro.mp4");
const body = join(TAKES, "body.mp4");
const outro = join(ROOT, "video/out/jugnu-outro.mp4");
const out = join(ROOT, "video/out/jugnu-demo.mp4");
const INTO_DEMO = 0.8;
const INTO_OUTRO = 1.8; // a slow dip through black, the music easing in
const a = length(intro);
const b = length(body);
const graph = [
  `[0:v]fps=30,format=yuv420p,settb=AVTB[v0]`,
  `[1:v]fps=30,format=yuv420p,settb=AVTB[v1]`,
  `[2:v]fps=30,format=yuv420p,settb=AVTB[v2]`,
  `[v0][v1]xfade=transition=fade:duration=${INTO_DEMO}:offset=${a - INTO_DEMO}[x]`,
  `[x][v2]xfade=transition=fadeblack:duration=${INTO_OUTRO}:offset=${a + b - INTO_DEMO - INTO_OUTRO}[v]`,
  `[0:a][1:a]acrossfade=d=${INTO_DEMO}[y]`,
  `[y][2:a]acrossfade=d=${INTO_OUTRO}:c1=qsin:c2=qsin[s]`,
].join(";");
const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", intro, "-i", body, "-i", outro, "-filter_complex", graph, "-map", "[v]", "-map", "[s]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", out], { encoding: "utf8", maxBuffer: 1 << 26 });
if (r.status !== 0) throw new Error(r.stderr.slice(0, 800));
const total = length(out);
console.log(`wrote ${out}: ${total.toFixed(1)} s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}) ${total >= 180 ? "OVER 3 MINUTES" : "under 3 minutes"}`);
