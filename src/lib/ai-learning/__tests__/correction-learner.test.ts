/**
 * CorrectionLearner 单元测试
 *
 * 测试纠正学习器的核心功能：
 * - 纠正记录存储
 * - 相似纠正查询
 * - 应用记录更新
 * - 学习统计
 *
 * @module ai-learning
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { CorrectionSignal, IntentType } from "../types";

// =============================================================================
// Mock 设置
// =============================================================================

// Mock 链式调用返回值
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSingle = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSelect = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockInsert = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpdate = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockEq = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockOrder = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLimit = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = jest.fn<any>();

// 设置 Supabase Mock
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

describe("CorrectionLearner", () => {
  // 延迟导入以确保 mock 生效 - 使用 any 避免 import() 类型限制
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let createCorrectionLearner: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let learner: any;

  beforeEach(async () => {
    // 清除所有 mock
    jest.clearAllMocks();

    // 重置链式调用默认行为
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder, error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
    });

    // 动态导入模块
    const correctionLearnerModule = await import("../correction-learner");
    createCorrectionLearner = correctionLearnerModule.createCorrectionLearner;
    learner = createCorrectionLearner();
  });

  // ===========================================================================
  // recordCorrection 测试
  // ===========================================================================

  describe("recordCorrection", () => {
    const mockId = "correction-123";
    const baseParams = {
      userId: "user-1",
      originalMessage: "帮我整理收藏",
      wrongIntent: "query" as IntentType,
      correctIntent: "organize" as IntentType,
      signal: {
        signal: "correction_follow",
        confidence: 0.88,
      } as CorrectionSignal,
    };

    it("成功记录纠正", async () => {
      // 设置成功响应
      mockSingle.mockResolvedValueOnce({
        data: { id: mockId },
        error: null,
      });

      const result = await learner.recordCorrection(baseParams);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(mockId);
      expect(mockFrom).toHaveBeenCalledWith("intent_corrections");
    });

    it("记录包含正确的字段", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: mockId },
        error: null,
      });

      await learner.recordCorrection(baseParams);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          original_input: "帮我整理收藏",
          wrong_intent: "query",
          correct_intent: "organize",
          signal: "correction_follow",
          confidence: 0.88,
          applied_count: 0,
        }),
      );
    });

    it("数据库错误返回失败", async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

      const result = await learner.recordCorrection(baseParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it.each([
      "explicit_wrong",
      "correction_follow",
      "reformulation",
      "negative_feedback",
    ] as const)("记录 %s 信号类型", async (signalType) => {
      mockSingle.mockResolvedValueOnce({
        data: { id: mockId },
        error: null,
      });

      await learner.recordCorrection({
        ...baseParams,
        signal: { signal: signalType, confidence: 0.9 },
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: signalType,
        }),
      );
    });
  });

  // ===========================================================================
  // findSimilarCorrection 测试
  // ===========================================================================

  describe("findSimilarCorrection", () => {
    // 使用空格分隔的文本以匹配 tokenize 逻辑（按空格分词）
    const baseParams = {
      input: "帮我 整理 收藏",
      userId: "user-1",
    };

    beforeEach(() => {
      // 重置链式调用以支持 findSimilarCorrection 的调用链
      mockEq.mockReturnValue({ order: mockOrder });
      mockOrder.mockReturnValue({ limit: mockLimit });
    });

    it("找到高相似度纠正记录", async () => {
      const mockRecords = [
        {
          id: "corr-1",
          // 使用相同的分词格式，有 3/4 个词重叠 = 0.75 相似度
          original_input: "帮我 整理 收藏 夹",
          correct_intent: "organize",
          applied_count: 5,
        },
      ];
      mockLimit.mockResolvedValueOnce({ data: mockRecords, error: null });

      const result = await learner.findSimilarCorrection({
        ...baseParams,
        similarityThreshold: 0.7, // 降低阈值以匹配 0.75
      });

      expect(result.success).toBe(true);
      expect(result.data?.correctIntent).toBe("organize");
      expect(result.data?.similarity).toBeGreaterThan(0.5);
    });

    it("无历史记录返回 null", async () => {
      mockLimit.mockResolvedValueOnce({ data: [], error: null });

      const result = await learner.findSimilarCorrection(baseParams);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("相似度低于阈值返回 null", async () => {
      const mockRecords = [
        {
          id: "corr-1",
          original_input: "完全 不同 的 内容",
          correct_intent: "create",
          applied_count: 2,
        },
      ];
      mockLimit.mockResolvedValueOnce({ data: mockRecords, error: null });

      const result = await learner.findSimilarCorrection({
        ...baseParams,
        similarityThreshold: 0.9,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("数据库错误返回失败", async () => {
      mockLimit.mockResolvedValueOnce({
        data: null,
        error: { message: "Query failed" },
      });

      const result = await learner.findSimilarCorrection(baseParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Query failed");
    });

    it("返回相似度最高的记录", async () => {
      const mockRecords = [
        {
          id: "corr-1",
          // 2/4 词重叠 = 0.5
          original_input: "整理 收藏",
          correct_intent: "organize",
          applied_count: 3,
        },
        {
          id: "corr-2",
          // 3/4 词重叠 = 0.75
          original_input: "帮我 整理 收藏 夹",
          correct_intent: "organize",
          applied_count: 5,
        },
      ];
      mockLimit.mockResolvedValueOnce({ data: mockRecords, error: null });

      const result = await learner.findSimilarCorrection({
        ...baseParams,
        similarityThreshold: 0.5, // 降低阈值
      });

      expect(result.success).toBe(true);
      // 应返回相似度更高的记录
      expect(result.data).not.toBeNull();
      expect(result.data?.id).toBe("corr-2"); // 验证返回的是相似度更高的
    });
  });

  // ===========================================================================
  // recordApplication 测试
  // ===========================================================================

  describe("recordApplication", () => {
    const correctionId = "correction-123";

    beforeEach(() => {
      // 重置 eq 以返回 Promise
      mockEq.mockResolvedValue({ error: null });
    });

    it("成功更新应用计数", async () => {
      const result = await learner.recordApplication(correctionId);

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith("intent_corrections");
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("更新失败返回错误", async () => {
      mockEq.mockResolvedValueOnce({
        error: { message: "Update failed" },
      });

      const result = await learner.recordApplication(correctionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Update failed");
    });
  });

  // ===========================================================================
  // getStats 测试
  // ===========================================================================

  describe("getStats", () => {
    const userId = "user-1";

    beforeEach(() => {
      // 重置 eq 以返回 Promise
      mockEq.mockResolvedValue({ data: [], error: null });
    });

    it("获取空统计", async () => {
      const result = await learner.getStats(userId);

      expect(result.success).toBe(true);
      expect(result.data?.totalCorrections).toBe(0);
      expect(result.data?.totalApplications).toBe(0);
    });

    it("正确计算统计数据", async () => {
      const mockRecords = [
        {
          correct_intent: "organize",
          applied_count: 5,
          created_at: "2025-12-25T10:00:00Z",
        },
        {
          correct_intent: "organize",
          applied_count: 3,
          created_at: "2025-12-24T10:00:00Z",
        },
        {
          correct_intent: "query",
          applied_count: 2,
          created_at: "2025-12-23T10:00:00Z",
        },
      ];
      mockEq.mockResolvedValueOnce({ data: mockRecords, error: null });

      const result = await learner.getStats(userId);

      expect(result.success).toBe(true);
      expect(result.data?.totalCorrections).toBe(3);
      expect(result.data?.totalApplications).toBe(10);
      expect(result.data?.byIntent.organize.corrections).toBe(2);
      expect(result.data?.byIntent.organize.applications).toBe(8);
      expect(result.data?.byIntent.query.corrections).toBe(1);
    });

    it("数据库错误返回失败", async () => {
      mockEq.mockResolvedValueOnce({
        data: null,
        error: { message: "Stats query failed" },
      });

      const result = await learner.getStats(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Stats query failed");
    });

    it("记录最后纠正时间", async () => {
      const mockRecords = [
        {
          correct_intent: "organize",
          applied_count: 1,
          created_at: "2025-12-25T15:00:00Z",
        },
        {
          correct_intent: "query",
          applied_count: 1,
          created_at: "2025-12-20T10:00:00Z",
        },
      ];
      mockEq.mockResolvedValueOnce({ data: mockRecords, error: null });

      const result = await learner.getStats(userId);

      expect(result.success).toBe(true);
      expect(result.data?.lastCorrectionAt).toEqual(
        new Date("2025-12-25T15:00:00Z"),
      );
    });
  });

  // ===========================================================================
  // 工厂函数测试
  // ===========================================================================

  describe("createCorrectionLearner", () => {
    it("创建 CorrectionLearner 实例", async () => {
      const instance = createCorrectionLearner();
      // 动态导入以获取类类型进行 instanceof 检查
      const { CorrectionLearner } = await import("../correction-learner");
      expect(instance).toBeInstanceOf(CorrectionLearner);
    });
  });
});
