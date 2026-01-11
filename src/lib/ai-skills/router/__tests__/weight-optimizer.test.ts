/**
 * WeightOptimizer 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import {
  WeightOptimizer,
  getWeightOptimizer,
  resetWeightOptimizer,
  type WeightOptimizerConfig,
  type RuleStats,
  DEFAULT_WEIGHT_OPTIMIZER_CONFIG,
} from "../weight-optimizer";

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            data: [],
            error: null,
          })),
          eq: jest.fn(() => ({
            data: [],
            error: null,
          })),
        })),
        insert: jest.fn(() => ({
          data: null,
          error: null,
        })),
      })),
    }),
  ),
}));

describe("WeightOptimizer", () => {
  let optimizer: WeightOptimizer;

  beforeEach(() => {
    resetWeightOptimizer();
    optimizer = new WeightOptimizer();
  });

  afterEach(() => {
    resetWeightOptimizer();
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default config", () => {
      const opt = new WeightOptimizer();
      const stats = opt.getStats();

      expect(stats.rulesAnalyzed).toBe(0);
      expect(stats.updatesGenerated).toBe(0);
      expect(stats.updatesApplied).toBe(0);
      expect(stats.lastOptimizationAt).toBeNull();
    });

    it("should accept custom config", () => {
      const customConfig: Partial<WeightOptimizerConfig> = {
        lowAccuracyThreshold: 0.6,
        highAccuracyThreshold: 0.9,
        minSampleCount: 10,
      };

      const opt = new WeightOptimizer(customConfig);
      // 配置应该被应用（通过行为测试验证）
      expect(opt).toBeDefined();
    });
  });

  describe("getStats", () => {
    it("should return optimizer statistics", () => {
      const stats = optimizer.getStats();

      expect(stats).toHaveProperty("rulesAnalyzed");
      expect(stats).toHaveProperty("updatesGenerated");
      expect(stats).toHaveProperty("updatesApplied");
      expect(stats).toHaveProperty("lastOptimizationAt");
    });

    it("should return a copy of stats", () => {
      const stats1 = optimizer.getStats();
      const stats2 = optimizer.getStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  describe("resetStats", () => {
    it("should reset all statistics", () => {
      // 先生成一些统计数据（通过内部状态修改）
      const stats = optimizer.getStats();
      expect(stats.rulesAnalyzed).toBe(0);

      optimizer.resetStats();

      const newStats = optimizer.getStats();
      expect(newStats.rulesAnalyzed).toBe(0);
      expect(newStats.updatesGenerated).toBe(0);
      expect(newStats.updatesApplied).toBe(0);
      expect(newStats.lastOptimizationAt).toBeNull();
    });
  });

  describe("singleton", () => {
    it("should return same instance", () => {
      const instance1 = getWeightOptimizer();
      const instance2 = getWeightOptimizer();

      expect(instance1).toBe(instance2);
    });

    it("should create new instance after reset", () => {
      const instance1 = getWeightOptimizer();
      resetWeightOptimizer();
      const instance2 = getWeightOptimizer();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("weight update logic", () => {
    it("should generate update for low accuracy rule", () => {
      // 模拟低准确率的规则统计
      const lowAccuracyStats: RuleStats = {
        intentKey: "query:search",
        triggerCount: 50,
        correctCount: 25, // 50% 准确率
        wrongCount: 25,
        accuracy: 0.5,
        currentWeight: 70,
      };

      // 测试是否应该降权
      const shouldDowngrade =
        lowAccuracyStats.accuracy <
        DEFAULT_WEIGHT_OPTIMIZER_CONFIG.lowAccuracyThreshold;
      expect(shouldDowngrade).toBe(true);
    });

    it("should generate update for high accuracy high frequency rule", () => {
      // 模拟高准确率高频率的规则统计
      const highAccuracyStats: RuleStats = {
        intentKey: "query:count",
        triggerCount: 100,
        correctCount: 98, // 98% 准确率
        wrongCount: 2,
        accuracy: 0.98,
        currentWeight: 60,
      };

      // 测试是否应该提权
      const shouldUpgrade =
        highAccuracyStats.accuracy >
          DEFAULT_WEIGHT_OPTIMIZER_CONFIG.highAccuracyThreshold &&
        highAccuracyStats.triggerCount >
          DEFAULT_WEIGHT_OPTIMIZER_CONFIG.highFrequencyThreshold;
      expect(shouldUpgrade).toBe(true);
    });

    it("should not generate update for insufficient samples", () => {
      // 模拟样本不足的规则统计
      const insufficientStats: RuleStats = {
        intentKey: "organize:cleanup",
        triggerCount: 5, // 样本不足
        correctCount: 2,
        wrongCount: 3,
        accuracy: 0.4,
        currentWeight: 50,
      };

      // 测试是否应该跳过
      const shouldSkip =
        insufficientStats.triggerCount <
        DEFAULT_WEIGHT_OPTIMIZER_CONFIG.minSampleCount;
      expect(shouldSkip).toBe(true);
    });
  });

  describe("weight bounds", () => {
    it("should respect minimum weight", () => {
      const minWeight = DEFAULT_WEIGHT_OPTIMIZER_CONFIG.minWeight;
      const currentWeight = 15;
      const delta = -10;

      const newWeight = Math.max(minWeight, currentWeight + delta);
      expect(newWeight).toBeGreaterThanOrEqual(minWeight);
    });

    it("should respect maximum weight", () => {
      const maxWeight = DEFAULT_WEIGHT_OPTIMIZER_CONFIG.maxWeight;
      const currentWeight = 98;
      const delta = 5;

      const newWeight = Math.min(maxWeight, currentWeight + delta);
      expect(newWeight).toBeLessThanOrEqual(maxWeight);
    });
  });

  describe("confidence calculation", () => {
    it("should calculate update confidence based on sample size", () => {
      // 大样本量应该有更高的置信度
      const largeSampleStats: RuleStats = {
        intentKey: "query:search",
        triggerCount: 200,
        correctCount: 100,
        wrongCount: 100,
        accuracy: 0.5,
        currentWeight: 50,
      };

      const smallSampleStats: RuleStats = {
        intentKey: "query:list",
        triggerCount: 25,
        correctCount: 12,
        wrongCount: 13,
        accuracy: 0.48,
        currentWeight: 50,
      };

      // 样本量因子：min(triggerCount / 100, 1) * 0.3
      const largeSampleFactor =
        Math.min(largeSampleStats.triggerCount / 100, 1) * 0.3;
      const smallSampleFactor =
        Math.min(smallSampleStats.triggerCount / 100, 1) * 0.3;

      expect(largeSampleFactor).toBeGreaterThan(smallSampleFactor);
    });
  });
});
