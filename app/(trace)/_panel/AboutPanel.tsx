"use client";

import { memo, useEffect, useRef, type CSSProperties, type RefObject } from "react";
import type { AboutParams } from "@/lib/domain/about";

// The intersection panel's mirror: a sheet from the left, full-screen on mobile. It stays
// mounted so it can slide both ways; while closed it is inert, out of the tab order.
function AboutPanel({
  open,
  meta,
  params,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  meta: string;
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
        className="flex-1 overflow-y-auto p-6 grid content-start items-center gap-y-6 grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,var(--about-measure))_auto]"
        style={
          {
            // `ch` resolves against this font size, so the measure is in the copy's characters.
            fontSize: params.textPx,
            columnGap: params.closeGapPx,
            "--about-measure": `${params.measureCh}ch`,
          } as CSSProperties
        }
      >
        <p className="text-xs text-zinc-500 font-mono tabular-nums">{meta}</p>
        {/* The glyph's own box is the layout footprint, so the gap is exactly columnGap; the
            tap target is the transparent ::before around it. The button is one meta line tall
            (same text-xs, height 1lh), so the ✕ centres on the meta's first line even when the
            meta wraps. */}
        <button
          onClick={onClose}
          className="relative self-start h-[1lh] flex items-center text-xs text-zinc-400 hover:text-zinc-900 rounded-sm outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-zinc-400 before:absolute before:-inset-4 before:content-['']"
          aria-label="Close"
        >
          <span className="text-xl leading-none">✕</span>
        </button>

        <div className="col-start-1 space-y-[1em] leading-relaxed">
          <p>
            A script takes an hourly wind reading for wherever I am and draws its path over time: direction sets which way the line goes, speed sets how far.
          </p>
          <p>
            Where the line crosses itself, two moments, hours or days apart, meet at one point.
            Each crossing is circled, and a language model writes a haiku from those two readings. Click a circle to read it.</p>
        </div>
      </div>
    </div>
  );
}

export default memo(AboutPanel);
