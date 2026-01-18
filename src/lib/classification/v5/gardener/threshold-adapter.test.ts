/**
 * 智能分类 v5.0 - 阈值自适应器测试
 */

import { ThresholdAdapter } from './threshold-adapter';
import type { ClassificationStats } from './threshold-adapter';
import type { LoggerService } from '../shared/logger';
import type { ThresholdConfig } from './types';

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

describe('ThresholdAdapter', () => {
  let adapter: ThresholdAdapter;
  let config: ThresholdConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      t0ConfidenceThreshold: 0.85,
      vectorConflictThreshold: 0.15,
      minThreshold: 0.7,
      maxThreshold: 0.95,
    };
    adapter = new ThresholdAdapter(mockLogger, config);
  });

  describe('构造函数', () => {
    it('应该正确初始化', () => {
      expect(adapter).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({
        service: 'ThresholdAdapter',
      });
    });
  });

  describe('analyze', () => {
    it('数据量不足时应该返回 null', () => {
      const stats: ClassificationStats = {
        totalClassifications: 30,
        correctClassifications: 25,
        t1Corrections: 5,
        userCorrections: 2,
        averageConfidence: 0.88,
      };

      const result = adapter.analyze(stats);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '数据量不足，不建议调整阈值',
        expect.any(Object)
      );
    });

    it('场景1: 高准确率 + 低T1率 → 建议降低阈值', () => {
      const stats: ClassificationStats = {
        totalClassifications: 100,
        correctClassifications: 92,
        t1Corrections: 8,
        userCorrections: 3,
        averageConfidence: 0.9,
      };

      const result = adapter.analyze(stats);

      expect(result).not.toBeNull();
      expect(result!.suggestedThreshold).toBeLessThan(result!.currentThreshold);
      expect(result!.reason).toContain('降低阈值');
      expect(result!.confidence).toBeGreaterThan(0.8);
    });

    it('场景2: 低准确率 → 建议提高阈值', () => {
      const stats: ClassificationStats = {
        totalClassifications: 100,
        correctClassifications: 70,
        t1Corrections: 20,
        userCorrections: 10,
        averageConfidence: 0.82,
      };

      const result = adapter.analyze(stats);

      expect(result).not.toBeNull();
      expect(result!.suggestedThreshold).toBeGreaterThan(result!.currentThreshold);
      expect(result!.reason).toContain('提高阈值');
    });

    it('场景3: T1纠正率过高 → 建议提高阈值', () => {
      const stats: ClassificationStats = {
        totalClassifications: 100,
        correctClassifications: 80,
        t1Corrections: 35,
        userCorrections: 5,
        averageConfidence: 0.85,
      };

      const result = adapter.analyze(stats);

      expect(result).not.toBeNull();
      expect(result!.suggestedThreshold).toBeGreaterThan(result!.currentThreshold);
      expect(result!.reason).toContain('T1 纠正率过高');
    });

    it('场景4: 平均置信度远高于阈值 → 建议降低阈值', () => {
      const stats: ClassificationStats = {
        totalClassifications: 100,
        correctClassifications: 85,
        t1Corrections: 12,
        userCorrections: 5,
        averageConfidence: 1.02, // 远高于 0.85
      };

      const result = adapter.analyze(stats);

      expect(result).not.toBeNull();
      expect(result!.suggestedThreshold).toBeLessThan(result!.currentThreshold);
      expect(result!.reason).toContain('平均置信度');
    });

    it('应该遵守最小阈值限制', () => {
      config.t0ConfidenceThreshold = 0.72; // 接近最小值
      adapter = new ThresholdAdapter(mockLogger, config);

      const stats: ClassificationStats = {
        totalClassifications: 100,
        correctClassifications: 95,
        t1Corrections: 5,
        userCorrections: 1,
        averageConfidence: 0.95,
      };

      const result = adapter.analyze(stats);

      if (result) {
        expect(result.suggestedThreshold).toBeGreaterThanOrEqual(config.minThreshold);
      }
    });

    it('应该遵守最大阈值限制', () => {
      config.t0ConfidenceThreshold = 0.93; // 接近最大值
      adapter = new ThresholdAdapter(mockLogger, config);

      const stats: ClassificationStats = {
        totalClassifications: 100,
        correctClassifications: 65,
        t1Corrections: 25,
        userCorrections: 15,
        averageConfidence: 0.8,
      };

      const result = adapter.analyze(stats);

      if (result) {
        expect(result.suggestedThreshold).toBeLessThanOrEqual(config.maxThreshold);
      }
    });
  });

  describe('applyAdjustment', () => {
    it('应该应用阈值调整', () => {
      const adjustment = {
        currentThreshold: 0.85,
        suggestedThreshold: 0.8,
        reason: 'Test adjustment',
        confidence: 0.9,
        supportingData: {
          totalClassifications: 100,
          averageAccuracy: 0.92,
          t1CorrectionRate: 0.08,
          userCorrectionRate: 0.03,
        },
      };

      adapter.applyAdjustment(adjustment);

      const updatedConfig = adapter.getConfig();
      expect(updatedConfig.t0ConfidenceThreshold).toBe(0.8);
    });
  });

  describe('getConfig', () => {
    it('应该返回当前配置的副本', () => {
      const returnedConfig = adapter.getConfig();

      expect(returnedConfig).toEqual(config);
      expect(returnedConfig).not.toBe(config); // 应该是副本
    });
  });
});
