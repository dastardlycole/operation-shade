"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import questionsData from "@/data/questions.json";
import { findQuizBranch } from "@/lib/replies";
import type { Question } from "@/lib/types";

const questions = questionsData as Question[];
const KEYS = ["skin", "routine", "budget", "finish"] as const;

type Answers = { skin: string; routine: string; budget: string; finish: string };

export default function QuizPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [branchAnswer, setBranchAnswer] = useState<string | null>(null);

  const question = questions[step];

  function handleSelect(value: string) {
    const key = KEYS[step];
    const next = { ...answers, [key]: value };
    setAnswers(next);

    if (key === "skin" && value === "not-sure") {
      const branch = findQuizBranch("skin", "not-sure");
      if (branch) {
        setBranchAnswer(branch.answer);
        return;
      }
      router.push("/escape?skin=not-sure");
      return;
    }

    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      const params = new URLSearchParams(next as Record<string, string>);
      router.push(`/verdict?${params.toString()}`);
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  if (branchAnswer) {
    return (
      <div className="min-h-screen bg-cream flex justify-center">
        <div className="w-full max-w-sm px-5 py-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setBranchAnswer(null)} className="text-ink text-lg" aria-label="Back">‹</button>
            <span className="text-[10px] tracking-[0.15em] text-terra uppercase font-sans">Maya&apos;s answer</span>
          </div>
          <h1 className="font-serif text-[2rem] leading-tight text-ink mb-6">
            Not sure about your skin type?
          </h1>
          <div className="border border-ink/12 bg-white px-5 py-5 mb-4">
            <p className="text-[10px] tracking-[0.15em] text-ink/35 uppercase mb-3">Maya says</p>
            <p className="font-serif italic text-ink text-lg leading-relaxed">
              &ldquo;{branchAnswer}&rdquo;
            </p>
          </div>
          <p className="text-xs text-ink/35 mb-8">
            This is Maya&apos;s standing answer, not a bot. She wrote it.
          </p>
          <button
            onClick={() => router.push("/escape?skin=not-sure")}
            className="w-full border border-ink/20 text-ink py-3.5 text-sm text-center"
          >
            Still want to ask Maya directly?
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex justify-center">
      <div className="w-full max-w-sm px-5 py-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={handleBack}
            className={`text-ink text-lg w-6 ${step === 0 ? "invisible" : ""}`}
            aria-label="Back"
          >
            ‹
          </button>
          <span className="text-xs text-ink/40 tabular-nums">
            {step + 1} / {questions.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 mb-10">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-px flex-1 transition-colors ${
                i <= step ? "bg-ink" : "bg-ink/20"
              }`}
            />
          ))}
        </div>

        {/* Question */}
        <h1 className="font-serif text-[2.4rem] leading-tight text-ink mb-8">
          {question.prompt}
        </h1>

        {/* Options */}
        <div className="flex flex-col gap-2">
          {question.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="w-full text-left px-4 py-3.5 bg-white border border-ink/15 text-ink text-sm hover:border-ink/50 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
