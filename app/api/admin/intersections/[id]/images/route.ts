import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSupabase, BUCKET } from "@/lib/server/supabase";
import { processUpload, IMAGE_CONFIG, ALLOWED_TYPES } from "@/lib/server/images";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const intersectionId = Number(id);

  if (!Number.isInteger(intersectionId)) {
    return NextResponse.json({ error: "Invalid intersection" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 }
    );
  }

  if (file.size > IMAGE_CONFIG.maxBytes) {
    return NextResponse.json(
      { error: "File too large (max 15MB)" },
      { status: 400 }
    );
  }

  // Check the row exists before writing to storage: the create below would otherwise fail
  // on the foreign key with the blob already uploaded and nothing left pointing at it.
  const exists = await prisma.intersection.findUnique({
    where: { id: intersectionId },
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ error: "Intersection not found" }, { status: 404 });
  }

  let processed;
  try {
    processed = await processUpload(
      Buffer.from(await file.arrayBuffer()),
      file.type
    );
  } catch (err) {
    console.error("Image processing error:", err);
    return NextResponse.json(
      { error: "Could not read that image" },
      { status: 400 }
    );
  }

  const storageKey = `intersections/${intersectionId}/${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await getSupabase()
    .storage.from(BUCKET)
    .upload(storageKey, processed.data, { contentType: "image/webp" });

  if (uploadError) {
    console.error("Supabase upload error:", uploadError);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  try {
    const image = await prisma.intersectionImage.create({
      data: {
        intersectionId,
        storageKey,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
      },
    });
    return NextResponse.json(image, { status: 201 });
  } catch (err) {
    // The row is what makes the blob reachable, so drop the blob if the row never lands
    // (the intersection can be deleted between the check above and this write).
    console.error("Image row creation failed:", err);
    await getSupabase().storage.from(BUCKET).remove([storageKey]);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
