import { NextRequest, NextResponse } from "next/server";
import { unsealData } from "iron-session";
import { COOKIE_NAME, sessionOptions } from "@/lib/session-config";
import type { SessionData } from "@/lib/session";
import { sameOriginUrl } from "@/lib/redirect";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;

  if (cookie) {
    try {
      const session = await unsealData<SessionData>(cookie, {
        password: sessionOptions.password as string,
      });
      if (session.isLoggedIn) return NextResponse.next();
    } catch {
      // tampered or expired cookie — fall through
    }
  }

  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Absolute URL from the Host headers, not req.url — see lib/redirect.ts.
  // 307 preserves the method if a non-GET request was the one blocked.
  const loginUrl = sameOriginUrl(req, "/admin/login");
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl, 307);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
