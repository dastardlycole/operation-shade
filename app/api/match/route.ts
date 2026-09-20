import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export interface MatchCandidate {
  id: string;
  originalQuestion: string;
  answer: string;
}

export interface MatchResult {
  matchId: string | null;
  confidence: "high" | "medium" | "low" | null;
  reason: string | null;
}

const NO_MATCH: MatchResult = { matchId: null, confidence: null, reason: null };

export async function POST(req: NextRequest) {
  try {
    const { message, candidates } = (await req.json()) as {
      message: string;
      candidates: MatchCandidate[];
    };

    if (!message || !candidates?.length) {
      return NextResponse.json(NO_MATCH);
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const candidateList = candidates
      .map((c, i) => `[${i + 1}] "${c.originalQuestion}"`)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are deciding whether a new question is asking about the exact same product or topic as a previously answered question. Both must be about the same specific subject — matching on shared emotion, uncertainty, or vague similarity is NOT a match.

Examples of NOT a match:
- "I don't know my skin type" vs "which cocoa butter is best" → different subjects
- "I'm not sure what to use" vs "is the night serum worth it" → different subjects

Examples of a match:
- "what cocoa butter for dry lips" vs "which cocoa butter for chapped lips" → same product, same concern
- "is cloud cream good for oily skin" vs "can oily skin use cloud cream" → same product, same skin type

New question: "${message}"

Previously answered questions:
${candidateList}

Reply with JSON only:
- If there is a clear match on the same specific product or topic: { "match": <number>, "confidence": "high" | "medium", "reason": "<one short phrase>" }
- If no clear match: { "match": null }

No explanation outside the JSON.`,
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    // Strip markdown code fences if present
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(text);

    if (!parsed.match) return NextResponse.json(NO_MATCH);

    const idx = parsed.match - 1;
    if (idx < 0 || idx >= candidates.length) return NextResponse.json(NO_MATCH);

    return NextResponse.json({
      matchId: candidates[idx].id,
      confidence: parsed.confidence ?? "medium",
      reason: parsed.reason ?? null,
    } satisfies MatchResult);
  } catch (err) {
    console.error("[/api/match]", err);
    return NextResponse.json(NO_MATCH);
  }
}
