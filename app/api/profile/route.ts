// Profile API surface -- Package C. Replaces Package D's stub of this same
// route (app/api/profile/route.ts on main before this commit) -- the
// response shape below is deliberately unchanged from that stub
// ({ profileVersionId }) since lib/intake/submit-profile.ts and
// intake-flow.tsx already destructure exactly that field; only the
// `profileVersion` field is new, additive. No login: see
// lib/anon-session.ts for how "user" is identified here.
import { resolveAnonUserId, withAnonCookie } from "@/lib/anon-session";
import { createProfileVersion, getCurrentProfileVersion } from "@/lib/profile";
import { userProfileSchema } from "@/types/engine";

export async function GET(req: Request) {
  const { userId, isNew } = await resolveAnonUserId(req);
  const current = await getCurrentProfileVersion(userId);
  const response = Response.json({ profileVersion: current });
  return isNew ? withAnonCookie(response, userId) : response;
}

export async function POST(req: Request) {
  const { userId, isNew } = await resolveAnonUserId(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = userProfileSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Invalid profile data", issues: result.error.issues },
      { status: 400 }
    );
  }

  // Always a new row -- never an update in place, per
  // data-layer-decisions-v2.md's profile-versioning decision.
  const stored = await createProfileVersion(userId, result.data);
  const response = Response.json(
    { profileVersionId: stored.id, profileVersion: stored },
    { status: 201 }
  );
  return isNew ? withAnonCookie(response, userId) : response;
}
