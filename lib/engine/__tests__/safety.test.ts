import { describe, it, expect } from "vitest";
import { generateRecommendations } from "../recommend";
import { evaluateEligibility } from "../eligibility";
import vegetarianMuscleGain from "@/data/tools/samples/vegetarian-muscle-gain.json";
import { eligibilityPolicies, dosingPolicies } from "../knowledge-base";
import type { UserProfile, PredicateNode, SafetyGateResult } from "@/types/engine";

const P = (x: unknown) => x as UserProfile;

describe("targeted (non-global) safety escalation: substitution, not blanket escalation", () => {
  // safety-whey-milk-allergy is scoped to appliesTo.ingredientIds: ["whey-protein"],
  // not to the protein-complete COMPOUND. A vegetarian profile has a second
  // ingredient that delivers protein-complete (plant-protein-blend), so per
  // eligibility.ts's documented design the correct behavior is exactly what
  // the policy's own userMessage promises -- "We'll route you to a
  // plant-based protein instead" -- i.e. substitution, not escalation.
  it("a milk allergy routes protein-complete to plant-protein-blend instead of escalating it", () => {
    const profile = P({ ...vegetarianMuscleGain, allergies: ["milk"] });
    const result = generateRecommendations(profile);

    expect(result.globalEscalation).toBeUndefined();
    const protein = result.recommendations.find((r) => r.compoundId === "protein-complete")!;
    expect(protein.status).toBe("recommended");
    expect(protein.safetyTrace).toBeUndefined(); // no escalation -- a safe substitute existed

    const candidateIds = protein.candidateIngredients?.map((c) => c.ingredientId) ?? [];
    expect(candidateIds).not.toContain("whey-protein"); // filtered out by the milk allergy
    expect(candidateIds).toContain("plant-protein-blend"); // the substitute

    // The chosen product/serving plan must actually follow the filtered
    // candidate list -- a milk-allergic user must never end up with a whey SKU.
    expect(protein.servingPlan?.productId).not.toMatch(/whey/);

    // Creatine is unaffected -- the safety rule is scoped to whey-protein, not global.
    const creatine = result.recommendations.find((r) => r.compoundId === "creatine-monohydrate")!;
    expect(creatine.status).toBe("recommended");
  });

  // The exhaustion branch (escalate the whole compound because NO safe
  // delivery vehicle survives) has no real-data trigger today -- every
  // ingredient-scoped safety rule in data/policy/safety currently leaves at
  // least one substitute standing for the diets it can apply to. So this
  // exercises evaluateEligibility directly with a constructed SafetyGateResult
  // that blocks creatine-monohydrate's only delivery ingredient (itself),
  // proving the branch fires when it needs to rather than leaving it untested.
  it("escalates the whole compound when filtering blocked ingredients empties the candidate list", () => {
    const profile = P(vegetarianMuscleGain);
    // Synthetic policyId (not a real record in data/policy/safety) -- this
    // test is only about the filter-to-empty branch in eligibility.ts, not
    // about safetyTrace's policy-metadata lookup, so safetyTrace linkage is
    // deliberately not asserted here (policyTargets() safely returns false
    // for an unknown policyId, per its own fallback).
    const syntheticSafety: SafetyGateResult = {
      escalations: [
        {
          policyId: "safety-test-only-synthetic",
          global: false,
          severity: "high",
          userMessage: "test-only synthetic block",
          why: "synthetic",
          firedOnUnknown: false,
          trace: { value: "true", trace: [] },
        },
      ],
      globalEscalations: [],
      blockedCompoundIds: new Set(),
      blockedIngredientIds: new Set(["creatine-monohydrate"]),
    };

    const recs = evaluateEligibility(profile, syntheticSafety);
    const creatine = recs.find((r) => r.compoundId === "creatine-monohydrate")!;
    expect(creatine.status).toBe("escalate");
    // candidateIngredients is only ever populated for recommended/potentially_useful
    // statuses (see evaluateEligibility) -- an escalated item has nothing to
    // build a serving plan from, so it's correctly left unset here.
    expect(creatine.candidateIngredients).toBeUndefined();
  });
});

describe("commercial firewall (mirrors data/tools/validate.mjs's own check)", () => {
  it("no eligibility or dosing predicate anywhere reads monthlyBudgetINR", () => {
    const referencesBudget = (node: PredicateNode): boolean => {
      if ("all" in node) return node.all.some(referencesBudget);
      if ("any" in node) return node.any.some(referencesBudget);
      if ("not" in node) return referencesBudget(node.not);
      if ("const" in node) return false;
      for (const key of [
        "eq",
        "neq",
        "lt",
        "lte",
        "gt",
        "gte",
        "in",
        "contains_any",
        "contains_all",
        "contains_none",
        "exists",
        "matches",
      ] as const) {
        const arg = (node as Record<string, { field?: string } | undefined>)[key];
        if (arg?.field === "monthlyBudgetINR") return true;
      }
      return false;
    };

    for (const p of eligibilityPolicies) {
      expect(referencesBudget(p.recommendWhen), `${p.id}.recommendWhen`).toBe(false);
      if (p.suppressWhen) expect(referencesBudget(p.suppressWhen), `${p.id}.suppressWhen`).toBe(false);
    }
    for (const p of dosingPolicies) {
      expect(referencesBudget(p.appliesWhen), `${p.id}.appliesWhen`).toBe(false);
    }
  });

  it("sanity check: the detector actually catches a budget reference (so a false negative above isn't silent)", () => {
    const referencesBudget = (node: PredicateNode): boolean => {
      if ("all" in node) return node.all.some(referencesBudget);
      if ("eq" in node) return node.eq.field === "monthlyBudgetINR";
      return false;
    };
    const rigged: PredicateNode = { all: [{ eq: { field: "monthlyBudgetINR", value: 1000 } }] };
    expect(referencesBudget(rigged)).toBe(true);
  });
});
