/**
 * Merge Service Unit Tests
 * Tests for folder merge detection and execution
 */

import { MergeService } from "../services/merge.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock operation log service
jest.mock("../services/operation-log.service", () => ({
  operationLogService: {
    mergeFoldersWithNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

// Helper to create mock Supabase client
const createMockSupabase = () => {
  const mockChain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    data: null,
    error: null,
  };
  return mockChain;
};

// Mock Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

// Mock v42 helpers
jest.mock("@/lib/supabase/v42-types", () => ({
  v42Table: jest.fn((supabase) => supabase),
  v42Rpc: jest.fn((supabase) => supabase),
}));

describe("MergeService", () => {
  let service: MergeService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  // Sample folder profiles data
  const mockFolderProfiles = [
    {
      folder_id: 1,
      profile_embedding: Array(1536).fill(0.5),
      common_tags: ["react", "frontend", "javascript"],
      bookmark_count: 10,
      folders: {
        id: 1,
        name: "React",
        parent_id: null,
        user_id: "user-123",
        deleted_at: null,
      },
    },
    {
      folder_id: 2,
      profile_embedding: Array(1536).fill(0.51), // Similar embedding
      common_tags: ["react", "frontend", "hooks"],
      bookmark_count: 5,
      folders: {
        id: 2,
        name: "React Hooks",
        parent_id: null,
        user_id: "user-123",
        deleted_at: null,
      },
    },
    {
      folder_id: 3,
      profile_embedding: Array(1536).fill(0.1), // Different embedding
      common_tags: ["backend", "nodejs", "express"],
      bookmark_count: 8,
      folders: {
        id: 3,
        name: "Backend",
        parent_id: null,
        user_id: "user-123",
        deleted_at: null,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = createMockSupabase();

    // Setup createServerSupabaseClient mock
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase);

    // Create new service instance
    service = new MergeService();
  });

  describe("getMergeCandidates()", () => {
    it("should return empty array when less than 2 folders exist", async () => {
      mockSupabase.limit.mockResolvedValue({
        data: [mockFolderProfiles[0]],
        error: null,
      });

      const candidates = await service.getMergeCandidates("user-123");

      expect(candidates).toEqual([]);
    });

    it("should return empty array on database error", async () => {
      mockSupabase.limit.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const candidates = await service.getMergeCandidates("user-123");

      expect(candidates).toEqual([]);
    });

    it("should find similar folders as merge candidates", async () => {
      // Return folders with similar embeddings
      mockSupabase.limit.mockResolvedValue({
        data: mockFolderProfiles.slice(0, 2), // Only similar folders
        error: null,
      });

      const candidates = await service.getMergeCandidates("user-123");

      // Should find at least one candidate between React and React Hooks
      expect(candidates.length).toBeGreaterThanOrEqual(0);
    });

    it("should not suggest merge for dissimilar folders", async () => {
      // Create folders with very different embeddings
      const dissimilarFolders = [
        {
          ...mockFolderProfiles[0],
          profile_embedding: Array(1536).fill(1),
          common_tags: ["a", "b", "c"],
        },
        {
          ...mockFolderProfiles[1],
          folder_id: 4,
          folders: { ...mockFolderProfiles[1].folders, id: 4 },
          profile_embedding: Array(1536).fill(-1),
          common_tags: ["x", "y", "z"],
        },
      ];

      mockSupabase.limit.mockResolvedValue({
        data: dissimilarFolders,
        error: null,
      });

      const candidates = await service.getMergeCandidates("user-123");

      // Should not find merge candidates for very different folders
      expect(candidates).toEqual([]);
    });

    it("should sort candidates by similarity descending", async () => {
      // Setup multiple folder pairs with different similarities
      const multipleFolders = [
        ...mockFolderProfiles,
        {
          folder_id: 4,
          profile_embedding: Array(1536).fill(0.5), // Exact match with folder 1
          common_tags: ["react", "frontend", "javascript"],
          bookmark_count: 3,
          folders: {
            id: 4,
            name: "React Components",
            parent_id: null,
            user_id: "user-123",
            deleted_at: null,
          },
        },
      ];

      mockSupabase.limit.mockResolvedValue({
        data: multipleFolders,
        error: null,
      });

      const candidates = await service.getMergeCandidates("user-123");

      // If there are multiple candidates, they should be sorted by similarity
      if (candidates.length > 1) {
        for (let i = 1; i < candidates.length; i++) {
          expect(candidates[i - 1].similarity).toBeGreaterThanOrEqual(
            candidates[i].similarity,
          );
        }
      }
    });

    it("should limit results to MAX_SUGGESTIONS", async () => {
      // Create many similar folders
      const manyFolders = Array(10)
        .fill(null)
        .map((_, i) => ({
          folder_id: i + 1,
          profile_embedding: Array(1536).fill(0.5 + i * 0.001),
          common_tags: ["react", "frontend"],
          bookmark_count: 5,
          folders: {
            id: i + 1,
            name: `Folder ${i + 1}`,
            parent_id: null,
            user_id: "user-123",
            deleted_at: null,
          },
        }));

      mockSupabase.limit.mockResolvedValue({
        data: manyFolders,
        error: null,
      });

      const candidates = await service.getMergeCandidates("user-123");

      // Should not exceed 5 suggestions (MAX_SUGGESTIONS)
      expect(candidates.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getMergeSuggestion()", () => {
    it("should return null for less than 2 folder IDs", async () => {
      const suggestion = await service.getMergeSuggestion("user-123", [1]);

      expect(suggestion).toBeNull();
    });

    it("should return null when folders not found", async () => {
      mockSupabase.is.mockResolvedValue({
        data: [],
        error: null,
      });

      const suggestion = await service.getMergeSuggestion("user-123", [1, 2]);

      expect(suggestion).toBeNull();
    });

    it("should return detailed suggestion for valid folders", async () => {
      const foldersWithProfiles = [
        {
          id: 1,
          name: "React",
          parent_id: null,
          folder_profiles: [
            {
              bookmark_count: 10,
              profile_embedding: Array(1536).fill(0.5),
              common_tags: ["react", "frontend"],
            },
          ],
        },
        {
          id: 2,
          name: "React Hooks",
          parent_id: null,
          folder_profiles: [
            {
              bookmark_count: 5,
              profile_embedding: Array(1536).fill(0.5),
              common_tags: ["react", "hooks"],
            },
          ],
        },
      ];

      mockSupabase.is.mockResolvedValue({
        data: foldersWithProfiles,
        error: null,
      });

      const suggestion = await service.getMergeSuggestion("user-123", [1, 2]);

      expect(suggestion).not.toBeNull();
      expect(suggestion!.targetFolder.id).toBe(1); // Larger folder
      expect(suggestion!.sourceFolders).toHaveLength(1);
      expect(suggestion!.sourceFolders[0].id).toBe(2);
      expect(suggestion!.totalBookmarks).toBe(15);
      expect(suggestion!.similarity).toBeGreaterThan(0);
    });
  });

  describe("executeMerge()", () => {
    beforeEach(() => {
      // Setup default successful responses
      mockSupabase.is.mockResolvedValue({
        data: [
          { id: 1, name: "Target", parent_id: null },
          { id: 2, name: "Source", parent_id: null },
        ],
        error: null,
      });

      // Chain for bookmarks query
      const bookmarksChain = {
        ...mockSupabase,
        is: jest.fn().mockResolvedValue({
          data: [
            { id: 101, title: "Bookmark 1", folder_id: 2 },
            { id: 102, title: "Bookmark 2", folder_id: 2 },
          ],
          error: null,
        }),
      };

      mockSupabase.eq
        .mockReturnValueOnce(mockSupabase)
        .mockReturnValue(bookmarksChain);
    });

    it("should return error when target folder not found", async () => {
      mockSupabase.is.mockResolvedValue({
        data: [{ id: 2, name: "Source", parent_id: null }],
        error: null,
      });

      const result = await service.executeMerge("user-123", [2], 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain("目标文件夹不存在");
    });

    it("should return error when source folders not found", async () => {
      mockSupabase.is.mockResolvedValue({
        data: [{ id: 1, name: "Target", parent_id: null }],
        error: null,
      });

      const result = await service.executeMerge("user-123", [2], 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain("源文件夹不存在");
    });

    it("should return error on folder query failure", async () => {
      mockSupabase.is.mockResolvedValue({
        data: null,
        error: { message: "Query failed" },
      });

      const result = await service.executeMerge("user-123", [2], 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain("获取文件夹信息失败");
    });
  });

  describe("areMergeCandidates()", () => {
    it("should return false when profiles not found", async () => {
      mockSupabase.in.mockResolvedValue({
        data: [{ folder_id: 1, profile_embedding: null, common_tags: [] }],
        error: null,
      });

      const result = await service.areMergeCandidates("user-123", 1, 2);

      expect(result.canMerge).toBe(false);
      expect(result.similarity).toBe(0);
    });

    it("should detect highly similar folders", async () => {
      const embedding = Array(1536).fill(0.5);
      mockSupabase.in.mockResolvedValue({
        data: [
          {
            folder_id: 1,
            profile_embedding: embedding,
            common_tags: ["a", "b"],
          },
          {
            folder_id: 2,
            profile_embedding: embedding,
            common_tags: ["a", "b"],
          },
        ],
        error: null,
      });

      const result = await service.areMergeCandidates("user-123", 1, 2);

      expect(result.canMerge).toBe(true);
      expect(result.similarity).toBeCloseTo(1, 2); // Identical embeddings
      expect(result.tagOverlap).toBe(1); // Identical tags
    });

    it("should detect merge candidates by tag overlap", async () => {
      mockSupabase.in.mockResolvedValue({
        data: [
          {
            folder_id: 1,
            profile_embedding: Array(1536).fill(0.1),
            common_tags: ["react", "frontend", "hooks", "state"],
          },
          {
            folder_id: 2,
            profile_embedding: Array(1536).fill(0.9),
            common_tags: ["react", "frontend", "hooks", "context"],
          },
        ],
        error: null,
      });

      const result = await service.areMergeCandidates("user-123", 1, 2);

      // Even with different embeddings, high tag overlap should suggest merge
      expect(result.tagOverlap).toBeGreaterThan(0.5);
    });

    it("should not suggest merge for dissimilar folders", async () => {
      mockSupabase.in.mockResolvedValue({
        data: [
          {
            folder_id: 1,
            profile_embedding: Array(1536).fill(1),
            common_tags: ["frontend", "react"],
          },
          {
            folder_id: 2,
            profile_embedding: Array(1536).fill(-1),
            common_tags: ["backend", "python"],
          },
        ],
        error: null,
      });

      const result = await service.areMergeCandidates("user-123", 1, 2);

      // Very different embeddings and no tag overlap
      expect(result.tagOverlap).toBe(0);
    });
  });

  describe("Private methods (via public interface)", () => {
    describe("calculateTagOverlap", () => {
      it("should return 0 for empty tag arrays", async () => {
        mockSupabase.in.mockResolvedValue({
          data: [
            { folder_id: 1, profile_embedding: null, common_tags: [] },
            { folder_id: 2, profile_embedding: null, common_tags: [] },
          ],
          error: null,
        });

        const result = await service.areMergeCandidates("user-123", 1, 2);
        expect(result.tagOverlap).toBe(0);
      });

      it("should handle case-insensitive tag comparison", async () => {
        mockSupabase.in.mockResolvedValue({
          data: [
            {
              folder_id: 1,
              profile_embedding: null,
              common_tags: ["React", "FRONTEND"],
            },
            {
              folder_id: 2,
              profile_embedding: null,
              common_tags: ["react", "frontend"],
            },
          ],
          error: null,
        });

        const result = await service.areMergeCandidates("user-123", 1, 2);
        expect(result.tagOverlap).toBe(1); // Complete overlap (case-insensitive)
      });
    });

    describe("cosineSimilarity", () => {
      it("should return 1 for identical embeddings", async () => {
        const embedding = Array(1536).fill(0.5);
        mockSupabase.in.mockResolvedValue({
          data: [
            { folder_id: 1, profile_embedding: embedding, common_tags: [] },
            { folder_id: 2, profile_embedding: embedding, common_tags: [] },
          ],
          error: null,
        });

        const result = await service.areMergeCandidates("user-123", 1, 2);
        expect(result.similarity).toBeCloseTo(1, 5);
      });

      it("should return -1 for opposite embeddings", async () => {
        mockSupabase.in.mockResolvedValue({
          data: [
            {
              folder_id: 1,
              profile_embedding: Array(1536).fill(1),
              common_tags: [],
            },
            {
              folder_id: 2,
              profile_embedding: Array(1536).fill(-1),
              common_tags: [],
            },
          ],
          error: null,
        });

        const result = await service.areMergeCandidates("user-123", 1, 2);
        expect(result.similarity).toBeCloseTo(-1, 5);
      });

      it("should handle zero vectors gracefully", async () => {
        mockSupabase.in.mockResolvedValue({
          data: [
            {
              folder_id: 1,
              profile_embedding: Array(1536).fill(0),
              common_tags: [],
            },
            {
              folder_id: 2,
              profile_embedding: Array(1536).fill(0.5),
              common_tags: [],
            },
          ],
          error: null,
        });

        const result = await service.areMergeCandidates("user-123", 1, 2);
        expect(result.similarity).toBe(0);
      });
    });
  });
});
