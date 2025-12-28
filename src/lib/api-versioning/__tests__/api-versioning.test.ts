/**
 * API 版本化模块测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
import {
  rpcRegistry,
  defineRPCFunction,
  parseVersion,
  compareVersions,
  formatVersion,
  extractVersion,
  isVersionSupported,
} from "../index";
import { NextRequest } from "next/server";

describe("api-versioning", () => {
  describe("parseVersion", () => {
    it("should parse v1 format", () => {
      expect(parseVersion("v1")).toEqual({ major: 1, minor: 0, patch: 0 });
    });

    it("should parse v1.2 format", () => {
      expect(parseVersion("v1.2")).toEqual({ major: 1, minor: 2, patch: 0 });
    });

    it("should parse v1.2.3 format", () => {
      expect(parseVersion("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it("should parse without v prefix", () => {
      expect(parseVersion("1")).toEqual({ major: 1, minor: 0, patch: 0 });
      expect(parseVersion("2.0")).toEqual({ major: 2, minor: 0, patch: 0 });
      expect(parseVersion("3.1.4")).toEqual({ major: 3, minor: 1, patch: 4 });
    });

    it("should return null for invalid format", () => {
      expect(parseVersion("invalid")).toBeNull();
      expect(parseVersion("")).toBeNull();
      expect(parseVersion("v")).toBeNull();
    });
  });

  describe("compareVersions", () => {
    it("should compare major versions", () => {
      expect(
        compareVersions(
          { major: 2, minor: 0, patch: 0 },
          { major: 1, minor: 0, patch: 0 },
        ),
      ).toBeGreaterThan(0);
      expect(
        compareVersions(
          { major: 1, minor: 0, patch: 0 },
          { major: 2, minor: 0, patch: 0 },
        ),
      ).toBeLessThan(0);
    });

    it("should compare minor versions when major is equal", () => {
      expect(
        compareVersions(
          { major: 1, minor: 2, patch: 0 },
          { major: 1, minor: 1, patch: 0 },
        ),
      ).toBeGreaterThan(0);
      expect(
        compareVersions(
          { major: 1, minor: 1, patch: 0 },
          { major: 1, minor: 2, patch: 0 },
        ),
      ).toBeLessThan(0);
    });

    it("should compare patch versions when major and minor are equal", () => {
      expect(
        compareVersions(
          { major: 1, minor: 1, patch: 2 },
          { major: 1, minor: 1, patch: 1 },
        ),
      ).toBeGreaterThan(0);
      expect(
        compareVersions(
          { major: 1, minor: 1, patch: 1 },
          { major: 1, minor: 1, patch: 2 },
        ),
      ).toBeLessThan(0);
    });

    it("should return 0 for equal versions", () => {
      expect(
        compareVersions(
          { major: 1, minor: 2, patch: 3 },
          { major: 1, minor: 2, patch: 3 },
        ),
      ).toBe(0);
    });
  });

  describe("formatVersion", () => {
    it("should format version correctly", () => {
      expect(formatVersion({ major: 1, minor: 0, patch: 0 })).toBe("v1.0.0");
      expect(formatVersion({ major: 2, minor: 3, patch: 4 })).toBe("v2.3.4");
    });
  });

  describe("rpcRegistry", () => {
    beforeEach(() => {
      // 注册表已经通过 rpc-definitions 初始化
    });

    it("should have registered functions", () => {
      const families = rpcRegistry.getFamilies();
      expect(families.length).toBeGreaterThan(0);
    });

    it("should get function by family name", () => {
      const def = rpcRegistry.get("batch_add_tags");
      expect(def).not.toBeNull();
      expect(def?.name).toBe("batch_add_tags");
    });

    it("should return null for unregistered function", () => {
      const def = rpcRegistry.get("nonexistent_function");
      expect(def).toBeNull();
    });

    it("should negotiate version correctly", () => {
      const negotiation = rpcRegistry.negotiate("batch_add_tags", "v1");
      expect(negotiation).not.toBeNull();
      expect(negotiation?.resolvedVersion).toBe("v1");
      expect(negotiation?.isFallback).toBe(false);
    });

    it("should fallback to default version for unknown version", () => {
      const negotiation = rpcRegistry.negotiate("batch_add_tags", "v999");
      expect(negotiation).not.toBeNull();
      expect(negotiation?.isFallback).toBe(true);
    });

    it("should return default version when no version specified", () => {
      const negotiation = rpcRegistry.negotiate("batch_add_tags", null);
      expect(negotiation).not.toBeNull();
      expect(negotiation?.requestedVersion).toBeNull();
      expect(negotiation?.isFallback).toBe(false);
    });

    it("should get stats", () => {
      const stats = rpcRegistry.getStats();
      expect(stats.totalFamilies).toBeGreaterThan(0);
      expect(stats.totalVersions).toBeGreaterThan(0);
    });
  });

  describe("defineRPCFunction", () => {
    it("should create function definition", () => {
      const def = defineRPCFunction("test_function", {
        version: "v1",
        semanticVersion: { major: 1, minor: 0, patch: 0 },
        status: "stable",
        releasedAt: "2025-12-28",
      });

      expect(def.name).toBe("test_function");
      expect(def.meta.version).toBe("v1");
      expect(def.meta.status).toBe("stable");
    });

    it("should support optional fields", () => {
      const def = defineRPCFunction(
        "test_function",
        {
          version: "v2",
          semanticVersion: { major: 2, minor: 0, patch: 0 },
          status: "deprecated",
          releasedAt: "2025-12-01",
          deprecatedAt: "2025-12-28",
          sunsetAt: "2026-01-28",
          changelog: "Test changelog",
          migrationGuide: "See docs",
        },
        {
          paramsSchema: "{ id: number }",
          resultSchema: "{ success: boolean }",
        },
      );

      expect(def.meta.status).toBe("deprecated");
      expect(def.meta.deprecatedAt).toBe("2025-12-28");
      expect(def.paramsSchema).toBe("{ id: number }");
    });
  });

  describe("extractVersion", () => {
    it("should extract version from Accept-Version header", () => {
      const request = new NextRequest("http://localhost/api/test", {
        headers: {
          "Accept-Version": "v2",
        },
      });
      expect(extractVersion(request)).toBe("v2");
    });

    it("should extract version from query parameter", () => {
      const request = new NextRequest("http://localhost/api/test?version=v3");
      expect(extractVersion(request)).toBe("v3");
    });

    it("should extract version from URL path", () => {
      const request = new NextRequest("http://localhost/api/v2/bookmarks");
      expect(extractVersion(request)).toBe("v2");
    });

    it("should prioritize header over query", () => {
      const request = new NextRequest("http://localhost/api/test?version=v1", {
        headers: {
          "Accept-Version": "v2",
        },
      });
      expect(extractVersion(request)).toBe("v2");
    });

    it("should return null when no version specified", () => {
      const request = new NextRequest("http://localhost/api/test");
      expect(extractVersion(request)).toBeNull();
    });

    it("should normalize version without v prefix", () => {
      const request = new NextRequest("http://localhost/api/test?version=2");
      expect(extractVersion(request)).toBe("v2");
    });
  });

  describe("isVersionSupported", () => {
    it("should return true when version is in range", () => {
      expect(
        isVersionSupported("v2", { minVersion: "v1", maxVersion: "v3" }),
      ).toBe(true);
    });

    it("should return false when version is below min", () => {
      expect(isVersionSupported("v1", { minVersion: "v2" })).toBe(false);
    });

    it("should return false when version is above max", () => {
      expect(isVersionSupported("v4", { maxVersion: "v3" })).toBe(false);
    });

    it("should return true when no constraints", () => {
      expect(isVersionSupported("v99")).toBe(true);
    });
  });
});
