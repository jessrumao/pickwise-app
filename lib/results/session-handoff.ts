// Package D -> Package E handoff. Package C's real persistence doesn't
// exist yet (app/api/profile/route.ts is still a stub that doesn't store
// anything retrievable), so the intake flow hands its assembled UserProfile
// to the results page via sessionStorage rather than a database round trip.
// Package C landing should make this obsolete: the results page would fetch
// by profileVersionId instead. Kept in one place so both sides agree on the
// key and never need a second one added elsewhere.
import { userProfileSchema, type UserProfile } from "@/types/engine";

const SESSION_KEY = "pw:lastProfile";

export function saveProfileForResults(profile: UserProfile) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  } catch {
    // sessionStorage unavailable (private browsing etc.) — the results page
    // will just fall back to the demo-profile picker, not a hard failure.
  }
}

export function loadProfileForResults(): UserProfile | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return undefined;
    const parsed = userProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
