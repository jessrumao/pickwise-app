// Package G — routine builder. Per data-layer-decisions-v2.md, there are
// three distinct things: amount (Package B, policy x bodyweight), serving
// plan (Package B, arithmetic + rounding), and routine — fitting that into
// someone's actual day. This is the ONE place in the whole product the LLM
// is allowed to write free text, and it's only safe because that text is
// fenced by the evidence-backed timing constraint each dosing policy
// actually declares (types/engine.ts's DosingTiming, literally commented
// "THE FENCE"). This module builds that fence into the prompt — the LLM
// never sees anything it could use to invent a constraint the policy
// doesn't have, and where a constraint is "any", it's explicitly told not
// to improvise a specific time even though that's common gym folklore
// (see e.g. dose-creatine-maintenance.json's and dose-caffeine.json's own
// notes, which exist specifically to stop that).
//
// CHANGED 2026-09-07, product decision: routine is now built for the whole
// FUNDED BASKET in one call, not per recommendation card — a person doesn't
// take one supplement in isolation, they fit several into one day, and
// cross-item separation rules (timing.separateFromCompoundIds) only mean
// anything relative to what else is actually in the basket. Every item still
// carries its own fence into the combined prompt; the model must respect
// all of them at once, never relax one because another item is also present.
import type { DosingTiming, ServingPlan, TimingConstraint } from "@/types/engine";

const CONSTRAINT_INSTRUCTIONS: Record<TimingConstraint, string> = {
  any: "No specific time of day is required — it does not matter when in the day this is taken.",
  with_food: "Must be taken WITH a meal (ideally one containing some fat, for absorption).",
  empty_stomach: "Must be taken on an EMPTY stomach.",
  post_exercise_2h: "Should be taken within about 2 hours after exercise.",
  evening: "Should be taken in the evening.",
  morning: "Should be taken in the morning.",
};

export interface RoutineItemInput {
  compoundName: string;
  timing: DosingTiming;
  servingPlan?: Pick<ServingPlan, "servings" | "delivered" | "unit">;
}

export interface RoutineScheduleContext {
  exerciseFrequencyPerWeek?: number;
  sleepHoursTypical?: number;
}

function separationLineFor(timing: DosingTiming): string {
  const hasSeparation = !!timing.separateFromCompoundIds && timing.separateFromCompoundIds.length > 0;
  return hasSeparation
    ? `It MUST be taken separately from: ${timing.separateFromCompoundIds!.join(", ")}` +
        (timing.separationHours ? `, by at least ${timing.separationHours} hour(s).` : ".")
    : "There is no requirement to separate this from anything else — do not invent one.";
}

export function buildRoutinePrompt(
  items: RoutineItemInput[],
  scheduleContext?: RoutineScheduleContext
): { system: string; prompt: string } {
  const rules: string[] = [];
  let ruleNumber = 1;
  for (const item of items) {
    rules.push(
      `${ruleNumber}. ${item.compoundName} — timing requirement from the actual dosing policy: ` +
        `${CONSTRAINT_INSTRUCTIONS[item.timing.constraint]} ${separationLineFor(item.timing)}`
    );
    ruleNumber += 1;
  }

  const system = [
    items.length > 1
      ? "You write ONE short, practical daily routine (a few sentences, plain language) describing when and"
      : "You write ONE short, practical routine instruction (1-2 sentences, plain language) for when"
        + " and how to take a supplement.",
    items.length > 1
      ? "how to take EVERY item below TOGETHER, organized by time of day (e.g. morning, with a meal,"
      : "",
    items.length > 1 ? "post-workout, evening) so it reads as one coherent daily plan, not separate instructions." : "",
    "This is the ONLY place in this product where you write free",
    "text — every recommendation, dose, and safety decision around it was already computed by",
    "rules before you were called; you are not deciding any of that, only phrasing a schedule.",
    "",
    "Hard rules, never break these:",
    ...rules,
    `${ruleNumber}. Do not invent any timing detail beyond the requirements stated above. Where a rule says no`,
    "   specific time is required, do NOT suggest one anyway (e.g. do not say \"before your workout\" or",
    "   \"first thing in the morning\") even though that's common gym folklore — say something generic",
    "   like \"take it at a time that's easy to remember and stick with\" instead.",
    `${ruleNumber + 1}. Make no medical claim, and do not mention anything not given to you below.`,
    `${ruleNumber + 2}. Output plain text only — no markdown, no lists, no headings.` +
      (items.length > 1 ? " Group items naturally by time of day rather than repeating \"item: instruction\" for each one." : ""),
  ]
    .filter(Boolean)
    .join("\n");

  const promptLines: string[] = [];
  for (const item of items) {
    promptLines.push(`Supplement: ${item.compoundName}`);
    promptLines.push(
      item.servingPlan
        ? `Amount: ${item.servingPlan.servings} serving(s) (${item.servingPlan.delivered}${item.servingPlan.unit}) per day.`
        : "Amount: follow the product label (not numerically resolved for this item)."
    );
    if (item.timing.note) {
      promptLines.push(
        `Background note from the dosing policy (context only — it does not add a new rule beyond what's stated above): ${item.timing.note}`
      );
    }
    promptLines.push("");
  }
  if (scheduleContext?.exerciseFrequencyPerWeek != null) {
    promptLines.push(`This person exercises ${scheduleContext.exerciseFrequencyPerWeek} day(s) a week.`);
  }
  if (scheduleContext?.sleepHoursTypical != null) {
    promptLines.push(`This person typically sleeps ${scheduleContext.sleepHoursTypical} hours a night.`);
  }
  promptLines.push(items.length > 1 ? "Write the combined daily routine now." : "Write the routine instruction now.");

  return { system, prompt: promptLines.join("\n") };
}
