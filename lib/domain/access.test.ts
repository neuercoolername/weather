import { describe, it, expect } from "vitest";
import { accessFor, type AccessSession } from "./access";

const admin: AccessSession = { isLoggedIn: true };

describe("accessFor", () => {
  // Regression pin: the iOS app posts GPS with a Bearer header and no cookie. Gating this
  // stops ingest, and nothing about the trace fails loudly when it does.
  it("never gates the GPS ingest endpoint", () => {
    for (const session of [null, admin]) {
      expect(accessFor(session, "/api/location")).toBe("allow");
    }
  });

  it("leaves the login routes reachable without a session", () => {
    for (const path of ["/admin/login", "/api/admin/login"]) {
      expect(accessFor(null, path)).toBe("allow");
    }
  });

  it("leaves the trace open to everyone", () => {
    expect(accessFor(null, "/")).toBe("allow");
    expect(accessFor(admin, "/")).toBe("allow");
  });

  describe("the admin area", () => {
    it("admits an admin", () => {
      expect(accessFor(admin, "/admin/intersections")).toBe("allow");
      expect(accessFor(admin, "/api/admin/intersections/1")).toBe("allow");
    });

    // A fetch cannot follow a redirect to a login form into anything useful.
    it("answers unauthenticated API calls with 401 rather than a redirect", () => {
      expect(accessFor(null, "/api/admin/intersections/1")).toBe("unauthorized");
      expect(accessFor(null, "/admin/intersections")).toBe("admin-login");
    });
  });

  it("treats a falsy flag as absent", () => {
    expect(accessFor({ isLoggedIn: false }, "/admin")).toBe("admin-login");
  });

  // "/adminish" is not under "/admin"; only an exact segment boundary counts.
  it("matches on path segments, not string prefixes", () => {
    expect(accessFor(null, "/adminish")).toBe("allow");
    expect(accessFor(null, "/admin")).toBe("admin-login");
    expect(accessFor(null, "/admin/login/extra")).toBe("admin-login");
  });
});
