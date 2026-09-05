// kb_sha / ruleset_sha pin for decision_records. data/ and lib/engine/ ship
// in the same deploy in this repo, so one commit SHA pins both -- per
// data-layer-decisions-v2.md: "kb_sha/ruleset_sha should be the git SHA of
// the data/ directory state at decision time."
export function getDeploymentSha(): string {
  // Vercel sets this automatically on every deployment. Falls back to a
  // clearly-labelled placeholder for local dev, where it isn't set.
  return process.env.VERCEL_GIT_COMMIT_SHA ?? "local-dev";
}

export const ENGINE_VERSION = "1.0.0";
