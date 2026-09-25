import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

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
