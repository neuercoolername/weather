import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAndStoreWeather } from "@/lib/weather";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.API_KEY}`;

    if (!authHeader || authHeader !== expectedToken) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { lat, lon, timestamp } = body;

    if (typeof lat !== "number" || typeof lon !== "number" || isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { status: "error", message: "Invalid or missing lat/lon. Both must be numbers." },
        { status: 400 }
      );
    }

    if (timestamp) {
      console.log(`[Location API] Received timestamp from device: ${timestamp}`);
    }

    const location = await prisma.location.create({
      data: { lat, lon },
    });

    try {
      await fetchAndStoreWeather(location.id, lat, lon);
    } catch (weatherError) {
      console.error("[Location API] Failed to fetch initial weather:", weatherError);
    }

    return NextResponse.json({
      status: "ok",
      locationId: location.id,
      message: "Location saved successfully",
    });
  } catch (error) {
    console.error("[Location API] Unexpected error:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to save location" },
      { status: 500 }
    );
  }
}
