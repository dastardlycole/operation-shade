import { chromium } from "playwright";
import { promises as fs } from "fs";
import path from "path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "verify-shots3");
await fs.mkdir(OUT, { recursive: true });

let n = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${name}`);
}

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); process.exitCode = 1; }

console.log("\n═══ Real-time DM loop: conversation → inbox send → reply appears ═══");
{
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // 1. Open conversation page for @niamh in one tab
  const convPage = await ctx.newPage();
  await convPage.goto(BASE + "/conversation/niamh");
  await convPage.waitForLoadState("networkidle");
  const waitingEl = convPage.locator("text=Waiting for Maya");
  if (await waitingEl.isVisible()) pass("Conversation tab: 'Waiting for Maya's reply…' shown");
  else fail("Conversation tab: waiting state missing");
  await shot(convPage, "before-send");

  // 2. Open inbox in another tab, send a reply to @niamh
  const inboxPage = await ctx.newPage();
  await inboxPage.goto(BASE + "/inbox");
  await inboxPage.waitForLoadState("networkidle");
  // @niamh should be default selected
  const REPLY_TEXT = "Niamh: since you're not sure, try my 4-question page — it gives you a specific product list.";
  await inboxPage.locator("textarea").first().fill(REPLY_TEXT);
  const sendBtn = inboxPage.locator("button", { hasText: /^Send$/ });
  if (await sendBtn.isVisible()) {
    pass("Inbox: Send button visible");
    await sendBtn.click();
    await inboxPage.waitForTimeout(200);
    await shot(inboxPage, "inbox-after-send");
    // Verify sent state in inbox
    const sentLink = inboxPage.locator("text=See @niamh");
    if (await sentLink.isVisible()) pass("Inbox: 'See @niamh's view →' link appeared");
    else fail("Inbox: sent state missing");
  } else {
    fail("Inbox: Send button not visible");
  }

  // 3. Wait for the conversation page to show Maya's reply (up to 3s)
  try {
    await convPage.waitForSelector("text=" + REPLY_TEXT.substring(0, 30), { timeout: 3000 });
    pass("Conversation: Maya's reply appeared via localStorage polling");
    await shot(convPage, "conversation-with-reply");
    const convBody = await convPage.textContent("body");
    if (convBody?.includes("Maya")) pass("Conversation: 'Maya' label present above reply");
    if (convBody?.includes("No bots")) pass("Conversation: 'No bots' footer present");
  } catch {
    fail("Conversation: reply did NOT appear within 3 seconds");
    await shot(convPage, "conversation-no-reply");
    // Debug: check localStorage from conversation page
    const ls = await convPage.evaluate(() => localStorage.getItem("shade_replies"));
    console.log(`  localStorage shade_replies: ${ls?.substring(0, 200) ?? "null"}`);
  }

  await browser.close();
}

console.log(`\n📁 Screenshots in: ${OUT}`);
console.log(process.exitCode === 1 ? "\n⚠️  Some checks failed" : "\n✅ All checks passed");
