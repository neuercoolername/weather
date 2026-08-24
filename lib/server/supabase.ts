import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { PROD_BUCKET } from "@/lib/server/env-guard";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}

/**
 * Development uses a second bucket in the same project, so uploads can be exercised locally
 * without writing anywhere production reads from. Defaulting to the production name rather than
 * requiring the variable keeps the deployed container working without a coordinated env change;
 * `lib/server/env-guard.ts` is what enforces that the bucket matches the database.
 */
/**
 * A function rather than a constant so the environment is read at call time, the way
 * `getSupabase` already does. Scripts pick `.env` up only as a side effect of importing
 * `@prisma/client`, so a module-scope constant would resolve against whatever was set before that
 * import happened to be evaluated — and quietly fall back to the production bucket when it lost
 * the race.
 *
 * `||` rather than `??`: a blank `SUPABASE_BUCKET=` line is a plausible way to write "unset", and
 * an empty bucket name would fail every storage call while reading as "not the dev bucket" to the
 * guard.
 */
export function bucket(): string {
  return process.env.SUPABASE_BUCKET || PROD_BUCKET;
}

export const SIGNED_URL_EXPIRY = 86400;
