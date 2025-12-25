/**
 * ContentRouter Unit Tests
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { ContentRouter, type RouteInput } from "../content-router";

// ============================================================================
// Mocks
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

// Mock source profile service
const mockGetOrCreateFromUrl = jest.fn();
const mockGetQuickMatch = jest.fn();

jest.mock("@/lib/source-profile/source-profile.service", () => ({
  sourceProfileService: {
    getOrCreateFromUrl: (...args: unknown[]) => mockGetOrCreateFromUrl(...args),
    getQuickMatch: (...args: unknown[]) => mockGetQuickMatch(...args),
  },
}));

// Mock tag matcher
const mockTryTagMatch = jest.fn();

jest.mock("../tag-matcher", () => ({
  tagMatcher: {
    tryTagMatch: (...args: unknown[]) => mockTryTagMatch(...args),
  },
}));

// Mock title matcher
const mockTryTitleMatch = jest.fn();

jest.mock("../title-matcher", () => ({
  titleMatcher: {
    tryTitleMatch: (...args: unknown[]) => mockTryTitleMatch(...args),
  },
}));

// Mock config
jest.mock("@/lib/trust-mode/config", () => ({
  FAST_PATH_THRESHOLDS: {
    MIN_SOURCE_CONFIDENCE: 80,
    MIN_TAG_MATCH_SCORE: 70,
    MIN_TITLE_MATCH_SCORE: 75,
  },
  CONTENT_ROUTER_CONFIG: {
    FAST_PATH_TIMEOUT_MS: 100,
    SLOW_PATH_TIMEOUT_MS: 2000,
  },
  CONFIDENCE_THRESHOLDS: {
    HIGH: 85,
    MEDIUM: 60,
    LOW: 40,
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createSampleInput(overrides?: Partial<RouteInput>): RouteInput {
  return {
    userId: "user-123",
    url: "https://example.com/article",
    title: "React 18 新特性详解",
    content: "这是一篇关于 React 的文章",
    tags: ["React", "前端"],
    ...overrides,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe("ContentRouter", () => {
  let router: ContentRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    router = new ContentRouter();

    // Default mock returns
    mockGetOrCreateFromUrl.mockResolvedValue(null);
    mockGetQuickMatch.mockResolvedValue({ found: false });
    mockTryTagMatch.mockResolvedValue({ found: false, confidence: 0 });
    mockTryTitleMatch.mockResolvedValue({ found: false, confidence: 0 });
  });

  // ============================================================================
  // route() Tests
  // ============================================================================

  describe("route", () => {
    describe("fast path - high confidence", () => {
      it("should return fast path when source match has high confidence", async () => {
        mockGetQuickMatch.mockResolvedValue({
          found: true,
          suggestedFolderId: 1,
          confidence: 90,
          reason: "Known source: example.com",
        });

        const input = createSampleInput();
        const result = await router.route(input);

        expect(result.path).toBe("fast");
        expect(result.confidence).toBe(90);
        expect(result.needsSlowPathValidation).toBe(false);
        expect(result.fastPathResult?.matchType).toBe("source");
      });

      it("should return fast path when tag match has high confidence", async () => {
        mockGetQuickMatch.mockResolvedValue({ found: false });
        mockTryTagMatch.mockResolvedValue({
          found: true,
          suggestedFolderId: 2,
          confidence: 88,
          reason: "Tags match folder: 前端开发",
        });

        const input = createSampleInput();
        const result = await router.route(input);

        expect(result.path).toBe("fast");
        expect(result.confidence).toBe(88);
        expect(result.fastPathResult?.matchType).toBe("tag");
      });

      it("should return fast path when title match has high confidence", async () => {
        mockGetQuickMatch.mockResolvedValue({ found: false });
        mockTryTagMatch.mockResolvedValue({ found: false, confidence: 0 });
        mockTryTitleMatch.mockResolvedValue({
          found: true,
          suggestedFolderId: 3,
          confidence: 86,
          reason: "Title similar to existing bookmarks",
        });

        const input = createSampleInput();
        const result = await router.route(input);

        expect(result.path).toBe("fast");
        expect(result.confidence).toBe(86);
        expect(result.fastPathResult?.matchType).toBe("title");
      });
    });

    describe("hybrid path - medium confidence", () => {
      it("should return hybrid path when source match has medium confidence", async () => {
        mockGetQuickMatch.mockResolvedValue({
          found: true,
          suggestedFolderId: 1,
          confidence: 80, // meets MIN_SOURCE_CONFIDENCE but below HIGH (85)
          reason: "Source match",
        });

        const input = createSampleInput();
        const result = await router.route(input);

        expect(result.path).toBe("hybrid");
        expect(result.needsSlowPathValidation).toBe(true);
      });

      it("should return hybrid path when tag match has medium confidence", async () => {
        mockGetQuickMatch.mockResolvedValue({ found: false });
        mockTryTagMatch.mockResolvedValue({
          found: true,
          suggestedFolderId: 2,
          confidence: 75,
          reason: "Tag match",
        });

        const input = createSampleInput();
        const result = await router.route(input);

        expect(result.path).toBe("hybrid");
        expect(result.needsSlowPathValidation).toBe(true);
      });
    });

    describe("slow path", () => {
      it("should return slow path when no match found", async () => {
        const input = createSampleInput();
        const result = await router.route(input);

        expect(result.path).toBe("slow");
        expect(result.needsSlowPathValidation).toBe(false);
        expect(result.reason).toContain("No confident fast path match");
      });

      it("should return slow path when match has low confidence", async () => {
        mockGetQuickMatch.mockResolvedValue({
          found: true,
          suggestedFolderId: 1,
          confidence: 50, // below medium threshold
          reason: "Weak source match",
        });

        const input = createSampleInput();
        const result = await router.route(input);

        expect(result.path).toBe("slow");
      });

      it("should return slow path for complex content", async () => {
        const input = createSampleInput({
          content: "x".repeat(5000), // long content
        });
        const result = await router.route(input);

        expect(result.path).toBe("slow");
      });
    });

    describe("estimated time", () => {
      it("should estimate fast path time correctly", async () => {
        mockGetQuickMatch.mockResolvedValue({
          found: true,
          suggestedFolderId: 1,
          confidence: 90,
          reason: "Source match",
        });

        const input = createSampleInput();
        const result = await router.route(input);

        expect(result.estimatedTimeMs).toBe(100); // FAST_PATH_TIMEOUT_MS
      });

      it("should estimate slow path time correctly", async () => {
        const input = createSampleInput();
        const result = await router.route(input);

        expect(result.estimatedTimeMs).toBe(2000); // SLOW_PATH_TIMEOUT_MS
      });
    });
  });

  // ============================================================================
  // tryFastPath() Tests
  // ============================================================================

  describe("tryFastPath", () => {
    it("should prioritize source match over tag match", async () => {
      mockGetQuickMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: 1,
        confidence: 85,
        reason: "Source match",
      });
      mockTryTagMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: 2,
        confidence: 90,
        reason: "Tag match",
      });

      const input = createSampleInput();
      const result = await router.tryFastPath(input);

      expect(result.matchType).toBe("source");
      expect(result.suggestedFolderId).toBe(1);
    });

    it("should prioritize tag match over title match", async () => {
      mockGetQuickMatch.mockResolvedValue({ found: false });
      mockTryTagMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: 2,
        confidence: 80,
        reason: "Tag match",
      });
      mockTryTitleMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: 3,
        confidence: 85,
        reason: "Title match",
      });

      const input = createSampleInput();
      const result = await router.tryFastPath(input);

      expect(result.matchType).toBe("tag");
      expect(result.suggestedFolderId).toBe(2);
    });

    it("should fall back to title match when tags not provided", async () => {
      mockGetQuickMatch.mockResolvedValue({ found: false });
      mockTryTitleMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: 3,
        confidence: 80,
        reason: "Title match",
      });

      const input = createSampleInput({ tags: undefined });
      const result = await router.tryFastPath(input);

      expect(result.matchType).toBe("title");
      expect(mockTryTagMatch).not.toHaveBeenCalled();
    });

    it("should skip title match for short titles", async () => {
      mockGetQuickMatch.mockResolvedValue({ found: false });

      const input = createSampleInput({ title: "Hi", tags: undefined });
      const result = await router.tryFastPath(input);

      expect(result.matchType).toBe("none");
      expect(mockTryTitleMatch).not.toHaveBeenCalled();
    });

    it("should return none when no matches found", async () => {
      const input = createSampleInput();
      const result = await router.tryFastPath(input);

      expect(result.matchType).toBe("none");
      expect(result.suggestedFolderId).toBeNull();
    });

    it("should include source match in tag match result", async () => {
      mockGetQuickMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: null,
        confidence: 50, // below threshold but found
        reason: "Weak source match",
      });
      mockTryTagMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: 2,
        confidence: 80,
        reason: "Tag match",
      });

      const input = createSampleInput();
      const result = await router.tryFastPath(input);

      expect(result.matchType).toBe("tag");
      expect(result.sourceMatch).toBeDefined();
    });

    it("should handle source match below threshold", async () => {
      mockGetQuickMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: 1,
        confidence: 60, // below MIN_SOURCE_CONFIDENCE (80)
        reason: "Weak source match",
      });

      const input = createSampleInput({ tags: undefined });
      const result = await router.tryFastPath(input);

      expect(result.matchType).not.toBe("source");
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should handle source match error gracefully", async () => {
      mockGetOrCreateFromUrl.mockRejectedValue(new Error("Network error"));
      mockGetQuickMatch.mockRejectedValue(new Error("Network error"));

      const input = createSampleInput();
      const result = await router.tryFastPath(input);

      expect(result.matchType).toBe("none");
      // When source match fails, sourceMatch will be undefined or have found: false
      expect(result.sourceMatch?.found ?? false).toBe(false);
    });

    it("should continue with tag match after source error", async () => {
      mockGetQuickMatch.mockRejectedValue(new Error("Source error"));
      mockTryTagMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: 2,
        confidence: 85,
        reason: "Tag match",
      });

      const input = createSampleInput();
      const result = await router.tryFastPath(input);

      expect(result.matchType).toBe("tag");
    });
  });

  // ============================================================================
  // Integration-like Tests
  // ============================================================================

  describe("real-world scenarios", () => {
    it("should handle WeChat article URL", async () => {
      mockGetQuickMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: 10,
        confidence: 92,
        reason: "WeChat public account: 前端早读课",
      });

      const input = createSampleInput({
        url: "https://mp.weixin.qq.com/s/abc123",
        sourceName: "前端早读课",
      });
      const result = await router.route(input);

      expect(result.path).toBe("fast");
      expect(result.fastPathResult?.matchType).toBe("source");
    });

    it("should handle GitHub repository URL", async () => {
      mockGetQuickMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: 20,
        confidence: 88,
        reason: "GitHub repository",
      });

      const input = createSampleInput({
        url: "https://github.com/facebook/react",
        title: "React - A JavaScript library for building user interfaces",
      });
      const result = await router.route(input);

      expect(result.path).toBe("fast");
    });

    it("should handle unknown source with matching tags", async () => {
      mockGetQuickMatch.mockResolvedValue({ found: false });
      mockTryTagMatch.mockResolvedValue({
        found: true,
        suggestedFolderId: 5,
        confidence: 82,
        reason: "Multiple tag matches",
      });

      const input = createSampleInput({
        url: "https://unknown-blog.com/post",
        tags: ["TypeScript", "Node.js", "后端"],
      });
      const result = await router.route(input);

      expect(result.path).toBe("hybrid");
      expect(result.fastPathResult?.matchType).toBe("tag");
    });
  });
});
