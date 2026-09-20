"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import audienceData from "@/data/audience.json";
import interceptsData from "@/data/intercepts.json";
import { score, sortByBehaviour } from "@/lib/scorer";
import {
  saveReply,
  savePromotedAnswer,
  savePromotedQuizBranch,
  loadInboxMessages,
  loadPromotedAnswers,
  extractKeywords,
  type InboxMessage,
  type PromotedAnswer,
} from "@/lib/replies";
import type { MatchResult } from "@/app/api/match/route";
import type { Person, Intercept } from "@/lib/types";

const audience = audienceData as Person[];
const intercepts = interceptsData as Intercept[];

const seededEscapes = intercepts.filter((m) => m.routingPath !== null);
const behaviourDMs = sortByBehaviour(audience.filter((p) => p.dms > 0));
const audienceHandles = new Set(audience.map((p) => p.handle));
const rawDMs = intercepts.filter(
  (m) => m.routingPath === null && !audienceHandles.has(m.handle)
);
const neverMessaged = sortByBehaviour(audience.filter((p) => p.dms === 0));

type SelectedItem =
  | { kind: "escape"; item: Intercept }
  | { kind: "live"; item: InboxMessage }
  | { kind: "behaviour"; item: Person }
  | { kind: "raw"; item: Intercept };

const SKIN_LABELS: Record<string, string> = {
  dry: "Dry", oily: "Oily / combo", sensitive: "Sensitive",
  redness: "Redness", "not-sure": "Not sure",
};
const BUDGET_LABELS: Record<string, string> = {
  "under-30": "Under £30", "30-60": "£30–60", "60-plus": "£60+",
};

function formatScore(p: Person) {
  return [
    `${p.saves} saves`, `${p.shares} shares`, `${p.returns} returns`,
    p.order > 0 ? `£${p.order}` : "no order",
  ].join(" · ");
}

