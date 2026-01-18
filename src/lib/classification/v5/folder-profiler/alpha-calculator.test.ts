/**
 * 智能分类 v5.0 - Alpha 计算器测试
 */

import { AlphaCalculator } from './alpha-calculator';
import type { LoggerService } from '../shared/logger';
import type { FolderStats } from './types';

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

describe('AlphaCalculator', () => {
  let calculator: AlphaCalculator;

  beforeEach(() => {
    jest.clearAllMocks();
    calculator = new AlphaCalculator(mockLogger);
  });

  describe('calculate', () => {
    it('应该计算基本的 alpha 系数', () => {
      const stats: FolderStats = {
        folderId: 'test-folder',
        lastUsed: new Date(),
        behaviorCount: 50,
        contentCount: 50,
        contentDiversity: 0.5,
        recentActivity: 0.5,
      };

      const alpha = calculator.calculate(stats);

      expect(alpha).toBeGreaterThanOrEqual(0.2);
      expect(alpha).toBeLessThanOrEqual(0.8);
    });

    it('最近使用的文件夹应该有较高的 alpha', () => {
      const recentStats: FolderStats = {
        folderId: 'recent-folder',
        lastUsed: new Date(), // 刚刚使用
        behaviorCount: 50,
        contentCount: 50,
        contentDiversity: 0.5,
        recentActivity: 0.8,
      };

      const oldStats: FolderStats = {
        folderId: 'old-folder',
        lastUsed: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 天前
        behaviorCount: 50,
        contentCount: 50,
        contentDiversity: 0.5,
        recentActivity: 0.2,
      };

      const recentAlpha = calculator.calculate(recentStats);
      const oldAlpha = calculator.calculate(oldStats);

      expect(recentAlpha).toBeGreaterThan(oldAlpha);
    });

    it('行为数据多的文件夹应该有较高的 alpha', () => {
      const behaviorHeavyStats: FolderStats = {
        folderId: 'behavior-heavy',
        lastUsed: new Date(),
        behaviorCount: 80,
        contentCount: 20,
        contentDiversity: 0.5,
        recentActivity: 0.5,
      };

      const contentHeavyStats: FolderStats = {
        folderId: 'content-heavy',
        lastUsed: new Date(),
        behaviorCount: 20,
        contentCount: 80,
        contentDiversity: 0.5,
        recentActivity: 0.5,
      };

      const behaviorAlpha = calculator.calculate(behaviorHeavyStats);
      const contentAlpha = calculator.calculate(contentHeavyStats);

      expect(behaviorAlpha).toBeGreaterThan(contentAlpha);
    });

    it('alpha 应该被限制在 [0.2, 0.8] 范围内', () => {
      const extremeStats: FolderStats = {
        folderId: 'extreme-folder',
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

    it('空文件夹应该返回默认 alpha (0.5)', () => {
      const emptyStats: FolderStats = {
        folderId: 'empty-folder',
        lastUsed: new Date(),
        behaviorCount: 0,
        contentCount: 0,
        contentDiversity: 0.5,
        recentActivity: 0.5,
      };

      const alpha = calculator.calculate(emptyStats);

      // 应该接近 0.5（默认值）
      expect(alpha).toBeGreaterThanOrEqual(0.4);
      expect(alpha).toBeLessThanOrEqual(0.6);
    });
  });
});
