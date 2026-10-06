"use client";

import { memo, useEffect, useRef, type CSSProperties, type RefObject } from "react";
import type { AboutParams } from "@/lib/domain/about";

// The intersection panel's mirror: a sheet from the left, full-screen on mobile. It stays
// mounted so it can slide both ways; while closed it is inert, out of the tab order.
function AboutPanel({
  open,
  params,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  params: AboutParams;
  onClose: () => void;
  /** the button that opened the panel, which gets focus back when it closes */
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus goes to the panel itself, not the close button, so opening with a mouse draws no
  // focus ring; Tab still reaches the button.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const opener = returnFocusRef.current;
    panel?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (panel?.contains(document.activeElement)) opener?.focus();
    };
  }, [open, onClose, returnFocusRef]);

  // Two columns: the text at its measure, then the close button. On desktop the panel is
  // as wide as that grid; on mobile the text column takes whatever the screen leaves.
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="About"
      aria-hidden={!open}
      inert={!open}
      tabIndex={-1}
      className={`fixed z-20 inset-0 md:absolute md:right-auto md:w-max flex flex-col bg-white md:border-r border-zinc-200 outline-none transition-transform ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none ${open ? "translate-x-0" : "-translate-x-[101%]"}`}
      style={{ transitionDuration: `${params.slideMs}ms` }}
    >
      <div
        className="flex-1 overflow-y-auto p-6 grid content-start grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,var(--about-measure))_auto]"
        style={
          {
            // `ch` resolves against this font size, so the measure is in the copy's characters.
            fontSize: params.textPx,
            columnGap: params.closeGapPx,
            "--about-measure": `${params.measureCh}ch`,
          } as CSSProperties
        }
      >
        <div className="space-y-[1em] leading-relaxed">
          <p>This is a collection that grows on the wind’s schedule.</p>
          <p>
            A script records the wind wherever I am and traces its path over time. Whenever that
            path crosses itself, I add a note to the intersection.
          </p>
        </div>
        {/* The glyph's own box is the layout footprint, so the gap is exactly columnGap; the
            tap target is the transparent ::before around it. The button is one line of copy tall
            (same size and leading, height 1lh), so the ✕ centres on the text's first line. */}
        <button
          onClick={onClose}
          className="relative self-start h-[1lh] flex items-center leading-relaxed text-zinc-400 hover:text-zinc-900 rounded-sm outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-zinc-400 before:absolute before:-inset-4 before:content-['']"
          aria-label="Close"
        >
          <span className="text-xl leading-none">✕</span>
        </button>
      </div>
    </div>
  );
}

export default memo(AboutPanel);
