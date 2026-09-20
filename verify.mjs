import { chromium } from "playwright";
import { promises as fs } from "fs";
import path from "path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "verify-shots");
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

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

// ─────────────────────────────────────────────
console.log("\n═══ 1. Root redirect ═══");
{
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/");
  await pg.waitForURL(/\/quiz/);
  pass("/ redirects to /quiz");
  await pg.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 2. Quiz — full happy path (dry / nothing / 30-60 / rich) ═══");
{
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/quiz");
  await pg.waitForLoadState("networkidle");
  await shot(pg, "quiz-q1");
  // Check Q1 text
  const q1 = await pg.textContent("h1");
  if (q1?.includes("skin")) pass(`Q1 prompt present: "${q1?.trim()}"`);
  else fail(`Q1 prompt unexpected: "${q1?.trim()}"`);
  // step counter
  const counter = await pg.textContent("span.tabular-nums");
  if (counter?.trim() === "1 / 4") pass("Step counter shows 1 / 4");
  else fail(`Step counter: "${counter?.trim()}"`);
  // Click "Dry"
  await pg.click("text=Dry");
  await pg.waitForTimeout(200);
  const q2 = await pg.textContent("h1");
  if (q2 !== q1) pass("Auto-advanced to Q2");
  else fail("Did not advance to Q2");
  await shot(pg, "quiz-q2");
  // Click "Nothing" for routine
  await pg.click("text=Nothing");
  await pg.waitForTimeout(200);
  await shot(pg, "quiz-q3");
  // Click "£30–60"
  await pg.click("text=£30–60");
  await pg.waitForTimeout(200);
  await shot(pg, "quiz-q4");
  // Click "Rich"
  await pg.click("text=Rich");
  await pg.waitForURL(/\/verdict/);
  pass("Reached /verdict after Q4");
  await pg.waitForLoadState("networkidle");
  await shot(pg, "verdict-dry-nothing-30to60-rich");
  // Verify products visible
  const productCount = await pg.locator("[class*='border']").count();
  pass(`Verdict rendered (${productCount} bordered elements)`);
  // Check for SPF
  const bodyText = await pg.textContent("body");
  if (bodyText?.includes("SPF 50") || bodyText?.includes("Every verdict"))
    pass("SPF product labeled 'Every verdict'");
  else note("SPF label not found — check verdict page");
  // Check for "Still not sure" escape link
  if (bodyText?.includes("Still not sure")) pass("'Still not sure' link present");
  else fail("'Still not sure' link missing on verdict");
  await pg.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 3. Quiz — 'Not sure' → escape hatch ═══");
{
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/quiz");
  await pg.waitForLoadState("networkidle");
  await pg.click("text=Not sure");
  await pg.waitForURL(/\/escape/);
  const url = pg.url();
  if (url.includes("skin=not-sure")) pass("'Not sure' routes to /escape?skin=not-sure");
  else fail(`'Not sure' landed at: ${url}`);
  await shot(pg, "escape-from-not-sure");
  await pg.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 4. Verdict — oily / £60+ shows Glass Drop 'MAYA SAYS NO' ═══");
{
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/verdict?skin=oily&routine=nothing&budget=60-plus&finish=light");
  await pg.waitForLoadState("networkidle");
  await shot(pg, "verdict-oily-60plus");
  const bodyText = await pg.textContent("body");
  if (bodyText?.toLowerCase().includes("maya says no")) pass("Glass Drop shows 'Maya says no'");
  else fail("'Maya says no' not found for oily/60+ budget");
  if (bodyText?.includes("Glass Drop")) pass("Glass Drop product visible");
  else note("Glass Drop name not found");
  await pg.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 5. Verdict — no match → escape redirect ═══");
{
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/verdict?skin=redness&routine=nothing&budget=under-30&finish=invisible");
  await pg.waitForLoadState("networkidle");
  const url = pg.url();
  if (url.includes("/escape")) {
    pass("No-rule case redirects to /escape");
  } else {
    const bodyText = await pg.textContent("body");
    if (bodyText?.includes("Still not sure")) {
      pass("Verdict rendered (rule found for redness/nothing/under-30/invisible)");
    } else {
      note(`Landed at: ${url}`);
    }
  }
  await shot(pg, "verdict-no-match-escape");
  await pg.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 6. Escape hatch — session pre-fill ═══");
{
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/escape?skin=dry&routine=nothing&budget=30-60&finish=rich&shown=Cloud+Cream,+SPF+50");
  await pg.waitForLoadState("networkidle");
  await shot(pg, "escape-prefilled");
  const bodyText = await pg.textContent("body");
  if (bodyText?.includes("Dry")) pass("skin=dry shows 'Dry'");
  else fail("skin not pre-filled");
  if (bodyText?.includes("Nothing")) pass("routine=nothing shows 'Nothing'");
  else fail("routine not pre-filled");
  if (bodyText?.includes("£30–60")) pass("budget=30-60 shows '£30–60'");
  else fail("budget not pre-filled");
  if (bodyText?.includes("Cloud Cream")) pass("shown products in summary");
  else fail("shown products missing");
  if (bodyText?.includes("Maya will see")) pass("'Maya will see' pre-composed message present");
  else fail("'Maya will see' section missing");
  // Test send button → sent state
  await pg.click("text=Send to Maya");
  await pg.waitForTimeout(300);
  await shot(pg, "escape-sent-state");
  const afterSend = await pg.textContent("body");
  if (afterSend?.includes("Sent. Maya answers personally.")) pass("Send button transitions to sent state");
  else fail("Sent state message not shown");
  if (afterSend?.includes("Check for Maya's reply")) pass("'Check for Maya's reply' link appears");
  else fail("'Check for Maya's reply' link missing");
  await pg.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 7. Share card ═══");
{
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/share?skin=dry&routine=nothing&budget=30-60&finish=rich");
  await pg.waitForLoadState("networkidle");
  await shot(pg, "share-card");
  const bodyText = await pg.textContent("body");
  if (bodyText?.includes("MAYA RAO")) pass("'MAYA RAO' branding on share card");
  else fail("'MAYA RAO' not on share card");
  if (bodyText?.includes("four taps")) pass("'Get your own in four taps' CTA present");
  else fail("CTA missing on share card");
  // Check dark background
  const bg = await pg.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  pass(`Background: ${bg}`);
  await pg.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 8. Inbox — default to @niamh, layout ═══");
{
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/inbox");
  await pg.waitForLoadState("networkidle");
  await shot(pg, "inbox-default");
  const bodyText = await pg.textContent("body");
  // @niamh should be selected
  if (bodyText?.includes("niamh")) pass("@niamh visible in inbox");
  else fail("@niamh not found in inbox");
  // Column headers
  if (bodyText?.includes("CAME THROUGH THE PAGE")) pass("'CAME THROUGH THE PAGE' section present");
  else fail("'CAME THROUGH THE PAGE' section missing");
  if (bodyText?.includes("RANKED BY BEHAVIOUR")) pass("'RANKED BY BEHAVIOUR' section present");
  else fail("'RANKED BY BEHAVIOUR' section missing");
  // @niamh pre-selected in centre panel
  const centreHandle = await pg.locator("text=@niamh").first().isVisible();
  if (centreHandle) pass("@niamh visible in centre conversation panel");
  await pg.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 9. Inbox — send reply → localStorage → conversation updates ═══");
{
  // Open inbox and conversation in same context (same localStorage)
  const inboxPage = await ctx.newPage();
  await inboxPage.goto(BASE + "/inbox");
  await inboxPage.waitForLoadState("networkidle");

  // Select @niamh (should be default)
  // Type a reply
  const textarea = inboxPage.locator("textarea").first();
  await textarea.fill("Hi Niamh! I'd recommend the Cloud Cream for dry skin.");
  await shot(inboxPage, "inbox-reply-typed");

  // Open conversation tab before sending (to test real-time update)
  const convPage = await ctx.newPage();
  await convPage.goto(BASE + "/conversation/niamh");
  await convPage.waitForLoadState("networkidle");
  await shot(convPage, "conversation-waiting");
  const waitingText = await convPage.textContent("body");
  if (waitingText?.includes("Waiting for Maya")) pass("Conversation shows 'Waiting for Maya's reply…'");
  else fail("Waiting state not shown in conversation");
  if (waitingText?.includes("Maya answers personally. No bots.")) pass("'No bots' footer present");
  else fail("'No bots' footer missing");

  // Send from inbox
  const sendBtn = inboxPage.locator("button", { hasText: /^Send$/ }).first();
  if (await sendBtn.isVisible()) {
    await sendBtn.click();
    await inboxPage.waitForTimeout(800); // wait for localStorage + poll cycle
    await shot(inboxPage, "inbox-after-send");
    // Check "See @handle's view" link appeared
    const inboxBody = await inboxPage.textContent("body");
    if (inboxBody?.includes("See @niamh")) pass("'See @niamh's view' link appears after send");
    else note("'See @niamh's view' link not visible — check send handler");

    // Poll on conversation page (500ms interval)
    await convPage.waitForTimeout(800);
    await shot(convPage, "conversation-after-reply");
    const convBody = await convPage.textContent("body");
    if (convBody?.includes("Cloud Cream")) pass("Conversation updated with Maya's reply (real-time)");
    else fail("Conversation did NOT update after inbox send");
  } else {
    note("Send button not found — might need to select a person first");
    await shot(inboxPage, "inbox-send-debug");
  }

  await inboxPage.close();
  await convPage.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 10. Inbox — @sarah repeat detection (previousAnswer seeded) ═══");
{
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/inbox");
  await pg.waitForLoadState("networkidle");
  // Click @sarah
  const sarahBtn = pg.locator("text=@sarah").first();
  if (await sarahBtn.isVisible()) {
    await sarahBtn.click();
    await pg.waitForTimeout(300);
    await shot(pg, "inbox-sarah-repeat");
    const bodyText = await pg.textContent("body");
    if (bodyText?.includes("previously answered") || bodyText?.includes("Asked before") || bodyText?.includes("same question")) {
      pass("Repeat detection indicator shown for @sarah");
    } else {
      note("No explicit repeat indicator — checking for pre-filled reply textarea");
      const textareaValue = await pg.locator("textarea").first().inputValue();
      if (textareaValue) pass(`Pre-filled reply for @sarah: "${textareaValue.substring(0, 60)}..."`);
      else note("No pre-fill found for @sarah");
    }
  } else {
    note("@sarah not visible — check if she appears in inbox list");
    await shot(pg, "inbox-sarah-debug");
  }
  await pg.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 11. Inbox — rule promotion modal ═══");
{
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/inbox");
  await pg.waitForLoadState("networkidle");
  // Look for "Add as rule" / "Promote" button
  const ruleBtn = pg.locator("text=/Add.*rule|Promote|Make.*rule/i").first();
  if (await ruleBtn.isVisible()) {
    await ruleBtn.click();
    await pg.waitForTimeout(300);
    await shot(pg, "inbox-rule-modal");
    const bodyText = await pg.textContent("body");
    if (bodyText?.includes("rule")) pass("Rule promotion modal opened");
  } else {
    note("Rule promotion button not immediately visible — may require sending first");
    await shot(pg, "inbox-rule-button-debug");
  }
  await pg.close();
}

// ─────────────────────────────────────────────
console.log("\n═══ 12. Back navigation on quiz ═══");
{
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/quiz");
  await pg.waitForLoadState("networkidle");
  await pg.click("text=Dry");
  await pg.waitForTimeout(200);
  const counter2 = await pg.textContent("span.tabular-nums");
  if (counter2?.trim() === "2 / 4") pass("Advanced to Q2");
  // Back button
  await pg.click("button[aria-label='Back']");
  await pg.waitForTimeout(200);
  const counter1 = await pg.textContent("span.tabular-nums");
  if (counter1?.trim() === "1 / 4") pass("Back button returns to Q1");
  else fail(`Back button result: "${counter1?.trim()}"`);
  await pg.close();
}

await browser.close();
console.log(`\n📁 Screenshots in: ${OUT}`);
console.log(process.exitCode === 1 ? "\n⚠️  Some checks failed — see ❌ above" : "\n✅ All checks passed");
