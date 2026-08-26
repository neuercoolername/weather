import { describe, it, expect } from "vitest";
import { accessFor, type AccessSession } from "./access";

const admin: AccessSession = { isLoggedIn: true };
const viewer: AccessSession = { isViewer: true };

describe("accessFor", () => {
  // Regression pin: the iOS app posts GPS with a Bearer header and no cookie. Gating this
  // stops ingest, and nothing about the trace fails loudly when it does.
  it("never gates the GPS ingest endpoint", () => {
    for (const session of [null, viewer, admin]) {
      expect(accessFor(session, "/api/location")).toBe("allow");
    }
  });

  it("leaves both login routes reachable without a session", () => {
    for (const path of [
      "/viewer-login",
      "/api/viewer-login",
      "/admin/login",
      "/api/admin/login",
    ]) {
      expect(accessFor(null, path)).toBe("allow");
    }
  });

  describe("the public trace", () => {
    it("turns away a request with no session", () => {
      expect(accessFor(null, "/")).toBe("viewer-login");
    });

    it("admits a viewer, and an admin without a separate viewer flag", () => {
      expect(accessFor(viewer, "/")).toBe("allow");
      expect(accessFor(admin, "/")).toBe("allow");
    });
  });

  describe("the admin area", () => {
    it("rejects a viewer session — viewer access never implies admin", () => {
      expect(accessFor(viewer, "/admin/intersections")).toBe("admin-login");
      expect(accessFor(viewer, "/api/admin/intersections/1")).toBe("unauthorized");
    });

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
    expect(accessFor({ isLoggedIn: false, isViewer: false }, "/")).toBe("viewer-login");
    expect(accessFor({ isViewer: true }, "/admin")).toBe("admin-login");
  });

  // "/adminish" is not under "/admin"; only an exact segment boundary counts.
  it("matches on path segments, not string prefixes", () => {
    expect(accessFor(viewer, "/adminish")).toBe("allow");
    expect(accessFor(viewer, "/admin")).toBe("admin-login");
    expect(accessFor(viewer, "/admin/login/extra")).toBe("admin-login");
  });
});
