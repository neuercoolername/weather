// Browser history for the trace's panels — the "external system" a React effect connects
// to, in the same shape as trace-camera.ts. The path is the selection (`/12`, `/about`);
// this decides whether a change pushes, replaces or goes back, and remembers whether the
// open panel's entry is one it pushed.
//
// Written straight to the History API rather than through the router: a router navigation
// would re-run the server page — the whole trace and fresh image URLs — for what is only a
// change of panel. Next patches pushState/replaceState and keeps usePathname in step.
//
// Construction touches nothing, so it is safe to create during render; the popstate
// listener is only added by subscribe(), from an effect.

import { historyMode, traceHref, type TraceView } from "@/lib/domain/trace-route";

export interface TraceHistory {
  /** Move from `current` to `next`: push, replace, or close (see historyMode). */
  show(current: TraceView, next: TraceView): void;
  /** Listen for Back/Forward. Returns the unsubscribe. */
  subscribe(onPop: () => void): () => void;
}

export function createTraceHistory(): TraceHistory {
  // Whether the open panel's entry is one this page pushed. Closing then goes Back to the
  // entry before it; a panel reached by a shared link has no such entry, so it replaces.
  let pushed = false;

  return {
    show(current, next) {
      switch (historyMode(current, next)) {
        case "push":
          window.history.pushState(null, "", traceHref(next));
          pushed = true;
          return;
        case "replace":
          window.history.replaceState(null, "", traceHref(next));
          return;
        case "close":
          if (pushed) {
            pushed = false;
            window.history.back();
          } else {
            window.history.replaceState(null, "", traceHref(next));
          }
      }
    },

    subscribe(onPop) {
      // Back/Forward land on an entry this page didn't just push.
      const handler = () => {
        pushed = false;
        onPop();
      };
      window.addEventListener("popstate", handler);
      return () => window.removeEventListener("popstate", handler);
    },
  };
}
