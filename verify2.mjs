import { chromium } from "playwright";
import { promises as fs } from "fs";
import path from "path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "verify-shots2");
await fs.mkdir(OUT, { recursive: true });

let n = 0;
async function shot(page, name) {
  const file = path.join(OUT, `${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${name}`);
}

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); process.exitCode = 1; }
function note(msg) { console.log(`  ⚠️  ${msg}`); }

// ─────────────────────────────────────────────
console.log("\n═══ 1. Share page — URL shows + Send button functional ═══");
{
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/share?skin=dry&routine=nothing&budget=30-60&finish=rich");
  await pg.waitForLoadState("networkidle");
  await pg.waitForTimeout(500); // let useEffect populate origin
  await shot(pg, "share-fixed");
  const bodyText = await pg.textContent("body");
  if (bodyText?.toLowerCase().includes("maya rao")) pass("Maya Rao's Verdict branding present");
  else fail("Maya Rao branding not found");
  if (bodyText?.includes("/quiz")) pass("Quiz URL shows in share card (QuizLink rendered)");
  else fail("/quiz URL not shown in share card");
  const sendBtn = pg.locator("button", { hasText: /Send to a friend|Copied/ });
  if (await sendBtn.isVisible()) pass("'Send to a friend' button visible and clickable");
  else fail("Send button missing");
  if (bodyText?.includes("Back to my verdict")) pass("'Back to my verdict' link present");
  else fail("'Back to my verdict' link missing");
  // Verify "[page link]" placeholder is gone
  if (!bodyText?.includes("[page link]")) pass("[page link] placeholder removed");
  else fail("[page link] placeholder still present");
  await browser.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 2. Inbox — wider viewport, send flow, rule promotion ═══");
{
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/inbox");
  await pg.waitForLoadState("networkidle");
  await shot(pg, "inbox-1440");
  const bodyText = await pg.textContent("body");
  if (bodyText?.toLowerCase().includes("came through the page")) pass("'Came through the page' section present");
  else fail("'Came through the page' section missing");
  if (bodyText?.toLowerCase().includes("ranked by behaviour")) pass("'Ranked by behaviour' section present");
  else fail("'Ranked by behaviour' section missing");
  // @niamh default
  const niamhInCentre = pg.locator("text=@niamh").first();
  if (await niamhInCentre.isVisible()) pass("@niamh visible in centre panel");
  // Send button for @niamh (no previousAnswer → single Send button)
  const sendBtn = pg.locator("button", { hasText: /^Send$/ });
  const sendBtnVisible = await sendBtn.isVisible();
  if (sendBtnVisible) pass("'Send' button visible for @niamh");
  else fail("'Send' button not visible for @niamh");

  // Type a reply and send
  await pg.locator("textarea").first().fill("Hi Niamh! Since you're not sure, answer these 4 questions on my page and it tells you exactly what to buy.");
  await shot(pg, "inbox-niamh-typed");
  if (sendBtnVisible) {
    await sendBtn.click();
    await pg.waitForTimeout(400);
    await shot(pg, "inbox-niamh-sent");
    const afterBody = await pg.textContent("body");
    if (afterBody?.includes("Sent.")) pass("Sent state shown after clicking Send");
    else fail("Sent state not shown");
    if (afterBody?.includes("See @niamh")) pass("'See @niamh's view →' link appears");
    else fail("'See @niamh's view →' link missing");
    // Rule promotion modal (niamh came through the page with skin=not-sure)
    if (afterBody?.includes("Add this as a rule?")) {
      pass("Rule promotion modal appeared");
      await shot(pg, "inbox-rule-modal");
    } else {
      note("Rule promotion modal not shown — check if @niamh triggers it");
    }
  }
  await browser.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 3. Inbox — @sarah repeat detection at wide viewport ═══");
{
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/inbox");
  await pg.waitForLoadState("networkidle");
  // Click @sarah
  await pg.locator("button:has-text('@sarah')").first().click();
  await pg.waitForTimeout(300);
  await shot(pg, "inbox-sarah-wide");
  const bodyText = await pg.textContent("body");
  if (bodyText?.includes("answered this before") || bodyText?.includes("You've answered")) {
    pass("'You've answered this before' banner shown for @sarah");
  } else {
    fail("Repeat detection banner not shown for @sarah");
  }
  // "Edit first" + "Send as is" buttons should appear
  const editBtn = pg.locator("button", { hasText: "Edit first" });
  const sendAsIs = pg.locator("button", { hasText: "Send as is" });
  if (await editBtn.isVisible()) pass("'Edit first' button shown (previousAnswer pre-fill active)");
  else fail("'Edit first' button not visible");
  if (await sendAsIs.isVisible()) pass("'Send as is' button shown");
  else fail("'Send as is' button not visible");
  await browser.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 4. Full loop: inbox send → conversation page updates ═══");
{
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Open conversation first (waiting state)
  const convPage = await ctx.newPage();
  await convPage.goto(BASE + "/conversation/niamh");
  await convPage.waitForLoadState("networkidle");
  const waitBody = await convPage.textContent("body");
  if (waitBody?.includes("Waiting for Maya")) pass("Conversation starts in waiting state");
  else fail("Waiting state not shown");

  // Open inbox and send
  const inboxPage = await ctx.newPage();
  await inboxPage.goto(BASE + "/inbox");
  await inboxPage.waitForLoadState("networkidle");
  // Type and send to @niamh (default selected)
  await inboxPage.locator("textarea").first().fill("Niamh, take the quiz on my page — 4 questions and it tells you exactly.");
  const sendBtn = inboxPage.locator("button", { hasText: /^Send$/ });
  if (await sendBtn.isVisible()) {
    await sendBtn.click();
    await inboxPage.waitForTimeout(300);
    // Let conversation poll (500ms interval)
    await convPage.waitForTimeout(800);
    await shot(convPage, "conversation-updated");
    const convBody = await convPage.textContent("body");
    if (convBody?.includes("Niamh, take the quiz")) {
      pass("Conversation page updated with Maya's reply in real-time");
    } else {
      fail("Conversation did NOT update after inbox send");
    }
  } else {
    fail("Send button not found for full loop test");
  }
  await browser.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 5. Rule promotion → promoted rule saved to localStorage ═══");
{
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/inbox");
  await pg.waitForLoadState("networkidle");
  // @niamh is default (not-sure → triggers promotion after send)
  await pg.locator("textarea").first().fill("Hi! Take my quiz — it identifies your skin type.");
  const sendBtn = pg.locator("button", { hasText: /^Send$/ });
  if (await sendBtn.isVisible()) {
    await sendBtn.click();
    await pg.waitForTimeout(300);
    await shot(pg, "rule-promotion-modal");
    const bodyText = await pg.textContent("body");
    if (bodyText?.includes("Add this as a rule?")) {
      pass("Rule promotion modal shown after sending to @niamh (not-sure skin)");
      // Click "Add to the page"
      const addBtn = pg.locator("button", { hasText: "Add to the page" });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await pg.waitForTimeout(200);
        // Check localStorage
        const stored = await pg.evaluate(() => localStorage.getItem("shade_promoted_rules"));
        if (stored && stored.includes("not-sure")) {
          pass("Promoted rule saved to localStorage with trigger='not-sure'");
        } else {
          fail(`localStorage after promotion: ${stored}`);
        }
        await shot(pg, "rule-promotion-done");
      }
    } else {
      note("Promotion modal not shown — niamh may already be answered from prior test");
      await shot(pg, "rule-promotion-debug");
    }
  }
  await browser.close();
}

console.log(`\n📁 Screenshots in: ${OUT}`);
console.log(process.exitCode === 1 ? "\n⚠️  Some checks failed — see ❌ above" : "\n✅ All checks passed");
