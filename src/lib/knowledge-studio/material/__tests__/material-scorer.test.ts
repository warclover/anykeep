/**
 * MaterialScorer - 单元测试
 * @module knowledge-studio/material
 */

import { MaterialScorer } from "../material-scorer";
import {
  DIMENSION_WEIGHTS,
  QUALITY_THRESHOLDS,
  getQualityLevel,
  QUALITY_DISPLAY,
} from "../types";

// Mock Supabase - 根据 bookmarkIds 动态返回结果
const mockInFn = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          in: mockInFn,
        })),
      })),
    })),
  })),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe("MaterialScorer", () => {
  let scorer: MaterialScorer;

  beforeEach(() => {
    jest.clearAllMocks();
    scorer = new MaterialScorer();
  });

  describe("analyze", () => {
    it("should return error for empty bookmark IDs (no valid bookmarks found)", async () => {
      // 当 bookmarkIds 为空时，numericIds 也为空，查询返回空数组
      mockInFn.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await scorer.analyze({
        userId: "test-user",
        bookmarkIds: [],
      });

      // 空数组导致 bookmarks.length === 0，返回 success: false
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_BOOKMARK_IDS");
    });

    it("should return success with scores for valid bookmarks", async () => {
      mockInFn.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            title: "Test Bookmark",
            url: "https://github.com/test/repo",
            ai_summary:
              "This is a test summary with enough content to score well.",
            platform: "github.com",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      const result = await scorer.analyze({
        userId: "test-user",
        bookmarkIds: ["1"],
      });

      expect(result.success).toBe(true);
      expect(result.scores).toHaveLength(1);
      expect(result.scores?.[0].bookmarkId).toBe("1");
    });
  });

  describe("DIMENSION_WEIGHTS", () => {
    it("should have weights that sum to 1", () => {
      const totalWeight = Object.values(DIMENSION_WEIGHTS).reduce(
        (sum, w) => sum + w,
        0,
      );
      expect(totalWeight).toBeCloseTo(1, 2);
    });

    it("should have freshness weight", () => {
      expect(DIMENSION_WEIGHTS.freshness).toBeDefined();
      expect(typeof DIMENSION_WEIGHTS.freshness).toBe("number");
    });

    it("should have relevance weight", () => {
      expect(DIMENSION_WEIGHTS.relevance).toBeDefined();
      expect(typeof DIMENSION_WEIGHTS.relevance).toBe("number");
    });

    it("should have depth weight", () => {
      expect(DIMENSION_WEIGHTS.depth).toBeDefined();
      expect(typeof DIMENSION_WEIGHTS.depth).toBe("number");
    });

    it("should have credibility weight", () => {
      expect(DIMENSION_WEIGHTS.credibility).toBeDefined();
      expect(typeof DIMENSION_WEIGHTS.credibility).toBe("number");
    });
  });

  describe("QUALITY_THRESHOLDS", () => {
    it("should have excellent threshold at 80", () => {
      expect(QUALITY_THRESHOLDS.excellent).toBe(80);
    });

    it("should have good threshold at 60", () => {
      expect(QUALITY_THRESHOLDS.good).toBe(60);
    });

    it("should have fair threshold at 40", () => {
      expect(QUALITY_THRESHOLDS.fair).toBe(40);
    });
  });

  describe("getQualityLevel", () => {
    it("should return excellent for score >= 80", () => {
      expect(getQualityLevel(80)).toBe("excellent");
      expect(getQualityLevel(95)).toBe("excellent");
      expect(getQualityLevel(100)).toBe("excellent");
    });

    it("should return good for score >= 60 and < 80", () => {
      expect(getQualityLevel(60)).toBe("good");
      expect(getQualityLevel(70)).toBe("good");
      expect(getQualityLevel(79)).toBe("good");
    });

    it("should return fair for score >= 40 and < 60", () => {
      expect(getQualityLevel(40)).toBe("fair");
      expect(getQualityLevel(50)).toBe("fair");
      expect(getQualityLevel(59)).toBe("fair");
    });

    it("should return poor for score < 40", () => {
      expect(getQualityLevel(0)).toBe("poor");
      expect(getQualityLevel(20)).toBe("poor");
      expect(getQualityLevel(39)).toBe("poor");
    });
  });

  describe("QUALITY_DISPLAY", () => {
    it("should have display info for excellent", () => {
      expect(QUALITY_DISPLAY.excellent).toBeDefined();
      expect(QUALITY_DISPLAY.excellent.label).toBe("优秀");
      expect(QUALITY_DISPLAY.excellent.color).toBe("green");
    });

    it("should have display info for good", () => {
      expect(QUALITY_DISPLAY.good).toBeDefined();
      expect(QUALITY_DISPLAY.good.label).toBe("良好");
      expect(QUALITY_DISPLAY.good.color).toBe("blue");
    });

    it("should have display info for fair", () => {
      expect(QUALITY_DISPLAY.fair).toBeDefined();
      expect(QUALITY_DISPLAY.fair.label).toBe("一般");
      expect(QUALITY_DISPLAY.fair.color).toBe("yellow");
    });

    it("should have display info for poor", () => {
      expect(QUALITY_DISPLAY.poor).toBeDefined();
      expect(QUALITY_DISPLAY.poor.label).toBe("待改进");
      expect(QUALITY_DISPLAY.poor.color).toBe("red");
    });
  });
});
