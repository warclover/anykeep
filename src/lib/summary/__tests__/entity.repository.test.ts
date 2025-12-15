/**
 * Entity Repository Tests
 *
 * 实体仓库单元测试
 *
 * @version 3.0.0
 * @since 2025-12-15
 */

import {
  EntityRepository,
  getEntityRepository,
  resetEntityRepository,
  type EntityRecord,
  type SharedEntityBookmark,
} from "../repositories/entity.repository";
import type { Entity } from "@/lib/classification/types/ai-summary";

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Supabase client
const mockRpc = jest.fn();
const mockFrom = jest.fn();

// V4.2.7: Mock server client (used by entity.repository.ts)
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      rpc: mockRpc,
      from: mockFrom,
    }),
  ),
}));

// Keep client mock for compatibility
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

// ============================================================================
// Mock Data
// ============================================================================

const mockBookmarkId = 123;
const mockUserId = "test-user-uuid";

const mockEntities: Entity[] = [
  { name: "React", type: "tech", confidence: 0.95 },
  { name: "张三", type: "person", confidence: 0.85 },
  { name: "TypeScript", type: "tech", confidence: 0.9 },
];

// EntityRecord type is exported but used only for type checking
const _mockEntityRecords: EntityRecord[] = [
  {
    id: "entity-1",
    bookmark_id: 123,
    user_id: mockUserId,
    name: "React",
    type: "tech",
    normalized_name: "react",
    confidence: 0.95,
    created_at: "2025-12-15T10:00:00Z",
  },
  {
    id: "entity-2",
    bookmark_id: 123,
    user_id: mockUserId,
    name: "TypeScript",
    type: "tech",
    normalized_name: "typescript",
    confidence: 0.9,
    created_at: "2025-12-15T10:00:00Z",
  },
];

const mockSharedEntityBookmarks: SharedEntityBookmark[] = [
  {
    bookmark_id: 456,
    shared_entities: ["React", "TypeScript"],
    shared_count: 2,
  },
  {
    bookmark_id: 789,
    shared_entities: ["React"],
    shared_count: 1,
  },
];

// ============================================================================
// Tests: EntityRepository
// ============================================================================

