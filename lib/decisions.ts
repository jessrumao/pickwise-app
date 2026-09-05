// Decision record persistence -- Package C. Immutable once written: three
// pins (one profile_version row, two git SHAs) plus the trace/recommendation/
// budget the engine actually produced, per data-layer-decisions-v2.md.
import { getPool } from "@/lib/db";
import type { RecommendationResult } from "@/lib/engine";
import { buildDecisionRecordPayload } from "@/lib/decision-mapping";

export interface CreateDecisionRecordInput {
  userId: string;
  profileVersionId: string;
  kbSha: string;
  rulesetSha: string;
  engineVersion: string;
  result: RecommendationResult;
}

export interface StoredDecisionRecord {
  id: string;
  userId: string;
  profileVersionId: string;
  createdAt: Date;
  kbSha: string;
  rulesetSha: string;
  engineVersion: string;
  trace: unknown;
  recommendation: unknown;
  budgetOutcome: unknown;
  escalations: unknown;
}

interface DecisionRecordRow {
  id: string;
  user_id: string;
  profile_version_id: string;
  created_at: Date;
  kb_sha: string;
  ruleset_sha: string;
  engine_version: string;
  trace: unknown;
  recommendation: unknown;
  budget_outcome: unknown;
  escalations: unknown;
}

function rowToDecisionRecord(row: DecisionRecordRow): StoredDecisionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    profileVersionId: row.profile_version_id,
    createdAt: row.created_at,
    kbSha: row.kb_sha,
    rulesetSha: row.ruleset_sha,
    engineVersion: row.engine_version,
    trace: row.trace,
    recommendation: row.recommendation,
    budgetOutcome: row.budget_outcome,
    escalations: row.escalations,
  };
}

export class ProfileVersionOwnershipError extends Error {
  constructor(profileVersionId: string) {
    super(
      `profile_version_id ${profileVersionId} does not exist or does not belong to this user`
    );
    this.name = "ProfileVersionOwnershipError";
  }
}

// The `where exists (...)` clause is the application-code enforcement that
// data/db/schema.sql's decision_profile_same_user constraint note calls
// for: a decision record must never point at a profile belonging to a
// different user. Checked atomically as part of the insert rather than as a
// separate read-then-write (which would race).
export async function createDecisionRecord(
  input: CreateDecisionRecordInput
): Promise<StoredDecisionRecord> {
  const { trace, recommendation, budgetOutcome, escalations } = buildDecisionRecordPayload(
    input.result
  );
  const { rows } = await getPool().query<DecisionRecordRow>(
    `insert into decision_records
       (user_id, profile_version_id, kb_sha, ruleset_sha, engine_version, trace, recommendation, budget_outcome, escalations)
     select $1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb
     where exists (
       select 1 from profile_versions where id = $2::uuid and user_id = $1::uuid
     )
     returning *`,
    [
      input.userId,
      input.profileVersionId,
      input.kbSha,
      input.rulesetSha,
      input.engineVersion,
      JSON.stringify(trace),
      JSON.stringify(recommendation),
      budgetOutcome ? JSON.stringify(budgetOutcome) : null,
      JSON.stringify(escalations),
    ]
  );
  if (rows.length === 0) {
    throw new ProfileVersionOwnershipError(input.profileVersionId);
  }
  return rowToDecisionRecord(rows[0]);
}

export async function getDecisionRecords(userId: string): Promise<StoredDecisionRecord[]> {
  const { rows } = await getPool().query<DecisionRecordRow>(
    `select * from decision_records where user_id = $1 order by created_at desc`,
    [userId]
  );
  return rows.map(rowToDecisionRecord);
}
