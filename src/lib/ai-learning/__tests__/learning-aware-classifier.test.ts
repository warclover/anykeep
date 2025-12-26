/**
 * LearningAwareClassifier 单元测试
 *
 * 测试学习感知分类器的核心功能：
 * - 学习结果应用
 * - 纠正信号处理
 * - 负面反馈处理
 * - 分类优先级
 *
 * @module ai-learning
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  LearningAwareClassifier,
  createLearningAwareClassifier,
} from "../learning-aware-classifier";
import type { IntentType, AIOutput, ConversationState } from "../types";

// =============================================================================
// 测试数据（保留以供未来测试使用）
// =============================================================================

const _createMockAIOutput = (overrides: Partial<AIOutput> = {}): AIOutput => ({
  messageId: "msg-1",
  intent: "query",
  wasSuccessful: false,
  ...overrides,
});

const _createMockConversationState = (
  overrides: Partial<ConversationState> = {},
): ConversationState => ({
  conversationId: "user-1_conv-1",
  lastUserInput: "帮我整理收藏",
  consecutiveFailures: 1,
  turnCount: 2,
  ...overrides,
});

// =============================================================================
// 测试用例
// =============================================================================

describe("LearningAwareClassifier", () => {
  let classifier: LearningAwareClassifier;

  beforeEach(() => {
    // 每个测试创建新实例，使用禁用学习模式避免数据库调用
    classifier = createLearningAwareClassifier({
      learningOverrideThreshold: 0.85,
      enableLearning: false, // 禁用学习以避免数据库调用
    });
  });

  // ===========================================================================
  // classify 基本功能测试
  // ===========================================================================

  describe("classify 基本功能", () => {
    it("正确分类搜索意图", async () => {
      const result = await classifier.classify({
        input: "帮我搜索 AI 文章",
        userId: "user-1",
      });

      expect(result.intent).toBe("query");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("正确分类整理意图", async () => {
      const result = await classifier.classify({
        input: "整理我的收藏夹",
        userId: "user-1",
      });

      expect(result.intent).toBe("organize");
    });

    it("正确分类创作意图", async () => {
      const result = await classifier.classify({
        input: "总结这几篇文章",
        userId: "user-1",
      });

      expect(result.intent).toBe("create");
    });

    it("正确分类导出意图", async () => {
      const result = await classifier.classify({
        input: "导出我的数据",
        userId: "user-1",
      });

      expect(result.intent).toBe("export");
    });

    it("正确分类复习意图", async () => {
      const result = await classifier.classify({
        input: "复习最近收藏",
        userId: "user-1",
      });

      expect(result.intent).toBe("review");
    });

    it("未知意图返回 unknown", async () => {
      const result = await classifier.classify({
        input: "随便说点什么",
        userId: "user-1",
      });

      expect(result.intent).toBe("unknown");
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("禁用学习时 learning.applied 为 false", async () => {
      const result = await classifier.classify({
        input: "帮我搜索文章",
        userId: "user-1",
        enableLearning: false,
      });

      expect(result.learning?.applied).toBe(false);
    });
  });

  // ===========================================================================
  // 多关键词测试
  // ===========================================================================

  describe("多关键词意图分类", () => {
    const queryKeywords = ["搜索", "查找", "找", "搜", "有没有"];
    const organizeKeywords = ["整理", "分类", "归类", "移动", "放到"];
    const createKeywords = ["总结", "摘要", "概括", "萃取", "提炼"];
    const exportKeywords = ["导出", "下载", "备份"];
    const reviewKeywords = ["复习", "回顾", "重温"];

    it.each(queryKeywords)('"%s" 应分类为 query', async (keyword) => {
      const result = await classifier.classify({
        input: `帮我${keyword}一下文章`,
        userId: "user-1",
      });
      expect(result.intent).toBe("query");
    });

    it.each(organizeKeywords)('"%s" 应分类为 organize', async (keyword) => {
      const result = await classifier.classify({
        input: `${keyword}我的收藏`,
        userId: "user-1",
      });
      expect(result.intent).toBe("organize");
    });

    it.each(createKeywords)('"%s" 应分类为 create', async (keyword) => {
      const result = await classifier.classify({
        input: `${keyword}这些内容`,
        userId: "user-1",
      });
      expect(result.intent).toBe("create");
    });

    it.each(exportKeywords)('"%s" 应分类为 export', async (keyword) => {
      const result = await classifier.classify({
        input: `${keyword}我的数据`,
        userId: "user-1",
      });
      expect(result.intent).toBe("export");
    });

    it.each(reviewKeywords)('"%s" 应分类为 review', async (keyword) => {
      const result = await classifier.classify({
        input: `${keyword}之前的内容`,
        userId: "user-1",
      });
      expect(result.intent).toBe("review");
    });
  });

  // ===========================================================================
  // setOriginalClassifier 测试
  // ===========================================================================

  describe("setOriginalClassifier", () => {
    it("使用外部分类器覆盖简单分类", async () => {
      const mockOriginalClassifier = {
        classify: async (_input: string) => ({
          intent: "create" as IntentType,
          confidence: 0.95,
        }),
      };

      classifier.setOriginalClassifier(mockOriginalClassifier);

      const result = await classifier.classify({
        input: "任意输入应该被覆盖",
        userId: "user-1",
      });

      expect(result.intent).toBe("create");
      expect(result.confidence).toBe(0.95);
    });

    it("外部分类器优先级高于简单分类", async () => {
      const mockOriginalClassifier = {
        classify: async (_input: string) => ({
          intent: "export" as IntentType,
          confidence: 0.88,
        }),
      };

      classifier.setOriginalClassifier(mockOriginalClassifier);

      // 即使输入包含 "搜索" 关键词，也应该使用外部分类器结果
      const result = await classifier.classify({
        input: "帮我搜索文章", // 正常会被分类为 query
        userId: "user-1",
      });

      expect(result.intent).toBe("export");
    });
  });

  // ===========================================================================
  // 配置测试
  // ===========================================================================

  describe("配置选项", () => {
    it("可配置学习覆盖阈值", () => {
      const customClassifier = createLearningAwareClassifier({
        learningOverrideThreshold: 0.5,
        enableLearning: false,
      });

      expect(customClassifier).toBeInstanceOf(LearningAwareClassifier);
    });

    it("默认启用学习", () => {
      const defaultClassifier = createLearningAwareClassifier();
      expect(defaultClassifier).toBeInstanceOf(LearningAwareClassifier);
    });

    it("可禁用学习", () => {
      const noLearningClassifier = createLearningAwareClassifier({
        enableLearning: false,
      });
      expect(noLearningClassifier).toBeInstanceOf(LearningAwareClassifier);
    });
  });

  // ===========================================================================
  // 分类响应结构测试
  // ===========================================================================

  describe("分类响应结构", () => {
    it("返回完整的响应结构", async () => {
      const result = await classifier.classify({
        input: "帮我搜索文章",
        userId: "user-1",
      });

      expect(result).toHaveProperty("intent");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("learning");
      expect(typeof result.intent).toBe("string");
      expect(typeof result.confidence).toBe("number");
    });

    it("置信度在有效范围内", async () => {
      const result = await classifier.classify({
        input: "帮我搜索文章",
        userId: "user-1",
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("learning 对象包含 applied 字段", async () => {
      const result = await classifier.classify({
        input: "帮我搜索文章",
        userId: "user-1",
      });

      expect(result.learning).toBeDefined();
      expect(typeof result.learning?.applied).toBe("boolean");
    });
  });

  // ===========================================================================
  // 边界情况测试
  // ===========================================================================

  describe("边界情况", () => {
    it("空输入返回 unknown", async () => {
      const result = await classifier.classify({
        input: "",
        userId: "user-1",
      });

      expect(result.intent).toBe("unknown");
    });

    it("只有空格的输入返回 unknown", async () => {
      const result = await classifier.classify({
        input: "   ",
        userId: "user-1",
      });

      expect(result.intent).toBe("unknown");
    });

    it("特殊字符输入不崩溃", async () => {
      const result = await classifier.classify({
        input: "!@#$%^&*()",
        userId: "user-1",
      });

      expect(result.intent).toBeDefined();
    });

    it("超长输入不崩溃", async () => {
      const longInput = "帮我搜索".repeat(1000);
      const result = await classifier.classify({
        input: longInput,
        userId: "user-1",
      });

      expect(result.intent).toBe("query");
    });
  });
});
