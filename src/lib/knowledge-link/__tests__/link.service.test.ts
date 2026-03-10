/**
 * Link Service Tests
 *
 * 知识关联服务单元测试
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import { LinkService, resetLinkService } from "../services/link.service";
import type { ILinkRepository } from "../repositories/link.repository";
import type { ISimilarityEngineService } from "../services/similarity-engine.service";
import type { IEntityMatcherService } from "../services/entity-matcher.service";
import type {
  KnowledgeLink,
  RelatedBookmark,
  KnowledgeGraphStats,
  DiscoveredLink,
  LinkServiceConfig,
} from "../types/link.types";

// ============================================================================
// Mock Data
// ============================================================================

const mockUserId = "test-user-uuid";
const mockBookmarkId = 123;

const mockRelatedBookmarks: RelatedBookmark[] = [
  {
    bookmark: {
      id: 456,
      title: "React Hooks 深入理解",
      url: "https://example.com/react-hooks",
      platform: "article",
    },
    link: {
      type: "entity",
      strength: 0.8,
      sharedItems: ["React", "Hooks"],
    },
  },
  {
    bookmark: {
      id: 789,
      title: "前端性能优化指南",
      url: "https://example.com/performance",
      platform: "tutorial",
    },
    link: {
      type: "semantic",
      strength: 0.75,
      sharedItems: [],
    },
  },
];

const mockGraphStats: KnowledgeGraphStats = {
  totalBookmarks: 100,
  totalLinks: 250,
  avgLinksPerBookmark: 5,
  linksByType: {
    semantic: 120,
    entity: 80,
    tag: 40,
    topic: 10,
  },
  linksByStrength: {
    strong: 50,
    medium: 120,
    weak: 80,
  },
};

const mockDiscoveredLinks: DiscoveredLink[] = [
  {
    targetBookmarkId: 456,
    linkType: "semantic",
    strength: 0.8,
    evidence: {
      type: "semantic",
      score: 0.8,
      details: { similarityScore: 0.8 },
    },
    algorithm: "vector-cosine-similarity",
  },
];

// ============================================================================
// Mock Implementations
// ============================================================================

const createMockLinkRepository = (): jest.Mocked<ILinkRepository> => ({
  upsertLink: jest.fn().mockResolvedValue("link-id"),
  batchUpsertLinks: jest.fn().mockResolvedValue(1),
  getBookmarkLinks: jest.fn().mockResolvedValue([]),
  getRelatedBookmarks: jest.fn().mockResolvedValue(mockRelatedBookmarks),
  deleteBookmarkLinks: jest.fn().mockResolvedValue(0),
  getGraphStats: jest.fn().mockResolvedValue(mockGraphStats),
  discoverLinks: jest.fn().mockResolvedValue(mockDiscoveredLinks),
  getBookmarkEntities: jest.fn().mockResolvedValue(["React", "Hooks"]),
});

const createMockSimilarityEngine =
  (): jest.Mocked<ISimilarityEngineService> => ({
    findSimilar: jest.fn().mockResolvedValue(mockDiscoveredLinks),
    calculateSimilarity: jest.fn().mockResolvedValue(0.8),
  });

const createMockEntityMatcher = (): jest.Mocked<IEntityMatcherService> => ({
  findBySharedEntities: jest.fn().mockResolvedValue([]),
  getSharedEntities: jest.fn().mockResolvedValue(["React"]),
});

// ============================================================================
// Tests: LinkService
// ============================================================================

describe("LinkService", () => {
  let service: LinkService;
  let mockLinkRepo: jest.Mocked<ILinkRepository>;
  let mockSimilarityEngine: jest.Mocked<ISimilarityEngineService>;
  let mockEntityMatcher: jest.Mocked<IEntityMatcherService>;

  beforeEach(() => {
    resetLinkService();
    mockLinkRepo = createMockLinkRepository();
    mockSimilarityEngine = createMockSimilarityEngine();
    mockEntityMatcher = createMockEntityMatcher();

    service = new LinkService(
      mockLinkRepo,
      mockSimilarityEngine,
      mockEntityMatcher,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // getRelatedBookmarks
  // --------------------------------------------------------------------------

  describe("getRelatedBookmarks", () => {
    it("should return related bookmarks from repository", async () => {
      const result = await service.getRelatedBookmarks(
        mockBookmarkId,
        mockUserId,
      );

      expect(result).toEqual(mockRelatedBookmarks);
      expect(mockLinkRepo.getRelatedBookmarks).toHaveBeenCalledWith(
        mockBookmarkId,
        mockUserId,
        expect.objectContaining({
          limit: 10,
          minStrength: 0.5,
        }),
      );
    });

    it("should pass custom options to repository", async () => {
      await service.getRelatedBookmarks(mockBookmarkId, mockUserId, {
        limit: 20,
        minStrength: 0.5,
        types: ["entity", "tag"],
      });

      expect(mockLinkRepo.getRelatedBookmarks).toHaveBeenCalledWith(
        mockBookmarkId,
        mockUserId,
        {
          limit: 20,
          minStrength: 0.5,
          types: ["entity", "tag"],
        },
      );
    });
  });

  // --------------------------------------------------------------------------
  // getBookmarkLinks
  // --------------------------------------------------------------------------

  describe("getBookmarkLinks", () => {
    it("should return bookmark links from repository", async () => {
      const mockLinks: KnowledgeLink[] = [
        {
          id: "link-1",
          userId: mockUserId,
          sourceBookmarkId: mockBookmarkId,
          targetBookmarkId: 456,
          linkType: "entity",
          strength: 0.8,
          evidence: {
            type: "entity",
            score: 0.8,
            details: { sharedEntities: ["React"] },
          },
          createdAt: new Date().toISOString(),
        },
      ];
      mockLinkRepo.getBookmarkLinks.mockResolvedValue(mockLinks);

      const result = await service.getBookmarkLinks(mockBookmarkId, mockUserId);

      expect(result).toEqual(mockLinks);
      expect(mockLinkRepo.getBookmarkLinks).toHaveBeenCalledWith(
        mockBookmarkId,
        expect.objectContaining({ userId: mockUserId }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // getGraphStats
  // --------------------------------------------------------------------------

  describe("getGraphStats", () => {
    it("should return graph stats from repository", async () => {
      const result = await service.getGraphStats(mockUserId);

      expect(result).toEqual(mockGraphStats);
      expect(mockLinkRepo.getGraphStats).toHaveBeenCalledWith(mockUserId);
    });
  });

  // --------------------------------------------------------------------------
  // rebuildLinks
  // --------------------------------------------------------------------------

  describe("rebuildLinks", () => {
    it("should delete existing links before rebuilding", async () => {
      mockLinkRepo.deleteBookmarkLinks.mockResolvedValue(5);
      mockLinkRepo.getBookmarkLinks.mockResolvedValue([]);

      await service.rebuildLinks(mockBookmarkId, mockUserId);

      expect(mockLinkRepo.deleteBookmarkLinks).toHaveBeenCalledWith(
        mockBookmarkId,
      );
    });
  });
});

// ============================================================================
// Tests: LinkServiceConfig
// ============================================================================

describe("LinkServiceConfig", () => {
  it("should use default config when not provided", () => {
    const service = new LinkService(
      createMockLinkRepository(),
      createMockSimilarityEngine(),
      createMockEntityMatcher(),
    );

    // Service should be created without errors
    expect(service).toBeDefined();
  });

  it("should merge custom config with defaults", () => {
    const customConfig: Partial<LinkServiceConfig> = {
      enableSemantic: false,
      semanticThreshold: 0.9,
    };

    const service = new LinkService(
      createMockLinkRepository(),
      createMockSimilarityEngine(),
      createMockEntityMatcher(),
      customConfig,
    );

    expect(service).toBeDefined();
  });
});

// ============================================================================
// Tests: Module Exports
// ============================================================================

describe("Module Exports", () => {
  it("should export LinkService class", () => {
    expect(LinkService).toBeDefined();
    expect(typeof LinkService).toBe("function");
  });

  it("should export resetLinkService function", () => {
    expect(resetLinkService).toBeDefined();
    expect(typeof resetLinkService).toBe("function");
  });
});
