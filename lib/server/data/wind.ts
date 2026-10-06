import "server-only";

// Data-access: load recent weather snapshots and adapt them into the domain
// WindField that drives the flow-field headline. Keeps Prisma + rawJson shaping
// out of the presentation layer and out of the pure `lib/domain/wind-field`.

import { prisma } from "@/lib/server/prisma";
import {
  computeWindField,
  meanWindSpeed,
  type WindField,
  type WindReading,
} from "@/lib/domain/wind-field";

interface RawCurrent {
  wind_gusts_10m?: number;
  wind_direction_10m?: number;
}

export interface CurrentWind {
  /** flow-field parameters (null if no snapshots, or every hour was calm) */
  field: WindField | null;
  /** mean wind speed, km/h, calm hours included (null only if no snapshots) */
  meanSpeed: number | null;
}

/** The current wind, derived from the last 24 hourly snapshots. */
export async function getCurrentWind(): Promise<CurrentWind> {
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

  return { field: computeWindField(series), meanSpeed: meanWindSpeed(series) };
}
