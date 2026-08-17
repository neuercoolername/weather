import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSupabase, BUCKET } from "@/lib/server/supabase";

type Params = { params: Promise<{ id: string; imageId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { imageId } = await params;

  const image = await prisma.intersectionImage.findUnique({
    where: { id: imageId },
    select: { storageKey: true },
  });

  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: storageError } = await getSupabase().storage
    .from(BUCKET)
    .remove([image.storageKey]);

  if (storageError) {
    console.error("Supabase storage removal error:", storageError);
  }

  await prisma.intersectionImage.delete({ where: { id: imageId } });

  return new NextResponse(null, { status: 204 });
}
