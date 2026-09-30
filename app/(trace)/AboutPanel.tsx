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
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const opener = returnFocusRef.current;
    closeRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (panel?.contains(document.activeElement)) opener?.focus();
    };
  }, [open, onClose, returnFocusRef]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="About"
      aria-hidden={!open}
      inert={!open}
      className={`fixed z-20 inset-0 md:absolute md:right-auto md:w-(--about-width) flex flex-col bg-white md:border-r border-zinc-200 transition-transform ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none ${open ? "translate-x-0" : "-translate-x-[101%]"}`}
      style={
        {
          "--about-width": `max(${params.panelMinWidth}px, ${params.panelWidthFraction * 100}vw)`,
          transitionDuration: `${params.slideMs}ms`,
        } as CSSProperties
      }
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500 font-mono tabular-nums">{meta}</p>
          <button
            ref={closeRef}
            onClick={onClose}
            className="w-12 h-12 shrink-0 flex items-center justify-center text-xl text-zinc-400 hover:text-zinc-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          className="space-y-[1em] leading-relaxed"
          style={{ fontSize: params.textPx, maxWidth: `${params.measureCh}ch` }}
        >
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
