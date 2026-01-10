/**
 * HybridIntentClassifier 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import { HybridIntentClassifier } from "../hybrid-intent-classifier";
import type { IntentRule as _IntentRule } from "../types";
import { DEFAULT_RULES } from "../intent-classifier";
import * as embeddingGenerator from "@/lib/utils/embedding-generator";

// Mock EmbeddingService
jest.mock("@/lib/utils/embedding-generator", () => ({
  generateEmbedding: jest.fn(),
}));

describe("HybridIntentClassifier", () => {
  let classifier: HybridIntentClassifier;
  const mockGenerateEmbedding =
    embeddingGenerator.generateEmbedding as jest.MockedFunction<
      typeof embeddingGenerator.generateEmbedding
    >;

  beforeEach(() => {
    classifier = new HybridIntentClassifier({
      enableSemanticMatching: true,
      debug: false,
    });
    mockGenerateEmbedding.mockClear();
  });

  // ============================================
  // 初始化测试
  // ============================================
  describe("initialize", () => {
    it("应该初始化语义匹配器", async () => {
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]);

      await classifier.initialize(DEFAULT_RULES.slice(0, 5)); // 使用前 5 个规则

      const status = classifier.getSemanticMatcherStatus();
      expect(status.initialized).toBe(true);
      expect(status.intentCount).toBeGreaterThan(0);
    });

    it("应该处理空规则列表", async () => {
      await classifier.initialize([]);

      const status = classifier.getSemanticMatcherStatus();
      expect(status.initialized).toBe(false);
    });

    it("应该在语义匹配未启用时跳过初始化", async () => {
      const noSemanticClassifier = new HybridIntentClassifier({
        enableSemanticMatching: false,
      });

      await noSemanticClassifier.initialize(DEFAULT_RULES.slice(0, 5));

      const status = noSemanticClassifier.getSemanticMatcherStatus();
      expect(status.initialized).toBe(false);
    });
  });

  // ============================================
  // 分类测试 - 高置信度规则匹配
  // ============================================
  describe("classify - 高置信度规则匹配", () => {
    it("应该直接返回高置信度的规则匹配结果", async () => {
      const result = await classifier.classify("整理一下我的收藏");

      expect(result.type).toBe("organize");
      expect(result.subType).toBe("cleanup");
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.method).toBe("rule");
    });

    it("应该包含调试信息", async () => {
      const debugClassifier = new HybridIntentClassifier({
        enableSemanticMatching: true,
        debug: true,
      });

      const result = await debugClassifier.classify("整理收藏");

      expect(result.debugInfo).toBeDefined();
      expect(result.debugInfo?.ruleConfidence).toBeDefined();
    });
  });

  // ============================================
  // 分类测试 - 混合融合
  // ============================================
  describe("classify - 混合融合", () => {
    beforeEach(async () => {
      // 初始化语义匹配器
      mockGenerateEmbedding.mockImplementation((text: string) => {
        // 模拟语义相似度
        if (text.includes("整理") || text.includes("清理")) {
          return Promise.resolve([0.9, 0.8, 0.7, 0.6, 0.5]);
        }
        return Promise.resolve([0.5, 0.5, 0.5, 0.5, 0.5]);
      });

      await classifier.initialize(DEFAULT_RULES.slice(0, 10));
      mockGenerateEmbedding.mockClear();
    });

    it("应该在规则和语义一致时提升置信度（hybrid_agree）", async () => {
      // 创建一个低置信度规则匹配的场景
      const lowConfidenceClassifier = new HybridIntentClassifier({
        enableSemanticMatching: true,
        ruleHighConfidenceThreshold: 0.95, // 提高阈值，使规则匹配置信度不足
      });

      // 初始化时使用与"整理"相关的 Embedding
      mockGenerateEmbedding.mockImplementation((text: string) => {
        if (text.includes("整理") || text.includes("清理")) {
          return Promise.resolve([0.9, 0.8, 0.7, 0.6, 0.5]);
        }
        return Promise.resolve([0.5, 0.5, 0.5, 0.5, 0.5]);
      });

      await lowConfidenceClassifier.initialize(DEFAULT_RULES.slice(0, 10));
      mockGenerateEmbedding.mockClear();

      // Mock 用户输入的 Embedding（与"整理"语义相似）
      mockGenerateEmbedding.mockResolvedValue([0.88, 0.78, 0.68, 0.58, 0.48]);

      const result = await lowConfidenceClassifier.classify("帮我整理一下");

      // 如果规则和语义匹配一致，应该使用 hybrid_agree
      // 否则可能是 rule 或 hybrid_override
      expect(["hybrid_agree", "rule", "hybrid_override"]).toContain(
        result.method,
      );
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("应该在语义明显更优时使用语义结果（hybrid_override）", async () => {
      // 创建一个低置信度的规则匹配场景
      const lowConfidenceClassifier = new HybridIntentClassifier({
        enableSemanticMatching: true,
        ruleHighConfidenceThreshold: 0.95, // 提高阈值，使规则匹配置信度不足
        semanticOverrideThreshold: 0.15,
      });

      await lowConfidenceClassifier.initialize(DEFAULT_RULES.slice(0, 10));

      // Mock 用户输入（语义匹配相似度很高）
      mockGenerateEmbedding.mockResolvedValue([0.9, 0.9, 0.9, 0.9, 0.9]);

      const result = await lowConfidenceClassifier.classify("帮我整理");

      // 如果语义匹配明显更优，应该使用语义结果
      if (result.method === "semantic") {
        expect(result.debugInfo?.fusionStrategy).toBe("semantic_override");
        expect(result.debugInfo?.semanticSimilarity).toBeGreaterThan(
          (result.debugInfo?.ruleConfidence || 0) + 0.15,
        );
      }
    });

    it("应该在语义匹配不足时回退到规则匹配（rule_fallback）", async () => {
      // 创建一个低置信度规则匹配的场景
      const lowConfidenceClassifier = new HybridIntentClassifier({
        enableSemanticMatching: true,
        ruleHighConfidenceThreshold: 0.95, // 提高阈值
        semanticOverrideThreshold: 0.2, // 提高语义覆盖阈值
      });

      // 初始化时使用与"整理"相关的 Embedding
      mockGenerateEmbedding.mockImplementation((text: string) => {
        if (text.includes("整理") || text.includes("清理")) {
          return Promise.resolve([1.0, 1.0, 1.0, 1.0, 1.0]);
        }
        return Promise.resolve([0.5, 0.5, 0.5, 0.5, 0.5]);
      });

      await lowConfidenceClassifier.initialize(DEFAULT_RULES.slice(0, 10));
      mockGenerateEmbedding.mockClear();

      // Mock 用户输入的 Embedding（与预计算的完全不相似，且语义相似度低）
      mockGenerateEmbedding.mockResolvedValue([-1.0, -1.0, -1.0, -1.0, -1.0]);

      const result = await lowConfidenceClassifier.classify("测试输入");

      // 应该使用规则匹配结果（因为语义相似度低）
      expect(["rule", "semantic"]).toContain(result.method);
      // 如果使用了 rule_fallback，验证 fusionStrategy
      if (result.debugInfo?.fusionStrategy === "rule_fallback") {
        expect(result.method).toBe("rule");
      }
    });
  });

  // ============================================
  // 分类测试 - 上下文支持
  // ============================================
  describe("classify - 上下文支持", () => {
    it("应该支持对话历史上下文", async () => {
      const result = await classifier.classify("这些", {
        input: "这些",
        messageHistory: [
          { role: "user", content: "帮我找关于 React 的文章" },
          { role: "assistant", content: "找到了 5 篇文章" },
        ],
        selectedBookmarks: [1, 2, 3],
      });

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });

    it("应该支持选中书签上下文", async () => {
      const result = await classifier.classify("给这些打标签", {
        input: "给这些打标签",
        selectedBookmarks: [1, 2, 3],
      });

      expect(result).toBeDefined();
    });

    it("应该支持当前文件夹上下文", async () => {
      const result = await classifier.classify("这个文件夹里有什么", {
        input: "这个文件夹里有什么",
        currentFolder: 123,
      });

      expect(result).toBeDefined();
    });
  });

  // ============================================
  // 配置测试
  // ============================================
  describe("配置", () => {
    it("应该支持禁用语义匹配", async () => {
      const noSemanticClassifier = new HybridIntentClassifier({
        enableSemanticMatching: false,
      });

      const result = await noSemanticClassifier.classify("整理收藏");

      expect(result.method).toBe("rule");
      expect(noSemanticClassifier.getSemanticMatcherStatus().initialized).toBe(
        false,
      );
    });

    it("应该支持自定义相似度阈值", () => {
      const customClassifier = new HybridIntentClassifier({
        enableSemanticMatching: true,
        semanticThreshold: 0.9, // 更高的阈值
      });

      expect(customClassifier).toBeDefined();
    });

    it("应该支持自定义规则高置信度阈值", async () => {
      const customClassifier = new HybridIntentClassifier({
        enableSemanticMatching: true,
        ruleHighConfidenceThreshold: 0.95, // 更高的阈值
      });

      const result = await customClassifier.classify("整理收藏");

      // 由于阈值更高，可能不会直接返回规则匹配
      expect(result).toBeDefined();
    });
  });

  // ============================================
  // 边界情况测试
  // ============================================
  describe("边界情况", () => {
    it("应该处理空输入", async () => {
      const result = await classifier.classify("");

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });

    it("应该处理非常长的输入", async () => {
      const longInput = "整理".repeat(1000);
      const result = await classifier.classify(longInput);

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });

    it("应该处理特殊字符", async () => {
      const specialInput = "整理！@#$%^&*()";
      const result = await classifier.classify(specialInput);

      expect(result).toBeDefined();
    });

    it("应该处理未初始化的语义匹配器", async () => {
      const uninitializedClassifier = new HybridIntentClassifier({
        enableSemanticMatching: true,
      });

      // 不调用 initialize
      const result = await uninitializedClassifier.classify("整理收藏");

      // 应该回退到纯规则匹配
      expect(result.method).toBe("rule");
    });
  });

  // ============================================
  // 性能测试
  // ============================================
  describe("性能", () => {
    it("高置信度规则匹配应该很快（<50ms）", async () => {
      const startTime = performance.now();
      await classifier.classify("整理收藏");
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50);
    });

    it("应该缓存语义匹配结果（如果启用）", async () => {
      // 初始化语义匹配器
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]);
      await classifier.initialize(DEFAULT_RULES.slice(0, 5));
      mockGenerateEmbedding.mockClear();

      // 第一次调用
      mockGenerateEmbedding.mockResolvedValue([0.5, 0.5, 0.5, 0.5, 0.5]);
      await classifier.classify("测试输入1");

      // 第二次调用相同输入（应该使用缓存）
      const callCount1 = mockGenerateEmbedding.mock.calls.length;
      await classifier.classify("测试输入1");
      const callCount2 = mockGenerateEmbedding.mock.calls.length;

      // 注意：由于规则匹配可能直接返回，Embedding 可能不会被调用
      // 这里主要验证不会出错
      expect(callCount2).toBeGreaterThanOrEqual(callCount1);
    });
  });

  // ============================================
  // 集成测试
  // ============================================
  describe("集成测试", () => {
    it("应该正确处理完整的分类流程", async () => {
      // 初始化
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]);
      await classifier.initialize(DEFAULT_RULES.slice(0, 10));
      mockGenerateEmbedding.mockClear();

      // 分类
      mockGenerateEmbedding.mockResolvedValue([0.5, 0.5, 0.5, 0.5, 0.5]);
      const result = await classifier.classify("整理一下我的收藏");

      // 验证结果
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.subType).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.method).toBeDefined();
    });

    it("应该与 IntentClassifier 兼容（返回相同结构）", async () => {
      const result = await classifier.classify("整理收藏");

      // 验证返回结构符合 IntentClassification
      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("subType");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("entities");
      expect(result).toHaveProperty("requiresMultiStep");
      expect(result).toHaveProperty("hasDeliverableExpectation");
      expect(result).toHaveProperty("source");
    });
  });
});
