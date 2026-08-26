// Who may reach which path. Pure, so the rules are testable without a request: `proxy.ts` is
// only the shell that reads the cookie and turns these verdicts into responses.

export type Access = "allow" | "viewer-login" | "admin-login" | "unauthorized";

/** Structural, so `lib/domain` never has to reach into the server-only session module. */
export interface AccessSession {
  isLoggedIn?: boolean;
  isViewer?: boolean;
}

/**
 * Paths that carry their own auth or grant it, and so must never sit behind the cookie gate.
 *
 * `/api/location` is the load-bearing one: the iOS app authenticates with a `Bearer $API_KEY`
 * header and holds no cookie, so gating it stops GPS ingest — and with it the trace — silently.
 * The others would lock out the only way to obtain a session.
 */
const ALWAYS_OPEN = new Set([
  "/api/location",
  "/viewer-login",
  "/api/viewer-login",
  "/admin/login",
  "/api/admin/login",
]);

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * The verdict for one request. Admin implies viewer, never the reverse: an admin session reaches
 * the public trace, a viewer session is turned away from `/admin`.
 */
export function accessFor(session: AccessSession | null, pathname: string): Access {
  if (ALWAYS_OPEN.has(pathname)) return "allow";

  const isAdmin = session?.isLoggedIn === true;

  // JSON, not a redirect — these are fetched by code that cannot follow one to a login form.
  if (isUnder(pathname, "/api/admin")) return isAdmin ? "allow" : "unauthorized";
  if (isUnder(pathname, "/admin")) return isAdmin ? "allow" : "admin-login";

  return isAdmin || session?.isViewer === true ? "allow" : "viewer-login";
}
