import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Native/WASM image codecs must be required at runtime rather than bundled. Marking
  // them external also gets them traced into .next/standalone, which heic-convert
  // otherwise misses because it is behind a lazy import.
  serverExternalPackages: ["sharp", "heic-convert"],
};

export default nextConfig;
