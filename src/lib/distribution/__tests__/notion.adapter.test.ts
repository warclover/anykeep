/**
 * NotionAdapter 单元测试
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NotionAdapter } from "../adapters/notion.adapter";
import type { DistributionTarget, DistributionBookmark } from "../types";

// Mock token-crypto
jest.mock("../utils/token-crypto", () => ({
  decryptToken: jest.fn().mockResolvedValue("mock-access-token"),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("NotionAdapter", () => {
  let adapter: NotionAdapter;
  let mockSupabase: {
    from: jest.Mock;
  };

  const mockTarget: DistributionTarget = {
    id: "target-1",
    userId: "user-1",
    targetType: "notion",
    name: "My Notion",
    enabled: true,
    trigger: { mode: "manual" },
    targetConfig: {
      databaseId: "db-123",
      propertyMapping: {},
      workspaceName: "My Workspace",
    },
    status: "idle",
    syncedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBookmarks: DistributionBookmark[] = [
    {
      id: "bookmark-1",
      title: "Test Article",
      url: "https://example.com/article",
      platform: "wechat",
      description: "A test article",
      aiSummary: "This is an AI summary",
      tags: ["tech", "news"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { access_token: "encrypted-token" },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    adapter = new NotionAdapter(mockSupabase as unknown as SupabaseClient);
  });

  describe("metadata", () => {
    it("should have correct type", () => {
      expect(adapter.type).toBe("notion");
    });

    it("should have correct display name", () => {
      expect(adapter.displayName).toBe("Notion");
    });

    it("should support all platforms", () => {
      expect(adapter.supportedPlatforms).toContain("web");
      expect(adapter.supportedPlatforms).toContain("mobile");
      expect(adapter.supportedPlatforms).toContain("desktop");
    });
  });

  describe("initialize", () => {
    it("should fetch and decrypt token", async () => {
      await adapter.initialize(mockTarget);

      expect(mockSupabase.from).toHaveBeenCalledWith(
        "distribution_oauth_tokens",
      );
    });

    it("should throw error when no token found", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              }),
            }),
          }),
        }),
      });

      await expect(adapter.initialize(mockTarget)).rejects.toThrow(
        "Notion 未授权",
      );
    });

    it("should throw error when supabase not provided", async () => {
      const adapterWithoutSupabase = new NotionAdapter();

      await expect(
        adapterWithoutSupabase.initialize(mockTarget),
      ).rejects.toThrow("Supabase client is required");
    });
  });

  describe("validateConfig", () => {
    it("should return valid for correct config", async () => {
      const result = await adapter.validateConfig(mockTarget);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return invalid when databaseId is missing", async () => {
      const invalidTarget = {
        ...mockTarget,
        targetConfig: {},
      };

      const result = await adapter.validateConfig(invalidTarget);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("请选择目标 Database");
    });

    it("should include warning when property mapping is empty", async () => {
      const result = await adapter.validateConfig(mockTarget);

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain("未配置属性映射");
    });
  });

  describe("testConnection", () => {
    it("should return failure when not initialized", async () => {
      const result = await adapter.testConnection(mockTarget);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Notion 未授权");
    });

    it("should return success when database is accessible", async () => {
      await adapter.initialize(mockTarget);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: [{ plain_text: "My Database" }],
          properties: { Name: {}, URL: {} },
        }),
      });

      const result = await adapter.testConnection(mockTarget);

      expect(result.success).toBe(true);
      expect(result.details?.databaseTitle).toBe("My Database");
      expect(result.details?.propertyCount).toBe(2);
    });

    it("should return failure when database is not accessible", async () => {
      await adapter.initialize(mockTarget);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Database not found" }),
      });

      const result = await adapter.testConnection(mockTarget);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database not found");
    });
  });

  describe("distribute", () => {
    beforeEach(async () => {
      await adapter.initialize(mockTarget);
    });

    it("should throw error when not initialized", async () => {
      const uninitializedAdapter = new NotionAdapter(
        mockSupabase as unknown as SupabaseClient,
      );

      await expect(
        uninitializedAdapter.distribute(mockBookmarks, mockTarget),
      ).rejects.toThrow("NotionAdapter not initialized");
    });

    it("should throw error when databaseId is missing", async () => {
      const invalidTarget = {
        ...mockTarget,
        targetConfig: {},
      };

      await expect(
        adapter.distribute(mockBookmarks, invalidTarget),
      ).rejects.toThrow("未配置 Notion Database");
    });

    it("should create new page when bookmark does not exist", async () => {
      // Mock query (no existing page)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      // Mock create page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "page-123" }),
      });

      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(result.success).toBe(true);
      expect(result.distributedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.records[0].externalId).toBe("page-123");
      expect(result.records[0].status).toBe("success");
    });

    it("should update existing page when bookmark exists", async () => {
      // Mock query (existing page found)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: "existing-page-123" }] }),
      });

      // Mock update page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(result.success).toBe(true);
      expect(result.distributedCount).toBe(1);
      expect(result.records[0].externalId).toBe("existing-page-123");
    });

    it("should handle API errors gracefully", async () => {
      // Mock query
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      // Mock create page failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Rate limited" }),
      });

      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(result.success).toBe(false);
      expect(result.distributedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors?.[0].code).toBe("NOTION_API_ERROR");
      expect(result.errors?.[0].message).toContain("Rate limited");
    });
  });

  describe("getDatabases", () => {
    it("should return database list", async () => {
      await adapter.initialize(mockTarget);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: "db-1",
              title: [{ plain_text: "Database 1" }],
              icon: { emoji: "📚" },
            },
            {
              id: "db-2",
              title: [{ plain_text: "Database 2" }],
              icon: null,
            },
          ],
        }),
      });

      const databases = await adapter.getDatabases();

      expect(databases).toHaveLength(2);
      expect(databases[0]).toEqual({
        id: "db-1",
        title: "Database 1",
        icon: "📚",
      });
      expect(databases[1]).toEqual({
        id: "db-2",
        title: "Database 2",
        icon: null,
      });
    });

    it("should throw error when not initialized", async () => {
      const uninitializedAdapter = new NotionAdapter();

      await expect(uninitializedAdapter.getDatabases()).rejects.toThrow(
        "Notion 未授权",
      );
    });
  });

  describe("getDatabaseProperties", () => {
    it("should return property list", async () => {
      await adapter.initialize(mockTarget);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            Name: { id: "title", type: "title" },
            URL: { id: "url", type: "url" },
            Tags: { id: "tags", type: "multi_select" },
          },
        }),
      });

      const properties = await adapter.getDatabaseProperties("db-123");

      expect(properties).toHaveLength(3);
      expect(properties).toContainEqual({
        id: "title",
        name: "Name",
        type: "title",
      });
    });
  });
});
