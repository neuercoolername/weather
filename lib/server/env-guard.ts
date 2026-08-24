import "server-only";

/**
 * Refuses to let writing code run against production by accident.
 *
 * Env-file precedence differs across Next, the Prisma CLI and `tsx`, so nothing here trusts
 * *which* file was loaded — every check reads the resolved value and inspects its host. Anything
 * missing or unparseable counts as production: being refused locally is an annoyance, the
 * reverse is a deleted photo.
 */

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "host.docker.internal",
]);

/** Escape hatch for the one caller allowed to write to production: the dispatch workflow. */
const OVERRIDE = "ALLOW_PROD";

/**
 * The two buckets, by name. Both live in the same Supabase project, so the project URL cannot tell
 * them apart — the name is the only signal, which is why the pairing rule below keys on it rather
 * than on the host.
 *
 * Deliberately constants and not environment variables. `SUPABASE_BUCKET` says which bucket to
 * use; these say which one is which. Reading both from the environment would let a caller declare
 * whatever it is already using to be the development bucket, and the check would certify itself.
 */
export const DEV_BUCKET = "intersection-images-dev";
export const PROD_BUCKET = "intersection-images";

export interface EnvTargets {
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_BUCKET?: string;
  ALLOW_PROD?: string;
}

/** `next typegen` narrows NodeJS.ProcessEnv to declared keys, so it needs widening once here. */
function currentEnv(): EnvTargets {
  return process.env as EnvTargets;
}

export function isLocalUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    // IPv6 hostnames come back bracketed; the set stores them bare.
    const { hostname } = new URL(url);
    return LOCAL_HOSTNAMES.has(hostname.replace(/^\[|\]$/g, ""));
  } catch {
    return false;
  }
}

/** Both URLs must be local — a half-swapped pair is the failure this exists to catch. */
export function isLocalDatabase(env: EnvTargets = currentEnv()): boolean {
  return isLocalUrl(env.DATABASE_URL) && isLocalUrl(env.DIRECT_URL);
}

/** Anything that is not explicitly the development bucket counts as production. */
export function isDevStorage(env: EnvTargets = currentEnv()): boolean {
  return env.SUPABASE_BUCKET === DEV_BUCKET;
}

function hostOf(url: string | undefined): string {
  if (!url) return "unset";
  try {
    return new URL(url).host;
  } catch {
    return "unparseable";
  }
}

export function describeTargets(env: EnvTargets = currentEnv()): string {
  return (
    `  database: ${hostOf(env.DATABASE_URL)} (direct: ${hostOf(env.DIRECT_URL)})\n` +
    `  storage:  ${hostOf(env.SUPABASE_URL)} bucket "${env.SUPABASE_BUCKET || PROD_BUCKET}"`
  );
}

/**
 * Refuse unless the database is local. `allowOverride: false` makes that absolute — used by
 * `reset-trace`, which has no legitimate production use at all.
 */
export function assertNotProduction(
  action: string,
  { allowOverride = true }: { allowOverride?: boolean } = {},
  env: EnvTargets = currentEnv()
): void {
  if (isLocalDatabase(env)) return;

  if (allowOverride && env[OVERRIDE] === "1") return;

  throw new Error(
    `Refusing to run "${action}" — the database is not local.\n` +
      `${describeTargets(env)}\n\n` +
      (allowOverride
        ? `Run it against the local database, or dispatch the "Run production script" ` +
          `workflow, which is the only place ${OVERRIDE}=1 is set.`
        : `This command deletes hand-written content and has no production path. ` +
          `${OVERRIDE} does not unlock it.`)
  );
}

/**
 * Refuse when the database and the bucket are not a matching pair: the local database goes with
 * the development bucket, the production database with the production bucket.
 *
 * Rows and blobs are two halves of one record, so a local database paired with the production
 * bucket lets a run read a small local row set and delete the real objects behind it. Reads are
 * unaffected — only call this before writing.
 */
export function targetsDisagree(
  action: string,
  env: EnvTargets = currentEnv()
): string | null {
  if (isLocalDatabase(env) === isDevStorage(env)) return null;

  return (
    `Refusing to run "${action}" — the database and the bucket are not a matching pair.\n` +
    `${describeTargets(env)}\n\n` +
    `A local database goes with the "${DEV_BUCKET}" bucket, and the production database with the ` +
    `production bucket. Writes would otherwise apply to one environment while reading the other.`
  );
}

/** Throwing form for scripts; route handlers use `targetsDisagree` and answer with a status. */
export function assertTargetsAgree(
  action: string,
  env: EnvTargets = currentEnv()
): void {
  const conflict = targetsDisagree(action, env);
  if (conflict) throw new Error(conflict);
}
