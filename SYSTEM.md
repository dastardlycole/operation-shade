# Operation Shade — How the System Works

## The problem it solves

Maya Rao gets 4,800 DMs a month. She can only answer a fraction. The people who *don't* message — too shy, don't want to bother her — drive ~60% of sales but are invisible to her current workflow. This system serves that silent majority and makes Maya's time go further with the people who do reach out.

---

## Three layers

### 1. The public verdict page (`/quiz` → `/verdict`)

Four questions, auto-advances on tap. No LLMs. Deterministic routing.

```
skin type × budget → product set
SPF 50 always appended (Every verdict)
Glass Drop shown with "MAYA SAYS NO" when budget is £60+ (endorsed: false)
```

The routing rules live in `data/rules.json`. Maya's judgement is encoded once, runs for everyone. No DMs required.

**"Not sure" on Q1** → always goes to the escape hatch. The quiz cannot answer this.

---

### 2. The escape hatch (`/escape` → `/conversation/[id]`)

For people the quiz can't serve — wrong skin type, edge case, wants Maya specifically.

The form carries everything the follower already answered (skin, routine, budget, finish, products shown) so Maya doesn't have to ask again. The follower adds a name and any free text.

On submit:
- A unique conversation ID is generated (`handle-timestamp36`)
- The message is saved to `localStorage` (`shade_inbox_messages`)
- The follower lands on `/conversation/[id]` showing "Waiting for Maya's reply…"

The conversation page polls `localStorage` every 500ms. When Maya replies from the inbox, the reply appears in real time — no page refresh.

---

### 3. The creator inbox (`/inbox`)

**Left column — Came through the page**

Live messages submitted via the escape hatch appear here (NEW badge). Seeded demo messages are below them. Both show the follower's quiz answers so Maya has full context before reading the message.

**Left column — Messaged you, ranked by behaviour**

Audience DMs sorted by behavioural score, not recency:
```
score = saves×3 + shares×5 + returns×2 + (prior order ? +10 : 0)
DMs count 0
```

Megan with 1 DM and £38 order scores 50. Naomi with 2 DMs and no order scores 13. Maya's time goes to the person more likely to buy.

**Right column — Never messaged**

Audience members with dms===0, same scoring. They're not reaching out but they're engaged. Maya can see them.

---

## The recall loop

This is the compounding value of the system.

### Step 1 — Maya answers a new question

Someone asks "what cocoa butter would you recommend for dry lips". Maya types her answer in the inbox, clicks Send. The reply goes to `localStorage` (`shade_replies`) keyed by conversation ID, and appears on the follower's conversation page within 500ms.

### Step 2 — Maya adds it to the loop

After sending, the inbox offers: **"Add this to the loop?"** Maya sees which keywords the question will match on, can edit the wording, confirms.

The answer is saved to `localStorage` (`shade_promoted_answers`) with:
- The original question text
- Keywords extracted from it (used for display only)
- Maya's answer
- Timestamp

### Step 3 — Next similar question arrives

When Maya opens a new message, the inbox calls `POST /api/match` with:
- The new message
- All promoted answers (original question + answer)

**Claude Haiku** compares them semantically — not keyword overlap, actual meaning. "which cocoa butter is best for chapped lips" matches "what cocoa butter would you recommend for dry lips". "is cocoa butter good for oily skin" does not.

If there's a match, the inbox shows:
```
YOU'VE ANSWERED THIS BEFORE
[Maya's previous answer, pre-loaded in the reply box]
[Edit first]  [Send as is]
```

Maya reviews, optionally edits, sends in one click. The follower gets the same quality answer Maya gave the first time.

### What reaches Maya for real effort

Only what's genuinely new. Everything else is her own expertise, surfaced back to her.

---

## Data flow

```
localStorage keys:
  shade_inbox_messages   → { [id]: InboxMessage }     — submitted via escape hatch
  shade_replies          → { [id]: Reply }             — Maya's sent replies
  shade_promoted_answers → { [id]: PromotedAnswer }    — Maya's promoted answers
```

Cross-tab real-time: `window.addEventListener('storage', ...)` + 500ms polling interval. Works within the same browser session (demo). Production would use WebSockets or SSE.

---

## Key files

| File | What it does |
|------|-------------|
| `lib/router.ts` | Deterministic routing — skin × budget → products |
| `lib/scorer.ts` | Behavioural score per audience member |
| `lib/replies.ts` | All localStorage read/write — messages, replies, promoted answers |
| `app/api/match/route.ts` | Claude Haiku semantic match — is this the same question? |
| `data/rules.json` | 12 routing rules (seed data) |
| `data/products.json` | 10 products, Glass Drop has endorsed:false |
| `data/intercepts.json` | 12 seeded DMs for demo (@sarah has previousAnswer seeded) |
| `data/audience.json` | 10 audience members with behavioural signals |

---

## What production would change

- **Message transport**: localStorage → database. Real API behind the escape form.
- **Identity**: Name field → email for reply notification. No Instagram login required — this channel exists precisely for people who won't DM on social.
- **Recall matching**: Claude Haiku → embeddings (faster, cheaper at scale). Embed promoted questions at promotion time, nearest-neighbour search on new messages. Claude stays for the things that need language.
- **Behavioural data**: Hardcoded JSON → live signals from Instagram Graph API (saves, shares) + Shopify webhooks (orders, returns).
- **Maya's product CMS**: Edit products.json → admin UI. Maya updates prices, notes, marks things declined.
- **Rule management**: Maya sees all promoted answers, can retire stale ones, sees deflection counts ("this answer has handled 340 questions").
- **Notifications**: "Maya replied" → email to follower. No polling needed.
