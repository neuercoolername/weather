import { describe, it, expect, afterEach } from "vitest";
import { bucket } from "./supabase";
import { DEV_BUCKET, PROD_BUCKET } from "./env-guard";

const original = process.env.SUPABASE_BUCKET;

afterEach(() => {
  if (original === undefined) delete process.env.SUPABASE_BUCKET;
  else process.env.SUPABASE_BUCKET = original;
});

describe("bucket", () => {
  it("uses SUPABASE_BUCKET when it names one", () => {
    process.env.SUPABASE_BUCKET = DEV_BUCKET;
    expect(bucket()).toBe(DEV_BUCKET);
  });

  it("falls back to production when unset", () => {
    delete process.env.SUPABASE_BUCKET;
    expect(bucket()).toBe(PROD_BUCKET);
  });

  // `??` would hand an empty string straight through, which fails every storage call while
  // reading as "not the dev bucket" to the guard — a production pairing by accident.
  it("falls back to production when set but blank", () => {
    process.env.SUPABASE_BUCKET = "";
    expect(bucket()).toBe(PROD_BUCKET);
  });

  it("reads the environment at call time, not at import", () => {
    process.env.SUPABASE_BUCKET = DEV_BUCKET;
    expect(bucket()).toBe(DEV_BUCKET);
    process.env.SUPABASE_BUCKET = PROD_BUCKET;
    expect(bucket()).toBe(PROD_BUCKET);
  });
});
