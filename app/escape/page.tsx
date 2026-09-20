"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { saveInboxMessage, loadPromotedAnswers } from "@/lib/replies";
import type { MatchResult } from "@/app/api/match/route";

const SKIN_LABELS: Record<string, string> = {
  dry: "Dry", oily: "Oily / combo", sensitive: "Sensitive",
  redness: "Redness", "not-sure": "Not sure",
};
const ROUTINE_LABELS: Record<string, string> = {
  nothing: "Nothing", "cleanser-only": "A cleanser only", "full-routine": "Full routine",
};
const BUDGET_LABELS: Record<string, string> = {
  "under-30": "Under £30", "30-60": "£30–60", "60-plus": "£60+",
};
const FINISH_LABELS: Record<string, string> = {
  rich: "Rich", light: "Light", glow: "Glow", invisible: "Invisible",
};

function EscapeForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [name, setName] = useState("");
  const [freeText, setFreeText] = useState("");
  const [checking, setChecking] = useState(false);
  const [deflected, setDeflected] = useState<string | null>(null);
  const [deflectReason, setDeflectReason] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [conversationId, setConversationId] = useState("");

  const skin = sp.get("skin") || "";
  const routine = sp.get("routine") || "";
  const budget = sp.get("budget") || "";
  const finish = sp.get("finish") || "";
  const shown = sp.get("shown") || "";

  const rows = [
    { label: "SKIN", value: SKIN_LABELS[skin] || skin || "—" },
    { label: "USING NOW", value: ROUTINE_LABELS[routine] || routine || "—" },
    { label: "BUDGET", value: BUDGET_LABELS[budget] || budget || "—" },
    { label: "FINISH", value: FINISH_LABELS[finish] || finish || "—" },
    ...(shown ? [{ label: "SHOWN", value: shown }] : []),
  ];

  const precomposed = [
    skin && `${SKIN_LABELS[skin] || skin} skin`,
    routine && (ROUTINE_LABELS[routine] || routine),
    budget && (BUDGET_LABELS[budget] || budget),
    finish && `${FINISH_LABELS[finish] || finish} finish`,
    shown && `was shown ${shown}`,
    "still unsure",
  ].filter(Boolean).join(", ");

  const fullMessage = [precomposed, freeText.trim()].filter(Boolean).join(". ");

  async function handleSend() {
    if (!name.trim()) return;

    const promotedAnswers = Object.values(loadPromotedAnswers());

    // Check promoted answers library first
    if (promotedAnswers.length > 0 && freeText.trim()) {
      setChecking(true);
      try {
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: fullMessage,
            candidates: promotedAnswers.map((a) => ({
              id: a.id,
              originalQuestion: a.originalQuestion,
              answer: a.answer,
            })),
          }),
        });
        if (res.ok) {
          const result: MatchResult = await res.json();
          if (result.matchId) {
            const matched = promotedAnswers.find((a) => a.id === result.matchId);
            if (matched) {
              setDeflected(matched.answer);
              setDeflectReason(result.reason);
              setChecking(false);
              return;
            }
          }
        }
      } catch { /* fall through to inbox */ }
      setChecking(false);
    }

    // No match — send to Maya's inbox
    sendToInbox();
  }

  function sendToInbox() {
    const id = `${name.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`;
    saveInboxMessage({
      id,
      handle: name.trim(),
      message: fullMessage || precomposed,
      sessionData: {
        skin: skin || undefined,
        routine: routine || undefined,
        budget: budget || undefined,
        finish: finish || undefined,
      },
      submittedAt: Date.now(),
    });
    setConversationId(id);
    setSent(true);
  }

  // ── Deflected state — Maya has answered this before ──────────────────────
  if (deflected) {
    return (
      <div className="min-h-screen bg-cream flex justify-center">
        <div className="w-full max-w-sm px-5 py-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => router.back()} className="text-ink text-lg" aria-label="Back">‹</button>
            <span className="text-[10px] tracking-[0.15em] text-terra uppercase font-sans">Maya has answered this</span>
          </div>

          <h1 className="font-serif text-[2rem] leading-tight text-ink mb-6">
            She&apos;s been here before.
          </h1>

          <div className="border border-ink/12 bg-white px-5 py-5 mb-4">
            <p className="text-[10px] tracking-[0.15em] text-ink/35 uppercase mb-3">Maya&apos;s answer</p>
            <p className="font-serif italic text-ink text-lg leading-relaxed">
              &ldquo;{deflected}&rdquo;
            </p>
          </div>

          {deflectReason && (
            <p className="text-xs text-ink/40 mb-6 leading-relaxed">
              Matched because: {deflectReason}.
            </p>
          )}

          <p className="text-xs text-ink/35 mb-8">
            This is Maya&apos;s standing answer, not a bot. She wrote it.
          </p>

          <button
            onClick={() => { setDeflected(null); sendToInbox(); }}
            className="w-full border border-ink/20 text-ink py-3.5 text-sm text-center mb-3"
          >
            Still want to message Maya directly?
          </button>

          <Link href="/quiz" className="block text-center text-xs text-ink/35 underline underline-offset-2">
            Back to the quiz
          </Link>
        </div>
      </div>
    );
  }

  // ── Sent state ────────────────────────────────────────────────────────────
  if (sent) {
    return (
      <div className="min-h-screen bg-cream flex justify-center">
        <div className="w-full max-w-sm px-5 py-6">
          <div className="flex items-center justify-between mb-6">
            <span />
            <span className="text-[10px] tracking-[0.15em] text-terra uppercase font-sans">Write to Maya</span>
          </div>
          <h1 className="font-serif text-[2rem] leading-tight text-ink mb-6">Sent.</h1>
          <p className="text-sm text-ink/50 mb-6">Maya answers personally. This might take a day or two.</p>
          <Link
            href={`/conversation/${conversationId}`}
            className="block w-full border border-ink/20 text-ink py-3.5 text-sm text-center"
          >
            Check for Maya&apos;s reply
          </Link>
        </div>
      </div>
    );
  }

  // ── Default form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream flex justify-center">
      <div className="w-full max-w-sm px-5 py-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="text-ink text-lg" aria-label="Back">‹</button>
          <span className="text-[10px] tracking-[0.15em] text-terra uppercase font-sans">Write to Maya</span>
        </div>

        <h1 className="font-serif text-[2rem] leading-tight text-ink mb-2">Tell Maya the rest.</h1>
        <p className="text-sm text-ink/55 mb-6 leading-relaxed">
          Everything you answered goes with your message, so she doesn&apos;t have to ask again.
        </p>

        <div className="border border-ink/[0.12] mb-5">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-between px-4 py-2.5 border-b border-ink/[0.08] last:border-0">
              <span className="text-[10px] tracking-[0.15em] text-ink/40 uppercase">{row.label}</span>
              <span className="text-sm text-ink">{row.value}</span>
            </div>
          ))}
        </div>

        {precomposed && (
          <div className="mb-5">
            <p className="text-[10px] tracking-[0.15em] text-ink/40 uppercase mb-2">Maya will see</p>
            <p className="font-serif italic text-ink/65 text-sm leading-relaxed">{precomposed}</p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-[10px] tracking-[0.15em] text-ink/40 uppercase mb-2">In your own words</p>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            className="w-full border border-ink/15 bg-white p-3 text-sm text-ink min-h-[96px] resize-none focus:outline-none focus:border-ink/40"
            placeholder="What else should Maya know?"
          />
        </div>

        <div className="mb-5">
          <p className="text-[10px] tracking-[0.15em] text-ink/40 uppercase mb-2">Your name or @handle</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink/40"
            placeholder="So Maya knows who to reply to"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!name.trim() || checking}
          className="w-full bg-ink text-white py-4 text-sm font-sans disabled:opacity-40"
        >
          {checking ? "Checking Maya's answers…" : "Send to Maya"}
        </button>
      </div>
    </div>
  );
}

export default function EscapePage() {
  return (
    <Suspense>
      <EscapeForm />
    </Suspense>
  );
}
