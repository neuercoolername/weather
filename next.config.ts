import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Native/WASM image codecs must be required at runtime rather than bundled. Marking
  // them external also gets them traced into .next/standalone, which heic-convert
  // otherwise misses because it is behind a lazy import.
  serverExternalPackages: ["sharp", "heic-convert"],

  // Applies to every response, not just HTML, so signed image URLs and API JSON carry it too.
  // Pairs with `app/robots.ts` — see the note there on why neither is sufficient alone.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
        ],
      },
    ];
  },
};

export default nextConfig;
