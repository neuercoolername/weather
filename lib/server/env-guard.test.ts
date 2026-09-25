import { describe, it, expect } from "vitest";
import {
  isLocalUrl,
  isLocalDatabase,
  assertNotProduction,
  type EnvTargets,
} from "@/lib/server/env-guard";

const LOCAL_DB = "postgresql://weather:weather@localhost:5433/weather";
const PROD_DB =
  "postgresql://user:pw@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const local: EnvTargets = { DATABASE_URL: LOCAL_DB, DIRECT_URL: LOCAL_DB };
const prod: EnvTargets = { DATABASE_URL: PROD_DB, DIRECT_URL: PROD_DB };

describe("isLocalUrl", () => {
  it.each([
    ["postgresql://u:p@localhost:5433/db", true],
    ["postgresql://u:p@127.0.0.1:5433/db", true],
    ["http://[::1]:54321", true],
    ["http://host.docker.internal:54321", true],
    [PROD_DB, false],
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
