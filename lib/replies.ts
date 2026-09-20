const REPLIES_KEY = "shade_replies";
const PROMOTED_KEY = "shade_promoted_answers";
const INBOX_KEY = "shade_inbox_messages";

// ─── Maya's sent replies (keyed by conversation id) ───────────────────────────

export interface Reply {
  handle: string;
  originalMessage: string;
  reply: string;
  timestamp: number;
}

export function saveReply(r: Reply): void {
  if (typeof window === "undefined") return;
  const all = loadReplies();
  all[r.handle] = r;
  localStorage.setItem(REPLIES_KEY, JSON.stringify(all));
}

export function loadReplies(): Record<string, Reply> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(REPLIES_KEY) ?? "{}"); } catch { return {}; }
}

export function loadReply(id: string): Reply | null {
  return loadReplies()[id] ?? null;
}

// ─── Messages submitted via the escape hatch ─────────────────────────────────

export interface InboxMessage {
  id: string;       // unique conversation id (used in /conversation/[id])
  handle: string;   // display name the follower gave
  message: string;
  sessionData: { skin?: string; routine?: string; budget?: string; finish?: string };
  submittedAt: number;
}

export function saveInboxMessage(m: InboxMessage): void {
  if (typeof window === "undefined") return;
  const all = loadInboxMessages();
  all[m.id] = m;
  localStorage.setItem(INBOX_KEY, JSON.stringify(all));
}

export function loadInboxMessages(): Record<string, InboxMessage> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(INBOX_KEY) ?? "{}"); } catch { return {}; }
}

export function loadInboxMessage(id: string): InboxMessage | null {
  return loadInboxMessages()[id] ?? null;
}

// ─── Promoted answers (Maya's standing replies, keyed by keywords) ────────────

export interface PromotedAnswer {
  id: string;
  originalQuestion: string;
  keywords: string[];
  answer: string;
  promotedAt: number;
}

const STOPWORDS = new Set([
  "i","a","an","the","is","it","to","do","for","in","on","at","my","me",
  "you","we","be","am","are","was","what","how","would","could","should",
  "can","will","with","have","has","had","but","not","or","and","of","so",
  "that","this","there","they","them","their","from","by","any","all",
  "just","use","get","like","than","about","if","as","up","im","ive","its",
  "been","which","when","where","who","why","too","even","actually","really",
]);

export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export function savePromotedAnswer(a: PromotedAnswer): void {
  if (typeof window === "undefined") return;
  const all = loadPromotedAnswers();
  all[a.id] = a;
  localStorage.setItem(PROMOTED_KEY, JSON.stringify(all));
}

export function loadPromotedAnswers(): Record<string, PromotedAnswer> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(PROMOTED_KEY) ?? "{}"); } catch { return {}; }
}

export function findMatchingAnswer(message: string): PromotedAnswer | null {
  const msgKeywords = new Set(extractKeywords(message));
  if (msgKeywords.size === 0) return null;
  const answers = Object.values(loadPromotedAnswers());
  // Find the answer with the most keyword overlap
  let best: PromotedAnswer | null = null;
  let bestScore = 0;
  for (const a of answers) {
    const overlap = a.keywords.filter((k) => msgKeywords.has(k)).length;
    if (overlap > bestScore) { bestScore = overlap; best = a; }
  }
  return bestScore >= 1 ? best : null;
}

// ─── Promoted quiz branches (deterministic branch off a specific quiz option) ──

const QUIZ_BRANCHES_KEY = "shade_quiz_branches";

export interface PromotedQuizBranch {
  id: string;
  questionKey: string; // e.g. "skin"
  optionKey: string;   // e.g. "not-sure"
  answer: string;
  promotedAt: number;
}

export function savePromotedQuizBranch(b: PromotedQuizBranch): void {
  if (typeof window === "undefined") return;
  const all = loadPromotedQuizBranches();
  all[`${b.questionKey}:${b.optionKey}`] = b;
  localStorage.setItem(QUIZ_BRANCHES_KEY, JSON.stringify(all));
}

export function loadPromotedQuizBranches(): Record<string, PromotedQuizBranch> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(QUIZ_BRANCHES_KEY) ?? "{}"); } catch { return {}; }
}

export function findQuizBranch(questionKey: string, optionKey: string): PromotedQuizBranch | null {
  return loadPromotedQuizBranches()[`${questionKey}:${optionKey}`] ?? null;
}

// ─── Legacy PromotedRule shim (inbox pre-fill by skin trigger) ───────────────
// Kept so old seeded @sarah previousAnswer flow still compiles.

export interface PromotedRule {
  trigger: string;
  answer: string;
  wording: string;
  promotedAt: number;
}

export function savePromotedRule(_rule: PromotedRule): void { /* superseded */ }
export function loadPromotedRule(_trigger: string): PromotedRule | null { return null; }
