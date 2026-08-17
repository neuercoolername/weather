import { describe, it, expect } from "vitest";
import { redirectToPath, sameOriginUrl, safeNextPath } from "./redirect";

/** A request whose url has the bogus bind-address origin Next hands us in Docker. */
function req(headers: Record<string, string>, url = "http://0.0.0.0:3000/admin/intersections") {
  return { headers: new Headers(headers), url };
}

describe("redirectToPath", () => {
  it("sets a relative Location header", () => {
    const res = redirectToPath("/admin/login");
    expect(res.headers.get("location")).toBe("/admin/login");
  });

  // Regression pin: an absolute Location was built from req.url, whose origin Next
  // derives from the bind address — producing http://0.0.0.0:3000/admin/... in prod.
  it("never emits an absolute URL", () => {
    for (const path of ["/admin/login", "/admin/intersections", "/admin/login?error=1"]) {
      expect(redirectToPath(path).headers.get("location")).not.toContain("://");
    }
  });

  it("defaults to 303 and honours an explicit status", () => {
    expect(redirectToPath("/admin/login").status).toBe(303);
    expect(redirectToPath("/admin/login", 307).status).toBe(307);
  });

  it("preserves the query string", () => {
    const res = redirectToPath("/admin/login?error=1&next=%2Fadmin%2Fintersections");
    expect(res.headers.get("location")).toBe(
      "/admin/login?error=1&next=%2Fadmin%2Fintersections"
    );
  });
});

describe("sameOriginUrl", () => {
  // Regression pin: the origin must come from the headers, never from req.url.
  it("ignores the bind-address origin of req.url", () => {
    const url = sameOriginUrl(
      req({ host: "weather.davidamberg.work", "x-forwarded-proto": "https" }),
      "/admin/login"
    );
    expect(url.href).toBe("https://weather.davidamberg.work/admin/login");
    expect(url.href).not.toContain("0.0.0.0");
  });

  it("prefers x-forwarded-host over host", () => {
    const url = sameOriginUrl(
      req({
        host: "internal:3000",
        "x-forwarded-host": "weather.davidamberg.work",
        "x-forwarded-proto": "https",
      }),
      "/admin/login"
    );
    expect(url.origin).toBe("https://weather.davidamberg.work");
  });

  it("takes the first entry when a proxy chain sends a list", () => {
    const url = sameOriginUrl(
      req({
        "x-forwarded-host": "weather.davidamberg.work, internal:3000",
        "x-forwarded-proto": "https, http",
      }),
      "/admin/login"
    );
    expect(url.origin).toBe("https://weather.davidamberg.work");
  });

  it("assumes http for loopback hosts when no proto is forwarded", () => {
    expect(sameOriginUrl(req({ host: "localhost:3000" }), "/admin/login").origin).toBe(
      "http://localhost:3000"
    );
    expect(sameOriginUrl(req({ host: "127.0.0.1:3000" }), "/admin/login").origin).toBe(
      "http://127.0.0.1:3000"
    );
  });

  it("assumes https for a real host when no proto is forwarded", () => {
    expect(
      sameOriginUrl(req({ host: "weather.davidamberg.work" }), "/admin/login").origin
    ).toBe("https://weather.davidamberg.work");
  });

  it("falls back to req.url when no host header exists at all", () => {
    expect(sameOriginUrl(req({}), "/admin/login").pathname).toBe("/admin/login");
  });

  it("returns a URL whose query params can be set", () => {
    const url = sameOriginUrl(req({ host: "localhost:3000" }), "/admin/login");
    url.searchParams.set("next", "/admin/intersections");
    expect(url.href).toBe(
      "http://localhost:3000/admin/login?next=%2Fadmin%2Fintersections"
    );
  });
});

describe("safeNextPath", () => {
  it("keeps a same-origin path", () => {
    expect(safeNextPath("/admin/intersections", "/fallback")).toBe(
      "/admin/intersections"
    );
    expect(safeNextPath("/admin/intersections/12", "/fallback")).toBe(
      "/admin/intersections/12"
    );
  });

  it("falls back for a missing or empty next", () => {
    expect(safeNextPath(null, "/admin/intersections")).toBe("/admin/intersections");
    expect(safeNextPath("", "/admin/intersections")).toBe("/admin/intersections");
  });

  it("rejects off-origin targets", () => {
    for (const bad of [
      "//evil.com",
      "///evil.com",
      "https://evil.com",
      "http://evil.com/admin",
      "/\\evil.com",
      "evil.com",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(bad, "/admin/intersections")).toBe("/admin/intersections");
    }
  });
});
