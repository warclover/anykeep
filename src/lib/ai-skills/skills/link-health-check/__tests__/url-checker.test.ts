/**
 * URL 检测服务单元测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { UrlChecker } from "../services/url-checker";
import type { BookmarkForCheck } from "../types";
import { LINK_HEALTH_CONFIG } from "../types";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("UrlChecker", () => {
  let urlChecker: UrlChecker;

  beforeEach(() => {
    urlChecker = new UrlChecker();
    mockFetch.mockReset();
  });

  describe("checkBatch", () => {
    it("should check multiple URLs in batches", async () => {
      const bookmarks: BookmarkForCheck[] = [
        { id: 1, url: "https://example.com/1", title: "Test 1" },
        { id: 2, url: "https://example.com/2", title: "Test 2" },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        redirected: false,
        url: "https://example.com/1",
      });

      const results = await urlChecker.checkBatch(bookmarks, {
        timeout: 5000,
        concurrency: 2,
      });

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("healthy");
      expect(results[1].status).toBe("healthy");
    });

    it("should respect concurrency limit", async () => {
      const bookmarks: BookmarkForCheck[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: i + 1,
          url: `https://example.com/${i + 1}`,
          title: `Test ${i + 1}`,
        }),
      );

      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;

      mockFetch.mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
        await new Promise((r) => setTimeout(r, 10));
        concurrentCalls--;
        return { ok: true, status: 200, redirected: false };
      });

      await urlChecker.checkBatch(bookmarks, {
        timeout: 5000,
        concurrency: 3,
      });

      expect(maxConcurrentCalls).toBeLessThanOrEqual(3);
    });
  });

  describe("checkSingle (via checkBatch)", () => {
    it("should detect healthy URL (200)", async () => {
      const bookmarks: BookmarkForCheck[] = [
        { id: 1, url: "https://example.com", title: "Test" },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        redirected: false,
      });

      const results = await urlChecker.checkBatch(bookmarks, {
        timeout: 5000,
        concurrency: 1,
      });

      expect(results[0].status).toBe("healthy");
      expect(results[0].httpStatus).toBe(200);
    });

    it("should detect 404 as failed", async () => {
      const bookmarks: BookmarkForCheck[] = [
        { id: 1, url: "https://example.com/notfound", title: "Test" },
      ];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        redirected: false,
      });

      const results = await urlChecker.checkBatch(bookmarks, {
        timeout: 5000,
        concurrency: 1,
      });

      expect(results[0].status).toBe("failed");
      expect(results[0].httpStatus).toBe(404);
    });

    it("should detect slow response", async () => {
      const bookmarks: BookmarkForCheck[] = [
        { id: 1, url: "https://slow.example.com", title: "Test" },
      ];

      // Mock a response that takes longer than SLOW_THRESHOLD_MS
      // We use a smaller delay for testing but check that the timing logic works
      const startTime = Date.now();
      mockFetch.mockImplementation(async () => {
        // Simulate delay by manipulating the perceived time
        return { ok: true, status: 200, redirected: false };
      });

      // Override Date.now to simulate slow response
      const _originalDateNow = Date.now;
      let callCount = 0;
      jest.spyOn(Date, "now").mockImplementation(() => {
        callCount++;
        // First call is start time, subsequent calls simulate elapsed time
        return callCount === 1
          ? startTime
          : startTime + LINK_HEALTH_CONFIG.SLOW_THRESHOLD_MS + 100;
      });

      const results = await urlChecker.checkBatch(bookmarks, {
        timeout: 10000,
        concurrency: 1,
      });

      // Restore Date.now
      jest.spyOn(Date, "now").mockRestore();

      expect(results[0].status).toBe("slow");
    }, 10000);

    it("should detect redirect", async () => {
      const bookmarks: BookmarkForCheck[] = [
        { id: 1, url: "https://old.example.com", title: "Test" },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        redirected: true,
        url: "https://new.example.com",
      });

      const results = await urlChecker.checkBatch(bookmarks, {
        timeout: 5000,
        concurrency: 1,
      });

      expect(results[0].status).toBe("healthy"); // redirected but OK
      expect(results[0].redirectUrl).toBe("https://new.example.com");
    });

    it("should handle timeout error", async () => {
      const bookmarks: BookmarkForCheck[] = [
        { id: 1, url: "https://timeout.example.com", title: "Test" },
      ];

      mockFetch.mockRejectedValue(new Error("The operation was aborted"));

      const results = await urlChecker.checkBatch(bookmarks, {
        timeout: 1000,
        concurrency: 1,
      });

      expect(results[0].status).toBe("failed");
      expect(results[0].errorType).toBe("timeout");
    });

    it("should handle SSL error", async () => {
      const bookmarks: BookmarkForCheck[] = [
        { id: 1, url: "https://badssl.example.com", title: "Test" },
      ];

      mockFetch.mockRejectedValue(new Error("SSL certificate error"));

      const results = await urlChecker.checkBatch(bookmarks, {
        timeout: 5000,
        concurrency: 1,
      });

      expect(results[0].status).toBe("failed");
      expect(results[0].errorType).toBe("ssl_error");
    });

    it("should handle DNS error", async () => {
      const bookmarks: BookmarkForCheck[] = [
        { id: 1, url: "https://nonexistent.invalid", title: "Test" },
      ];

      mockFetch.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

      const results = await urlChecker.checkBatch(bookmarks, {
        timeout: 5000,
        concurrency: 1,
      });

      expect(results[0].status).toBe("failed");
      expect(results[0].errorType).toBe("dns_error");
    });

    it("should handle connection refused", async () => {
      const bookmarks: BookmarkForCheck[] = [
        { id: 1, url: "https://refused.example.com", title: "Test" },
      ];

      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const results = await urlChecker.checkBatch(bookmarks, {
        timeout: 5000,
        concurrency: 1,
      });

      expect(results[0].status).toBe("failed");
      expect(results[0].errorType).toBe("connection_refused");
    });

    it("should skip invalid URLs", async () => {
      const bookmarks: BookmarkForCheck[] = [
        { id: 1, url: "javascript:void(0)", title: "Test" },
      ];

      const results = await urlChecker.checkBatch(bookmarks, {
        timeout: 5000,
        concurrency: 1,
      });

      expect(results[0].status).toBe("failed");
      expect(results[0].errorType).toBe("not_found");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fallback to GET if HEAD fails", async () => {
      const bookmarks: BookmarkForCheck[] = [
        { id: 1, url: "https://example.com", title: "Test" },
      ];

      // HEAD fails, GET succeeds
      mockFetch
        .mockRejectedValueOnce(new Error("Method not allowed"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          redirected: false,
        });

      const results = await urlChecker.checkBatch(bookmarks, {
        timeout: 5000,
        concurrency: 1,
      });

      expect(results[0].status).toBe("healthy");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
