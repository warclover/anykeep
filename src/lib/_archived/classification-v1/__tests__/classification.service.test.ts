/**
 * Classification Service Unit Tests
 * Tests for the main classification service
 */

import { ClassificationService } from "../services/classification.service";
import type {
  IMatcher,
  IScoreAggregator,
} from "../strategies/classic/interfaces";
import type { UserStageService } from "../services/user-stage.service";
import type {
  ClassificationResult,
  BookmarkInput,
  MatchResult,
  MatcherContext,
} from "../types";
import * as embeddingModule from "@/lib/utils/embedding-generator";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock embedding generator
jest.mock("@/lib/utils/embedding-generator", () => ({
  generateEmbedding: jest.fn().mockResolvedValue(Array(1536).fill(0.1)),
  buildEmbeddingText: jest.fn().mockReturnValue("test text"),
}));

// Get mocked functions
const mockGenerateEmbedding =
  embeddingModule.generateEmbedding as jest.MockedFunction<
    typeof embeddingModule.generateEmbedding
  >;

// Helper to create mock matcher
const createMockMatcher = (
  name: string,
  weight: number,
  matchResults: MatchResult[] = [],
): IMatcher => ({
  name,
  weight,
  match: jest.fn().mockResolvedValue(matchResults),
  isAvailable: jest.fn().mockResolvedValue(true),
});

// Helper to create mock AI matcher (with setMatcherResults method)
const createMockAIMatcher = (
  matchResults: MatchResult[] = [],
): IMatcher & { setMatcherResults: jest.Mock } => ({
  name: "ai",
  weight: 0.3,
  match: jest.fn().mockResolvedValue(matchResults),
  isAvailable: jest.fn().mockResolvedValue(true),
  setMatcherResults: jest.fn(),
});

// Helper to create mock aggregator
const createMockAggregator = (
  result: ClassificationResult,
): IScoreAggregator => ({
  aggregate: jest.fn().mockReturnValue(result),
});

// Helper to create mock user stage service
const createMockUserStageService = (
  isInColdStart: boolean = false,
): jest.Mocked<UserStageService> =>
  ({
    isInColdStart: jest.fn().mockResolvedValue(isInColdStart),
    getStage: jest.fn().mockResolvedValue("growing"),
  }) as unknown as jest.Mocked<UserStageService>;

// Helper to create mock Supabase client
const createMockSupabase = (): unknown => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
});

