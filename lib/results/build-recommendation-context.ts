// Formats a verified UserProfile + RecommendationResult into a compact text
// block the explain-mode chat (app/api/chat/route.ts) injects directly into
// the system prompt. Fixes a real gap: the chat previously only had a
// semantic-search tool over evidence text (ask-about-recommendation.ts) and
// no structured knowledge of what was actually recommended or who the user
// is — so a question like "why was this recommended for ME" or "what's in
// my profile" had nothing to answer from. This is built server-side from
// the user's own OWNED, database-verified profile (see route.ts's
// getProfileVersionById ownership check) — never from client-supplied
// profile data, so a chat message can't be used to spoof a different
// profile than the one that actually produced these recommendations.
//
// Deliberately plain text, not JSON — this is read by the model as prose
// context, not parsed by code, so it's optimized for that.
import { knowledgeBase, type RecommendationResult } from "@/lib/engine";
import { getProductDisplay } from "@/lib/results/product-lookup";
import { statusDisplay } from "@/lib/results/status-display";
import type { Recommendation, UserProfile } from "@/types/engine";

function itemName(rec: Recommendation): string {
  if (rec.compoundId) return knowledgeBase.compoundById.get(rec.compoundId)?.name ?? rec.compoundId;
  if (rec.ingredientId) return knowledgeBase.ingredientById.get(rec.ingredientId)?.name ?? rec.ingredientId;
  return "Unknown item";
}

function formatProfile(profile: UserProfile): string {
  const lines: string[] = [];
  lines.push(`Age: ${profile.age}`);
  if (profile.sex !== "prefer_not_to_say") lines.push(`Sex: ${profile.sex}`);
  lines.push(`Body weight: ${profile.bodyWeightKg}kg`);
  if (profile.heightCm != null) lines.push(`Height: ${profile.heightCm}cm`);
  lines.push(`Diet: ${profile.dietaryPattern}`);
  lines.push(`Exercise: ${profile.exerciseFrequencyPerWeek} day(s)/week` +
    (profile.exerciseType?.length ? `, ${profile.exerciseType.join(", ")}` : "") +
    (profile.exerciseIntensityTypical ? `, typically ${profile.exerciseIntensityTypical} intensity` : ""));
  lines.push(`Goals: ${profile.primaryGoals.join(", ")}`);
  lines.push(
    profile.monthlyBudgetINR != null
      ? `Monthly supplement budget: ₹${profile.monthlyBudgetINR}${profile.budgetIsHardConstraint ? " (hard limit)" : " (soft, some overage OK)"}`
      : "Monthly supplement budget: no limit set"
  );
  lines.push(`Sleep: ${profile.sleepHoursTypical} hours/night`);
  lines.push(
    `Existing supplement use: ${profile.existingSupplementUse.length > 0 ? profile.existingSupplementUse.join(", ") : "none"}`
  );
  if (profile.estimatedDailyProteinG != null) {
    lines.push(`Estimated daily protein from food: ${profile.estimatedDailyProteinG}g`);
  }
  lines.push(`Allergies: ${profile.allergies.length > 0 ? profile.allergies.join(", ") : "none reported"}`);
  if (profile.relevantHealthContext) {
    lines.push(`Other health context they shared: ${profile.relevantHealthContext}`);
  }
  lines.push(
    `Medications/conditions flagged: ${profile.medicationsOrConditionsFlag.hasAny ? profile.medicationsOrConditionsFlag.freeText || "yes, unspecified" : "no"}`
  );
  return lines.join("\n");
}

function formatRecommendation(rec: Recommendation): string {
  const display = statusDisplay(rec.status);
  if (!display) return ""; // not_shown — engine deliberately didn't surface this
  const parts: string[] = [`${itemName(rec)} — ${display.label}: ${rec.why}`];
  if (rec.servingPlan) {
    const product = getProductDisplay(rec.servingPlan.productId);
    parts.push(
      `  Dose: ${rec.servingPlan.servings} serving(s) (${rec.servingPlan.delivered}${rec.servingPlan.unit}) per day` +
        (rec.servingPlan.flooredUpToMinEffective ? " (rounded up to the minimum effective dose)" : "")
    );
    if (product) {
      parts.push(
        `  Product: ${product.brand} — ${product.productName}` +
          (product.priceINR != null ? ` (₹${product.priceINR})` : "")
      );
    }
  }
  return parts.join("\n");
}

export function buildRecommendationContext(
  profile: UserProfile,
  result: RecommendationResult
): string {
  if (result.globalEscalation) {
    return [
      "USER PROFILE:",
      formatProfile(profile),
      "",
      "RECOMMENDATION OUTCOME:",
      `No automated recommendations were produced — a global safety escalation fired: ${result.globalEscalation.userMessage}`,
    ].join("\n");
  }

  const recLines = result.recommendations
    .map(formatRecommendation)
    .filter((s) => s.length > 0);

  const sections = [
    "USER PROFILE:",
    formatProfile(profile),
    "",
    "RECOMMENDATIONS (produced by the deterministic rules engine, not by you):",
    recLines.length > 0 ? recLines.join("\n\n") : "(none)",
  ];

  if (result.budget) {
    sections.push("", "BUDGET:");
    sections.push(
      result.budget.budgetINR != null
        ? `Limit: ₹${result.budget.budgetINR}/month`
        : "No budget limit set"
    );
    sections.push(`Funded this month: ₹${result.budget.totalFundedCostINR}`);
    if (result.budget.deferred.length > 0) {
      sections.push(
        `Deferred (would exceed budget): ${result.budget.deferred
          .map((d) => itemName(d.recommendation))
          .join(", ")}`
      );
    }
  }

  return sections.join("\n");
}
