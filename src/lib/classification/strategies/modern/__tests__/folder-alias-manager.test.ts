/**
 * 文件夹别名管理器单元测试
 *
 * @module @/lib/classification/v5/classification-pipeline/__tests__/folder-alias-manager.test
 */

import { FolderAliasManager } from "../folder-alias-manager";

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  update: jest.fn().mockReturnThis(),
};

describe("FolderAliasManager", () => {
  let manager: FolderAliasManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new FolderAliasManager(mockSupabase as any);
  });

  describe("getAliases", () => {
    it("should return aliases from database including normalized folder name", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vuejs", "vue"] },
        error: null,
      });

      const aliases = await manager.getAliases("user1", 1, "Vue.js");

      expect(aliases).toContain("vuejs");
      expect(aliases).toContain("vue");
      expect(mockSupabase.from).toHaveBeenCalledWith("folder_tag_profiles");
    });

    it("should return normalized folder name when no aliases in database", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" }, // no rows returned
      });

      const aliases = await manager.getAliases("user1", 1, "Next.js");

      expect(aliases).toContain("nextjs");
    });

    it("should use cache on subsequent calls", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["react"] },
        error: null,
      });

      // First call - hits database
      await manager.getAliases("user1", 1, "React");
      // Second call - should use cache
      await manager.getAliases("user1", 1, "React");

      // Should only call database once
      expect(mockSupabase.single).toHaveBeenCalledTimes(1);
    });

    it("should deduplicate aliases", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vuejs", "Vue.js", "VUEJS"] },
        error: null,
      });

      const aliases = await manager.getAliases("user1", 1, "Vue.js");

      // All normalize to "vuejs", should be deduplicated
      const uniqueAliases = new Set(aliases);
      expect(uniqueAliases.size).toBe(aliases.length);
    });
  });

  describe("matchesAlias", () => {
    it("should return true when tag matches folder alias", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vuejs", "vue"] },
        error: null,
      });

      const matches = await manager.matchesAlias("user1", 1, "Vue.js", "vue");

      expect(matches).toBe(true);
    });

    it("should return true when tag matches normalized folder name", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: [] },
        error: null,
      });

      const matches = await manager.matchesAlias(
        "user1",
        1,
        "Next.js",
        "nextjs",
      );

      expect(matches).toBe(true);
    });

    it("should return false when tag does not match any alias", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vuejs"] },
        error: null,
      });

      const matches = await manager.matchesAlias("user1", 1, "Vue.js", "react");

      expect(matches).toBe(false);
    });

    it("should return false for empty tag", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vuejs"] },
        error: null,
      });

      const matches = await manager.matchesAlias("user1", 1, "Vue.js", "");

      expect(matches).toBe(false);
    });
  });

  describe("findMatchingTags", () => {
    it("should return all matching tags", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vuejs", "vue", "vue3"] },
        error: null,
      });

      const matched = await manager.findMatchingTags("user1", 1, "Vue.js", [
        "vue",
        "react",
        "vuejs",
        "angular",
      ]);

      expect(matched).toContain("vue");
      expect(matched).toContain("vuejs");
      expect(matched).not.toContain("react");
      expect(matched).not.toContain("angular");
    });

    it("should return empty array when no tags match", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vuejs"] },
        error: null,
      });

      const matched = await manager.findMatchingTags("user1", 1, "Vue.js", [
        "react",
        "angular",
      ]);

      expect(matched).toHaveLength(0);
    });
  });

  describe("recordLearningEvent", () => {
    it("should increment hit count for existing record", () => {
      // Record first event
      manager.recordLearningEvent("user1", 1, "frontend");
      // Record second event
      manager.recordLearningEvent("user1", 1, "frontend");

      const stats = manager.getLearningStats("user1");
      expect(stats.totalRecords).toBe(1);
    });

    it("should create new record for new tag-folder combination", () => {
      manager.recordLearningEvent("user1", 1, "frontend");
      manager.recordLearningEvent("user1", 1, "backend");

      const stats = manager.getLearningStats("user1");
      expect(stats.totalRecords).toBe(2);
    });

    it("should auto-add alias when threshold is reached", async () => {
      // Mock for addAlias
      mockSupabase.single.mockResolvedValue({
        data: { aliases: [] },
        error: null,
      });
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      // Record 3 events (default threshold)
      manager.recordLearningEvent("user1", 1, "frontend");
      manager.recordLearningEvent("user1", 1, "frontend");
      manager.recordLearningEvent("user1", 1, "frontend");

      // Wait for async addAlias to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The record should be removed after auto-adding
      const stats = manager.getLearningStats("user1");
      expect(stats.totalRecords).toBe(0);
    });

    it("should normalize tag before recording", () => {
      manager.recordLearningEvent("user1", 1, "Vue.js");
      manager.recordLearningEvent("user1", 1, "vuejs");

      // Both should be treated as the same tag
      const stats = manager.getLearningStats("user1");
      expect(stats.totalRecords).toBe(1);
    });

    it("should ignore empty tags", () => {
      manager.recordLearningEvent("user1", 1, "");
      manager.recordLearningEvent("user1", 1, "   ");

      const stats = manager.getLearningStats("user1");
      expect(stats.totalRecords).toBe(0);
    });
  });

  describe("addAlias", () => {
    it("should add alias to database", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: [] },
        error: null,
      });
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      await manager.addAlias("user1", 1, "vuejs");

      expect(mockSupabase.from).toHaveBeenCalledWith("folder_tag_profiles");
      expect(mockSupabase.update).toHaveBeenCalledWith({
        aliases: expect.arrayContaining(["vuejs"]),
      });
    });

    it("should not add duplicate alias", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vuejs"] },
        error: null,
      });

      await manager.addAlias("user1", 1, "vuejs");

      // Should not call update since alias already exists
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it("should normalize alias before adding", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: [] },
        error: null,
      });
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      await manager.addAlias("user1", 1, "Vue.js");

      expect(mockSupabase.update).toHaveBeenCalledWith({
        aliases: expect.arrayContaining(["vuejs"]),
      });
    });

    it("should clear cache after adding alias", async () => {
      // First, populate cache
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: [] },
        error: null,
      });
      await manager.getAliases("user1", 1, "Vue.js");

      // Add alias
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: [] },
        error: null,
      });
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });
      await manager.addAlias("user1", 1, "vue");

      // Next getAliases should hit database again
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vue"] },
        error: null,
      });
      await manager.getAliases("user1", 1, "Vue.js");

      expect(mockSupabase.single).toHaveBeenCalledTimes(3);
    });

    it("should ignore empty alias", async () => {
      await manager.addAlias("user1", 1, "");

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe("removeAlias", () => {
    it("should remove alias from database", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vuejs", "vue"] },
        error: null,
      });
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      await manager.removeAlias("user1", 1, "vuejs");

      expect(mockSupabase.update).toHaveBeenCalledWith({
        aliases: expect.not.arrayContaining(["vuejs"]),
      });
    });

    it("should clear cache after removing alias", async () => {
      // First, populate cache
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vuejs"] },
        error: null,
      });
      await manager.getAliases("user1", 1, "Vue.js");

      // Remove alias
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: ["vuejs"] },
        error: null,
      });
      mockSupabase.update.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });
      await manager.removeAlias("user1", 1, "vuejs");

      // Next getAliases should hit database again
      mockSupabase.single.mockResolvedValueOnce({
        data: { aliases: [] },
        error: null,
      });
      await manager.getAliases("user1", 1, "Vue.js");

      expect(mockSupabase.single).toHaveBeenCalledTimes(3);
    });
  });

  describe("clearCache", () => {
    it("should clear cache for specific folder", async () => {
      mockSupabase.single.mockResolvedValue({
        data: { aliases: [] },
        error: null,
      });

      await manager.getAliases("user1", 1, "Vue.js");
      await manager.getAliases("user1", 2, "React");

      manager.clearCache("user1", 1);

      // Folder 1 should hit database again
      await manager.getAliases("user1", 1, "Vue.js");
      // Folder 2 should still use cache
      await manager.getAliases("user1", 2, "React");

      expect(mockSupabase.single).toHaveBeenCalledTimes(3);
    });

    it("should clear all cache for user when no folderId provided", async () => {
      mockSupabase.single.mockResolvedValue({
        data: { aliases: [] },
        error: null,
      });

      await manager.getAliases("user1", 1, "Vue.js");
      await manager.getAliases("user1", 2, "React");

      manager.clearCache("user1");

      // Both should hit database again
      await manager.getAliases("user1", 1, "Vue.js");
      await manager.getAliases("user1", 2, "React");

      expect(mockSupabase.single).toHaveBeenCalledTimes(4);
    });
  });

  describe("clearAllCache", () => {
    it("should clear cache for all users", async () => {
      mockSupabase.single.mockResolvedValue({
        data: { aliases: [] },
        error: null,
      });

      await manager.getAliases("user1", 1, "Vue.js");
      await manager.getAliases("user2", 1, "React");

      manager.clearAllCache();

      // Both users should hit database again
      await manager.getAliases("user1", 1, "Vue.js");
      await manager.getAliases("user2", 1, "React");

      expect(mockSupabase.single).toHaveBeenCalledTimes(4);
    });
  });

  describe("cleanupExpiredLearningRecords", () => {
    it("should remove expired learning records", () => {
      // Create manager with short expiry for testing
      const shortExpiryManager = new FolderAliasManager(mockSupabase as any, {
        learningRecordExpiryMs: 100, // 100ms expiry
      });

      // Add a learning event
      shortExpiryManager.recordLearningEvent("user1", 1, "test");

      // Verify record exists
      let stats = shortExpiryManager.getLearningStats("user1");
      expect(stats.totalRecords).toBe(1);

      // Wait for expiry and cleanup
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          shortExpiryManager.cleanupExpiredLearningRecords();
          stats = shortExpiryManager.getLearningStats("user1");
          expect(stats.totalRecords).toBe(0);
          resolve();
        }, 150);
      });
    });
  });

  describe("getLearningStats", () => {
    it("should return correct stats", () => {
      manager.recordLearningEvent("user1", 1, "frontend");
      manager.recordLearningEvent("user1", 1, "frontend"); // 2nd hit
      manager.recordLearningEvent("user1", 2, "backend");

      const stats = manager.getLearningStats("user1");

      expect(stats.totalRecords).toBe(2);
      expect(stats.nearThreshold).toBe(1); // "frontend" has 2 hits, near threshold of 3
    });

    it("should return zero stats for unknown user", () => {
      const stats = manager.getLearningStats("unknown-user");

      expect(stats.totalRecords).toBe(0);
      expect(stats.nearThreshold).toBe(0);
    });
  });

  describe("cache TTL", () => {
    it("should invalidate cache after TTL expires", async () => {
      // Create manager with short TTL for testing
      const shortTtlManager = new FolderAliasManager(mockSupabase as any, {
        cacheTtlMs: 100, // 100ms TTL
      });

      mockSupabase.single.mockResolvedValue({
        data: { aliases: [] },
        error: null,
      });

      // First call
      await shortTtlManager.getAliases("user1", 1, "Vue.js");

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second call should hit database again
      await shortTtlManager.getAliases("user1", 1, "Vue.js");

      expect(mockSupabase.single).toHaveBeenCalledTimes(2);
    });
  });
});
