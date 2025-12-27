/**
 * Wayback Machine 归档查找服务单元测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { WaybackFinder } from "../services/wayback-finder";
import type { LinkCheckResult } from "../types";
import { LINK_HEALTH_CONFIG } from "../types";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("WaybackFinder", () => {
  let waybackFinder: WaybackFinder;

  beforeEach(() => {
    waybackFinder = new WaybackFinder();
    mockFetch.mockReset();
  });

  describe("findArchives", () => {
    it("should find archives for multiple URLs", async () => {
      const failedResults: LinkCheckResult[] = [
        {
          bookmarkId: 1,
          url: "https://example.com/1",
          status: "failed",
          checkedAt: new Date(),
        },
        {
          bookmarkId: 2,
          url: "https://example.com/2",
          status: "failed",
          checkedAt: new Date(),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          archived_snapshots: {
            closest: {
              available: true,
              url: "https://web.archive.org/web/20231015/https://example.com/1",
              timestamp: "20231015123456",
            },
          },
        }),
      });

      const results = await waybackFinder.findArchives(failedResults);

      expect(results).toHaveLength(2);
      expect(results[0].waybackUrl).toContain("web.archive.org");
      expect(results[0].timestamp).toBe("20231015123456");
    });

    it("should limit lookups to WAYBACK_MAX_LOOKUP", async () => {
      const failedResults: LinkCheckResult[] = Array.from(
        { length: 50 },
        (_, i) => ({
          bookmarkId: i + 1,
          url: `https://example.com/${i + 1}`,
          status: "failed" as const,
          checkedAt: new Date(),
        }),
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          archived_snapshots: {
            closest: { available: false },
          },
        }),
      });

      await waybackFinder.findArchives(failedResults);

      // Should only call for WAYBACK_MAX_LOOKUP URLs
      expect(mockFetch).toHaveBeenCalledTimes(
        LINK_HEALTH_CONFIG.WAYBACK_MAX_LOOKUP,
      );
    });

    it("should respect concurrency limit", async () => {
      const failedResults: LinkCheckResult[] = Array.from(
        { length: 9 },
        (_, i) => ({
          bookmarkId: i + 1,
          url: `https://example.com/${i + 1}`,
          status: "failed" as const,
          checkedAt: new Date(),
        }),
      );

      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;

      mockFetch.mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
        await new Promise((r) => setTimeout(r, 10));
        concurrentCalls--;
        return {
          ok: true,
          json: async () => ({
            archived_snapshots: { closest: { available: false } },
          }),
        };
      });

      await waybackFinder.findArchives(failedResults);

      expect(maxConcurrentCalls).toBeLessThanOrEqual(
        LINK_HEALTH_CONFIG.WAYBACK_CONCURRENCY,
      );
    });
  });

  describe("findSingle (via findArchives)", () => {
    it("should return archive URL when available", async () => {
      const failedResults: LinkCheckResult[] = [
        {
          bookmarkId: 1,
          url: "https://deleted.example.com",
          status: "failed",
          checkedAt: new Date(),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          url: "https://deleted.example.com",
          archived_snapshots: {
            closest: {
              status: "200",
              available: true,
              url: "https://web.archive.org/web/20231015123456/https://deleted.example.com",
              timestamp: "20231015123456",
            },
          },
        }),
      });

      const results = await waybackFinder.findArchives(failedResults);

      expect(results[0].waybackUrl).toBe(
        "https://web.archive.org/web/20231015123456/https://deleted.example.com",
      );
      expect(results[0].timestamp).toBe("20231015123456");
    });

    it("should return undefined when no archive available", async () => {
      const failedResults: LinkCheckResult[] = [
        {
          bookmarkId: 1,
          url: "https://never-existed.example.com",
          status: "failed",
          checkedAt: new Date(),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          archived_snapshots: {},
        }),
      });

      const results = await waybackFinder.findArchives(failedResults);

      expect(results[0].waybackUrl).toBeUndefined();
      expect(results[0].timestamp).toBeUndefined();
    });

    it("should handle API errors gracefully", async () => {
      const failedResults: LinkCheckResult[] = [
        {
          bookmarkId: 1,
          url: "https://example.com",
          status: "failed",
          checkedAt: new Date(),
        },
      ];

      mockFetch.mockRejectedValue(new Error("Network error"));

      const results = await waybackFinder.findArchives(failedResults);

      expect(results[0].waybackUrl).toBeUndefined();
      expect(results[0].bookmarkId).toBe(1);
      expect(results[0].originalUrl).toBe("https://example.com");
    });

    it("should handle non-OK response", async () => {
      const failedResults: LinkCheckResult[] = [
        {
          bookmarkId: 1,
          url: "https://example.com",
          status: "failed",
          checkedAt: new Date(),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
      });

      const results = await waybackFinder.findArchives(failedResults);

      expect(results[0].waybackUrl).toBeUndefined();
    });

    it("should encode URL properly", async () => {
      const failedResults: LinkCheckResult[] = [
        {
          bookmarkId: 1,
          url: "https://example.com/path?query=value&foo=bar",
          status: "failed",
          checkedAt: new Date(),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          archived_snapshots: { closest: { available: false } },
        }),
      });

      await waybackFinder.findArchives(failedResults);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          encodeURIComponent("https://example.com/path?query=value&foo=bar"),
        ),
        expect.any(Object),
      );
    });
  });

  describe("formatTimestamp", () => {
    it("should format timestamp correctly", () => {
      expect(waybackFinder.formatTimestamp("20231015123456")).toBe(
        "2023-10-15 12:34",
      );
    });

    it("should handle short timestamp", () => {
      expect(waybackFinder.formatTimestamp("20231015")).toBe(
        "2023-10-15 00:00",
      );
    });

    it("should handle empty timestamp", () => {
      expect(waybackFinder.formatTimestamp("")).toBe("");
    });

    it("should handle invalid timestamp", () => {
      expect(waybackFinder.formatTimestamp("abc")).toBe("");
    });
  });

  describe("buildWaybackUrl", () => {
    it("should build URL with timestamp", () => {
      const url = waybackFinder.buildWaybackUrl(
        "https://example.com",
        "20231015123456",
      );
      expect(url).toBe(
        "https://web.archive.org/web/20231015123456/https://example.com",
      );
    });

    it("should build URL without timestamp (latest)", () => {
      const url = waybackFinder.buildWaybackUrl("https://example.com");
      expect(url).toBe("https://web.archive.org/web/*/https://example.com");
    });
  });
});