describe("EntityRepository", () => {
  let repository: EntityRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    resetEntityRepository();
    repository = new EntityRepository();
  });

  // --------------------------------------------------------------------------
  // saveEntities
  // --------------------------------------------------------------------------

  describe("saveEntities", () => {
    it("should save entities and return count", async () => {
      mockRpc.mockResolvedValueOnce({ data: 3, error: null });

      const result = await repository.saveEntities(
        mockBookmarkId,
        mockUserId,
        mockEntities,
      );

      expect(result).toBe(3);
      expect(mockRpc).toHaveBeenCalledWith("save_bookmark_entities", {
        p_bookmark_id: mockBookmarkId,
        p_user_id: mockUserId,
        p_entities: expect.arrayContaining([
          expect.objectContaining({ name: "React", type: "tech" }),
        ]),
      });
    });

    it("should return 0 for empty entities array", async () => {
      const result = await repository.saveEntities(
        mockBookmarkId,
        mockUserId,
        [],
      );

      expect(result).toBe(0);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("should return 0 for null entities", async () => {
      const result = await repository.saveEntities(
        mockBookmarkId,
        mockUserId,

        null as unknown as Parameters<typeof repository.saveEntities>[2],
      );

      expect(result).toBe(0);
    });

    it("should use default confidence when not provided", async () => {
      mockRpc.mockResolvedValueOnce({ data: 1, error: null });

      const entitiesWithoutConfidence: Entity[] = [
        { name: "Vue", type: "tech" },
      ];

      await repository.saveEntities(
        mockBookmarkId,
        mockUserId,
        entitiesWithoutConfidence,
      );

      expect(mockRpc).toHaveBeenCalledWith("save_bookmark_entities", {
        p_bookmark_id: mockBookmarkId,
        p_user_id: mockUserId,
        p_entities: [{ name: "Vue", type: "tech", confidence: 1.0 }],
      });
    });

    it("should throw error on database failure", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

      await expect(
        repository.saveEntities(mockBookmarkId, mockUserId, mockEntities),
      ).rejects.toThrow("保存实体失败");
    });
  });

  // --------------------------------------------------------------------------
  // getBookmarkEntities
  // --------------------------------------------------------------------------

  describe("getBookmarkEntities", () => {
    it("should return entities for bookmark", async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          { name: "React", type: "tech", confidence: 0.95 },
          { name: "TypeScript", type: "tech", confidence: 0.9 },
        ],
        error: null,
      });

      const result = await repository.getBookmarkEntities(mockBookmarkId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("React");
      expect(result[0].type).toBe("tech");
    });

    it("should return empty array when no entities", async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await repository.getBookmarkEntities(mockBookmarkId);

      expect(result).toEqual([]);
    });

    it("should return empty array when data is null", async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await repository.getBookmarkEntities(mockBookmarkId);

      expect(result).toEqual([]);
    });

    it("should throw error on database failure", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

      await expect(
        repository.getBookmarkEntities(mockBookmarkId),
      ).rejects.toThrow("获取实体失败");
    });
  });

  // --------------------------------------------------------------------------
  // deleteBookmarkEntities
  // --------------------------------------------------------------------------

  describe("deleteBookmarkEntities", () => {
    it("should delete entities successfully", async () => {
      mockFrom.mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      await expect(
        repository.deleteBookmarkEntities(mockBookmarkId),
      ).resolves.not.toThrow();
    });

    it("should throw error on database failure", async () => {
      mockFrom.mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({ error: { message: "Delete failed" } }),
        }),
      });

      await expect(
        repository.deleteBookmarkEntities(mockBookmarkId),
      ).rejects.toThrow("删除实体失败");
    });
  });

  // --------------------------------------------------------------------------
  // findBookmarksBySharedEntities
  // --------------------------------------------------------------------------

  describe("findBookmarksBySharedEntities", () => {
    it("should return bookmarks with shared entities", async () => {
      mockRpc.mockResolvedValueOnce({
        data: mockSharedEntityBookmarks,
        error: null,
      });

      const result = await repository.findBookmarksBySharedEntities(
        mockUserId,
        ["React", "TypeScript"],
        mockBookmarkId,
      );

      expect(result).toHaveLength(2);
      expect(result[0].bookmark_id).toBe(456);
      expect(result[0].shared_count).toBe(2);
    });

    it("should return empty array for empty entity names", async () => {
      const result = await repository.findBookmarksBySharedEntities(
        mockUserId,
        [],
        mockBookmarkId,
      );

      expect(result).toEqual([]);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("should use default minShared and limit", async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await repository.findBookmarksBySharedEntities(
        mockUserId,
        ["React"],
        mockBookmarkId,
      );

      expect(mockRpc).toHaveBeenCalledWith(
        "find_bookmarks_by_shared_entities",
        expect.objectContaining({
          p_min_shared: 1,
          p_limit: 20,
        }),
      );
    });

    it("should use custom minShared and limit", async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await repository.findBookmarksBySharedEntities(
        mockUserId,
        ["React"],
        mockBookmarkId,
        2,
        10,
      );

      expect(mockRpc).toHaveBeenCalledWith(
        "find_bookmarks_by_shared_entities",
        expect.objectContaining({
          p_min_shared: 2,
          p_limit: 10,
        }),
      );
    });

    it("should handle null excludeBookmarkId", async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await repository.findBookmarksBySharedEntities(
        mockUserId,
        ["React"],
        undefined,
      );

      expect(mockRpc).toHaveBeenCalledWith(
        "find_bookmarks_by_shared_entities",
        expect.objectContaining({
          p_exclude_bookmark_id: null,
        }),
      );
    });

    it("should throw error on database failure", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

      await expect(
        repository.findBookmarksBySharedEntities(mockUserId, ["React"]),
      ).rejects.toThrow("查找共享实体书签失败");
    });
  });

  // --------------------------------------------------------------------------
  // getEntityStats
  // --------------------------------------------------------------------------

  describe("getEntityStats", () => {
    it("should return entity type statistics", async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              { type: "tech" },
              { type: "tech" },
              { type: "person" },
              { type: "concept" },
            ],
            error: null,
          }),
        }),
      });

      const result = await repository.getEntityStats(mockUserId);

      expect(result.tech).toBe(2);
      expect(result.person).toBe(1);
      expect(result.concept).toBe(1);
      expect(result.company).toBe(0);
    });

    it("should return zero counts when no data", async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const result = await repository.getEntityStats(mockUserId);

      expect(result.tech).toBe(0);
      expect(result.person).toBe(0);
    });

    it("should throw error on database failure", async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      });

      await expect(repository.getEntityStats(mockUserId)).rejects.toThrow(
        "获取实体统计失败",
      );
    });
  });

  // --------------------------------------------------------------------------
  // getTopEntities
  // --------------------------------------------------------------------------

  describe("getTopEntities", () => {
    it("should return top entities sorted by count", async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              { name: "React", type: "tech", normalized_name: "react" },
              { name: "React", type: "tech", normalized_name: "react" },
              {
                name: "TypeScript",
                type: "tech",
                normalized_name: "typescript",
              },
              { name: "React", type: "tech", normalized_name: "react" },
            ],
            error: null,
          }),
        }),
      });

      const result = await repository.getTopEntities(mockUserId, 10);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("React");
      expect(result[0].count).toBe(3);
      expect(result[1].name).toBe("TypeScript");
      expect(result[1].count).toBe(1);
    });

    it("should limit results to specified count", async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              { name: "A", type: "tech", normalized_name: "a" },
              { name: "B", type: "tech", normalized_name: "b" },
              { name: "C", type: "tech", normalized_name: "c" },
            ],
            error: null,
          }),
        }),
      });

      const result = await repository.getTopEntities(mockUserId, 2);

      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("should return empty array when no data", async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await repository.getTopEntities(mockUserId);

      expect(result).toEqual([]);
    });

    it("should throw error on database failure", async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      });

      await expect(repository.getTopEntities(mockUserId)).rejects.toThrow(
        "获取热门实体失败",
      );
    });
  });
});

// ============================================================================
// Tests: Singleton Pattern
// ============================================================================

describe("Singleton Pattern", () => {
  beforeEach(() => {
    resetEntityRepository();
  });

  it("should return same instance on multiple calls", () => {
    const instance1 = getEntityRepository();
    const instance2 = getEntityRepository();

    expect(instance1).toBe(instance2);
  });

  it("should return new instance after reset", () => {
    const instance1 = getEntityRepository();
    resetEntityRepository();
    const instance2 = getEntityRepository();

    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================================
// Tests: Module Exports
// ============================================================================

describe("Module Exports", () => {
  it("should export EntityRepository class", () => {
    expect(EntityRepository).toBeDefined();
    expect(typeof EntityRepository).toBe("function");
  });

  it("should export getEntityRepository function", () => {
    expect(getEntityRepository).toBeDefined();
    expect(typeof getEntityRepository).toBe("function");
  });

  it("should export resetEntityRepository function", () => {
    expect(resetEntityRepository).toBeDefined();
    expect(typeof resetEntityRepository).toBe("function");
  });
});
