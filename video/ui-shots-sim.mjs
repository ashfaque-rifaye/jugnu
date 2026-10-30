// Results and plan after "Simulate one term" (client-side state only, nothing is saved), and the phone-line tab.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "assets/ui");
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--force-color-profile=srgb", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1.25 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem("jugnu-welcomed", "1");
  localStorage.setItem("jugnu-role", JSON.stringify({ kind: "beo" }));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (text) =>
  page.evaluate((x) => {
    const el = [...document.querySelectorAll("button,a,[role=tab]")].find((e) => e.innerText.trim().startsWith(x) && e.offsetParent);
    if (el) el.click();
    return Boolean(el);
  }, text);
await page.goto("http://localhost:5191/results", { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
await wait(2000);
console.log("simulate", await clickText("Simulate one term"));
await wait(2500);
await page.screenshot({ path: join(OUT, "results-sim.png") });
console.log("share", await clickText("4Share"), await clickText("Share"));
await wait(2000);
await page.screenshot({ path: join(OUT, "plan-sim.png") });
await page.goto("http://localhost:5191/interviews", { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
await wait(2000);
console.log("phone", await clickText("Phone line"));
await wait(2000);
await page.screenshot({ path: join(OUT, "phone.png") });
await browser.close();
