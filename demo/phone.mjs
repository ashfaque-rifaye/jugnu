// Prepares the owner's screen recording of the call for the phone shot: frames, lined up with the call's clock.
//   node demo/phone.mjs <recording> <seconds into the recording when the call connects>
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TAKES = process.env.DEMO_TAKES ?? "E:/jugnu-takes";
const [file, connect] = process.argv.slice(2);
if (!file || connect === undefined) throw new Error("Usage: node demo/phone.mjs <recording> <seconds when the call connects>");
const FPS = 15;
const dir = join(TAKES, "phone");
mkdirSync(join(dir, "frames"), { recursive: true });
console.log(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());
const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", `fps=${FPS},scale=-2:816`, "-q:v", "3", "-start_number", "0", join(dir, "frames/%06d.jpg")], { encoding: "utf8" });
if (r.status !== 0) throw new Error(r.stderr);
const { started } = JSON.parse(readFileSync(join(TAKES, "call/call.json"), "utf8"));
const t0 = Date.parse(started) - Number(connect) * 1000;
const n = readdirSync(join(dir, "frames")).length;
writeFileSync(join(dir, "frames.json"), JSON.stringify({ times: Array.from({ length: n }, (_, i) => Math.round(t0 + (i / FPS) * 1000)) }));
console.log(`${n} phone frames`);
