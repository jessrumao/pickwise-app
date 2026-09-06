// Tests the fence itself, not LLM output (which is nondeterministic prose
// a unit test can't verify — see app/api/routine/route.ts's own note).
// Verified against the REAL dosing policies in data/, not hand-built
// fixtures, so a policy author changing a constraint is exactly what would
// break this if the prompt logic drifted.
//
// buildRoutinePrompt takes an ARRAY of items (2026-09-07: routine is now
// built for the whole basket in one call, not per card) — most cases here
// exercise it with a single-item array, since the fence logic itself is
// per-item regardless of how many items share the call.
import { describe, expect, it } from "vitest";
import { buildRoutinePrompt } from "@/lib/routine/build-routine-prompt";
import { dosingPolicies } from "@/lib/engine/knowledge-base";
import type { DosingPolicy } from "@/types/engine";

function timingFor(compoundId: string): DosingPolicy["timing"] {
  const policy = dosingPolicies.find((p) => p.compoundId === compoundId);
  if (!policy) throw new Error(`no dosing policy for ${compoundId}`);
  return policy.timing;
}

describe("buildRoutinePrompt: the fence", () => {
  it("constraint 'any' explicitly forbids inventing a specific time (creatine — the folklore case)", () => {
    const { system } = buildRoutinePrompt([
      { compoundName: "Creatine monohydrate", timing: timingFor("creatine-monohydrate") },
    ]);
    expect(system).toContain("No specific time of day is required");
    expect(system).toContain("do NOT suggest one anyway");
    expect(system).toContain("before your workout");
  });

  it("constraint 'with_food' states the requirement plainly (omega-3)", () => {
    const { system } = buildRoutinePrompt([
      { compoundName: "Combined EPA + DHA", timing: timingFor("epa-dha") },
    ]);
    expect(system).toContain("Must be taken WITH a meal");
  });

  it("constraint 'evening' states the requirement plainly (magnesium)", () => {
    const { system } = buildRoutinePrompt([
      { compoundName: "Magnesium", timing: timingFor("magnesium") },
    ]);
    expect(system).toContain("Should be taken in the evening");
  });

  it("no policy today declares a hard separation, and the prompt says so explicitly rather than staying silent", () => {
    for (const policy of dosingPolicies) {
      const { system } = buildRoutinePrompt([{ compoundName: policy.compoundId ?? "?", timing: policy.timing }]);
      expect(system).toContain("do not invent one");
    }
  });

  it("a hypothetical hard separation (e.g. a future standalone-iron policy) is stated as a real rule, with hours if given", () => {
    const { system } = buildRoutinePrompt([
      {
        compoundName: "Iron",
        timing: {
          constraint: "any",
          separateFromCompoundIds: ["calcium"],
          separationHours: 2,
          note: "",
        },
      },
    ]);
    expect(system).toContain("MUST be taken separately from: calcium");
    expect(system).toContain("at least 2 hour(s)");
  });

  it("includes the serving amount when a servingPlan is given, and says so plainly when it isn't", () => {
    const withPlan = buildRoutinePrompt([
      {
        compoundName: "Complete dietary protein",
        timing: timingFor("protein-complete"),
        servingPlan: { servings: 1.5, delivered: 36, unit: "g" },
      },
    ]);
    expect(withPlan.prompt).toContain("1.5 serving(s) (36g) per day");

    const withoutPlan = buildRoutinePrompt([
      { compoundName: "Multivitamin / multimineral", timing: timingFor("multivitamin") },
    ]);
    expect(withoutPlan.prompt).toContain("follow the product label");
  });

  it("carries the policy's own note as context, never as an additional rule", () => {
    const { prompt } = buildRoutinePrompt([
      { compoundName: "Creatine monohydrate", timing: timingFor("creatine-monohydrate") },
    ]);
    expect(prompt).toContain("BECAUSE it is folklore");
  });

  it("combines multiple items into one prompt, each keeping its own fence, and asks for one coherent plan", () => {
    const { system, prompt } = buildRoutinePrompt([
      { compoundName: "Complete dietary protein", timing: timingFor("protein-complete"), servingPlan: { servings: 1.5, delivered: 36, unit: "g" } },
      { compoundName: "Creatine monohydrate", timing: timingFor("creatine-monohydrate") },
      { compoundName: "Combined EPA + DHA", timing: timingFor("epa-dha") },
    ]);
    // Every item's own fence is present.
    expect(system).toContain("No specific time of day is required");
    expect(system).toContain("Must be taken WITH a meal");
    // Asks for one combined plan, not per-item instructions.
    expect(system).toContain("EVERY item below TOGETHER");
    expect(system).toContain("Group items naturally by time of day");
    // Every item's amount/name reaches the prompt.
    expect(prompt).toContain("Supplement: Complete dietary protein");
    expect(prompt).toContain("Supplement: Creatine monohydrate");
    expect(prompt).toContain("Supplement: Combined EPA + DHA");
    expect(prompt).toContain("Write the combined daily routine now.");
  });

  it("a single-item basket keeps the original singular phrasing", () => {
    const { system, prompt } = buildRoutinePrompt([
      { compoundName: "Creatine monohydrate", timing: timingFor("creatine-monohydrate") },
    ]);
    expect(system).toContain("You write ONE short, practical routine instruction");
    expect(prompt).toContain("Write the routine instruction now.");
  });
});