describe("ClassificationService", () => {
  let service: ClassificationService;
  let mockMatchers: IMatcher[];
  let mockAggregator: IScoreAggregator;
  let mockUserStageService: jest.Mocked<UserStageService>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  const defaultClassificationResult: ClassificationResult = {
    folderId: 1,
    folderName: "Frontend",
    confidence: 80,
    reason: "High match",
    action: "classify",
    scores: {
      vectorScore: 85,
      historyScore: 70,
      aiScore: 80,
    },
  };

  const testBookmark: BookmarkInput = {
    id: 123,
    title: "React Hooks Tutorial",
    summary: "Learn how to use React Hooks effectively",
    tags: ["react", "hooks", "javascript"],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset embedding mock to return valid embedding
    mockGenerateEmbedding.mockResolvedValue(Array(1536).fill(0.1));

    mockMatchers = [
      createMockMatcher("vector", 0.4, [
        {
          folderId: 1,
          folderName: "Frontend",
          score: 85,
          confidence: 85,
          reason: "Vector match",
        },
      ]),
      createMockMatcher("history", 0.3, [
        {
          folderId: 1,
          folderName: "Frontend",
          score: 70,
          confidence: 70,
          reason: "History match",
        },
      ]),
      // Use mock AI matcher with setMatcherResults method
      createMockAIMatcher([
        {
          folderId: 1,
          folderName: "Frontend",
          score: 80,
          confidence: 80,
          reason: "AI recommends",
        },
      ]),
    ];

    mockAggregator = createMockAggregator(defaultClassificationResult);
    mockUserStageService = createMockUserStageService(false);
    mockSupabase = createMockSupabase();

    service = new ClassificationService(
      mockMatchers,
      mockAggregator,
      mockUserStageService,
      mockSupabase as ConstructorParameters<typeof ClassificationService>[3],
    );
  });

  describe("classify()", () => {
    it("should classify bookmark successfully", async () => {
      const result = await service.classify("user-123", testBookmark);

      expect(result.action).toBe("classify");
      expect(result.folderId).toBe(1);
      expect(result.folderName).toBe("Frontend");
      expect(result.confidence).toBe(80);
    });

    it("should check user stage", async () => {
      await service.classify("user-123", testBookmark);

      expect(mockUserStageService.isInColdStart).toHaveBeenCalledWith(
        "user-123",
      );
    });

    it("should run all matchers for non-cold-start users", async () => {
      await service.classify("user-123", testBookmark);

      for (const matcher of mockMatchers) {
        if (matcher.name !== "ai") {
          expect(matcher.isAvailable).toHaveBeenCalled();
        }
      }
    });

    it("should aggregate results from all matchers", async () => {
      await service.classify("user-123", testBookmark);

      expect(mockAggregator.aggregate).toHaveBeenCalled();
    });

    it("should return inbox result on error", async () => {
      // Make matcher throw error
      mockMatchers[0].match = jest
        .fn()
        .mockRejectedValue(new Error("Match failed"));

      const result = await service.classify("user-123", testBookmark);

      // Should still return a result (aggregator handles partial results)
      expect(result).toBeDefined();
    });

    it("should handle unexpected errors gracefully", async () => {
      // Force an error by making aggregator throw
      mockAggregator.aggregate = jest.fn().mockImplementation(() => {
        throw new Error("Aggregation failed");
      });

      const result = await service.classify("user-123", testBookmark);

      expect(result.action).toBe("inbox");
      expect(result.folderId).toBeNull();
      expect(result.reason).toContain("unexpected error");
    });
  });

  describe("classify() - cold start mode", () => {
    beforeEach(() => {
      mockUserStageService = createMockUserStageService(true);

      service = new ClassificationService(
        mockMatchers,
        mockAggregator,
        mockUserStageService,
        mockSupabase as ConstructorParameters<typeof ClassificationService>[3],
      );
    });

    it("should skip AI matcher in cold start mode", async () => {
      const aiMatcher = mockMatchers.find((m) => m.name === "ai");

      await service.classify("user-123", testBookmark);

      // AI matcher should not be called in cold start mode
      // Note: The service skips AI and history matchers for cold start
      expect(aiMatcher?.match).not.toHaveBeenCalled();
    });

    it("should skip history matcher in cold start mode", async () => {
      const historyMatcher = mockMatchers.find((m) => m.name === "history");

      await service.classify("user-123", testBookmark);

      // History matcher should not be called in cold start mode
      expect(historyMatcher?.match).not.toHaveBeenCalled();
    });

    it("should use vector matcher in cold start mode", async () => {
      const vectorMatcher = mockMatchers.find((m) => m.name === "vector");

      await service.classify("user-123", testBookmark);

      expect(vectorMatcher?.isAvailable).toHaveBeenCalled();
    });
  });

  describe("classify() - no embedding", () => {
    beforeEach(() => {
      // Mock embedding generator to return empty array
      mockGenerateEmbedding.mockResolvedValue([]);
    });

    it("should return inbox when no embedding available", async () => {
      const bookmarkWithoutEmbedding: BookmarkInput = {
        title: "Test",
      };

      const result = await service.classify(
        "user-123",
        bookmarkWithoutEmbedding,
      );

      expect(result.action).toBe("inbox");
      expect(result.reason).toContain("No embedding");
    });
  });

  describe("classifyBatch()", () => {
    it("should classify multiple bookmarks", async () => {
      // Ensure embedding is generated for each bookmark
      mockGenerateEmbedding.mockResolvedValue(Array(1536).fill(0.1));

      const bookmarks: BookmarkInput[] = [
        { id: 1, title: "React Tutorial" },
        { id: 2, title: "Vue Tutorial" },
        { id: 3, title: "Angular Tutorial" },
      ];

      const results = await service.classifyBatch("user-123", bookmarks);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.action).toBe("classify");
      });
    });

    it("should handle individual errors in batch", async () => {
      // Ensure embedding is generated for each bookmark
      mockGenerateEmbedding.mockResolvedValue(Array(1536).fill(0.1));

      // First classification succeeds, second fails
      let callCount = 0;
      mockAggregator.aggregate = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error("Failed");
        }
        return defaultClassificationResult;
      });

      const bookmarks: BookmarkInput[] = [
        { id: 1, title: "First" },
        { id: 2, title: "Second" },
        { id: 3, title: "Third" },
      ];

      const results = await service.classifyBatch("user-123", bookmarks);

      expect(results).toHaveLength(3);
      expect(results[0].action).toBe("classify");
      expect(results[1].action).toBe("inbox"); // Failed one
      expect(results[2].action).toBe("classify");
    });

    it("should handle empty bookmark array", async () => {
      const results = await service.classifyBatch("user-123", []);

      expect(results).toHaveLength(0);
    });
  });

  describe("classify() - matcher availability", () => {
    it("should skip unavailable matchers", async () => {
      // Ensure embedding is generated
      mockGenerateEmbedding.mockResolvedValue(Array(1536).fill(0.1));

      // Make vector matcher unavailable
      mockMatchers[0].isAvailable = jest.fn().mockResolvedValue(false);

      await service.classify("user-123", testBookmark);

      // Vector matcher should not be called since it's unavailable
      expect(mockMatchers[0].match).not.toHaveBeenCalled();
      // History matcher should be called
      expect(mockMatchers[1].match).toHaveBeenCalled();
    });

    it("should handle matcher errors gracefully", async () => {
      // Ensure embedding is generated
      mockGenerateEmbedding.mockResolvedValue(Array(1536).fill(0.1));

      mockMatchers[0].match = jest
        .fn()
        .mockRejectedValue(new Error("Matcher error"));

      const result = await service.classify("user-123", testBookmark);

      // Should still get a result from other matchers
      expect(result).toBeDefined();
      expect(mockAggregator.aggregate).toHaveBeenCalled();
    });
  });

  describe("classify() - with bookmark embedding", () => {
    it("should use provided embedding instead of generating new one", async () => {
      const mockEmbedding = Array(1536).fill(0.5);

      const bookmarkWithEmbedding: BookmarkInput = {
        id: 123,
        title: "Test",
        embedding: mockEmbedding,
      };

      await service.classify("user-123", bookmarkWithEmbedding);

      // Should not call generateEmbedding when embedding is provided
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    });
  });
});

