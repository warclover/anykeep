/**
 * 画像推断引擎单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  PersonaInferrer,
  personaInferrer,
  createPersonaInferrer,
} from "../persona-inferrer";
import { personaCache } from "../persona-cache";
import type { UserBookmarkStats } from "../types";

// Mock feature flags
jest.mock("../../config/feature-flags", () => ({
  FeatureFlags: {
    ENABLE_PERSONA_INFERENCE: true,
    ENABLE_PM_PERSONA: true,
    ENABLE_CONSULTANT_PERSONA: true,
    ENABLE_TEACHER_PERSONA: true,
  },
}));

describe("PersonaInferrer", () => {
  beforeEach(() => {
    // Clear cache before each test
    personaCache.clear();
  });

  describe("infer", () => {
    it("should infer pm persona for 36kr/PRD heavy user", async () => {
      const stats: UserBookmarkStats = {
        userId: "pm-user-1",
        platformDistribution: {
          "36kr.com": 40,
          "producthunt.com": 20,
        },
        tagFrequency: {
          prd: 15,
          竞品分析: 10,
          用户研究: 8,
        },
        totalBookmarks: 80,
        statsRange: { from: "2025-01-01", to: "2025-01-07" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.primaryPersona).toBe("pm");
      expect(result.confidence).toBeGreaterThan(50);
    });

    it("should infer consultant persona for MBA/strategy heavy user", async () => {
      const stats: UserBookmarkStats = {
        userId: "consultant-user-1",
        platformDistribution: {
          "mbalib.com": 30,
          "mckinsey.com": 15,
        },
        tagFrequency: {
          咨询: 20,
          战略: 15,
          商业分析: 10,
        },
        totalBookmarks: 70,
        statsRange: { from: "2025-01-01", to: "2025-01-07" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.primaryPersona).toBe("consultant");
      expect(result.confidence).toBeGreaterThan(50);
    });

    it("should infer teacher persona for academic heavy user", async () => {
      const stats: UserBookmarkStats = {
        userId: "teacher-user-1",
        platformDistribution: {
          "cnki.net": 40,
          "icourse163.org": 25,
        },
        tagFrequency: {
          课程设计: 20,
          教学方法: 15,
          教育心理学: 10,
        },
        totalBookmarks: 85,
        statsRange: { from: "2025-01-01", to: "2025-01-07" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.primaryPersona).toBe("teacher");
      expect(result.confidence).toBeGreaterThan(50);
    });

    it("should return general for insufficient data", async () => {
      const stats: UserBookmarkStats = {
        userId: "new-user-1",
        platformDistribution: {},
        tagFrequency: {},
        totalBookmarks: 3, // Less than minSampleSize (10)
        statsRange: { from: "2025-01-01", to: "2025-01-07" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.primaryPersona).toBe("general");
      expect(result.confidence).toBe(0);
    });

    it("should cache inference results", async () => {
      const stats: UserBookmarkStats = {
        userId: "cache-test-user",
        platformDistribution: {
          "github.com": 50,
        },
        tagFrequency: {
          编程: 20,
        },
        totalBookmarks: 100,
        statsRange: { from: "2025-01-01", to: "2025-01-07" },
      };

      // First call
      const result1 = await personaInferrer.infer(stats);

      // Check cache
      expect(personaCache.has("cache-test-user")).toBe(true);

      // Second call should return cached result
      const result2 = await personaInferrer.infer(stats);

      expect(result1.primaryPersona).toBe(result2.primaryPersona);
      expect(result1.inferredAt).toBe(result2.inferredAt);
    });

    it("should include alternatives in result", async () => {
      const stats: UserBookmarkStats = {
        userId: "multi-persona-user",
        platformDistribution: {
          "github.com": 30,
          "arxiv.org": 20,
        },
        tagFrequency: {
          ai: 15,
          论文: 10,
        },
        totalBookmarks: 80,
        statsRange: { from: "2025-01-01", to: "2025-01-07" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.alternatives).toBeDefined();
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    it("should include signals in result", async () => {
      const stats: UserBookmarkStats = {
        userId: "signal-test-user",
        platformDistribution: {
          "zhihu.com": 40,
        },
        tagFrequency: {
          知识: 20,
        },
        totalBookmarks: 60,
        statsRange: { from: "2025-01-01", to: "2025-01-07" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.signals).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
    });
  });

  describe("invalidateCache", () => {
    it("should remove user from cache", async () => {
      const stats: UserBookmarkStats = {
        userId: "invalidate-test-user",
        platformDistribution: {
          "36kr.com": 30,
        },
        tagFrequency: {},
        totalBookmarks: 50,
        statsRange: { from: "2025-01-01", to: "2025-01-07" },
      };

      // First, add to cache
      await personaInferrer.infer(stats);
      expect(personaCache.has("invalidate-test-user")).toBe(true);

      // Invalidate
      personaInferrer.invalidateCache("invalidate-test-user");
      expect(personaCache.has("invalidate-test-user")).toBe(false);
    });
  });

  describe("createPersonaInferrer", () => {
    it("should create a new instance with custom config", () => {
      const inferrer = createPersonaInferrer({
        minConfidenceThreshold: 70,
        minSampleSize: 20,
      });

      expect(inferrer).toBeInstanceOf(PersonaInferrer);
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton", () => {
      expect(personaInferrer).toBeDefined();
      expect(personaInferrer).toBeInstanceOf(PersonaInferrer);
    });
  });
});
