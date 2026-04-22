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
    data: { text: typeof text === "string" ? text : null },
    select: { id: true, text: true },
  });

  return NextResponse.json(intersection);
}
