import "server-only";

import { getSupabase, BUCKET, SIGNED_URL_EXPIRY } from "@/lib/server/supabase";

/**
 * Signed URLs for stored images, batched into one call and held across renders.
 *
 * Signing on every render would give the same image a different query string each time,
 * which changes the browser's cache key and forces a full re-download on every view.
 * Reusing a URL for half its validity keeps it stable, and still leaves ~12h of life on
 * one handed out at the last possible moment.
 */
const CACHE_TTL_MS = (SIGNED_URL_EXPIRY / 2) * 1000;

const cache = new Map<string, { url: string; cachedAt: number }>();

/** Exported for tests; the cache is module-level and would otherwise leak between them. */
export function clearSignedUrlCache(): void {
  cache.clear();
}

export async function signedUrlsFor(
  storageKeys: string[]
): Promise<Map<string, string>> {
  const now = Date.now();
  const resolved = new Map<string, string>();
  const misses: string[] = [];

  for (const key of new Set(storageKeys)) {
    const hit = cache.get(key);
    if (hit && now - hit.cachedAt < CACHE_TTL_MS) {
      resolved.set(key, hit.url);
    } else {
      misses.push(key);
    }
  }

  if (misses.length > 0) {
    const { data, error } = await getSupabase()
      .storage.from(BUCKET)
      .createSignedUrls(misses, SIGNED_URL_EXPIRY);

    if (error) {
      console.error("Supabase signing error:", error);
    }

    for (const entry of data ?? []) {
      // createSignedUrls reports per-item failures inline rather than throwing.
      if (!entry.signedUrl || !entry.path) continue;
      cache.set(entry.path, { url: entry.signedUrl, cachedAt: now });
      resolved.set(entry.path, entry.signedUrl);
    }
  }

  return resolved;
}
