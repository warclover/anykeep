/**
 * Entity Matcher Service Tests
 *
 * 实体匹配服务单元测试
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import {
  EntityMatcherService,
  getEntityMatcherService,
  resetEntityMatcherService,
  type EntityMatchConfig,
} from "../services/entity-matcher.service";

// ============================================================================
// Mock Data
// ============================================================================

const mockUserId = "test-user-uuid";
const mockBookmarkId = 123;
const mockEntityNames = ["React", "TypeScript", "Next.js"];

const mockSharedEntityResults = [
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

const mockEntities1 = [
  { normalized_name: "react" },
  { normalized_name: "typescript" },
  { normalized_name: "next.js" },
];

const mockEntities2 = [
  { normalized_name: "react" },
  { normalized_name: "vue" },
];

// ============================================================================
// Mock Supabase Client
// ============================================================================

const createMockSupabase = () => ({
  rpc: jest.fn().mockResolvedValue({
    data: mockSharedEntityResults,
    error: null,
  }),
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: mockEntities1,
        error: null,
      }),
    }),
  }),
});

// ============================================================================
// Tests: EntityMatcherService
// ============================================================================

describe("EntityMatcherService", () => {
  let service: EntityMatcherService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    resetEntityMatcherService();
    mockSupabase = createMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new EntityMatcherService(mockSupabase as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // findBySharedEntities
  // --------------------------------------------------------------------------

  describe("findBySharedEntities", () => {
    it("should return discovered links from shared entities", async () => {
      const result = await service.findBySharedEntities(
        mockUserId,
        mockEntityNames,
        mockBookmarkId,
      );

      expect(result).toHaveLength(2);
      expect(result[0].linkType).toBe("entity");
      expect(result[0].targetBookmarkId).toBe(456);
    });

    it("should calculate strength based on shared count", async () => {
      const result = await service.findBySharedEntities(
        mockUserId,
        mockEntityNames,
        mockBookmarkId,
      );

      // shared_count = 2, strength = min(2/3, 1) = 0.666...
      expect(result[0].strength).toBeCloseTo(2 / 3, 2);
      // shared_count = 1, strength = min(1/3, 1) = 0.333...
      expect(result[1].strength).toBeCloseTo(1 / 3, 2);
    });

    it("should cap strength at 1", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            bookmark_id: 456,
            shared_entities: ["a", "b", "c", "d"],
            shared_count: 5,
          },
        ],
        error: null,
      });

      const result = await service.findBySharedEntities(
        mockUserId,
        ["a", "b", "c", "d", "e"],
        mockBookmarkId,
      );

      expect(result[0].strength).toBe(1);
    });

    it("should call RPC with correct parameters", async () => {
      await service.findBySharedEntities(
        mockUserId,
        mockEntityNames,
        mockBookmarkId,
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "find_bookmarks_by_shared_entities",
        {
          p_user_id: mockUserId,
          p_entity_names: mockEntityNames,
          p_exclude_bookmark_id: mockBookmarkId,
          p_min_shared: 1,
          p_limit: 10,
        },
      );
    });

    it("should use custom config when provided", async () => {
      const customConfig: Partial<EntityMatchConfig> = {
        minShared: 2,
        limit: 5,
      };

      await service.findBySharedEntities(
        mockUserId,
        mockEntityNames,
        mockBookmarkId,
        customConfig,
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "find_bookmarks_by_shared_entities",
        {
          p_user_id: mockUserId,
          p_entity_names: mockEntityNames,
          p_exclude_bookmark_id: mockBookmarkId,
          p_min_shared: 2,
          p_limit: 5,
        },
      );
    });

    it("should return empty array when entityNames is empty", async () => {
      const result = await service.findBySharedEntities(
        mockUserId,
        [],
        mockBookmarkId,
      );

      expect(result).toEqual([]);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it("should return empty array when entityNames is null/undefined", async () => {
      const result = await service.findBySharedEntities(
        mockUserId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any,
        mockBookmarkId,
      );

      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error("Database error"),
      });

      const result = await service.findBySharedEntities(
        mockUserId,
        mockEntityNames,
        mockBookmarkId,
      );

      expect(result).toEqual([]);
    });

    it("should include correct evidence in result", async () => {
      const result = await service.findBySharedEntities(
        mockUserId,
        mockEntityNames,
        mockBookmarkId,
      );

      expect(result[0].evidence).toEqual({
        type: "entity",
        score: 2 / mockEntityNames.length,
        details: {
          sharedEntities: ["React", "TypeScript"],
        },
      });
      expect(result[0].algorithm).toBe("entity-matching");
    });
  });

  // --------------------------------------------------------------------------
  // getSharedEntities
  // --------------------------------------------------------------------------

  describe("getSharedEntities", () => {
    it("should return shared entities between two bookmarks", async () => {
      // Setup mocks for two consecutive calls
      const fromMock = jest.fn();
      fromMock
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockEntities1,
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockEntities2,
              error: null,
            }),
          }),
        });

      mockSupabase.from = fromMock;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testService = new EntityMatcherService(mockSupabase as any);

      const result = await testService.getSharedEntities(123, 456);

      expect(result).toContain("react");
      expect(result).not.toContain("typescript");
      expect(result).not.toContain("vue");
    });

    it("should return empty array when first bookmark has no entities", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const result = await service.getSharedEntities(123, 456);

      expect(result).toEqual([]);
    });

    it("should return empty array on database error", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: new Error("DB Error"),
          }),
        }),
      });

      const result = await service.getSharedEntities(123, 456);

      expect(result).toEqual([]);
    });
  });
});

// ============================================================================
// Tests: Singleton Pattern
// ============================================================================

describe("Singleton Pattern", () => {
  beforeEach(() => {
    resetEntityMatcherService();
  });

  it("should return same instance on multiple calls", () => {
    const instance1 = getEntityMatcherService();
    const instance2 = getEntityMatcherService();

    expect(instance1).toBe(instance2);
  });

  it("should return new instance after reset", () => {
    const instance1 = getEntityMatcherService();
    resetEntityMatcherService();
    const instance2 = getEntityMatcherService();

    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================================
// Tests: Module Exports
// ============================================================================

describe("Module Exports", () => {
  it("should export EntityMatcherService class", () => {
    expect(EntityMatcherService).toBeDefined();
    expect(typeof EntityMatcherService).toBe("function");
  });

  it("should export getEntityMatcherService function", () => {
    expect(getEntityMatcherService).toBeDefined();
    expect(typeof getEntityMatcherService).toBe("function");
  });

  it("should export resetEntityMatcherService function", () => {
    expect(resetEntityMatcherService).toBeDefined();
    expect(typeof resetEntityMatcherService).toBe("function");
  });
});
