"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function QuizLink() {
  const [host, setHost] = useState("…");
  useEffect(() => { setHost(window.location.host); }, []);
  return (
    <span className="text-[10px] font-mono text-white/45 tracking-tight">
      {host}/quiz
    </span>
  );
}

interface ShareButtonProps {
  headline: string;
  products: string;
  verdictUrl: string;
}

export function ShareButton({ headline, products, verdictUrl }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/quiz`;
    const text = `${headline}\n${products}\n\nGet your own in four taps:`;
    if (navigator.share) {
      try { await navigator.share({ title: "Maya Rao's Verdict", text, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <button
        onClick={handleShare}
        className="w-full max-w-sm bg-ink text-white py-4 text-sm font-sans mb-3"
      >
        {copied ? "Copied to clipboard" : "Send to a friend"}
      </button>
      <Link
        href={verdictUrl}
        className="text-sm text-ink/50 underline underline-offset-2"
      >
        Back to my verdict
      </Link>
    </>
  );
}
