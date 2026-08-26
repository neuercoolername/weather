import type { MetadataRoute } from "next";

/**
 * Disallow every crawler.
 *
 * This stops new crawling but cannot remove a URL already in an index: a blocked crawler never
 * fetches the page, so it never sees a `noindex`. The `X-Robots-Tag` header in `next.config.ts`
 * is the half that de-lists, which is why both exist.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
