import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllIntersectionsWithImages,
  getIntersectionWithImages,
} from "@/lib/server/data/intersections";
import { getTracePoints } from "@/lib/server/data/trace-points";
import { getCurrentWind } from "@/lib/server/data/wind";
import { getCurrentTimeOfDay } from "@/lib/server/data/time-of-day";
import { beaufortForce, closestPhrase, randomPhrase } from "@/lib/domain/beaufort";
import { hasContent } from "@/lib/domain/intersection-content";
import { traceHeadline } from "@/lib/domain/trace-headline";
import { parseTraceSlug } from "@/lib/domain/trace-route";
import TraceSVG from "../TraceSVG";
import TimeOfDayBackdrop from "../TimeOfDayBackdrop";

export const dynamic = "force-dynamic";

const DESCRIPTION_LENGTH = 150;

// `/`, `/about` and `/12` are one route, so the client can move between them with
// history.pushState and never leave the page. Junk paths, and crossings with nothing to
// show, 404 here rather than open an empty panel.
//
// Shared by generateMetadata and the page: React's cache makes it one lookup per request.
const getNote = cache(async (id: number) => {
  const ix = await getIntersectionWithImages(id);
  return ix && hasContent(ix.text, ix.images.length) ? ix : null;
});

async function viewFor(params: PageProps<"/[[...slug]]">["params"]) {
  const view = parseTraceSlug((await params).slug);
  if (!view) notFound();
  if (view.kind === "note" && !(await getNote(view.id))) notFound();
  return view;
}

export async function generateMetadata(
  props: PageProps<"/[[...slug]]">
): Promise<Metadata> {
  const view = await viewFor(props.params);
  if (view.kind === "about") return { title: "Wind — About" };
  if (view.kind !== "note") return {};

  const ix = (await getNote(view.id))!;
  const title = `Wind — ${traceHeadline(ix, 0, "")}`;
  const text = ix.text?.trim().replace(/\s+/g, " ");
  const description =
    text && text.length > DESCRIPTION_LENGTH
      ? `${text.slice(0, DESCRIPTION_LENGTH - 1).trimEnd()}…`
      : text || undefined;
  // A signed URL, so it lapses after a day — previews are cached when the link is shared.
  const image = ix.images[0];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image?.signedUrl
        ? [{ url: image.signedUrl, width: image.width ?? undefined, height: image.height ?? undefined }]
        : undefined,
    },
  };
}

export default async function Home(props: PageProps<"/[[...slug]]">) {
  await viewFor(props.params);

  const [tracePoints, intersections, wind, timeOfDay] = await Promise.all([
    getTracePoints(),
    getAllIntersectionsWithImages(),
    getCurrentWind(),
    getCurrentTimeOfDay(),
  ]);

  if (tracePoints.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <TimeOfDayBackdrop look={timeOfDay} />
        <p className="text-lg text-zinc-500">No trace data yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-dvh">
      <TimeOfDayBackdrop look={timeOfDay} />
      <TraceSVG
        tracePoints={tracePoints}
        intersections={intersections}
        windField={wind.field}
        phrase={
          (wind.meanSpeed === null
            ? randomPhrase()
            : closestPhrase(beaufortForce(wind.meanSpeed))
          ).text
        }
      />
    </div>
  );
}
