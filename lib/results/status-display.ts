// Package E — single place for RecommendationStatus -> UI label/copy, per
// the instruction in types/engine.ts (keep the machine status -> display
// string mapping in one place rather than duplicating it across cards).
import type { RecommendationStatus } from "@/types/engine";

export type StatusTone = "positive" | "informative" | "calm" | "escalate";

export interface StatusDisplay {
  label: string;
  tone: StatusTone;
  // Shown under the label so a suppressed/escalated item still reads as a
  // considered, deliberate outcome rather than an error or an omission.
  framing: string;
}

export const STATUS_DISPLAY: Record<
  Exclude<RecommendationStatus, "not_shown">,
  StatusDisplay
> = {
  recommended: {
    label: "Recommended",
    tone: "positive",
    framing: "Evidence and your profile both support this.",
  },
  potentially_useful: {
    label: "Potentially useful",
    tone: "informative",
    framing: "Your profile fits, but the evidence behind it is limited.",
  },
  not_needed: {
    label: "Not needed",
    tone: "calm",
    framing: "We looked at this for you — it's not indicated here.",
  },
  already_covered: {
    label: "Already covered",
    tone: "calm",
    framing: "You're already covering this, so we won't double up.",
  },
  escalate: {
    label: "Talk to a doctor first",
    tone: "escalate",
    framing: "This isn't a no — it just needs a clinician's judgment, not ours.",
  },
};

// Tailwind classes layered onto the shadcn Badge's "outline" variant.
// Deliberately no red/destructive anywhere: per the brief, escalate must read
// as a legitimate outcome, not an error.
export const TONE_BADGE_CLASSES: Record<StatusTone, string> = {
  positive: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
  informative: "border-sky-600/40 text-sky-700 dark:text-sky-400",
  calm: "border-muted-foreground/30 text-muted-foreground",
  escalate: "border-amber-600/40 text-amber-700 dark:text-amber-400",
};

export function statusDisplay(status: RecommendationStatus): StatusDisplay | undefined {
  if (status === "not_shown") return undefined;
  return STATUS_DISPLAY[status];
}
