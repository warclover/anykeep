/**
 * Score Aggregator Unit Tests
 * 测试评分聚合器的核心逻辑
 */

import { WeightedScoreAggregator } from "../strategies/classic/score-aggregator";
import type { IMatcher } from "../strategies/classic/interfaces";
import type { MatchResult } from "../types";

// Mock matchers
const createMockMatcher = (name: string, weight: number): IMatcher => ({
  name,
  weight,
  match: jest.fn(),
  isAvailable: jest.fn().mockResolvedValue(true),
});

describe("WeightedScoreAggregator", () => {
  let aggregator: WeightedScoreAggregator;
  let matchers: IMatcher[];

  beforeEach(() => {
    aggregator = new WeightedScoreAggregator({ lowConfidenceThreshold: 30 });
    matchers = [
      createMockMatcher("vector", 0.4),
      createMockMatcher("history", 0.3),
      createMockMatcher("ai", 0.3),
    ];
  });

  describe("aggregate()", () => {
    it("should return inbox action when no results", () => {
      const results = new Map<string, MatchResult[]>();

      const result = aggregator.aggregate(results, matchers);

      expect(result.action).toBe("inbox");
      expect(result.folderId).toBeNull();
      expect(result.folderName).toBe("待整理");
      expect(result.confidence).toBe(0);
    });

    it("should return inbox action when confidence is below threshold", () => {
      const results = new Map<string, MatchResult[]>([
        [
          "vector",
          [
            {
              folderId: 1,
              folderName: "Test Folder",
              score: 20,
              confidence: 20,
              reason: "Low match",
            },
          ],
        ],
      ]);

      const result = aggregator.aggregate(results, matchers);

      expect(result.action).toBe("inbox");
      expect(result.folderId).toBeNull();
      expect(result.confidence).toBeLessThan(30);
    });

    it("should classify when confidence is above threshold", () => {
      const results = new Map<string, MatchResult[]>([
        [
          "vector",
          [
            {
              folderId: 1,
              folderName: "Frontend",
              score: 80,
              confidence: 80,
              reason: "High vector match",
            },
          ],
        ],
        [
          "history",
          [
            {
              folderId: 1,
              folderName: "Frontend",
              score: 70,
              confidence: 70,
              reason: "History match",
            },
          ],
        ],
        [
          "ai",
          [
            {
              folderId: 1,
              folderName: "Frontend",
              score: 90,
              confidence: 90,
              reason: "AI recommends",
            },
          ],
        ],
      ]);

      const result = aggregator.aggregate(results, matchers);

      expect(result.action).toBe("classify");
      expect(result.folderId).toBe(1);
      expect(result.folderName).toBe("Frontend");
      // Weighted: (80*0.4 + 70*0.3 + 90*0.3) / 1.0 = 32 + 21 + 27 = 80
      expect(result.confidence).toBe(80);
    });

    it("should correctly calculate weighted scores", () => {
      const results = new Map<string, MatchResult[]>([
        [
          "vector",
          [
            {
              folderId: 1,
              folderName: "Test",
              score: 100,
              confidence: 100,
              reason: "Perfect vector",
            },
          ],
        ],
        [
          "history",
          [
            {
              folderId: 1,
              folderName: "Test",
              score: 0,
              confidence: 0,
              reason: "No history",
            },
          ],
        ],
        [
          "ai",
          [
            {
              folderId: 1,
              folderName: "Test",
              score: 50,
              confidence: 50,
              reason: "Moderate AI",
            },
          ],
        ],
      ]);

      const result = aggregator.aggregate(results, matchers);

      // Weighted: (100*0.4 + 0*0.3 + 50*0.3) / 1.0 = 40 + 0 + 15 = 55
      expect(result.confidence).toBe(55);
      expect(result.scores.vectorScore).toBe(100);
      expect(result.scores.historyScore).toBe(0);
      expect(result.scores.aiScore).toBe(50);
    });

    it("should select highest scoring folder when multiple candidates", () => {
      const results = new Map<string, MatchResult[]>([
        [
          "vector",
          [
            {
              folderId: 1,
              folderName: "Folder A",
              score: 80,
              confidence: 80,
              reason: "",
            },
            {
              folderId: 2,
              folderName: "Folder B",
              score: 60,
              confidence: 60,
              reason: "",
            },
          ],
        ],
        [
          "history",
          [
            {
              folderId: 2,
              folderName: "Folder B",
              score: 90,
              confidence: 90,
              reason: "",
            },
          ],
        ],
      ]);

      const result = aggregator.aggregate(results, matchers);

      // 使用加权平均算法：weightedScore = weightedSum / totalWeight
      // Folder A: (80*0.4) / 0.4 = 80
      // Folder B: (60*0.4 + 90*0.3) / 0.7 = 51 / 0.7 ≈ 72.86
      // Folder A 得分更高
      expect(result.folderId).toBe(1);
      expect(result.folderName).toBe("Folder A");
    });

    it("should include match details in result", () => {
      const results = new Map<string, MatchResult[]>([
        [
          "vector",
          [
            {
              folderId: 1,
              folderName: "Folder 1",
              score: 80,
              confidence: 80,
              reason: "",
            },
            {
              folderId: 2,
              folderName: "Folder 2",
              score: 70,
              confidence: 70,
              reason: "",
            },
            {
              folderId: 3,
              folderName: "Folder 3",
              score: 60,
              confidence: 60,
              reason: "",
            },
          ],
        ],
      ]);

      const result = aggregator.aggregate(results, matchers);

      expect(result.matchDetails).toBeDefined();
      expect(result.matchDetails!.length).toBeLessThanOrEqual(5);
      // Should be sorted by score
      expect(result.matchDetails![0].folderId).toBe(1);
    });

    it("should handle missing matcher results gracefully", () => {
      const results = new Map<string, MatchResult[]>([
        [
          "vector",
          [
            {
              folderId: 1,
              folderName: "Test",
              score: 100,
              confidence: 100,
              reason: "Vector only",
            },
          ],
        ],
        // No history or AI results
      ]);

      const result = aggregator.aggregate(results, matchers);

      // 加权平均：(100*0.4) / 0.4 = 100（不是简单的 100*0.4 = 40）
      expect(result.confidence).toBe(100);
      expect(result.action).toBe("classify");
    });
  });

  describe("custom threshold", () => {
    it("should use custom low confidence threshold", () => {
      const customAggregator = new WeightedScoreAggregator({
        lowConfidenceThreshold: 50,
      });

      const results = new Map<string, MatchResult[]>([
        [
          "vector",
          [
            {
              folderId: 1,
              folderName: "Test",
              score: 40, // 设置低分以测试阈值
              confidence: 40,
              reason: "",
            },
          ],
        ],
      ]);

      const result = customAggregator.aggregate(results, matchers);

      // 加权平均：(40*0.4) / 0.4 = 40，低于自定义阈值 50
      expect(result.action).toBe("inbox");
    });
  });

  describe("edge cases", () => {
    it("should handle empty matchers array", () => {
      const results = new Map<string, MatchResult[]>([
        [
          "vector",
          [
            {
              folderId: 1,
              folderName: "Test",
              score: 100,
              confidence: 100,
              reason: "",
            },
          ],
        ],
      ]);

      const result = aggregator.aggregate(results, []);

      expect(result.action).toBe("inbox");
      expect(result.confidence).toBe(0);
    });

    it("should handle zero weight matchers", () => {
      const zeroWeightMatchers = [
        createMockMatcher("vector", 0),
        createMockMatcher("history", 0),
      ];

      const results = new Map<string, MatchResult[]>([
        [
          "vector",
          [
            {
              folderId: 1,
              folderName: "Test",
              score: 100,
              confidence: 100,
              reason: "",
            },
          ],
        ],
      ]);

      const result = aggregator.aggregate(results, zeroWeightMatchers);

      expect(result.confidence).toBe(0);
    });

    it("should handle negative scores gracefully", () => {
      const results = new Map<string, MatchResult[]>([
        [
          "vector",
          [
            {
              folderId: 1,
              folderName: "Test",
              score: -10,
              confidence: -10,
              reason: "",
            },
          ],
        ],
      ]);

      const result = aggregator.aggregate(results, matchers);

      expect(result.action).toBe("inbox");
    });
  });
});
