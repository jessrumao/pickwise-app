// Package G — routine builder. Per data-layer-decisions-v2.md, there are
// three distinct things: amount (Package B, policy x bodyweight), serving
// plan (Package B, arithmetic + rounding), and routine — fitting that into
// someone's actual day. This is the ONE place in the whole product the LLM
// is allowed to write free text, and it's only safe because that text is
// fenced by the evidence-backed timing constraint the dosing policy
// actually declares (types/engine.ts's DosingTiming, literally commented
// "THE FENCE"). This module builds that fence into the prompt — the LLM
// never sees anything it could use to invent a constraint the policy
// doesn't have, and where the constraint is "any", it's explicitly told not
// to improvise a specific time even though that's common gym folklore
// (see e.g. dose-creatine-maintenance.json's and dose-caffeine.json's own
// notes, which exist specifically to stop that).
import type { DosingTiming, ServingPlan, TimingConstraint } from "@/types/engine";

const CONSTRAINT_INSTRUCTIONS: Record<TimingConstraint, string> = {
  any: "No specific time of day is required — it does not matter when in the day this is taken.",
  with_food: "Must be taken WITH a meal (ideally one containing some fat, for absorption).",
  empty_stomach: "Must be taken on an EMPTY stomach.",
  post_exercise_2h: "Should be taken within about 2 hours after exercise.",
  evening: "Should be taken in the evening.",
  morning: "Should be taken in the morning.",
};

export interface RoutineInput {
  compoundName: string;
  timing: DosingTiming;
  servingPlan?: Pick<ServingPlan, "servings" | "delivered" | "unit">;
  scheduleContext?: {
    exerciseFrequencyPerWeek?: number;
    sleepHoursTypical?: number;
  };
}

export function buildRoutinePrompt(input: RoutineInput): { system: string; prompt: string } {
  const { compoundName, timing, servingPlan, scheduleContext } = input;

  const hasSeparation = !!timing.separateFromCompoundIds && timing.separateFromCompoundIds.length > 0;
  const separationLine = hasSeparation
    ? `It MUST be taken separately from: ${timing.separateFromCompoundIds!.join(", ")}` +
      (timing.separationHours ? `, by at least ${timing.separationHours} hour(s).` : ".")
    : "There is no requirement to separate this from anything else — do not invent one.";

  const system = [
    "You write ONE short, practical routine instruction (1-2 sentences, plain language) for when",
    "and how to take a supplement. This is the ONLY place in this product where you write free",
    "text — every recommendation, dose, and safety decision around it was already computed by",
    "rules before you were called; you are not deciding any of that, only phrasing a schedule.",
    "",
    "Hard rules, never break these:",
    `1. Timing requirement, from the actual dosing policy: ${CONSTRAINT_INSTRUCTIONS[timing.constraint]}`,
    `2. Separation requirement, from the actual dosing policy: ${separationLine}`,
    "3. Do not invent any timing detail beyond rules 1 and 2. If rule 1 says no specific time is",
    "   required, do NOT suggest one anyway (e.g. do not say \"before your workout\" or \"first",
    "   thing in the morning\") even though that's common gym folklore — say something generic",
    "   like \"take it at a time that's easy to remember and stick with\" instead.",
    "4. Make no medical claim, and do not mention anything not given to you below.",
    "5. Output plain text only — no markdown, no lists, no headings.",
  ].join("\n");

  const promptLines = [
    `Supplement: ${compoundName}`,
    servingPlan
      ? `Amount: ${servingPlan.servings} serving(s) (${servingPlan.delivered}${servingPlan.unit}) per day.`
      : "Amount: follow the product label (not numerically resolved for this item).",
  ];
  if (timing.note) {
    promptLines.push(
      `Background note from the dosing policy (context only — it does not add a new rule beyond 1 and 2 above): ${timing.note}`
    );
  }
  if (scheduleContext?.exerciseFrequencyPerWeek != null) {
    promptLines.push(`This person exercises ${scheduleContext.exerciseFrequencyPerWeek} day(s) a week.`);
  }
  if (scheduleContext?.sleepHoursTypical != null) {
    promptLines.push(`This person typically sleeps ${scheduleContext.sleepHoursTypical} hours a night.`);
  }
  promptLines.push("Write the routine instruction now.");

  return { system, prompt: promptLines.join("\n") };
}
