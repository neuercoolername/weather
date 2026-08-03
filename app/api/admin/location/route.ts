import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lon } = body;

    if (typeof lat !== "number" || typeof lon !== "number" || isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { status: "error", message: "Invalid or missing lat/lon. Both must be numbers." },
        { status: 400 }
      );
    }

    const location = await prisma.location.create({
      data: { lat, lon },
    });

    return NextResponse.json({
      status: "ok",
      locationId: location.id,
      message: "Location saved successfully",
    });
  } catch (error) {
    console.error("[Admin Location API] Unexpected error:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to save location" },
      { status: 500 }
    );
  }
}
