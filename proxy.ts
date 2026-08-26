import { NextRequest, NextResponse } from "next/server";
import { unsealData } from "iron-session";
import { COOKIE_NAME, sessionOptions } from "@/lib/server/auth/session-config";
import type { SessionData } from "@/lib/server/auth/session";
import { sameOriginUrl } from "@/lib/server/auth/redirect";
import { accessFor } from "@/lib/domain/access";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req);

  switch (accessFor(session, pathname)) {
    case "allow":
      return NextResponse.next();
    case "unauthorized":
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    case "admin-login":
      return loginRedirect(req, "/admin/login", pathname);
    case "viewer-login":
      return loginRedirect(req, "/viewer-login", pathname);
  }
}

async function readSession(req: NextRequest): Promise<SessionData | null> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;

  try {
    return await unsealData<SessionData>(cookie, {
      password: sessionOptions.password as string,
    });
  } catch {
    // tampered or expired cookie — no different from having none
    return null;
  }
}

// Absolute URL from the Host headers, not req.url — see lib/server/auth/redirect.ts.
// 307 preserves the method if a non-GET request was the one blocked.
function loginRedirect(req: NextRequest, loginPath: string, from: string) {
  const loginUrl = sameOriginUrl(req, loginPath);
  loginUrl.searchParams.set("next", from);
  return NextResponse.redirect(loginUrl, 307);
}

// Listed explicitly rather than sweeping the site with exclusions, because a sweeping matcher
// would catch `/api/location` — the iOS app's cookie-less ingest endpoint. The cost is that a
// route absent from this list is not gated at all: `/` is the only public page today, so any
// second one has to be added here or it ships open. `accessFor` keeps `/api/location` open a
// second time in case that ever happens by matcher rather than by hand.
export const config = {
  matcher: ["/", "/admin/:path*", "/api/admin/:path*"],
};
