import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

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
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("error", "1");
    if (next) loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  resetRateLimit(ip);
  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();

  const next =
    req.nextUrl.searchParams.get("next") ?? "/admin/intersections";
  return NextResponse.redirect(new URL(next, req.url), { status: 303 });
}
