// Profile persistence -- Package C. Every write is a new profile_versions
// row, never an update in place (data-layer-decisions-v2.md: this is what
// makes a decision record reproducible against the exact profile that
// produced it).
import { getPool } from "@/lib/db";
import type { UserProfile } from "@/types/engine";
import {
  rowToProfile,
  profileToInsertParams,
  PROFILE_INSERT_COLUMNS,
  type ProfileVersionRow,
} from "@/lib/profile-mapping";

export interface StoredProfileVersion {
  id: string;
  userId: string;
  createdAt: Date;
  profile: UserProfile;
}

type FullProfileVersionRow = ProfileVersionRow & { id: string; user_id: string };

function rowToStoredProfileVersion(row: FullProfileVersionRow): StoredProfileVersion {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    profile: rowToProfile(row),
  };
}

export async function createProfileVersion(
  userId: string,
  profile: UserProfile
): Promise<StoredProfileVersion> {
  const params = profileToInsertParams(profile, userId);
  const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await getPool().query<FullProfileVersionRow>(
    `insert into profile_versions (${PROFILE_INSERT_COLUMNS.join(", ")})
     values (${placeholders})
     returning *`,
    params
  );
  return rowToStoredProfileVersion(rows[0]);
}

// "Current profile" = latest row for that user_id (data-layer-decisions-v2.md).
export async function getCurrentProfileVersion(
  userId: string
): Promise<StoredProfileVersion | null> {
  const { rows } = await getPool().query<FullProfileVersionRow>(
    `select * from profile_versions where user_id = $1 order by created_at desc limit 1`,
    [userId]
  );
  return rows[0] ? rowToStoredProfileVersion(rows[0]) : null;
}

export async function getProfileVersionById(
  userId: string,
  profileVersionId: string
): Promise<StoredProfileVersion | null> {
  const { rows } = await getPool().query<FullProfileVersionRow>(
    `select * from profile_versions where id = $1 and user_id = $2`,
    [profileVersionId, userId]
  );
  return rows[0] ? rowToStoredProfileVersion(rows[0]) : null;
}
