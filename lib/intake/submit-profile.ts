import type { DietaryPattern, UserProfile } from "@/types/engine";
import type { ParsedFreeText } from "@/lib/intake/assemble-profile";

export async function parseFreeText(input: {
  existingSupplementUseText: string;
  allergiesText: string;
  medicationsHasAny: boolean;
  medicationsFreeText: string;
}): Promise<ParsedFreeText> {
  const res = await fetch("/api/intake/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("Could not process your free-text answers. Please try again.");
  }
  return res.json();
}

// Only called when the user says they don't know their daily protein
// intake and describes what they eat instead — never on the default
// slider path. Returns a rough estimate + confidence; the caller still
// shows it on the same adjustable slider rather than trusting it silently.
export async function estimateProteinFromDescription(input: {
  dietaryPattern: DietaryPattern;
  bodyWeightKg: number;
  foodDescription: string;
}): Promise<{ estimatedDailyProteinG: number; confidence: number }> {
  const res = await fetch("/api/intake/estimate-protein", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("Could not estimate from that description. Please try again.");
  }
  return res.json();
}

// Package C's real /api/profile — see docs/status/c-auth-persistence-status.md.
export async function submitProfile(
  profile: UserProfile
): Promise<{ profileVersionId: string }> {
  const res = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    throw new Error("Could not submit your profile. Please try again.");
  }
  return res.json();
}
