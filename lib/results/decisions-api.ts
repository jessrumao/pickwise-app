// Client-side call to Package C's /api/decisions. The browser's anonymous
// `pw_uid` cookie rides along automatically on a same-origin fetch — no
// auth header, no session check needed (see lib/anon-session.ts).
import type { DecisionRecordPayload } from "@/lib/decision-mapping";

export async function createDecision(profileVersionId: string): Promise<DecisionRecordPayload> {
  const res = await fetch("/api/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileVersionId }),
  });
  if (!res.ok) {
    throw new Error("Could not generate recommendations for this profile. Please try again.");
  }
  const { decisionRecord } = (await res.json()) as { decisionRecord: DecisionRecordPayload };
  return decisionRecord;
}
