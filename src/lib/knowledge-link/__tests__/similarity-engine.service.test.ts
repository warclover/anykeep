/**
 * Similarity Engine Service Tests
 *
 * 语义相似度引擎服务单元测试
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SimilarityEngineService,
  getSimilarityEngineService,
  resetSimilarityEngineService,
  type SimilarityConfig,
} from "../services/similarity-engine.service";

// ============================================================================
// Mock Data
// ============================================================================

const mockUserId = "test-user-uuid";
const mockBookmarkId = 123;

const mockSimilarBookmarks = [
  { bookmark_id: 456, title: "相似文章 1", similarity: 0.85 },
  { bookmark_id: 789, title: "相似文章 2", similarity: 0.75 },
];

const mockBookmarksWithEmbedding = [
  { id: 123, embedding: [0.1, 0.2, 0.3, 0.4, 0.5] },
  { id: 456, embedding: [0.1, 0.2, 0.3, 0.4, 0.6] },
];

// ============================================================================
// Mock Supabase Client
// ============================================================================

const createMockSupabase = () => ({
  rpc: jest.fn().mockResolvedValue({ data: mockSimilarBookmarks, error: null }),
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      in: jest.fn().mockResolvedValue({
        data: mockBookmarksWithEmbedding,
        error: null,
      }),
    }),
  }),
});

// ============================================================================
// Tests: SimilarityEngineService
// ============================================================================

describe("SimilarityEngineService", () => {
  let service: SimilarityEngineService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    resetSimilarityEngineService();
    mockSupabase = createMockSupabase();
    service = new SimilarityEngineService(
      mockSupabase as unknown as SupabaseClient,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // findSimilar
  // --------------------------------------------------------------------------

  describe("findSimilar", () => {
    it("should return discovered links from similar bookmarks", async () => {
      const result = await service.findSimilar(mockUserId, mockBookmarkId);

      expect(result).toHaveLength(2);
      expect(result[0].linkType).toBe("semantic");
      expect(result[0].targetBookmarkId).toBe(456);
      expect(result[0].strength).toBe(0.85);
    });

    it("should call RPC with correct parameters", async () => {
      await service.findSimilar(mockUserId, mockBookmarkId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "find_similar_bookmarks_for_linking",
        {
          p_user_id: mockUserId,
          p_bookmark_id: mockBookmarkId,
          p_min_similarity: 0.7,
          p_limit: 10,
        },
      );
    });

    it("should use custom config when provided", async () => {
      const customConfig: Partial<SimilarityConfig> = {
        minSimilarity: 0.8,
        limit: 5,
      };

      await service.findSimilar(mockUserId, mockBookmarkId, customConfig);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "find_similar_bookmarks_for_linking",
        {
          p_user_id: mockUserId,
          p_bookmark_id: mockBookmarkId,
          p_min_similarity: 0.8,
          p_limit: 5,
        },
      );
    });

    it("should return empty array on error", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error("Database error"),
      });

      const result = await service.findSimilar(mockUserId, mockBookmarkId);

      expect(result).toEqual([]);
    });

    it("should return empty array when data is null", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.findSimilar(mockUserId, mockBookmarkId);

      expect(result).toEqual([]);
    });

    it("should include correct evidence in result", async () => {
      const result = await service.findSimilar(mockUserId, mockBookmarkId);

      expect(result[0].evidence).toEqual({
        type: "semantic",
        score: 0.85,
        details: {
          similarityScore: 0.85,
        },
      });
      expect(result[0].algorithm).toBe("vector-cosine-similarity");
    });
  });

  // --------------------------------------------------------------------------
  // calculateSimilarity
  // --------------------------------------------------------------------------

  describe("calculateSimilarity", () => {
    it("should return similarity between two bookmarks", async () => {
      const result = await service.calculateSimilarity(123, 456);

      // The cosine similarity should be close to 1 (vectors are similar)
      expect(result).toBeGreaterThan(0.9);
    });

    it("should return 0 when bookmarks not found", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await service.calculateSimilarity(123, 456);

      expect(result).toBe(0);
    });

    it("should return 0 when only one bookmark found", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [mockBookmarksWithEmbedding[0]],
            error: null,
          }),
        }),
      });

      const result = await service.calculateSimilarity(123, 456);

      expect(result).toBe(0);
    });

    it("should return 0 when embedding is missing", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [
              { id: 123, embedding: null },
              { id: 456, embedding: [0.1, 0.2] },
            ],
            error: null,
          }),
        }),
      });

      const result = await service.calculateSimilarity(123, 456);

      expect(result).toBe(0);
    });

    it("should return 0 on database error", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: null,
            error: new Error("DB Error"),
          }),
        }),
      });

      const result = await service.calculateSimilarity(123, 456);

      expect(result).toBe(0);
    });
  });
});

// ============================================================================
// Tests: Cosine Similarity Algorithm
// ============================================================================

describe("Cosine Similarity Algorithm", () => {
  // Tests create their own service instances with specific mocks

  it("should return 1 for identical vectors", async () => {
    const mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [
              { id: 1, embedding: [1, 0, 0] },
              { id: 2, embedding: [1, 0, 0] },
            ],
            error: null,
          }),
        }),
      }),
    };
    const testService = new SimilarityEngineService(
      mockSupabase as unknown as SupabaseClient,
    );

    const result = await testService.calculateSimilarity(1, 2);

    expect(result).toBeCloseTo(1, 5);
  });

  it("should return 0 for orthogonal vectors", async () => {
    const mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [
              { id: 1, embedding: [1, 0, 0] },
              { id: 2, embedding: [0, 1, 0] },
            ],
            error: null,
          }),
        }),
      }),
    };
    const testService = new SimilarityEngineService(
      mockSupabase as unknown as SupabaseClient,
    );

    const result = await testService.calculateSimilarity(1, 2);

    expect(result).toBeCloseTo(0, 5);
  });
});

// ============================================================================
// Tests: Singleton Pattern
// ============================================================================

describe("Singleton Pattern", () => {
  beforeEach(() => {
    resetSimilarityEngineService();
  });

  it("should return same instance on multiple calls", () => {
    const instance1 = getSimilarityEngineService();
    const instance2 = getSimilarityEngineService();

    expect(instance1).toBe(instance2);
  });

  it("should return new instance after reset", () => {
    const instance1 = getSimilarityEngineService();
    resetSimilarityEngineService();
    const instance2 = getSimilarityEngineService();

    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================================
// Tests: Module Exports
// ============================================================================

describe("Module Exports", () => {
  it("should export SimilarityEngineService class", () => {
    expect(SimilarityEngineService).toBeDefined();
    expect(typeof SimilarityEngineService).toBe("function");
  });

  it("should export getSimilarityEngineService function", () => {
    expect(getSimilarityEngineService).toBeDefined();
    expect(typeof getSimilarityEngineService).toBe("function");
  });

  it("should export resetSimilarityEngineService function", () => {
    expect(resetSimilarityEngineService).toBeDefined();
    expect(typeof resetSimilarityEngineService).toBe("function");
  });
});
