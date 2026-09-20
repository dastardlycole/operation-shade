import { chromium } from "playwright-core";
import { mkdir } from "fs/promises";

const shots = [
  { name: "01_quiz_q1", url: "http://localhost:3000/quiz", width: 390 },
  {
    name: "02_verdict_dry",
    url: "http://localhost:3000/verdict?skin=dry&routine=cleanser-only&budget=30-60&finish=rich",
    width: 390,
  },
  {
    name: "03_verdict_oily_60plus",
    url: "http://localhost:3000/verdict?skin=oily&routine=nothing&budget=60-plus&finish=glow",
    width: 390,
  },
  {
    name: "04_escape",
    url: "http://localhost:3000/escape?skin=dry&routine=cleanser-only&budget=30-60&finish=rich&shown=Cloud+Cream+%2B+SPF+50",
    width: 390,
  },
  {
    name: "05_share",
    url: "http://localhost:3000/share?skin=dry&routine=cleanser-only&budget=30-60&finish=rich",
    width: 390,
  },
  { name: "06_inbox", url: "http://localhost:3000/inbox", width: 1280 },
];

await mkdir("screenshots", { recursive: true });

const browser = await chromium.launch();
for (const { name, url, width } of shots) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  console.log(`✓ ${name}`);
  await page.close();
}
await browser.close();
