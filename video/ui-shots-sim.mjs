// Progress after "Play the term" (client-side state only, nothing is saved), and the phone-line tab.
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
  localStorage.setItem("jugnu-guide", "off"); // no guide bubble on the screens
  addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style");
    s.textContent = "[data-agent]{display:none!important}";
    document.head.append(s);
  });
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (text) =>
  page.evaluate((x) => {
    const el = [...document.querySelectorAll("button,a,[role=tab]")].find((e) => e.innerText.trim().startsWith(x) && e.offsetParent);
    if (el) el.click();
    return Boolean(el);
  }, text);
await page.goto("http://localhost:5190/today", { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
await wait(2000);
console.log("play", await clickText("Play the term"));
await wait(50000);
await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => /Check progress/.test(a.innerText) && a.offsetParent)?.click());
await wait(3000);
await page.screenshot({ path: join(OUT, "results-sim.png") });
await page.goto("http://localhost:5190/interviews", { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
await wait(2000);
console.log("phone", await clickText("Phone line"));
await wait(2000);
await page.screenshot({ path: join(OUT, "phone.png") });
await browser.close();
