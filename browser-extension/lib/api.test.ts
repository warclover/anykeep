/**
 * API Module Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { api, ApiError } from "./api";
import { setMockStorageData, resetMockStorage } from "../test/mocks/browser";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("api", () => {
  beforeEach(() => {
    resetMockStorage();
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("ApiError", () => {
    it("should create error with message and code", () => {
      const error = new ApiError("Test error", "TEST_CODE");

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("ApiError");
    });

    it("should include statusCode when provided", () => {
      const error = new ApiError("HTTP error", "HTTP_ERROR", 404);

      expect(error.statusCode).toBe(404);
    });
  });

  describe("detectPlatform", () => {
    it("should detect WeChat Official Account", () => {
      expect(api.detectPlatform("https://mp.weixin.qq.com/s/abc")).toBe(
        "WECHAT_OFFICIAL_ACCOUNT",
      );
    });

    it("should detect Bilibili", () => {
      expect(api.detectPlatform("https://www.bilibili.com/video/BV123")).toBe(
        "BILIBILI",
      );
      expect(api.detectPlatform("https://b23.tv/abc")).toBe("BILIBILI");
    });

    it("should detect Xiaohongshu", () => {
      expect(api.detectPlatform("https://www.xiaohongshu.com/note/123")).toBe(
        "XIAOHONGSHU",
      );
      expect(api.detectPlatform("https://xhslink.com/abc")).toBe("XIAOHONGSHU");
    });

    it("should detect Zhihu", () => {
      expect(api.detectPlatform("https://www.zhihu.com/question/123")).toBe(
        "ZHIHU",
      );
      expect(api.detectPlatform("https://zhuanlan.zhihu.com/p/123")).toBe(
        "ZHIHU",
      );
    });

    it("should detect Douyin", () => {
      expect(api.detectPlatform("https://www.douyin.com/video/123")).toBe(
        "DOUYIN",
      );
      expect(api.detectPlatform("https://v.douyin.com/abc")).toBe("DOUYIN");
    });

    it("should detect Weibo", () => {
      expect(api.detectPlatform("https://weibo.com/123/456")).toBe("WEIBO");
      expect(api.detectPlatform("https://m.weibo.cn/status/123")).toBe("WEIBO");
    });

    it("should detect Juejin", () => {
      expect(api.detectPlatform("https://juejin.cn/post/123")).toBe("JUEJIN");
    });

    it("should detect Jianshu", () => {
      expect(api.detectPlatform("https://www.jianshu.com/p/123")).toBe(
        "JIANSHU",
      );
    });

    it("should detect CSDN", () => {
      expect(api.detectPlatform("https://blog.csdn.net/user/article/123")).toBe(
        "CSDN",
      );
    });

    it("should detect GitHub", () => {
      expect(api.detectPlatform("https://github.com/user/repo")).toBe("GITHUB");
    });

    it("should detect YouTube", () => {
      expect(api.detectPlatform("https://www.youtube.com/watch?v=abc")).toBe(
        "YOUTUBE",
      );
      expect(api.detectPlatform("https://youtu.be/abc")).toBe("YOUTUBE");
    });

    it("should detect Twitter/X", () => {
      expect(api.detectPlatform("https://twitter.com/user/status/123")).toBe(
        "TWITTER",
      );
      expect(api.detectPlatform("https://x.com/user/status/123")).toBe(
        "TWITTER",
      );
    });

    it("should detect Medium", () => {
      expect(api.detectPlatform("https://medium.com/@user/article")).toBe(
        "MEDIUM",
      );
    });

    it("should detect Notion", () => {
      expect(api.detectPlatform("https://notion.so/page-id")).toBe("NOTION");
    });

    it("should return OTHER for unknown URLs", () => {
      expect(api.detectPlatform("https://example.com/page")).toBe("OTHER");
      expect(api.detectPlatform("https://unknown-site.org")).toBe("OTHER");
    });
  });

  describe("saveBookmark", () => {
    it("should throw UNAUTHORIZED when not logged in", async () => {
      // No auth data set

      await expect(
        api.saveBookmark({
          url: "https://example.com",
          title: "Test",
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        api.saveBookmark({
          url: "https://example.com",
          title: "Test",
        }),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should send POST request with bookmark data when logged in", async () => {
      setMockStorageData({
        authToken: "test-token",
        userId: "user-123",
        apiUrl: "https://api.test.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { id: 1, title: "Test" },
        }),
      });

      const result = await api.saveBookmark({
        url: "https://example.com",
        title: "Test Page",
        description: "Test description",
        platform: "OTHER",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/bookmarks",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          }),
        }),
      );

      expect(result.success).toBe(true);
    });
  });

  describe("verifyAuth", () => {
    it("should return true when auth is valid", async () => {
      setMockStorageData({
        authToken: "valid-token",
        userId: "user-123",
        apiUrl: "https://api.test.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true }),
      });

      const result = await api.verifyAuth();
      expect(result).toBe(true);
    });

    it("should return false when auth is invalid", async () => {
      setMockStorageData({
        authToken: "invalid-token",
        userId: "user-123",
        apiUrl: "https://api.test.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ error: { code: "UNAUTHORIZED" } }),
      });

      const result = await api.verifyAuth();
      expect(result).toBe(false);
    });
  });

  describe("checkDuplicate", () => {
    it("should return true when URL exists", async () => {
      setMockStorageData({
        authToken: "token",
        userId: "user",
        apiUrl: "https://api.test.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ data: { exists: true } }),
      });

      const result = await api.checkDuplicate("https://example.com");
      expect(result).toBe(true);
    });

    it("should return false when URL does not exist", async () => {
      setMockStorageData({
        authToken: "token",
        userId: "user",
        apiUrl: "https://api.test.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ data: { exists: false } }),
      });

      const result = await api.checkDuplicate("https://example.com");
      expect(result).toBe(false);
    });

    it("should return false on error", async () => {
      setMockStorageData({
        authToken: "token",
        userId: "user",
        apiUrl: "https://api.test.com",
      });

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await api.checkDuplicate("https://example.com");
      expect(result).toBe(false);
    });
  });

  describe("getMetadata", () => {
    it("should return metadata for URL", async () => {
      setMockStorageData({
        authToken: "token",
        userId: "user",
        apiUrl: "https://api.test.com",
      });

      const mockMetadata = {
        title: "Test Page",
        url: "https://example.com",
        description: "Test description",
        platform: "OTHER",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ data: mockMetadata }),
      });

      const result = await api.getMetadata("https://example.com");

      expect(result).toEqual(mockMetadata);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/bookmarks/metadata?url=https%3A%2F%2Fexample.com",
        ),
        expect.any(Object),
      );
    });

    it("should throw error when metadata fetch fails", async () => {
      setMockStorageData({
        authToken: "token",
        userId: "user",
        apiUrl: "https://api.test.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ data: null }),
      });

      await expect(api.getMetadata("https://example.com")).rejects.toThrow(
        ApiError,
      );
    });
  });

  describe("request (via api methods)", () => {
    it("should handle non-JSON response", async () => {
      setMockStorageData({
        authToken: "token",
        userId: "user",
        apiUrl: "https://api.test.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "text/html" }),
      });

      const result = await api.verifyAuth();
      expect(result).toBe(true);
    });

    it("should handle HTTP error with non-JSON response", async () => {
      setMockStorageData({
        authToken: "token",
        userId: "user",
        apiUrl: "https://api.test.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "text/html" }),
      });

      // verifyAuth catches errors and returns false
      const result = await api.verifyAuth();
      expect(result).toBe(false);
    });

    it("should handle API error response", async () => {
      setMockStorageData({
        authToken: "token",
        userId: "user",
        apiUrl: "https://api.test.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          error: { code: "VALIDATION_ERROR", message: "Invalid data" },
        }),
      });

      await expect(
        api.saveBookmark({ url: "invalid", title: "" }),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });
  });
});
