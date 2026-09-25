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

export interface EnvTargets {
  DATABASE_URL?: string;
  DIRECT_URL?: string;
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

function hostOf(url: string | undefined): string {
  if (!url) return "unset";
  try {
    return new URL(url).host;
  } catch {
    return "unparseable";
  }
}

export function describeTargets(env: EnvTargets = currentEnv()): string {
  return `  database: ${hostOf(env.DATABASE_URL)} (direct: ${hostOf(env.DIRECT_URL)})`;
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
