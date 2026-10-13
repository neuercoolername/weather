"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { parseTracePath, type TraceView } from "@/lib/domain/trace-route";
import { createTraceHistory } from "./trace-history";

/**
 * The trace's current view, read from the path, and the two ways to change it.
 * `onPop` runs after Back/Forward, with the view landed on.
 */
export function useTraceNavigation(onPop: (view: TraceView) => void) {
  const pathname = usePathname();
  // Keyed on the string, so handlers built from it stay stable across zoom frames.
  const view = useMemo(() => parseTracePath(pathname), [pathname]);
  const [history] = useState(createTraceHistory);

  const handlePop = useEffectEvent(() => onPop(parseTracePath(window.location.pathname)));
  useEffect(() => history.subscribe(() => handlePop()), [history]);

  const show = useCallback((next: TraceView) => history.show(view, next), [history, view]);
  const close = useCallback(() => history.show(view, { kind: "trace" }), [history, view]);

  return { view, show, close };
}
