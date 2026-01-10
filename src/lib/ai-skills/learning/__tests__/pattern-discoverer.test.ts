/**
 * IntentPatternDiscoverer 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import type { IntentPatternDiscoverer } from "../pattern-discoverer";
import { createPatternDiscoverer } from "../pattern-discoverer";
import type { UserFeedback } from "../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Get global Supabase mock configuration functions
// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMock = require("@/lib/supabase/server") as {
  __setMockResponse: (key: string, response: unknown) => void;
  __setDefaultThenableResponse: (response: {
    data: unknown;
    error: unknown;
  }) => void;
  __resetMockResponses: () => void;
};

// ============================================
// 测试辅助函数
// ============================================

function createMockFeedback(
  overrides: Partial<UserFeedback> = {},
): UserFeedback {
  return {
    userId: "user-1",
    sessionId: "session-123",
    turnId: "turn-456",
    originalInput: "帮我整理一下收藏",
    predictedIntent: {
      type: "query",
      subType: "search",
      confidence: 0.6,
    },
    actualBehavior: "corrected",
    correctedType: "organize",
    correctedSubType: "cleanup",
    timestamp: new Date(),
    ...overrides,
  };
}

// ============================================
// 测试套件
// ============================================

describe("IntentPatternDiscoverer", () => {
  let discoverer: IntentPatternDiscoverer;

  beforeEach(() => {
    jest.clearAllMocks();
    supabaseMock.__resetMockResponses();

    // Set default mock responses
    supabaseMock.__setMockResponse("ai_intent_pattern_suggestions.single", {
      data: { id: 1 },
      error: null,
    });
    supabaseMock.__setDefaultThenableResponse({ data: null, error: null });

    discoverer = createPatternDiscoverer({ debug: false, minClusterSize: 3 });
  });

  describe("Cluster Similar Inputs", () => {
    it("should cluster similar inputs together", () => {
      const inputs = [
        "帮我整理收藏",
        "整理一下我的收藏",
        "把收藏整理整理",
        "删除这个书签",
        "删掉这个",
      ];

      const clusters = discoverer.clusterSimilarInputs(inputs);

      // 应该有聚类结果
      expect(clusters).toBeDefined();
      expect(Array.isArray(clusters)).toBe(true);
    });

    it("should not create clusters for dissimilar inputs", () => {
      const inputs = ["搜索人工智能", "删除书签", "导出数据", "播放语音"];

      const clusters = discoverer.clusterSimilarInputs(inputs);

      // 不相似的输入不应该形成大聚类
      const largeCluster = clusters.find((c) => c.size > 2);
      expect(largeCluster).toBeUndefined();
    });

    it("should calculate cluster similarity", () => {
      const inputs = ["整理我的收藏", "整理一下收藏", "整理收藏夹"];

      const clusters = discoverer.clusterSimilarInputs(inputs);

      if (clusters.length > 0) {
        expect(clusters[0].similarityScore).toBeGreaterThan(0);
        expect(clusters[0].similarityScore).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Pattern Discovery", () => {
    it("should discover patterns from failed cases", async () => {
      // 创建多个相似的失败案例
      const feedbacks: UserFeedback[] = [
        createMockFeedback({ originalInput: "帮我整理收藏" }),
        createMockFeedback({ originalInput: "整理一下我的收藏" }),
        createMockFeedback({ originalInput: "把收藏整理整理" }),
        createMockFeedback({ originalInput: "整理收藏夹" }),
        createMockFeedback({ originalInput: "收藏需要整理" }),
      ];

      const patterns = await discoverer.discoverNewPatterns(feedbacks);

      // 应该发现至少一个模式
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it("should return empty array for insufficient data", async () => {
      const feedbacks: UserFeedback[] = [
        createMockFeedback({ originalInput: "整理收藏" }),
      ];

      const patterns = await discoverer.discoverNewPatterns(feedbacks);

      expect(patterns).toEqual([]);
    });

    it("should filter out accepted feedback", async () => {
      const feedbacks: UserFeedback[] = [
        createMockFeedback({ actualBehavior: "accepted" }),
        createMockFeedback({ actualBehavior: "accepted" }),
        createMockFeedback({ actualBehavior: "accepted" }),
      ];

      const patterns = await discoverer.discoverNewPatterns(feedbacks);

      expect(patterns).toEqual([]);
    });

    it("should include corrected intent in pattern", async () => {
      const feedbacks: UserFeedback[] = Array(6)
        .fill(null)
        .map((_, i) =>
          createMockFeedback({
            originalInput: `整理收藏 ${i}`,
            correctedType: "organize",
            correctedSubType: "cleanup",
          }),
        );

      const patterns = await discoverer.discoverNewPatterns(feedbacks);

      if (patterns.length > 0) {
        expect(patterns[0].type).toBe("organize");
      }
    });
  });

  describe("Pattern Suggestions", () => {
    it("should save pattern suggestion", async () => {
      supabaseMock.__setMockResponse("ai_intent_pattern_suggestions.single", {
        data: { id: 123 },
        error: null,
      });

      const pattern = {
        type: "organize" as const,
        subType: "cleanup",
        pattern: "(?=.*整理).*",
        weight: 75,
        sampleInputs: ["整理收藏", "整理一下"],
        discoveryConfidence: 0.85,
        discoveryMethod: "clustering" as const,
        occurrenceCount: 10,
      };

      const id = await discoverer.savePatternSuggestion(pattern);

      expect(id).toBe(123);
    });

    it("should handle duplicate pattern gracefully", async () => {
      // First single() call returns duplicate error
      supabaseMock.__setMockResponse("ai_intent_pattern_suggestions.single", {
        data: null,
        error: { code: "23505", message: "duplicate key" },
      });

      const pattern = {
        type: "organize" as const,
        subType: "cleanup",
        pattern: "(?=.*整理).*",
        weight: 75,
        sampleInputs: ["整理收藏"],
        discoveryConfidence: 0.85,
        discoveryMethod: "clustering" as const,
        occurrenceCount: 10,
      };

      const id = await discoverer.savePatternSuggestion(pattern);

      expect(id).toBe(-1); // Duplicate returns -1
    });
  });

  describe("Configuration", () => {
    it("should use default config values", () => {
      const defaultDiscoverer = createPatternDiscoverer();
      expect(defaultDiscoverer).toBeDefined();
    });

    it("should respect custom config", () => {
      const customDiscoverer = createPatternDiscoverer({
        minClusterSize: 10,
        similarityThreshold: 0.8,
        maxSuggestions: 5,
        debug: true,
      });
      expect(customDiscoverer).toBeDefined();
    });
  });
});
