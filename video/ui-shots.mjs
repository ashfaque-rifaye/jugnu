// Screenshots of the real console for the outro. The dev server must be running on :5191.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "assets/ui");
const PAGES = ["today", "schools", "interviews", "practices", "plan", "results", "review", "district"];
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--force-color-profile=srgb", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1.25 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem("jugnu-welcomed", "1");
  localStorage.setItem("jugnu-role", JSON.stringify({ kind: "beo" }));
});
for (const p of PAGES) {
  await page.goto("http://localhost:5191/" + p, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: join(OUT, p + ".png") });
  console.log("shot", p);
}
await browser.close();
