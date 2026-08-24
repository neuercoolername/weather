import { describe, it, expect } from "vitest";
import {
  isLocalUrl,
  isLocalDatabase,
  isDevStorage,
  assertNotProduction,
  assertTargetsAgree,
  DEV_BUCKET,
  PROD_BUCKET,
  type EnvTargets,
} from "@/lib/server/env-guard";

const LOCAL_DB = "postgresql://weather:weather@localhost:5433/weather";
const PROD_DB =
  "postgresql://user:pw@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
// Both buckets live in the same project, so the URL is identical either way — the bucket name
// is the only thing separating development from production.
const SUPABASE_URL = "https://abcdefgh.supabase.co";

const local: EnvTargets = {
  DATABASE_URL: LOCAL_DB,
  DIRECT_URL: LOCAL_DB,
  SUPABASE_URL,
  SUPABASE_BUCKET: DEV_BUCKET,
};

const prod: EnvTargets = {
  DATABASE_URL: PROD_DB,
  DIRECT_URL: PROD_DB,
  SUPABASE_URL,
  SUPABASE_BUCKET: PROD_BUCKET,
};

describe("isLocalUrl", () => {
  it.each([
    ["postgresql://u:p@localhost:5433/db", true],
    ["postgresql://u:p@127.0.0.1:5433/db", true],
    ["http://[::1]:54321", true],
    ["http://host.docker.internal:54321", true],
    [PROD_DB, false],
    [SUPABASE_URL, false],
    // A hostname that merely contains "localhost" is not local.
    ["https://localhost.evil.example.com", false],
  ])("%s → %s", (url, expected) => {
    expect(isLocalUrl(url)).toBe(expected);
  });

  it("treats missing and unparseable values as remote", () => {
    expect(isLocalUrl(undefined)).toBe(false);
    expect(isLocalUrl("")).toBe(false);
    expect(isLocalUrl("not a url")).toBe(false);
  });
});

describe("isLocalDatabase", () => {
  it("requires both URLs to be local", () => {
    expect(isLocalDatabase(local)).toBe(true);
    expect(isLocalDatabase(prod)).toBe(false);
  });

  it("rejects a half-swapped pair in either direction", () => {
    expect(
      isLocalDatabase({ DATABASE_URL: LOCAL_DB, DIRECT_URL: PROD_DB })
    ).toBe(false);
    expect(
      isLocalDatabase({ DATABASE_URL: PROD_DB, DIRECT_URL: LOCAL_DB })
    ).toBe(false);
  });
});

describe("isDevStorage", () => {
  it("recognises only the development bucket", () => {
    expect(isDevStorage(local)).toBe(true);
    expect(isDevStorage(prod)).toBe(false);
  });

  it("treats an unset bucket as production, since that is what the default resolves to", () => {
    expect(isDevStorage({})).toBe(false);
  });
});

describe("assertNotProduction", () => {
  it("allows a local database", () => {
    expect(() => assertNotProduction("backfill", {}, local)).not.toThrow();
  });

  it("refuses a production database", () => {
    expect(() => assertNotProduction("backfill", {}, prod)).toThrow(
      /the database is not local/
    );
  });

  it("names the hosts so the message is actionable", () => {
    expect(() => assertNotProduction("backfill", {}, prod)).toThrow(
      /aws-1-eu-central-1\.pooler\.supabase\.com/
    );
  });

  it("unlocks production with ALLOW_PROD=1", () => {
    expect(() =>
      assertNotProduction("backfill", {}, { ...prod, ALLOW_PROD: "1" })
    ).not.toThrow();
  });

  it("ignores any other ALLOW_PROD value", () => {
    expect(() =>
      assertNotProduction("backfill", {}, { ...prod, ALLOW_PROD: "true" })
    ).toThrow();
  });

  it("cannot be unlocked when allowOverride is false", () => {
    expect(() =>
      assertNotProduction(
        "reset-trace",
        { allowOverride: false },
        { ...prod, ALLOW_PROD: "1" }
      )
    ).toThrow(/does not unlock it/);
  });
});

describe("assertTargetsAgree", () => {
  it("allows the local database with the development bucket", () => {
    expect(() => assertTargetsAgree("upload", local)).not.toThrow();
  });

  it("allows the production database with the production bucket", () => {
    expect(() => assertTargetsAgree("upload", prod)).not.toThrow();
  });

  it("refuses a local database paired with the production bucket", () => {
    expect(() =>
      assertTargetsAgree("upload", { ...local, SUPABASE_BUCKET: PROD_BUCKET })
    ).toThrow(/not a matching pair/);
  });

  it("refuses a production database paired with the development bucket", () => {
    expect(() =>
      assertTargetsAgree("upload", { ...prod, SUPABASE_BUCKET: DEV_BUCKET })
    ).toThrow(/not a matching pair/);
  });

  it("refuses a local database when the bucket is unset and defaults to production", () => {
    expect(() =>
      assertTargetsAgree("upload", { ...local, SUPABASE_BUCKET: undefined })
    ).toThrow(/not a matching pair/);
  });

  it("names both sides so the message says which pair was wrong", () => {
    expect(() =>
      assertTargetsAgree("upload", { ...local, SUPABASE_BUCKET: PROD_BUCKET })
    ).toThrow(/localhost:5433[\s\S]*intersection-images/);
  });
});
