import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getWeatherEmoji } from "@/lib/wmo-codes";

export const dynamic = "force-dynamic";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const snapshot = await prisma.weatherSnapshot.findFirst({
    orderBy: { fetchedAt: "desc" },
    select: { weathercode: true, isDay: true },
  });

  const emoji = snapshot
    ? getWeatherEmoji(snapshot.weathercode, snapshot.isDay)
    : "🌡️";

  return new ImageResponse(
    <div
      style={{
        fontSize: 28,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {emoji}
    </div>,
    size
  );
}
