import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { text } = await req.json();

  const intersection = await prisma.intersection.update({
    where: { id: Number(id) },
    // Trim on write so whitespace-only text can't land in the gap between the two
    // content checks: SQL sees "   " as text (not in the admin queue), while
    // hasContent() trims it away (hidden on the trace).
    data: { text: typeof text === "string" ? text.trim() || null : null },
    select: { id: true, text: true },
  });

  return NextResponse.json(intersection);
}
