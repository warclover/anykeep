/**
 * 多用户画像推断集成测试
 *
 * 验证完整的画像推断流程：信号收集 → 融合 → 置信度计算 → 缓存
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { personaInferrer, createPersonaInferrer } from "../persona-inferrer";
import { personaCache } from "../persona-cache";
import { platformMatcher } from "../platform-matcher";
import { tagMatcher } from "../tag-matcher";
import { signalFusion } from "../signal-fusion";
import {
  getPersonaPrompt,
  hasPersonaPrompt,
} from "../../personas/persona-prompts";
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

describe("Persona Inference Integration", () => {
  beforeEach(() => {
    personaCache.clear();
  });

  describe("End-to-End Inference Flow", () => {
    it("should correctly infer PM persona for product-focused user", async () => {
      const stats: UserBookmarkStats = {
        userId: "e2e-pm-user",
        platformDistribution: {
          "36kr.com": 45,
          "producthunt.com": 25,
          "zhihu.com": 20,
        },
        tagFrequency: {
          PRD: 15,
          竞品分析: 12,
          需求文档: 10,
          用户研究: 8,
        },
        totalBookmarks: 120,
        statsRange: { from: "2025-01-01", to: "2025-01-28" },
      };

      // Step 1: Platform matching
      const platformSignals = platformMatcher.match(
        stats.platformDistribution,
        stats.totalBookmarks,
      );
      expect(platformSignals.length).toBeGreaterThan(0);
      expect(platformSignals.some((s) => s.personas.includes("pm"))).toBe(true);

      // Step 2: Tag matching
      const tagSignals = tagMatcher.match(
        stats.tagFrequency,
        stats.totalBookmarks,
      );
      expect(tagSignals.length).toBeGreaterThan(0);
      expect(tagSignals.some((s) => s.personas.includes("pm"))).toBe(true);

      // Step 3: Signal fusion
      const allSignals = [...platformSignals, ...tagSignals];
      const fusionResult = signalFusion.generateResult(
        allSignals,
        stats.totalBookmarks,
      );
      expect(fusionResult.primaryPersona).toBe("pm");
      expect(fusionResult.confidence).toBeGreaterThan(60);

      // Step 4: Full inference with caching
      const result = await personaInferrer.infer(stats);
      expect(result.primaryPersona).toBe("pm");
      expect(result.confidence).toBeGreaterThan(60);
      expect(result.signals.length).toBeGreaterThan(0);

      // Step 5: Verify caching
      expect(personaCache.has("e2e-pm-user")).toBe(true);
      const cachedResult = await personaInferrer.infer(stats);
      expect(cachedResult.inferredAt).toBe(result.inferredAt);

      // Step 6: Verify prompt availability
      expect(hasPersonaPrompt("pm")).toBe(true);
      const prompt = getPersonaPrompt("pm");
      expect(prompt).toBeDefined();
      expect(prompt).toContain("产品");
    });

    it("should correctly infer Consultant persona for strategy-focused user", async () => {
      const stats: UserBookmarkStats = {
        userId: "e2e-consultant-user",
        platformDistribution: {
          "mbalib.com": 35,
          "mckinsey.com": 20,
          "hbr.org": 15,
        },
        tagFrequency: {
          咨询: 20,
          战略: 15,
          商业分析: 12,
          麦肯锡: 8,
        },
        totalBookmarks: 100,
        statsRange: { from: "2025-01-01", to: "2025-01-28" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.primaryPersona).toBe("consultant");
      expect(result.confidence).toBeGreaterThan(50);
      expect(hasPersonaPrompt("consultant")).toBe(true);

      const prompt = getPersonaPrompt("consultant");
      expect(prompt).toContain("咨询");
    });

    it("should correctly infer Teacher persona for education-focused user", async () => {
      const stats: UserBookmarkStats = {
        userId: "e2e-teacher-user",
        platformDistribution: {
          "cnki.net": 40,
          "icourse163.org": 30,
          "xuetangx.com": 20,
        },
        tagFrequency: {
          课程设计: 25,
          教学方法: 20,
          教育心理学: 15,
        },
        totalBookmarks: 110,
        statsRange: { from: "2025-01-01", to: "2025-01-28" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.primaryPersona).toBe("teacher");
      expect(result.confidence).toBeGreaterThan(50);
      expect(hasPersonaPrompt("teacher")).toBe(true);

      const prompt = getPersonaPrompt("teacher");
      expect(prompt).toContain("教");
    });

    it("should fall back to general for diverse/unclear signals", async () => {
      const stats: UserBookmarkStats = {
        userId: "e2e-general-user",
        platformDistribution: {
          "example.com": 10,
          "random-site.xyz": 8,
        },
        tagFrequency: {
          杂项: 5,
          其他: 3,
        },
        totalBookmarks: 25,
        statsRange: { from: "2025-01-01", to: "2025-01-28" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.primaryPersona).toBe("general");
      expect(hasPersonaPrompt("general")).toBe(true);
    });
  });

  describe("Cache Invalidation", () => {
    it("should properly invalidate cache for a user", async () => {
      const stats: UserBookmarkStats = {
        userId: "cache-invalidation-user",
        platformDistribution: {
          "github.com": 50,
        },
        tagFrequency: {
          编程: 20,
        },
        totalBookmarks: 80,
        statsRange: { from: "2025-01-01", to: "2025-01-28" },
      };

      // First inference - populates cache
      await personaInferrer.infer(stats);
      expect(personaCache.has("cache-invalidation-user")).toBe(true);

      // Invalidate
      personaInferrer.invalidateCache("cache-invalidation-user");
      expect(personaCache.has("cache-invalidation-user")).toBe(false);

      // Re-infer - should create new cache entry
      const newResult = await personaInferrer.infer(stats);
      expect(personaCache.has("cache-invalidation-user")).toBe(true);
      expect(newResult).toBeDefined();
    });
  });

  describe("Alternatives and Signals", () => {
    it("should include reasonable alternatives for mixed signals", async () => {
      const stats: UserBookmarkStats = {
        userId: "mixed-signals-user",
        platformDistribution: {
          "github.com": 30,
          "arxiv.org": 25,
          "36kr.com": 20,
        },
        tagFrequency: {
          AI: 15,
          论文: 12,
          产品: 10,
        },
        totalBookmarks: 100,
        statsRange: { from: "2025-01-01", to: "2025-01-28" },
      };

      const result = await personaInferrer.infer(stats);

      // Should have a primary persona
      expect(result.primaryPersona).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);

      // Should have alternatives given mixed signals
      expect(result.alternatives).toBeDefined();
      expect(Array.isArray(result.alternatives)).toBe(true);

      // Should include signals used for inference
      expect(result.signals).toBeDefined();
      expect(result.signals.length).toBeGreaterThan(0);
    });
  });

  describe("Custom Configuration", () => {
    it("should respect custom minConfidenceThreshold", async () => {
      const customInferrer = createPersonaInferrer({
        minConfidenceThreshold: 90, // Very high threshold
        minSampleSize: 10,
      });

      const stats: UserBookmarkStats = {
        userId: "custom-config-user",
        platformDistribution: {
          "zhihu.com": 30, // Generic platform
        },
        tagFrequency: {
          知识: 20,
        },
        totalBookmarks: 60,
        statsRange: { from: "2025-01-01", to: "2025-01-28" },
      };

      const result = await customInferrer.infer(stats);

      // With such a high threshold, most inferences won't meet it
      // But the result should still be valid
      expect(result).toBeDefined();
      expect(result.primaryPersona).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero bookmarks gracefully", async () => {
      const stats: UserBookmarkStats = {
        userId: "zero-bookmarks-user",
        platformDistribution: {},
        tagFrequency: {},
        totalBookmarks: 0,
        statsRange: { from: "2025-01-01", to: "2025-01-28" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.primaryPersona).toBe("general");
      expect(result.confidence).toBe(0);
    });

    it("should handle minimum sample size boundary", async () => {
      const stats: UserBookmarkStats = {
        userId: "min-sample-user",
        platformDistribution: {
          "github.com": 8,
        },
        tagFrequency: {},
        totalBookmarks: 8, // Below default minSampleSize of 10
        statsRange: { from: "2025-01-01", to: "2025-01-28" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.primaryPersona).toBe("general");
      expect(result.confidence).toBe(0);
    });

    it("should handle single dominant signal", async () => {
      const stats: UserBookmarkStats = {
        userId: "dominant-signal-user",
        platformDistribution: {
          "arxiv.org": 100,
        },
        tagFrequency: {},
        totalBookmarks: 100,
        statsRange: { from: "2025-01-01", to: "2025-01-28" },
      };

      const result = await personaInferrer.infer(stats);

      // arxiv.org should strongly indicate phd persona
      expect(result.primaryPersona).toBe("phd");
      expect(result.confidence).toBeGreaterThan(70);
    });
  });

  describe("Prompt Integration", () => {
    it("should have prompts for all Phase 1 personas", () => {
      const phase1Personas = ["pm", "consultant", "teacher", "general"];

      for (const persona of phase1Personas) {
        expect(hasPersonaPrompt(persona)).toBe(true);
        const prompt = getPersonaPrompt(persona);
        expect(prompt).toBeDefined();
        expect(prompt!.length).toBeGreaterThan(50);
      }
    });
  });
});
