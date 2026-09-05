// Anonymous, cookie-based identity -- no login, no email, no verification
// step. The first time a browser hits an endpoint that needs one, the
// server creates a `users` row and stores its id in a long-lived httpOnly
// cookie; every later request from that browser reuses it.
//
// This is NOT a verified identity -- anyone holding the cookie value can
// act as that "user". Acceptable for a class project with no sensitive PII
// beyond a supplement profile, and it's what makes "come back and see your
// history" work without a login screen. Revisit before this handles
// anything that needs real authentication or has to survive a user
// switching devices/browsers.
import { getPool } from "@/lib/db";

export const ANON_COOKIE_NAME = "pw_uid";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export interface AnonSession {
  userId: string;
  isNew: boolean;
}

// Reads the anon cookie off the request; if missing, or if it points at a
// row that no longer exists, mints a fresh users row instead. Returns
// isNew so the caller knows to set the cookie on its response.
export async function resolveAnonUserId(req: Request): Promise<AnonSession> {
  const existingId = parseCookie(req.headers.get("cookie"), ANON_COOKIE_NAME);

  if (existingId) {
    const { rows } = await getPool().query("select id from users where id = $1", [existingId]);
    if (rows.length > 0) {
      return { userId: existingId, isNew: false };
    }
  }

  const { rows } = await getPool().query("insert into users default values returning id");
  return { userId: rows[0].id, isNew: true };
}

export function withAnonCookie(response: Response, userId: string): Response {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${ANON_COOKIE_NAME}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secure}`
  );
  return response;
}
