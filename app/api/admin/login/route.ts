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

  if (password !== process.env.ADMIN_PASSWORD) {
    const next = req.nextUrl.searchParams.get("next") ?? "";
    const params = new URLSearchParams({ error: "1" });
    if (next) params.set("next", next);
    return redirectToPath(`/admin/login?${params}`);
  }

  resetRateLimit(ip);
  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();

  const next = safeNextPath(
    req.nextUrl.searchParams.get("next"),
    "/admin/intersections"
  );
  return redirectToPath(next);
}
