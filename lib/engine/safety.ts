// lib/engine/safety.ts
//
// The safety gate: runs FIRST, over every policy/safety/*.json record,
// before any eligibility rule. Includes the global unparseable-medications
// and global pregnancy escalations, which must fire on their own before
// eligibility even starts (data/tools/demo.mjs's unparseable-medications
// sample is the reference case: parseConfidence < 0.8 escalates globally,
// it never falls through to "no contraindication found").

import type { UserProfile, SafetyEscalation, SafetyGateResult } from "@/types/engine";
import { TRUE, UNKNOWN } from "@/types/engine";
import { safetyPolicies } from "./knowledge-base";
import { run, explain } from "./predicate";

export function evaluateSafetyGate(profile: UserProfile): SafetyGateResult {
  const escalations: SafetyEscalation[] = [];

  for (const policy of safetyPolicies) {
    const trace = run(policy.trigger, profile);
    const firedOnUnknown = trace.value === UNKNOWN && policy.onUnknown === "true";
    if (trace.value === TRUE || firedOnUnknown) {
      escalations.push({
        policyId: policy.id,
        global: !!policy.appliesTo.all,
        severity: policy.severity,
        userMessage: policy.userMessage,
        why: explain(trace),
        firedOnUnknown,
        trace,
      });
    }
  }

  const globalEscalations = escalations.filter((e) => e.global);

  const blockedCompoundIds = new Set<string>();
  const blockedIngredientIds = new Set<string>();
  for (const e of escalations) {
    const policy = safetyPolicies.find((p) => p.id === e.policyId);
    for (const c of policy?.appliesTo.compoundIds ?? []) blockedCompoundIds.add(c);
    for (const i of policy?.appliesTo.ingredientIds ?? []) blockedIngredientIds.add(i);
  }

  return { escalations, globalEscalations, blockedCompoundIds, blockedIngredientIds };
}
