// STUB for Package C (auth & persistence), which owns the real
// `profile_versions` table (see data/db/schema.sql). Package D needs
// somewhere to submit to now, so this validates the shape and hands back a
// fake version id without persisting anything. Package C should replace this
// handler's body with a real insert — the client contract (POST a
// UserProfile, get back { profileVersionId }) should not need to change.
import { userProfileSchema } from "@/types/engine";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON in request body.", 400);
  }

  const parsed = userProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Profile does not match the expected shape.", 400);
  }

  console.warn(
    "TODO(Package C): /api/profile is a stub — this profile was validated but not persisted."
  );

  return Response.json({
    profileVersionId: `stub-${crypto.randomUUID()}`,
  });
}
