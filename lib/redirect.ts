import { NextResponse } from "next/server";

/**
 * Why this file exists: never build a redirect URL from `req.url`.
 *
 * In a standalone build Next derives the origin of `req.url` (and of `req.nextUrl`)
 * from the address the server *binds* to — `0.0.0.0` in our Docker image — and ignores
 * the Host header the reverse proxy sends. That produced admin redirects to
 * http://0.0.0.0:3000/admin/... in production.
 */

/** Just enough of NextRequest to compute an origin — keeps this unit-testable. */
type RequestLike = { headers: Headers; url: string };

/**
 * Redirect to a same-origin path via a relative Location header, which the browser
 * resolves against the URL it is actually on. Correct in dev, in Docker, and behind a
 * reverse proxy, with no trust assumptions about forwarded headers.
 *
 * Route handlers only. Next's middleware pipeline parses Location as an absolute URL
 * and throws ERR_INVALID_URL on a relative one — middleware must use `sameOriginUrl`.
 */
export function redirectToPath(path: string, status: 303 | 307 = 303) {
  return new NextResponse(null, { status, headers: { Location: path } });
}

/**
 * Absolute same-origin URL built from the forwarded/Host headers, for the one place
 * that needs an absolute URL: middleware. Trusts the reverse proxy's Host header,
 * which is standard for a redirect back to our own login page.
 */
export function sameOriginUrl(req: RequestLike, path: string): URL {
  const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  // Chained proxies may send a comma-separated list; the first entry is the client-facing one.
  const host = forwardedHost?.split(",")[0].trim();
  if (!host) return new URL(path, req.url);

  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host) ? "http" : "https");

  return new URL(path, `${proto}://${host}`);
}

/** Constrain a user-supplied ?next= to a same-origin path; otherwise fall back. */
export function safeNextPath(next: string | null, fallback: string): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
