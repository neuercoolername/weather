// What the public trace is showing, and the path that names it: `/` is the plain trace,
// `/about` the About panel, `/12` crossing #12. Pure, so the server page (which 404s on
// junk) and the client (which reads the live pathname) agree on one mapping.

export type TraceView =
  | { kind: "trace" }
  | { kind: "about" }
  | { kind: "note"; id: number };

const TRACE: TraceView = { kind: "trace" };

// Plain digits with no leading zero, so each crossing has exactly one path — `/012`,
// `/1e3` and `/12.0` are not aliases of anything.
const NOTE_ID = /^[1-9]\d*$/;

/** The catch-all route's segments; `null` means no such page. */
export function parseTraceSlug(slug: string[] | undefined): TraceView | null {
  if (!slug || slug.length === 0) return TRACE;
  if (slug.length > 1) return null;

  const [segment] = slug;
  if (segment === "about") return { kind: "about" };
  if (NOTE_ID.test(segment)) {
    const id = Number(segment);
    return Number.isSafeInteger(id) ? { kind: "note", id } : null;
  }
  return null;
}

/** The live pathname on the client, where anything unrecognised just means the plain trace. */
export function parseTracePath(pathname: string): TraceView {
  const slug = pathname.split("/").filter(Boolean);
  return parseTraceSlug(slug) ?? TRACE;
}

export function traceHref(view: TraceView): string {
  switch (view.kind) {
    case "trace":
      return "/";
    case "about":
      return "/about";
    case "note":
      return `/${view.id}`;
  }
}

export type HistoryMode = "push" | "replace" | "close";

/**
 * How moving from one view to another should touch history. Opening from the bare trace
 * pushes, so Back closes; moving between panels replaces, so Back never steps through every
 * crossing visited; going to the bare trace closes whatever is open.
 */
export function historyMode(current: TraceView, next: TraceView): HistoryMode {
  if (next.kind === "trace") return "close";
  return current.kind === "trace" ? "push" : "replace";
}