describe("ClassificationService - Integration Tests", () => {
  // These tests verify the integration between service and matchers

  beforeEach(() => {
    // Ensure embedding is generated for integration tests
    mockGenerateEmbedding.mockResolvedValue(Array(1536).fill(0.1));
  });

  it("should pass correct context to matchers", async () => {
    const mockMatcher = createMockMatcher("vector", 0.4);
    let capturedContext: MatcherContext | undefined;

    mockMatcher.match = jest.fn().mockImplementation((ctx: MatcherContext) => {
      capturedContext = ctx;
      return Promise.resolve([]);
    });

    const mockAggregator = createMockAggregator({
      folderId: null,
      folderName: "待整理",
      confidence: 0,
      reason: "No matches",
      action: "inbox",
      scores: { vectorScore: 0, historyScore: 0, aiScore: 0 },
    });

    const service = new ClassificationService(
      [mockMatcher],
      mockAggregator,
      createMockUserStageService(),
      createMockSupabase() as ConstructorParameters<
        typeof ClassificationService
      >[3],
    );

    const bookmark: BookmarkInput = {
      id: 456,
      title: "Test Bookmark",
      summary: "This is a test",
      tags: ["test", "demo"],
    };

    await service.classify("user-789", bookmark);

    expect(capturedContext).toBeDefined();
    expect(capturedContext!.userId).toBe("user-789");
    expect(capturedContext!.title).toBe("Test Bookmark");
    expect(capturedContext!.summary).toBe("This is a test");
    expect(capturedContext!.tags).toEqual(["test", "demo"]);
    expect(capturedContext!.bookmarkId).toBe(456);
  });

  it("should pass all matcher results to aggregator", async () => {
    const vectorResults: MatchResult[] = [
      { folderId: 1, folderName: "A", score: 80, confidence: 80, reason: "" },
    ];
    const historyResults: MatchResult[] = [
      { folderId: 2, folderName: "B", score: 70, confidence: 70, reason: "" },
    ];

    const mockMatchers = [
      createMockMatcher("vector", 0.5, vectorResults),
      createMockMatcher("history", 0.5, historyResults),
    ];

    let capturedResults: Map<string, MatchResult[]> | undefined;
    const mockAggregator: IScoreAggregator = {
      aggregate: jest.fn().mockImplementation((results) => {
        capturedResults = results;
        return {
          folderId: 1,
          folderName: "A",
          confidence: 75,
          reason: "Aggregated",
          action: "classify",
          scores: { vectorScore: 80, historyScore: 70, aiScore: 0 },
        };
      }),
    };

    const service = new ClassificationService(
      mockMatchers,
      mockAggregator,
      createMockUserStageService(),
      createMockSupabase() as ConstructorParameters<
        typeof ClassificationService
      >[3],
    );

    await service.classify("user-123", { title: "Test" });

    expect(capturedResults).toBeDefined();
    expect(capturedResults!.get("vector")).toEqual(vectorResults);
    expect(capturedResults!.get("history")).toEqual(historyResults);
  });
});
