"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import interceptsData from "@/data/intercepts.json";
import { loadReply, loadInboxMessage, type Reply, type InboxMessage } from "@/lib/replies";
import type { Intercept } from "@/lib/types";

const intercepts = interceptsData as Intercept[];

interface Thread {
  handle: string;
  message: string;
}

export default function ConversationPage() {
  const { handle } = useParams<{ handle: string }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [reply, setReply] = useState<Reply | null>(null);
  const [justArrived, setJustArrived] = useState(false);

  useEffect(() => {
    // Resolve thread source: seeded intercept or live localStorage message
    const seeded = intercepts.find((m) => m.handle === handle);
    if (seeded) {
      setThread({ handle: seeded.handle, message: seeded.message });
    } else {
      const live = loadInboxMessage(handle);
      if (live) setThread({ handle: live.handle, message: live.message });
    }

    // Load any existing reply
    setReply(loadReply(handle));

    function onStorage(e: StorageEvent) {
      if (e.key === "shade_replies") {
        const incoming = loadReply(handle);
        if (incoming && !reply) {
          setJustArrived(true);
          setTimeout(() => setJustArrived(false), 2000);
        }
        setReply(incoming);
      }
      // Also re-check thread source if inbox messages updated
      if (e.key === "shade_inbox_messages") {
        const live = loadInboxMessage(handle);
        if (live) setThread({ handle: live.handle, message: live.message });
      }
    }

    const interval = setInterval(() => {
      const latest = loadReply(handle);
      if (latest) setReply(latest);
      // Keep checking for thread if not yet resolved
      if (!thread) {
        const live = loadInboxMessage(handle);
        if (live) setThread({ handle: live.handle, message: live.message });
      }
    }, 500);

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, [handle]);

  if (!thread) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-ink/40 text-sm">Loading conversation…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex justify-center">
      <div className="w-full max-w-sm flex flex-col">
        {/* Header */}
        <div className="px-5 py-5 border-b border-ink/10">
          <p className="text-[10px] tracking-[0.15em] text-terra uppercase mb-0.5">
            Direct message
          </p>
          <p className="font-serif text-xl text-ink">Maya Rao</p>
        </div>

        {/* Thread */}
        <div className="flex-1 px-5 py-6 flex flex-col gap-4">
          {/* Follower's message */}
          <div className="flex flex-col items-start gap-1">
            <p className="text-[10px] text-ink/35 tracking-wide uppercase">
              @{thread.handle}
            </p>
            <div className="bg-white border border-ink/12 px-4 py-3 max-w-[85%]">
              <p className="text-sm text-ink leading-relaxed">{thread.message}</p>
            </div>
          </div>

          {/* Maya's reply — or waiting state */}
          {reply ? (
            <div className={`flex flex-col items-end gap-1 ${justArrived ? "animate-fadein" : ""}`}>
              <p className="text-[10px] text-ink/35 tracking-wide uppercase">Maya</p>
              <div className="bg-ink px-4 py-3 max-w-[85%]">
                <p className="text-sm text-white leading-relaxed">{reply.reply}</p>
              </div>
              <p className="text-[10px] text-ink/25">
                {new Date(reply.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <p className="text-[10px] text-ink/35 tracking-wide uppercase">Maya</p>
              <div className="border border-dashed border-ink/20 px-4 py-3 max-w-[85%]">
                <p className="text-sm text-ink/30 italic">Waiting for Maya&apos;s reply…</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-ink/10">
          <p className="text-xs text-ink/30 text-center">Maya answers personally. No bots.</p>
        </div>
      </div>
    </div>
  );
}
