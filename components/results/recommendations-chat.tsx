"use client";

// components/results/recommendations-chat.tsx
//
// ONE shared chat for the whole results page, not a per-card question box.
// Per explicit product decision: a question box on every RecommendationCard
// would clutter the UI once a user has several recommendations to ask
// about. Instead this renders once, below all the cards, and is scoped to
// the union of every visible recommendation's cited claims (see
// ResultsView) rather than any single card.
//
// It talks to the SAME /api/chat endpoint the general chatbot uses, but
// flags each turn with `explainContext.citedClaimIds`. That flag switches
// the route into explain mode (see app/api/chat/route.ts): the model gets
// only the scoped askAboutRecommendation tool instead of the general tool
// set, and a system prompt that (a) never contradicts the deterministic
// recommendation the rules engine already made, and (b) keeps "why this
// was recommended" (cited evidence) visually and textually separate from
// "other research that exists but wasn't part of the decision"
// (supplementary evidence) -- see EXPLAIN_SYSTEM_PROMPT in prompts.ts and
// the evidenceTier badge in components/messages/sources.tsx.
//
// citedClaimIds can legitimately be an empty array (e.g. every visible
// recommendation is "not_needed"/"already_covered" with no cited policy);
// the route treats an empty array as "explain mode is on, just skip the
// cited-tier search" rather than turning explain mode off.

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Square, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageWall } from "@/components/messages/message-wall";
import { ThinkingIndicator } from "@/components/ai-elements/thinking-indicator";

export function RecommendationsChat({
  citedClaimIds,
  profileVersionId,
}: {
  citedClaimIds: string[];
  // Only set for a real, persisted submission (see app/results/page.tsx) —
  // absent for the demo-profile picker, which has no database row to look
  // up. When present, the server independently re-fetches this exact,
  // OWNED profile version and injects it (plus the recommendations it
  // produces) as verified context — never trusting a client-supplied
  // profile. See lib/results/build-recommendation-context.ts.
  profileVersionId?: string;
}) {
  const [input, setInput] = React.useState("");

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    experimental_throttle: 50,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    // `body` is a ChatRequestOptions field — it belongs in sendMessage's
    // SECOND argument, not alongside `text` in the first. Putting it in the
    // first argument (as this used to) is silently dropped by the SDK, so
    // explainContext never reached the server: explain mode never
    // activated, and the chat always answered as the generic assistant with
    // no recommendation or profile context at all. This was the real
    // reason the chat previously seemed unable to talk about either.
    sendMessage({ text }, { body: { explainContext: { citedClaimIds, profileVersionId } } });
    setInput("");
  }

  const canSend = status === "ready" || status === "error";
  const isBusy = status === "streaming" || status === "submitted";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <MessageCircle className="size-4" />
          Ask about your recommendations
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ask why something was or wasn&apos;t recommended, or what the evidence says. This
          won&apos;t change what was recommended -- it only helps explain it.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {messages.length > 0 && (
          <MessageWall messages={messages} status={status} />
        )}

        {status === "submitted" && <ThinkingIndicator />}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            className="min-h-11 max-h-40 resize-none overflow-y-auto"
            placeholder="e.g. Why wasn't creatine recommended for me?"
            disabled={isBusy}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          {canSend ? (
            <Button type="submit" size="icon" disabled={!input.trim()}>
              <ArrowUp className="size-4" />
            </Button>
          ) : (
            <Button type="button" size="icon" onClick={() => stop()}>
              <Square className="size-4" />
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