export default function InboxPage() {
  const niamh = seededEscapes.find((m) => m.handle === "niamh") ?? seededEscapes[0];
  const [selected, setSelected] = useState<SelectedItem>({ kind: "escape", item: niamh });
  const [liveMessages, setLiveMessages] = useState<InboxMessage[]>([]);
  const [reply, setReply] = useState("");
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [showPromotion, setShowPromotion] = useState<{ id: string; question: string; answer: string; isQuizDrop: boolean } | null>(null);
  const [promotionWording, setPromotionWording] = useState("");
  const [recall, setRecall] = useState<{ answer: PromotedAnswer; result: MatchResult } | null>(null);
  const [recallLoading, setRecallLoading] = useState(false);

  // Load live messages from localStorage (submitted via escape hatch)
  useEffect(() => {
    function refresh() {
      const msgs = Object.values(loadInboxMessages()).sort((a, b) => b.submittedAt - a.submittedAt);
      setLiveMessages(msgs);
    }
    refresh();
    window.addEventListener("storage", refresh);
    const iv = setInterval(refresh, 1000);
    return () => { window.removeEventListener("storage", refresh); clearInterval(iv); };
  }, []);

  // Semantic recall check — called when Maya opens a message
  async function checkRecall(message: string) {
    const allAnswers = Object.values(loadPromotedAnswers());
    if (!allAnswers.length) { setRecall(null); return; }
    setRecallLoading(true);
    setRecall(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          candidates: allAnswers.map((a) => ({ id: a.id, originalQuestion: a.originalQuestion, answer: a.answer })),
        }),
      });
      if (!res.ok) { setRecallLoading(false); return; }
      const result: MatchResult = await res.json();
      if (result.matchId) {
        const matched = allAnswers.find((a) => a.id === result.matchId);
        if (matched) setRecall({ answer: matched, result });
      }
    } finally {
      setRecallLoading(false);
    }
  }

  // The conversation id for the currently selected item
  const selectedId =
    selected.kind === "escape" ? selected.item.id
    : selected.kind === "live" ? selected.item.id
    : selected.kind === "raw" ? selected.item.id
    : selected.item.handle;

  const isAnswered = answered.has(selectedId);

  const currentMessage =
    selected.kind === "escape" ? selected.item.message
    : selected.kind === "live" ? selected.item.message
    : selected.kind === "raw" ? selected.item.message
    : null;

  const seededPreviousAnswer =
    (selected.kind === "escape" || selected.kind === "raw")
      ? selected.item.previousAnswer
      : null;

  const prefill = seededPreviousAnswer ?? recall?.answer.answer ?? null;

  function handleSend() {
    const textToSend = reply.trim() || prefill || "";
    if (!textToSend) return;

    setAnswered((prev) => new Set([...prev, selectedId]));

    const handle =
      selected.kind === "live" ? selected.item.id
      : selected.kind === "escape" ? selected.item.handle
      : selected.kind === "raw" ? selected.item.handle
      : selected.item.handle;

    const originalMsg = currentMessage ?? "";

    saveReply({ handle, originalMessage: originalMsg, reply: textToSend, timestamp: Date.now() });

    // Offer promotion for page messages (escape or live), only if not already recalled
    if ((selected.kind === "escape" || selected.kind === "live") && !recall) {
      const isQuizDrop =
        (selected.kind === "escape" && selected.item.routingPath?.skin === "not-sure") ||
        (selected.kind === "live" && selected.item.sessionData.skin === "not-sure");
      setShowPromotion({ id: selectedId, question: originalMsg, answer: textToSend, isQuizDrop: !!isQuizDrop });
      setPromotionWording(textToSend);
    }
    setReply("");
  }

  function handleAddRule(type: "standing" | "quiz") {
    if (!showPromotion) return;
    if (type === "quiz") {
      savePromotedQuizBranch({
        id: showPromotion.id,
        questionKey: "skin",
        optionKey: "not-sure",
        answer: promotionWording,
        promotedAt: Date.now(),
      });
    } else {
      const keywords = extractKeywords(showPromotion.question);
      const promoted: PromotedAnswer = {
        id: showPromotion.id,
        originalQuestion: showPromotion.question,
        keywords,
        answer: promotionWording,
        promotedAt: Date.now(),
      };
      savePromotedAnswer(promoted);
    }
    setShowPromotion(null);
  }

  // All "came through the page" — live messages first, then seeded
  const pageMessages = [...liveMessages.map((m) => ({ kind: "live" as const, m })),
    ...seededEscapes.map((m) => ({ kind: "escape" as const, m }))];

  return (
    <div className="h-screen bg-cream flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-ink/10">
        <span className="font-serif text-xl text-ink">Inbox</span>
        <span className="text-[10px] tracking-[0.15em] text-ink/40 uppercase">
          Sorted by buying behaviour, not arrival
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left column */}
        <div className="w-72 border-r border-ink/10 overflow-y-auto flex-shrink-0">
          {/* Came through the page */}
          {pageMessages.length > 0 && (
            <div>
              <p className="text-[10px] tracking-[0.15em] text-terra uppercase px-4 pt-4 pb-2">
                Came through the page
              </p>
              {pageMessages.map(({ kind, m }) => {
                const id = m.id;
                const handle = m.handle;
                const message = m.message;
                const routingPath = kind === "escape" ? (m as Intercept).routingPath : null;
                const skinLabel = routingPath?.skin ? (SKIN_LABELS[routingPath.skin] || routingPath.skin) : null;
                const isSelected =
                  kind === "live"
                    ? selected.kind === "live" && selected.item.id === id
                    : selected.kind === "escape" && (selected.item as Intercept).id === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setReply(""); setRecall(null);
                      if (kind === "live") {
                        setSelected({ kind: "live", item: m as InboxMessage });
                        checkRecall((m as InboxMessage).message);
                      } else {
                        setSelected({ kind: "escape", item: m as Intercept });
                        if (!(m as Intercept).previousAnswer) checkRecall((m as Intercept).message);
                      }
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-ink/[0.06] ${isSelected ? "bg-white" : "hover:bg-white/50"}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium text-ink">@{handle}</span>
                      <div className="flex items-center gap-1.5">
                        {kind === "live" && (
                          <span className="text-[9px] bg-terra/15 text-terra px-1.5 py-0.5">NEW</span>
                        )}
                        {answered.has(id) && (
                          <span className="text-[10px] text-ink/30">Answered</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-ink/55 truncate mb-1.5">{message}</p>
                    {skinLabel && (
                      <span className="inline-flex items-center gap-1 text-[10px] border border-terra/40 text-terra px-1.5 py-0.5">
                        Question 1 · {skinLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Messaged, ranked by behaviour */}
          <div>
            <p className="text-[10px] tracking-[0.15em] text-ink/40 uppercase px-4 pt-4 pb-2">
              Messaged you, ranked by behaviour
            </p>
            {behaviourDMs.map((person) => {
              const s = score(person);
              const isSelected = selected.kind === "behaviour" && selected.item.handle === person.handle;
              return (
                <button
                  key={person.handle}
                  onClick={() => setSelected({ kind: "behaviour", item: person })}
                  className={`w-full text-left px-4 py-3 border-b border-ink/[0.06] ${isSelected ? "bg-white" : "hover:bg-white/50"}`}
                >
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-medium text-ink capitalize">
                      {person.handle}{" "}
                      <span className="font-normal text-ink/40 text-xs">
                        {person.dms} {person.dms === 1 ? "DM" : "DMs"}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-ink">{s}</span>
                  </div>
                  <div className="h-px bg-ink/10 mb-1.5">
                    <div className="h-px bg-ink" style={{ width: `${Math.min((s / 70) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-ink/40">{formatScore(person)}</p>
                </button>
              );
            })}
          </div>

          {/* No behaviour data */}
          {rawDMs.length > 0 && (
            <div>
              <p className="text-[10px] tracking-[0.15em] text-ink/40 uppercase px-4 pt-4 pb-2">
                No behaviour data yet
              </p>
              {rawDMs.map((item) => {
                const isSelected = selected.kind === "raw" && selected.item.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelected({ kind: "raw", item })}
                    className={`w-full text-left px-4 py-3 border-b border-ink/[0.06] ${isSelected ? "bg-white" : "hover:bg-white/50"}`}
                  >
                    <p className="text-sm font-medium text-ink mb-0.5">@{item.handle}</p>
                    <p className="text-xs text-ink/55 truncate">{item.message}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Centre column */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-ink/10">
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {/* Handle + source */}
            <div className="flex items-baseline gap-3 mb-5">
              <span className="font-serif text-2xl text-ink">
                @{selected.kind === "behaviour" ? selected.item.handle : selected.item.handle}
              </span>
              <span className="text-[10px] tracking-[0.12em] text-ink/35 uppercase">
                {selected.kind === "behaviour" ? "Direct message" : "Came through the page"}
              </span>
            </div>

            {/* Quiz answers for escape / live */}
            {(selected.kind === "escape") && selected.item.routingPath && (
              <div className="border border-ink/10 mb-5">
                <p className="text-[10px] tracking-[0.15em] text-ink/35 uppercase px-4 pt-3 pb-2">
                  What she&apos;d answered before writing
                </p>
                {[
                  { q: "What's your skin doing?", a: selected.item.routingPath.skin ? SKIN_LABELS[selected.item.routingPath.skin] || selected.item.routingPath.skin : null, flag: selected.item.routingPath.skin === "not-sure" ? "no branch yet" : null },
                  { q: "What are you using now?", a: "—", flag: null },
                  { q: "Budget?", a: selected.item.routingPath.budget ? BUDGET_LABELS[selected.item.routingPath.budget] : null, flag: !selected.item.routingPath.budget ? "Didn't get that far" : null },
                  { q: "What finish do you like?", a: selected.item.routingPath.finish, flag: !selected.item.routingPath.finish ? "Didn't get that far" : null },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center px-4 py-2.5 border-t border-ink/[0.06]">
                    <span className="text-sm text-ink/70">{row.q}</span>
                    <div className="flex items-center gap-2">
                      {row.a && <span className="text-sm text-ink">{row.a}</span>}
                      {row.flag && <span className="text-[10px] text-terra/70 italic">{row.flag}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Session data for live messages */}
            {selected.kind === "live" && Object.keys(selected.item.sessionData).length > 0 && (
              <div className="border border-ink/10 mb-5">
                <p className="text-[10px] tracking-[0.15em] text-ink/35 uppercase px-4 pt-3 pb-2">
                  What she&apos;d answered before writing
                </p>
                {Object.entries(selected.item.sessionData).map(([k, v]) => v ? (
                  <div key={k} className="flex justify-between px-4 py-2.5 border-t border-ink/[0.06]">
                    <span className="text-sm text-ink/70 capitalize">{k}</span>
                    <span className="text-sm text-ink">{v}</span>
                  </div>
                ) : null)}
              </div>
            )}

            {/* The message */}
            <p className="font-serif italic text-2xl text-ink leading-snug mb-6">
              &ldquo;{selected.kind === "behaviour"
                ? `${selected.item.handle} has sent ${selected.item.dms} DM${selected.item.dms !== 1 ? "s" : ""}.`
                : selected.item.message}&rdquo;
            </p>

            {/* Recall detection — seeded previousAnswer */}
            {seededPreviousAnswer && (
              <div className="border border-ink/15 p-4 mb-4 bg-white">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] tracking-[0.15em] text-terra uppercase">
                    You&apos;ve answered this before
                  </span>
                  <span className="text-[10px] text-ink/35">Matched on: Cloud Cream · £38</span>
                </div>
                <p className="text-xs text-ink/55 mt-1">Recalled from your shelf, not generated. Edit it or send it.</p>
              </div>
            )}

            {/* Recall detection — semantic match via Claude */}
            {!seededPreviousAnswer && recallLoading && (
              <div className="border border-ink/10 p-4 mb-4">
                <p className="text-[10px] tracking-[0.15em] text-ink/35 uppercase">Checking your answers…</p>
              </div>
            )}
            {!seededPreviousAnswer && !recallLoading && recall && (
              <div className="border border-terra/30 p-4 mb-4 bg-terra/5">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] tracking-[0.15em] text-terra uppercase">
                    You&apos;ve answered this before
                  </span>
                  {recall.result.reason && (
                    <span className="text-[10px] text-ink/40 italic">{recall.result.reason}</span>
                  )}
                </div>
                <p className="text-xs text-ink/65 italic leading-relaxed">
                  &ldquo;{recall.answer.answer}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Reply area */}
          {!isAnswered ? (
            <div className="border-t border-ink/10 px-8 py-4">
              {/* Recalled answer — one-click send, textarea secondary */}
              {prefill && !reply ? (
                <div>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setReply(prefill)}
                      className="flex-1 border border-ink/20 text-ink py-3 text-sm"
                    >
                      Edit first
                    </button>
                    <button onClick={handleSend} className="flex-1 bg-ink text-white py-3 text-sm">
                      Send as is
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] tracking-[0.15em] text-ink/35 uppercase mb-2">Your reply</p>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={prefill ?? ""}
                    className="w-full border border-ink/15 bg-white p-3 text-sm text-ink h-24 resize-none focus:outline-none focus:border-ink/40 mb-3"
                  />
                  <div className="flex gap-2">
                    {prefill && (
                      <button
                        onClick={() => setReply("")}
                        className="border border-ink/20 text-ink px-4 py-3 text-sm"
                      >
                        ←
                      </button>
                    )}
                    <button onClick={handleSend} className="flex-1 bg-ink text-white py-3 text-sm">
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border-t border-ink/10 px-8 py-4 text-center">
              <p className="text-sm text-ink/40 mb-2">Sent.</p>
              {(selected.kind === "escape" || selected.kind === "live" || selected.kind === "raw") && (
                <Link
                  href={`/conversation/${selected.kind === "live" ? selected.item.id : selected.item.handle}`}
                  target="_blank"
                  className="text-xs text-terra underline underline-offset-2"
                >
                  See @{selected.item.handle}&apos;s view →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right column — never messaged */}
        <div className="w-64 overflow-y-auto flex-shrink-0 px-5 py-4">
          <p className="text-[10px] tracking-[0.15em] text-ink/40 uppercase mb-1">Never messaged</p>
          <p className="text-xs text-ink/35 mb-4">Same score. Reach out if you want to.</p>
          {neverMessaged.map((person) => {
            const s = score(person);
            return (
              <div key={person.handle} className="mb-4">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm font-medium text-ink capitalize">{person.handle}</span>
                  <span className="text-sm font-medium text-ink">{s}</span>
                </div>
                <div className="h-px bg-ink/10 mb-1.5">
                  <div className="h-px bg-ink" style={{ width: `${Math.min((s / 70) * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-ink/40">{formatScore(person)}</p>
              </div>
            );
          })}
          <div className="border-t border-ink/10 mt-6 pt-4">
            <p className="text-[10px] text-ink/30 leading-relaxed">
              Score = 3 per save + 5 per share + 2 per return + 10 for a prior order. DMs count 0.
            </p>
          </div>
        </div>
      </div>

      {/* Rule promotion modal */}
      {showPromotion && (
        <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-5">
          <div className="bg-white w-full max-w-md p-6">
            <h2 className="font-serif text-2xl text-ink mb-2">Add this to the loop?</h2>
            {!showPromotion.isQuizDrop && (
              <>
                <p className="text-[10px] tracking-[0.15em] text-ink/35 uppercase mt-4 mb-1">Will match on</p>
                <p className="text-xs text-terra mb-4">
                  {extractKeywords(showPromotion.question).join(", ") || "—"}
                </p>
              </>
            )}
            <p className="text-[10px] tracking-[0.15em] text-ink/35 uppercase mb-2">Your answer</p>
            <textarea
              value={promotionWording}
              onChange={(e) => setPromotionWording(e.target.value)}
              className="w-full border border-ink/15 p-3 text-sm text-ink h-24 resize-none focus:outline-none focus:border-ink/40 mb-4"
            />
            <div className="flex gap-3 mb-3">
              {showPromotion.isQuizDrop ? (
                <>
                  <button
                    onClick={() => handleAddRule("quiz")}
                    className="flex-1 bg-ink text-white py-3 text-sm"
                  >
                    Add to the quiz
                  </button>
                  <button
                    onClick={() => handleAddRule("standing")}
                    className="flex-1 bg-[#8B2012] text-white py-3 text-sm"
                  >
                    Add as standing answer
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleAddRule("standing")}
                  className="flex-1 bg-[#8B2012] text-white py-3 text-sm"
                >
                  Add to the loop
                </button>
              )}
            </div>
            <button
              onClick={() => setShowPromotion(null)}
              className="w-full border border-ink/20 text-ink py-3 text-sm"
            >
              Not this one
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
