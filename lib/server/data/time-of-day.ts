import "server-only";

// Data-access: resolve the tracked location's real current time-of-day look. The bucket comes
// from the *live* local time at the location, not the timestamp of the last hourly fetch and not
// the viewer's clock — Open-Meteo is called with `timezone=auto` (see weather-ingest.ts), so the
// latest snapshot's rawJson already carries the location's IANA timezone.

import { prisma } from "@/lib/server/prisma";
import { resolveTimeOfDay, type TimeOfDayLook } from "@/lib/domain/time-of-day";

interface RawRoot {
  timezone?: string;
}

/** The current time-of-day look at the tracked location (null if there's no snapshot yet). */
export async function getCurrentTimeOfDay(): Promise<TimeOfDayLook | null> {
  const latest = await prisma.weatherSnapshot.findFirst({
    orderBy: { fetchedAt: "desc" },
    select: { rawJson: true },
  });

  const timezone = (latest?.rawJson as RawRoot | null)?.timezone;
  if (!timezone) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  // hour12:false can report midnight as "24" in some engines — fold back into 0-23.
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);

  return resolveTimeOfDay(hour + minute / 60);
}
