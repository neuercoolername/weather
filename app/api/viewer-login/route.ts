import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { checkRateLimit, resetRateLimit } from "@/lib/server/auth/rate-limit";
import { redirectToPath, safeNextPath } from "@/lib/server/auth/redirect";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  if (!checkRateLimit(ip).allowed) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const formData = await req.formData();
  const password = formData.get("password");

  // An unset VIEWER_PASSWORD must not let a blank form through, so the gate refuses everyone
  // until it is configured rather than opening to everyone.
  const expected = process.env.VIEWER_PASSWORD;

  if (!expected || password !== expected) {
    const next = req.nextUrl.searchParams.get("next") ?? "";
    const params = new URLSearchParams({ error: "1" });
    if (next) params.set("next", next);
    return redirectToPath(`/viewer-login?${params}`);
  }

  resetRateLimit(ip);
  const session = await getSession();
  session.isViewer = true;
  await session.save();

  const next = safeNextPath(req.nextUrl.searchParams.get("next"), "/");
  return redirectToPath(next);
}
