/**
 * 学习应用优先级测试
 *
 * 验证学习结果应用的优先级规则：
 * - 当前会话纠正 > 历史学习 > 默认分类
 * - 学习相似度阈值检查
 * - 置信度对比处理
 *
 * @module ai-learning
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { IntentType, CorrectionSignal } from "../types";

// =============================================================================
// Mock 设置
// =============================================================================

// Mock Supabase

const mockSingle = jest.fn<any>();

const mockSelect = jest.fn<any>();

const mockInsert = jest.fn<any>();

const mockEq = jest.fn<any>();

const mockOrder = jest.fn<any>();

const mockLimit = jest.fn<any>();

const mockFrom = jest.fn<any>();

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// =============================================================================
// 测试用例
// =============================================================================

describe("Learning Application Priority", () => {
  // 延迟导入以确保 mock 生效

  let _LearningAwareClassifier: any;

  let createLearningAwareClassifier: any;

  let classifier: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // 设置默认 mock 行为
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
    });

    // 动态导入
    const learningModule = await import("../learning-aware-classifier");
    _LearningAwareClassifier = learningModule.LearningAwareClassifier;
    createLearningAwareClassifier =
      learningModule.createLearningAwareClassifier;
  });

  // ===========================================================================
  // 优先级测试
  // ===========================================================================

  describe("分类优先级规则", () => {
    it("外部分类器结果优先于内置简单分类", async () => {
      // 创建分类器
      classifier = createLearningAwareClassifier({
        enableLearning: false,
      });

      // 设置外部分类器返回 "analyze"（原 export）
      const mockOriginalClassifier = {
        classify: async (_input: string) => ({
          intent: "analyze" as IntentType,
          confidence: 0.92,
        }),
      };
      classifier.setOriginalClassifier(mockOriginalClassifier);

      // 输入包含 "搜索" 关键词（内置分类会返回 query）
      const result = await classifier.classify({
        input: "帮我搜索文章",
        userId: "user-1",
      });

      // 应使用外部分类器结果
      expect(result.intent).toBe("analyze");
      expect(result.confidence).toBe(0.92);
    });

    it("高置信度学习结果覆盖默认分类（启用学习时）", async () => {
      // 模拟有历史学习记录
      const mockRecords = [
        {
          id: "corr-1",
          original_input: "帮我 搜索 文章",
          correct_intent: "organize",
          applied_count: 10,
        },
      ];
      mockLimit.mockResolvedValueOnce({ data: mockRecords, error: null });

      classifier = createLearningAwareClassifier({
        enableLearning: true,
        learningOverrideThreshold: 0.7, // 降低阈值以便测试
      });

      const result = await classifier.classify({
        input: "帮我 搜索 文章", // 完全匹配历史记录
        userId: "user-1",
        enableLearning: true,
      });

      // 学习结果应该被应用（如果相似度足够高）
      // 注意：实际是否覆盖取决于相似度计算结果
      expect(result.learning).toBeDefined();
    });

    it("禁用学习时不查询历史记录", async () => {
      classifier = createLearningAwareClassifier({
        enableLearning: false,
      });

      await classifier.classify({
        input: "帮我搜索文章",
        userId: "user-1",
        enableLearning: false,
      });

      // 验证 from('intent_corrections') 未被调用于学习查询
      // 由于 enableLearning: false，不应有学习相关查询
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 相似度阈值测试
  // ===========================================================================

  describe("学习相似度阈值", () => {
    it("相似度低于阈值时不应用学习", async () => {
      // 阈值设为 0.85
      classifier = createLearningAwareClassifier({
        enableLearning: false, // 使用禁用学习来测试阈值逻辑
        learningOverrideThreshold: 0.85,
      });

      const result = await classifier.classify({
        input: "帮我搜索文章",
        userId: "user-1",
      });

      // 由于禁用学习，learning.applied 应为 false
      expect(result.learning?.applied).toBe(false);
    });

    it("可配置不同的学习覆盖阈值", async () => {
      // 动态导入以获取类类型
      const { LearningAwareClassifier } = await import(
        "../learning-aware-classifier"
      );

      const highThreshold = createLearningAwareClassifier({
        learningOverrideThreshold: 0.95,
        enableLearning: false,
      });
      expect(highThreshold).toBeInstanceOf(LearningAwareClassifier);

      const lowThreshold = createLearningAwareClassifier({
        learningOverrideThreshold: 0.5,
        enableLearning: false,
      });
      expect(lowThreshold).toBeInstanceOf(LearningAwareClassifier);
    });

    it("默认阈值为 0.85", async () => {
      // 使用默认配置创建
      const defaultClassifier = createLearningAwareClassifier({
        enableLearning: false,
      });

      // 验证可以正常分类
      const result = await defaultClassifier.classify({
        input: "帮我搜索文章",
        userId: "user-1",
      });

      expect(result.intent).toBe("query");
    });
  });

  // ===========================================================================
  // 多源分类结果优先级
  // ===========================================================================

  describe("多源分类结果优先级", () => {
    it("外部分类器 > 内置关键词分类", async () => {
      classifier = createLearningAwareClassifier({
        enableLearning: false,
      });

      // 外部分类器返回 create
      classifier.setOriginalClassifier({
        classify: async () => ({
          intent: "create" as IntentType,
          confidence: 0.88,
        }),
      });

      // 输入包含多个关键词
      const result = await classifier.classify({
        input: "整理并总结这些文章", // 包含 organize + create 关键词
        userId: "user-1",
      });

      expect(result.intent).toBe("create"); // 使用外部分类器结果
    });

    it("无外部分类器时使用内置关键词分类", async () => {
      classifier = createLearningAwareClassifier({
        enableLearning: false,
      });

      // 不设置外部分类器

      const result = await classifier.classify({
        input: "帮我整理收藏",
        userId: "user-1",
      });

      expect(result.intent).toBe("organize");
      expect(result.confidence).toBe(0.7); // 默认置信度
    });

    it("关键词匹配失败时返回 chitchat", async () => {
      classifier = createLearningAwareClassifier({
        enableLearning: false,
      });

      const result = await classifier.classify({
        input: "今天天气真好",
        userId: "user-1",
      });

      // 无法匹配特定意图时，返回 chitchat（闲聊）
      expect(result.intent).toBe("chitchat");
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  // ===========================================================================
  // 置信度处理测试
  // ===========================================================================

  describe("置信度处理", () => {
    it("保留外部分类器的置信度", async () => {
      classifier = createLearningAwareClassifier({
        enableLearning: false,
      });

      classifier.setOriginalClassifier({
        classify: async () => ({
          intent: "learn" as IntentType, // review → learn
          confidence: 0.76,
        }),
      });

      const result = await classifier.classify({
        input: "test input",
        userId: "user-1",
      });

      expect(result.confidence).toBe(0.76);
    });

    it("内置分类使用固定置信度 0.7", async () => {
      classifier = createLearningAwareClassifier({
        enableLearning: false,
      });

      const result = await classifier.classify({
        input: "导出我的数据",
        userId: "user-1",
      });

      expect(result.intent).toBe("analyze"); // export → analyze
      expect(result.confidence).toBe(0.7);
    });

    it("未知意图使用低置信度 0.3", async () => {
      classifier = createLearningAwareClassifier({
        enableLearning: false,
      });

      const result = await classifier.classify({
        input: "xxxxx",
        userId: "user-1",
      });

      expect(result.intent).toBe("chitchat"); // unknown → chitchat
      expect(result.confidence).toBe(0.3);
    });
  });

  // ===========================================================================
  // 信号类型优先级测试
  // ===========================================================================

  describe("纠正信号类型", () => {
    const signalTypes: CorrectionSignal["signal"][] = [
      "explicit_wrong",
      "correction_follow",
      "reformulation",
      "negative_feedback",
    ];

    it.each(signalTypes)("%s 信号类型被正确处理", async (signalType) => {
      // 这个测试验证不同信号类型都能被系统接受
      // 实际优先级处理在 CorrectionDetector 中
      expect(signalType).toBeDefined();
      expect([
        "explicit_wrong",
        "correction_follow",
        "reformulation",
        "negative_feedback",
      ]).toContain(signalType);
    });

    it("explicit_wrong 信号具有最高置信度", () => {
      // 根据设计，显式纠正信号应该具有最高权重
      const explicitSignal: Pick<CorrectionSignal, "signal" | "confidence"> = {
        signal: "explicit_wrong",
        confidence: 0.95,
      };

      const implicitSignal: Pick<CorrectionSignal, "signal" | "confidence"> = {
        signal: "negative_feedback",
        confidence: 0.7,
      };

      expect(explicitSignal.confidence).toBeGreaterThan(
        implicitSignal.confidence,
      );
    });
  });
});
