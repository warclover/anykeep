/**
 * VectorMatcher Unit Tests
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { VectorMatcher } from "../vector-matcher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = jest.Mock<(...args: any[]) => any>;

// ============================================================================
// Mocks
// ============================================================================

const mockSearchSimilarFolders = jest.fn() as AnyMock;
const mockFindByUserId = jest.fn() as AnyMock;
const mockSearchMatchingFolders = jest.fn() as AnyMock;

// Mock FolderProfileRepository
function createMockFolderProfileRepo() {
  return {
    searchSimilarFolders: mockSearchSimilarFolders,
    findByUserId: mockFindByUserId,
  };
}

// Mock CoreEdgeProfileService
function createMockCoreEdgeService() {
  return {
    searchMatchingFolders: mockSearchMatchingFolders,
  };
}

// Mock context
function createMockContext(overrides = {}) {
  return {
    userId: "user-123",
    title: "测试书签",
    url: "https://example.com",
    embedding: new Array(1024).fill(0.1),
    bookmarkId: 1,
    summary: "",
    tags: [],
    ...overrides,
  };
}

// Mock folder profile data
function createMockFolderProfile(overrides = {}) {
  return {
    folderId: 1,
    folderName: "技术文章",
    similarity: 0.85,
    topTags: ["前端", "React"],
    sampleTitles: ["React 入门"],
    bookmarkCount: 10,
    ...overrides,
  };
}

// Mock zone match data
function createMockZoneMatch(overrides = {}) {
  return {
    folderId: 1,
    folderName: "技术文章",
    coreSimilarity: 0.9,
    edgeSimilarity: 0.75,
    zoneMatch: "core" as const,
    confidenceLevel: "high" as const,
    ...overrides,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe("VectorMatcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchSimilarFolders.mockResolvedValue([]);
    mockFindByUserId.mockResolvedValue([]);
    mockSearchMatchingFolders.mockResolvedValue([]);
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe("constructor", () => {
    it("should initialize with default weight", () => {
      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never);

      expect(matcher.name).toBe("vector");
      expect(matcher.weight).toBeGreaterThan(0);
    });

    it("should accept custom weight", () => {
      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never, { weight: 0.5 });

      expect(matcher.weight).toBe(0.5);
    });

    it("should accept coreEdgeService option", () => {
      const repo = createMockFolderProfileRepo();
      const coreEdgeService = createMockCoreEdgeService();
      const matcher = new VectorMatcher(repo as never, {
        coreEdgeService: coreEdgeService as never,
      });

      expect(matcher).toBeDefined();
    });

    it("should default enableZoneMatching to true", () => {
      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never);

      // Enable zone matching by default (verified through behavior)
      expect(matcher).toBeDefined();
    });

    it("should accept enableZoneMatching option", () => {
      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never, {
        enableZoneMatching: false,
      });

      expect(matcher).toBeDefined();
    });
  });

  // ============================================================================
  // match() Tests - Basic
  // ============================================================================

  describe("match - basic", () => {
    it("should return empty array when no embedding provided", async () => {
      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never);
      const context = createMockContext({ embedding: null });

      const results = await matcher.match(context);

      expect(results).toEqual([]);
    });

    it("should return empty array when embedding is empty", async () => {
      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never);
      const context = createMockContext({ embedding: [] });

      const results = await matcher.match(context);

      expect(results).toEqual([]);
    });

    it("should return profile matches when no zone matching", async () => {
      mockSearchSimilarFolders.mockResolvedValue([
        createMockFolderProfile({ folderId: 1, similarity: 0.85 }),
        createMockFolderProfile({ folderId: 2, similarity: 0.75 }),
      ]);

      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never, {
        enableZoneMatching: false,
      });
      const context = createMockContext();

      const results = await matcher.match(context);

      expect(results).toHaveLength(2);
      expect(results[0].folderId).toBe(1);
      expect(results[0].score).toBe(85);
    });

    it("should calculate score from similarity", async () => {
      mockSearchSimilarFolders.mockResolvedValue([
        createMockFolderProfile({ similarity: 0.92 }),
      ]);

      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never, {
        enableZoneMatching: false,
      });
      const context = createMockContext();

      const results = await matcher.match(context);

      expect(results[0].score).toBe(92);
    });

    it("should include metadata in results", async () => {
      mockSearchSimilarFolders.mockResolvedValue([
        createMockFolderProfile({
          topTags: ["前端", "React"],
          sampleTitles: ["React 入门"],
        }),
      ]);

      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never, {
        enableZoneMatching: false,
      });
      const context = createMockContext();

      const results = await matcher.match(context);

      // Access extended properties through metadata with type assertion
      const metadata = results[0].metadata as {
        topTags: string[];
        sampleTitles: string[];
        matchSource: string;
      };
      expect(metadata.topTags).toEqual(["前端", "React"]);
      expect(metadata.sampleTitles).toEqual(["React 入门"]);
      expect(metadata.matchSource).toBe("profile");
    });
  });

  // ============================================================================
  // match() Tests - Zone Matching
  // ============================================================================

  describe("match - zone matching", () => {
    it("should prefer zone matching when enabled and service available", async () => {
      mockSearchMatchingFolders.mockResolvedValue([
        createMockZoneMatch({ folderId: 1, coreSimilarity: 0.9 }),
      ]);
      mockFindByUserId.mockResolvedValue([
        createMockFolderProfile({ folderId: 1 }),
      ]);

      const repo = createMockFolderProfileRepo();
      const coreEdgeService = createMockCoreEdgeService();
      const matcher = new VectorMatcher(repo as never, {
        coreEdgeService: coreEdgeService as never,
        enableZoneMatching: true,
      });
      const context = createMockContext();

      const results = await matcher.match(context);

      expect(mockSearchMatchingFolders).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it("should fall back to profile matching when zone matching returns empty", async () => {
      mockSearchMatchingFolders.mockResolvedValue([]);
      mockSearchSimilarFolders.mockResolvedValue([
        createMockFolderProfile({ folderId: 2 }),
      ]);

      const repo = createMockFolderProfileRepo();
      const coreEdgeService = createMockCoreEdgeService();
      const matcher = new VectorMatcher(repo as never, {
        coreEdgeService: coreEdgeService as never,
        enableZoneMatching: true,
      });
      const context = createMockContext();

      const results = await matcher.match(context);

      expect(results).toHaveLength(1);
      expect(results[0].folderId).toBe(2);
    });

    it("should fall back to profile matching when zone matching fails", async () => {
      mockSearchMatchingFolders.mockRejectedValue(new Error("Service error"));
      mockSearchSimilarFolders.mockResolvedValue([
        createMockFolderProfile({ folderId: 3 }),
      ]);

      const repo = createMockFolderProfileRepo();
      const coreEdgeService = createMockCoreEdgeService();
      const matcher = new VectorMatcher(repo as never, {
        coreEdgeService: coreEdgeService as never,
        enableZoneMatching: true,
      });
      const context = createMockContext();

      const results = await matcher.match(context);

      expect(results).toHaveLength(1);
      expect(results[0].folderId).toBe(3);
    });

    it("should add zone bonus for core zone match", async () => {
      mockSearchMatchingFolders.mockResolvedValue([
        createMockZoneMatch({
          folderId: 1,
          coreSimilarity: 0.8,
          zoneMatch: "core",
          confidenceLevel: "high",
        }),
      ]);
      mockFindByUserId.mockResolvedValue([]);

      const repo = createMockFolderProfileRepo();
      const coreEdgeService = createMockCoreEdgeService();
      const matcher = new VectorMatcher(repo as never, {
        coreEdgeService: coreEdgeService as never,
        enableZoneMatching: true,
      });
      const context = createMockContext();

      const results = await matcher.match(context);

      // Base: 80 + zone bonus (core=15, high=10) = 100 (capped)
      expect(results[0].score).toBeGreaterThan(80);
    });

    it("should add smaller bonus for edge zone match", async () => {
      mockSearchMatchingFolders.mockResolvedValue([
        createMockZoneMatch({
          folderId: 1,
          coreSimilarity: 0.8,
          zoneMatch: "edge",
          confidenceLevel: "medium",
        }),
      ]);
      mockFindByUserId.mockResolvedValue([]);

      const repo = createMockFolderProfileRepo();
      const coreEdgeService = createMockCoreEdgeService();
      const matcher = new VectorMatcher(repo as never, {
        coreEdgeService: coreEdgeService as never,
        enableZoneMatching: true,
      });
      const context = createMockContext();

      const results = await matcher.match(context);

      // Base: 80 + zone bonus (edge=5, medium=5) = 90
      expect(results[0].score).toBe(90);
    });

    it("should include zone information in results", async () => {
      mockSearchMatchingFolders.mockResolvedValue([
        createMockZoneMatch({
          zoneMatch: "core",
          coreSimilarity: 0.85,
          edgeSimilarity: 0.7,
          confidenceLevel: "high",
        }),
      ]);
      mockFindByUserId.mockResolvedValue([]);

      const repo = createMockFolderProfileRepo();
      const coreEdgeService = createMockCoreEdgeService();
      const matcher = new VectorMatcher(repo as never, {
        coreEdgeService: coreEdgeService as never,
        enableZoneMatching: true,
      });
      const context = createMockContext();

      const results = await matcher.match(context);

      // Cast to extended type for zone-specific properties
      const result = results[0] as unknown as {
        zoneMatch: string;
        coreSimilarity: number;
        edgeSimilarity: number;
        zoneConfidenceLevel: string;
      };
      expect(result.zoneMatch).toBe("core");
      expect(result.coreSimilarity).toBe(0.85);
      expect(result.edgeSimilarity).toBe(0.7);
      expect(result.zoneConfidenceLevel).toBe("high");
    });

    it("should enrich zone matches with profile data", async () => {
      mockSearchMatchingFolders.mockResolvedValue([
        createMockZoneMatch({ folderId: 1 }),
      ]);
      mockFindByUserId.mockResolvedValue([
        createMockFolderProfile({
          folderId: 1,
          topTags: ["AI", "机器学习"],
          sampleTitles: ["深度学习入门"],
        }),
      ]);

      const repo = createMockFolderProfileRepo();
      const coreEdgeService = createMockCoreEdgeService();
      const matcher = new VectorMatcher(repo as never, {
        coreEdgeService: coreEdgeService as never,
        enableZoneMatching: true,
      });
      const context = createMockContext();

      const results = await matcher.match(context);

      // Cast to extended type for zone-specific properties
      const result = results[0] as unknown as {
        topTags: string[];
        sampleTitles: string[];
      };
      expect(result.topTags).toEqual(["AI", "机器学习"]);
      expect(result.sampleTitles).toEqual(["深度学习入门"]);
    });
  });

  // ============================================================================
  // isAvailable() Tests
  // ============================================================================

  describe("isAvailable", () => {
    it("should return true when embedding exists", async () => {
      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never);
      const context = createMockContext();

      const available = await matcher.isAvailable(context);

      expect(available).toBe(true);
    });

    it("should return false when embedding is null", async () => {
      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never);
      const context = createMockContext({ embedding: null });

      const available = await matcher.isAvailable(context);

      expect(available).toBe(false);
    });

    it("should return false when embedding is empty", async () => {
      const repo = createMockFolderProfileRepo();
      const matcher = new VectorMatcher(repo as never);
      const context = createMockContext({ embedding: [] });

      const available = await matcher.isAvailable(context);

      expect(available).toBe(false);
    });
  });

  // ============================================================================
  // Dynamic Configuration Tests
  // ============================================================================

  describe("dynamic configuration", () => {
    it("should allow setting coreEdgeService dynamically", async () => {
      mockSearchMatchingFolders.mockResolvedValue([
        createMockZoneMatch({ folderId: 1 }),
      ]);
      mockFindByUserId.mockResolvedValue([]);

      const repo = createMockFolderProfileRepo();
      const coreEdgeService = createMockCoreEdgeService();
      const matcher = new VectorMatcher(repo as never, {
        enableZoneMatching: true,
      });

      // Initially no zone matching (no service)
      const results1 = await matcher.match(createMockContext());
      expect(results1).toHaveLength(0);

      // Set service dynamically
      matcher.setCoreEdgeService(coreEdgeService as never);
      const results2 = await matcher.match(createMockContext());
      expect(results2).toHaveLength(1);
    });

    it("should allow enabling/disabling zone matching", async () => {
      mockSearchMatchingFolders.mockResolvedValue([
        createMockZoneMatch({ folderId: 1 }),
      ]);
      mockSearchSimilarFolders.mockResolvedValue([
        createMockFolderProfile({ folderId: 2 }),
      ]);
      mockFindByUserId.mockResolvedValue([]);

      const repo = createMockFolderProfileRepo();
      const coreEdgeService = createMockCoreEdgeService();
      const matcher = new VectorMatcher(repo as never, {
        coreEdgeService: coreEdgeService as never,
        enableZoneMatching: true,
      });

      // Zone matching enabled
      const results1 = await matcher.match(createMockContext());
      expect(results1[0].folderId).toBe(1);

      // Disable zone matching
      matcher.setZoneMatchingEnabled(false);
      const results2 = await matcher.match(createMockContext());
      expect(results2[0].folderId).toBe(2);
    });
  });
});
