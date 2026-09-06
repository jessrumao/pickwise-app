# Explain-mode chat: give it the user's own profile + recommendations (2026-09-07)

Status note for the team / future sessions. Fixes a real product complaint:
the "Ask about your recommendations" chat on `/results` would flatly deny
having access to the user's profile or recommendations when asked
("what's my budget", "why was this recommended for ME") — making it
noticeably less useful than intended.

## Two separate bugs, not one

**1. The real root cause: `explainContext` never reached the server at all.**
`components/results/recommendations-chat.tsx` called
`sendMessage({ text, body: {...} } as any)`. In the installed AI SDK
(`ai@6.0.258` / `@ai-sdk/react@3.0.261`), `sendMessage`'s first argument
only accepts `text`/`files`/`metadata`/`parts`/`messageId` — `body` belongs
in a **second** `ChatRequestOptions` argument
(`sendMessage(message, options)`). The old call's `body` field was silently
ignored by the SDK (the `as any` cast is what let it compile despite not
matching the type), so `explainContext.citedClaimIds` never reached
`app/api/chat/route.ts` — explain mode never activated, and every message
got the general assistant's `SYSTEM_PROMPT`/identity/tool set instead of
`EXPLAIN_SYSTEM_PROMPT`. Verified live: before the fix, asking "what's my
budget" got a generic "I don't have access to your personal financial
information... I'm Piky, an AI research assistant..." response — the
general-assistant persona, not explain mode failing to find data.

Fixed by passing `body` correctly:
`sendMessage({ text }, { body: { explainContext: {...} } })`. This alone
would have fixed the original "can't refer to my recommendations" symptom
even without change #2 below, since explain mode's own prompt already
referred to "this recommendation" — it just was never being entered.

**2. The gap actually named in the complaint: no profile/recommendation data existed to give it anyway.**
Even with explain mode reached, the model only ever had
`askAboutRecommendation` — a semantic-search tool over evidence *text*
(`app/api/chat/tools/ask-about-recommendation.ts`). It had zero structured
knowledge of the user's own profile fields or what was actually
recommended (product, dose, priority, budget). So a question like "what's
my budget" or "why was this recommended for me based on my goals" had
nothing to answer from even once explain mode engaged.

## What changed

- **`lib/results/build-recommendation-context.ts`** (new) — formats a
  `UserProfile` + `RecommendationResult` into a compact text block: profile
  fields (age, sex, weight/height, diet, exercise, goals, budget, sleep,
  existing supplement use, allergies, health context, medications flag),
  and per-recommendation status/why/dose/product, plus a budget summary
  (funded total, deferred items). Reuses the same helpers the results UI
  itself uses (`knowledgeBase`, `getProductDisplay`, `statusDisplay`) so the
  text matches what's actually rendered, not a re-derived guess.
- **`app/api/chat/route.ts`** — `explainContext` now also accepts an
  optional `profileVersionId`. When present, the server independently
  re-fetches that OWNED profile version via `getProfileVersionById(userId,
  profileVersionId)` (same ownership check `POST /api/decisions` already
  uses — resolved via the anon cookie, never trusting anything the client
  claims), re-runs `generateRecommendations()` on it (pure, deterministic,
  cheap — avoids needing a `getDecisionRecordById` lookup), and injects the
  formatted context into the system prompt inside a `<user_context>` block.
  Resolution failure (no cookie yet, wrong user, deleted row) degrades
  gracefully to the prior evidence-only behavior rather than erroring the
  chat.
- **`components/results/recommendations-chat.tsx`** /
  **`components/results/results-view.tsx`** / **`app/results/page.tsx`** —
  thread an optional `profileVersionId` prop down from the page (which
  already had it from the URL) to the chat, included in `explainContext`.
  Only set for the real, persisted-submission path — the demo-profile
  picker has no database row to look up, so it keeps today's
  evidence-only behavior unchanged.
- **`prompts.ts`** — `EXPLAIN_SYSTEM_PROMPT` now explains the
  `<user_context>` block when present ("use it directly, no tool call
  needed, for profile/recommendation questions") and what to say when it's
  absent (say plainly the profile isn't available in this view, don't
  guess) — and narrows the `askAboutRecommendation` tool's stated purpose
  to supporting-evidence questions specifically, not profile/recommendation
  lookups it was never suited for anyway.

## Verification

`tsc --noEmit` clean. `eslint` clean on every touched file except one
pre-existing `@typescript-eslint/no-explicit-any` at `route.ts:68`
(confirmed present on `origin/main` before this change — the `let body: any`
parsing the raw request, unrelated to this fix). Full `vitest run`: **205
tests pass** (201 prior + 4 new in
`lib/results/__tests__/build-recommendation-context.test.ts`, covering real
profile fields appearing in the text, a recommendation's actual `why`
string appearing verbatim, real dose/product details, and the global-
escalation path reporting the real escalation message rather than a
generic one).

**Manually verified end to end in-browser**, a real submitted profile
(muscle gain, no budget limit, 60g estimated daily protein from food) →
`/results` → asked the chat "What's my monthly budget, how much am I
spending, and what's my goal?" and got back the actual real answer:
"Your monthly budget: No limit set... Amount spent this month: ₹6,995 (on
the two recommended products...)... Your goal: Muscle gain... alongside
your existing 60g daily intake from food" — pulling real profile and
basket data, not a generic refusal. A follow-up evidence-style question
("is there strong evidence for creatine improving strength?") still
correctly routed through the `askAboutRecommendation` tool (visible
"Reviewing the evidence" / search-query UI), confirming the tool path is
unaffected by the new context injection.

## Also found, not fixed here (out of scope for this task)

- The evidence-search follow-up above returned "I'm unable to retrieve the
  specific evidence right now due to a technical issue" with **no error
  logged server-side** — suggesting the model mis-narrated an empty/no-
  results search as a technical failure rather than a real one. Separate
  from the context-injection work here; worth a follow-up look at
  `askAboutRecommendation`'s empty-result phrasing or `EXPLAIN_SYSTEM_PROMPT`.
- **`app/chat/page.tsx`** (the general assistant) has the exact same
  `sendMessage({ text, body: {...} } as any)` pattern for
  `compactedSummary`/`summarizedUpTo`. Investigated and confirmed **dead
  code, not a live bug** — that page's real compaction mechanism sends
  `X-Compacted-*` via request headers (a separate, working code path), so
  the vestigial `body` field there is inert either way. Worth deleting for
  clarity in a future cleanup pass, but not urgent.

## Not done here (intentionally)

- No change to `askAboutRecommendation.ts`'s search logic itself — the
  fix is entirely about getting explain mode to activate and giving it
  structured context alongside the existing evidence tool, not about the
  evidence search's own behavior.
- The demo-profile picker path still has no profile-context injection
  (no persisted `profileVersionId` exists for it to look up) — matches its
  own stated purpose ("see how this page renders"), not the real user path.
