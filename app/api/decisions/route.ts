// Decision record API surface -- Package C. POST re-runs Package B's engine
// server-side against a profile version the caller already owns, rather
// than trusting a client-supplied recommendation result -- the engine
// output must come from the exact, structured pipeline, never from
// something a client could hand-edit before it's persisted. No login: see
// lib/anon-session.ts for how "user" is identified here.
import { z } from "zod";
import { resolveAnonUserId, withAnonCookie } from "@/lib/anon-session";
import { getProfileVersionById } from "@/lib/profile";
import { createDecisionRecord, getDecisionRecords, ProfileVersionOwnershipError } from "@/lib/decisions";
import { generateRecommendations } from "@/lib/engine";
import { getDeploymentSha, ENGINE_VERSION } from "@/lib/build-info";

const createDecisionSchema = z.object({
  profileVersionId: z.string().min(1),
});

export async function GET(req: Request) {
  const { userId, isNew } = await resolveAnonUserId(req);
  const records = await getDecisionRecords(userId);
  const response = Response.json({ decisionRecords: records });
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

  const parsed = createDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const profileVersion = await getProfileVersionById(userId, parsed.data.profileVersionId);
  if (!profileVersion) {
    return Response.json(
      { error: "Profile version not found for this user" },
      { status: 404 }
    );
  }

  const result = generateRecommendations(profileVersion.profile);
  const sha = getDeploymentSha();

  try {
    const stored = await createDecisionRecord({
      userId,
      profileVersionId: profileVersion.id,
      kbSha: sha,
      rulesetSha: sha,
      engineVersion: ENGINE_VERSION,
      result,
    });
    const response = Response.json({ decisionRecord: stored }, { status: 201 });
    return isNew ? withAnonCookie(response, userId) : response;
  } catch (err) {
    if (err instanceof ProfileVersionOwnershipError) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
