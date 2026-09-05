import type { UserProfile } from "@/types/engine";
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

// Talks to Package C's profile API once it exists; today that's the stub at
// app/api/profile/route.ts. Swapping in the real implementation should not
// require changing any caller of this function.
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
