/**
 * 智能分类 v5.1 - Alpha 计算器测试
 *
 * v5.1 使用弹性权重算法：
 * - N < 10: α = 0.8（小文件夹，80% 名称权重）
 * - 10 ≤ N < 100: α 线性递减 0.8 → 0.5
 * - N ≥ 100: α = 0.5（大文件夹，防止质心过度主导）
 */

import { AlphaCalculator, ALPHA_CONSTANTS } from "./alpha-calculator";
import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type { FolderStats } from "./types";

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

describe("AlphaCalculator", () => {
  let calculator: AlphaCalculator;

  beforeEach(() => {
    jest.clearAllMocks();
    calculator = new AlphaCalculator(mockLogger);
  });

  describe("calculate (v5.1 弹性权重模式)", () => {
    it("应该计算基本的 alpha 系数", () => {
      const stats: FolderStats = {
        folderId: "test-folder",
        lastUsed: new Date(),
        behaviorCount: 50,
        contentCount: 50,
        contentDiversity: 0.5,
        recentActivity: 0.5,
      };

      const alpha = calculator.calculate(stats);

      // v5.1: contentCount=50 处于成长期，α 线性递减
      // α = 0.8 - 0.3 * (50-10)/90 ≈ 0.667
      expect(alpha).toBeGreaterThanOrEqual(0.2);
      expect(alpha).toBeLessThanOrEqual(0.8);
    });

    it("v5.1 弹性权重：小文件夹应该返回 0.8", () => {
      const smallStats: FolderStats = {
        folderId: "small-folder",
        lastUsed: new Date(),
        behaviorCount: 5,
        contentCount: 5, // < 10，小文件夹
        contentDiversity: 0.5,
        recentActivity: 0.8,
      };

      const alpha = calculator.calculate(smallStats);

      // v5.1: 小文件夹 (contentCount < 10) 返回 0.8
      expect(alpha).toBe(ALPHA_CONSTANTS.SMALL_FOLDER_ALPHA);
    });

    it("v5.1 弹性权重：大文件夹应该返回 0.5", () => {
      const largeStats: FolderStats = {
        folderId: "large-folder",
        lastUsed: new Date(),
        behaviorCount: 50,
        contentCount: 150, // >= 100，大文件夹
        contentDiversity: 0.5,
        recentActivity: 0.2,
      };

      const alpha = calculator.calculate(largeStats);

      // v5.1: 大文件夹 (contentCount >= 100) 返回 0.5
      expect(alpha).toBe(ALPHA_CONSTANTS.LARGE_FOLDER_ALPHA);
    });

    it("v5.1 弹性权重：成长期文件夹 alpha 应该线性递减", () => {
      // contentCount = 55，处于成长期 (10-100)
      const growthStats: FolderStats = {
        folderId: "growth-folder",
        lastUsed: new Date(),
        behaviorCount: 20,
        contentCount: 55,
        contentDiversity: 0.5,
        recentActivity: 0.5,
      };

      const alpha = calculator.calculate(growthStats);

      // 期望值: 0.8 - 0.3 * (55-10)/90 = 0.8 - 0.3 * 0.5 = 0.65
      expect(alpha).toBeCloseTo(0.65, 2);
    });

    it("alpha 应该被限制在 [0.2, 0.8] 范围内", () => {
      const extremeStats: FolderStats = {
        folderId: "extreme-folder",
        lastUsed: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 年前
        behaviorCount: 0,
        contentCount: 100,
        contentDiversity: 0,
        recentActivity: 0,
      };

      const alpha = calculator.calculate(extremeStats);

      expect(alpha).toBeGreaterThanOrEqual(0.2);
      expect(alpha).toBeLessThanOrEqual(0.8);
    });

    it("v5.1: 空文件夹应该返回 0.8 (小文件夹策略)", () => {
      const emptyStats: FolderStats = {
        folderId: "empty-folder",
        lastUsed: new Date(),
        behaviorCount: 0,
        contentCount: 0, // < 10，视为小文件夹
        contentDiversity: 0.5,
        recentActivity: 0.5,
      };

      const alpha = calculator.calculate(emptyStats);

      // v5.1: 空文件夹 contentCount=0 < 10，返回 0.8
      expect(alpha).toBe(ALPHA_CONSTANTS.SMALL_FOLDER_ALPHA);
    });
  });

  describe("calculate (v5.0 兼容模式)", () => {
    let v50Calculator: AlphaCalculator;

    beforeEach(() => {
      // 禁用 v5.1 特性，使用 v5.0 算法
      v50Calculator = new AlphaCalculator(mockLogger, {
        enableV51Features: false,
      });
    });

    it("v5.0: 最近使用的文件夹应该有较高的 alpha", () => {
      const recentStats: FolderStats = {
        folderId: "recent-folder",
        lastUsed: new Date(), // 刚刚使用
        behaviorCount: 50,
        contentCount: 50,
        contentDiversity: 0.5,
        recentActivity: 0.8,
      };

      const oldStats: FolderStats = {
        folderId: "old-folder",
        lastUsed: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 天前
        behaviorCount: 50,
        contentCount: 50,
        contentDiversity: 0.5,
        recentActivity: 0.2,
      };

      const recentAlpha = v50Calculator.calculate(recentStats);
      const oldAlpha = v50Calculator.calculate(oldStats);

      // v5.0: 使用时间因素和活跃度因素
      expect(recentAlpha).toBeGreaterThan(oldAlpha);
    });

    it("v5.0: 行为数据多的文件夹应该有较高的 alpha", () => {
      const behaviorHeavyStats: FolderStats = {
        folderId: "behavior-heavy",
        lastUsed: new Date(),
        behaviorCount: 80,
        contentCount: 20,
        contentDiversity: 0.5,
        recentActivity: 0.5,
      };

      const contentHeavyStats: FolderStats = {
        folderId: "content-heavy",
        lastUsed: new Date(),
        behaviorCount: 20,
        contentCount: 80,
        contentDiversity: 0.5,
        recentActivity: 0.5,
      };

      const behaviorAlpha = v50Calculator.calculate(behaviorHeavyStats);
      const contentAlpha = v50Calculator.calculate(contentHeavyStats);

      // v5.0: 行为数据占比影响 alpha
      expect(behaviorAlpha).toBeGreaterThan(contentAlpha);
    });

    it("v5.0: 空文件夹应该返回接近 0.5 的默认值", () => {
      const emptyStats: FolderStats = {
        folderId: "empty-folder",
        lastUsed: new Date(),
        behaviorCount: 0,
        contentCount: 0,
        contentDiversity: 0.5,
        recentActivity: 0.5,
      };

      const alpha = v50Calculator.calculate(emptyStats);

      // v5.0: 加权平均后应接近 0.5
      expect(alpha).toBeGreaterThanOrEqual(0.4);
      expect(alpha).toBeLessThanOrEqual(0.7);
    });
  });

  describe("calculateElasticAlpha", () => {
    it("边界值测试：contentCount = 10 应该返回 0.8", () => {
      const alpha = calculator.calculateElasticAlpha(10);
      // 恰好在边界，处于成长期开始，ratio = 0
      expect(alpha).toBe(ALPHA_CONSTANTS.SMALL_FOLDER_ALPHA);
    });

    it("边界值测试：contentCount = 100 应该返回 0.5", () => {
      const alpha = calculator.calculateElasticAlpha(100);
      expect(alpha).toBe(ALPHA_CONSTANTS.LARGE_FOLDER_ALPHA);
    });

    it("中间值测试：contentCount = 55 应该返回约 0.65", () => {
      const alpha = calculator.calculateElasticAlpha(55);
      // α = 0.8 - 0.3 * (55-10)/90 = 0.8 - 0.15 = 0.65
      expect(alpha).toBeCloseTo(0.65, 2);
    });
  });
});
