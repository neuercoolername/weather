"use client";

import { useState } from "react";

export interface FrameConfig {
  /** Cross-fade duration from the empty frame to the loaded image, in ms. */
  fadeMs: number;
  /** Opacity of the hairline outline while the image is still in flight. */
  hairlineOpacity: number;
}

export const FRAME_CONFIG: FrameConfig = {
  fadeMs: 400,
  hairlineOpacity: 0.5,
};

interface Props {
  src: string;
  /** Intrinsic size of the stored image. Null for rows predating the resize pipeline. */
  width?: number | null;
  height?: number | null;
  alt?: string;
  className?: string;
  /** Classes for the space-reserving wrapper. Override to constrain it differently. */
  frameClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  /** The first image in a panel is the one being asked for; skip the lazy hint. */
  eager?: boolean;
  config?: FrameConfig;
}

/**
 * An image that occupies its final space before it has loaded.
 *
 * With the intrinsic size known, the frame reserves the exact aspect ratio up front, so
 * nothing below it shifts when the bytes land — and the wait reads as a drawn empty frame
 * rather than a gap. A hairline outline holds the space and fades out as the image fades
 * in. Without a recorded size there is nothing to reserve, so it degrades to a plain
 * fade-in.
 */
export default function ImageFrame({
  src,
  width,
  height,
  alt = "",
  className = "",
  frameClassName = "relative w-full",
  onClick,
  eager = false,
  config = FRAME_CONFIG,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Signed URLs rotate, so the same image id can arrive with a new src on a later render.
  // Without this the reused instance keeps the previous `loaded` and skips the fade.
  const [renderedSrc, setRenderedSrc] = useState(src);
  if (src !== renderedSrc) {
    setRenderedSrc(src);
    setLoaded(false);
    setFailed(false);
  }

  const ratio = width && height ? `${width} / ${height}` : undefined;

  return (
    <div
      className={frameClassName}
      style={{ aspectRatio: ratio }}
      onClick={onClick}
    >
      {/* Sits behind the image and fades out as it arrives, so the outline never
          double-draws over the loaded photo. */}
      <div
        aria-hidden={!failed}
        className="absolute inset-0 border border-zinc-300 pointer-events-none flex items-center justify-center"
        style={{
          opacity: loaded ? 0 : config.hairlineOpacity,
          transition: `opacity ${config.fadeMs}ms ease-out`,
        }}
      >
        {/* Without this a failed image is invisible: alt is empty by design, so the
            frame would otherwise sit at full opacity forever with nothing in it. */}
        {failed && (
          <span className="text-xs text-zinc-400 font-mono">image unavailable</span>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- images are already
          downscaled to a bounded WebP by lib/server/images.ts */}
      <img
        src={src}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        loading={eager ? undefined : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        // A cached image can complete before React attaches onLoad; catch that on mount.
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) setLoaded(true);
        }}
        // With a ratio the frame reserves the box and the image fills it; without one
        // (rows predating the backfill) the image sets its own height instead.
        className={`w-full ${ratio ? "h-full" : "h-auto"} ${className}`}
        style={{
          opacity: loaded ? 1 : 0,
          transition: `opacity ${config.fadeMs}ms ease-out`,
        }}
      />
    </div>
  );
}
