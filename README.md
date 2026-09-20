# Operation Shade

A demo built for Maya Rao — a beauty creator getting 4,800 DMs a month. Three layers that turn her judgment into a system.

## What it does

**Quiz → Verdict** (`/quiz`, `/verdict`)  
Four questions. Deterministic routing — skin type × budget → product set. No LLM, no hallucinations. Maya's logic, codified once.

**Escape hatch** (`/escape`)  
When the quiz can't answer, the follower writes to Maya. Their quiz answers travel with the message so she never has to ask again. Before it reaches her inbox, it checks whether she's already answered something like it — if yes, her standing answer is shown immediately.

**Maya's inbox** (`/inbox`)  
Not sorted by recency. Sorted by buying behaviour: saves, shares, returns, prior orders. People who DM constantly but never buy sit at the bottom. When Maya opens a message, the system checks if she's answered it before and pre-loads her answer. She reviews, edits if needed, sends.

**Conversation** (`/conversation/[id]`)  
The follower's side. Polls for Maya's reply in real time.

**Promote to the loop**  
After Maya answers, she can promote that answer in two ways:
- **Standing answer** — next time anyone asks something similar at the escape hatch, they get her answer directly, no inbox needed
- **Quiz branch** — for "not sure" skin type answers, her response goes into the quiz itself. Next person who picks "not sure" sees her answer without ever reaching the escape hatch

## Running it

```bash
npm install
npx next dev --turbopack
```

Requires `.env.local` with:
```
ANTHROPIC_API_KEY=sk-ant-...
```

The API key powers semantic matching in the inbox and escape hatch. Everything else is deterministic.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Claude Haiku (semantic matching only)
