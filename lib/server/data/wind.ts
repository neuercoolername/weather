import "server-only";

// Data-access: load recent weather snapshots and adapt them into the domain
// WindField that drives the flow-field headline. Keeps Prisma + rawJson shaping
// out of the presentation layer and out of the pure `lib/domain/wind-field`.

import { prisma } from "@/lib/server/prisma";
import {
  computeWindField,
  type WindField,
  type WindReading,
} from "@/lib/domain/wind-field";

interface RawCurrent {
  wind_gusts_10m?: number;
  wind_direction_10m?: number;
}

/** The current wind field, derived from the last 24 hourly snapshots (null if none). */
export async function getCurrentWindField(): Promise<WindField | null> {
  const rows = await prisma.weatherSnapshot.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 24,
    select: { windspeed: true, rawJson: true },
  });

  const series: WindReading[] = rows.map((s) => {
    const cur = (s.rawJson as { current?: RawCurrent } | null)?.current;
    return {
      spd: s.windspeed,
      gust: cur?.wind_gusts_10m ?? s.windspeed,
      dir: cur?.wind_direction_10m ?? 0,
    };
  });

  return computeWindField(series);
}
