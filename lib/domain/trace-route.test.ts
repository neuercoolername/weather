import { describe, it, expect } from "vitest";
import { parseTracePath, parseTraceSlug, traceHref, type TraceView } from "./trace-route";

describe("parseTraceSlug", () => {
  it("reads no segments as the plain trace", () => {
    expect(parseTraceSlug(undefined)).toEqual({ kind: "trace" });
    expect(parseTraceSlug([])).toEqual({ kind: "trace" });
  });

  it("reads /about and /12", () => {
    expect(parseTraceSlug(["about"])).toEqual({ kind: "about" });
    expect(parseTraceSlug(["12"])).toEqual({ kind: "note", id: 12 });
  });

  it("rejects anything that is not exactly one canonical id", () => {
    for (const slug of [["0"], ["-1"], ["012"], ["1e3"], ["12.0"], ["abc"], ["12", "x"]]) {
      expect(parseTraceSlug(slug)).toBeNull();
    }
  });

  it("rejects an id too large to be exact", () => {
    expect(parseTraceSlug(["99999999999999999999"])).toBeNull();
  });
});

describe("parseTracePath", () => {
  it("falls back to the plain trace for anything unrecognised", () => {
    expect(parseTracePath("/abc")).toEqual({ kind: "trace" });
    expect(parseTracePath("/12/x")).toEqual({ kind: "trace" });
  });

  it("ignores a trailing slash", () => {
    expect(parseTracePath("/12/")).toEqual({ kind: "note", id: 12 });
  });
});

describe("traceHref", () => {
  it("round-trips through parseTracePath", () => {
    const views: TraceView[] = [
      { kind: "trace" },
      { kind: "about" },
      { kind: "note", id: 12 },
    ];
    for (const view of views) {
      expect(parseTracePath(traceHref(view))).toEqual(view);
    }
  });
});
