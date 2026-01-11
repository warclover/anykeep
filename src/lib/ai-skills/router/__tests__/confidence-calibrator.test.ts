/**
 * ConfidenceCalibrator 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import {
  ConfidenceCalibrator,
  getConfidenceCalibrator,
  resetConfidenceCalibrator,
  calibrateConfidence,
  type CalibrationFeatures,
} from "../confidence-calibrator";

describe("ConfidenceCalibrator", () => {
  let calibrator: ConfidenceCalibrator;

  beforeEach(() => {
    resetConfidenceCalibrator();
    calibrator = new ConfidenceCalibrator();
  });

  afterEach(() => {
    resetConfidenceCalibrator();
  });

  describe("calibrate", () => {
    it("should return raw confidence when disabled", () => {
      const disabledCalibrator = new ConfidenceCalibrator({ enabled: false });
      const features: CalibrationFeatures = {
        messageLength: 20,
        ruleWeight: 80,
        matchCount: 3,
        hasEntities: true,
        disambiguationUsed: false,
        source: "rule",
      };

      const result = disabledCalibrator.calibrate(0.75, features);
      expect(result).toBe(0.75);
    });

    it("should calibrate confidence with features", () => {
      const features: CalibrationFeatures = {
        messageLength: 20,
        ruleWeight: 80,
        matchCount: 3,
        hasEntities: true,
        disambiguationUsed: false,
        source: "rule",
      };

      const result = calibrator.calibrate(0.75, features);

      // 校准后的置信度应该在有效范围内
      expect(result).toBeGreaterThanOrEqual(0.1);
      expect(result).toBeLessThanOrEqual(0.99);
    });

    it("should respect minConfidence and maxConfidence", () => {
      const calibratorWithLimits = new ConfidenceCalibrator({
        minConfidence: 0.3,
        maxConfidence: 0.9,
      });

      const lowFeatures: CalibrationFeatures = {
        messageLength: 5,
        ruleWeight: 10,
        matchCount: 1,
        hasEntities: false,
        disambiguationUsed: false,
        source: "semantic",
      };

      const result = calibratorWithLimits.calibrate(0.1, lowFeatures);
      expect(result).toBeGreaterThanOrEqual(0.3);
    });

    it("should apply source factor correctly", () => {
      const features: CalibrationFeatures = {
        messageLength: 20,
        ruleWeight: 80,
        matchCount: 3,
        hasEntities: true,
        disambiguationUsed: false,
        source: "rule",
      };

      const ruleResult = calibrator.calibrate(0.8, features);

      // 语义来源应该更保守
      const semanticFeatures = { ...features, source: "semantic" as const };
      const semanticResult = calibrator.calibrate(0.8, semanticFeatures);

      // 相同原始置信度，rule 来源的校准结果应该 >= semantic
      expect(ruleResult).toBeGreaterThanOrEqual(semanticResult);
    });

    it("should update statistics after calibration", () => {
      const features: CalibrationFeatures = {
        messageLength: 20,
        ruleWeight: 80,
        matchCount: 3,
        hasEntities: true,
        disambiguationUsed: false,
        source: "rule",
      };

      calibrator.calibrate(0.5, features);
      calibrator.calibrate(0.7, features);
      calibrator.calibrate(0.9, features);

      const stats = calibrator.getStats();
      expect(stats.calibrations).toBe(3);
      expect(stats.avgAdjustment).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getParams", () => {
    it("should return current calibration params", () => {
      const params = calibrator.getParams();

      expect(params.weights).toHaveLength(6);
      expect(params.bias).toBeDefined();
      expect(params.updatedAt).toBeDefined();
    });
  });

  describe("updateParams", () => {
    it("should update params correctly", () => {
      const newWeights = [0.5, 0.2, 0.1, 0.1, 0.05, 0.05];
      calibrator.updateParams({ weights: newWeights, sampleCount: 100 });

      const params = calibrator.getParams();
      expect(params.weights).toEqual(newWeights);
      expect(params.sampleCount).toBe(100);
    });
  });

  describe("getStats", () => {
    it("should return calibration statistics", () => {
      const stats = calibrator.getStats();

      expect(stats).toHaveProperty("calibrations");
      expect(stats).toHaveProperty("avgAdjustment");
      expect(stats).toHaveProperty("upAdjustments");
      expect(stats).toHaveProperty("downAdjustments");
    });
  });

  describe("resetStats", () => {
    it("should reset all statistics", () => {
      const features: CalibrationFeatures = {
        messageLength: 20,
        ruleWeight: 80,
        matchCount: 3,
        hasEntities: true,
        disambiguationUsed: false,
        source: "rule",
      };

      calibrator.calibrate(0.75, features);
      calibrator.calibrate(0.85, features);

      calibrator.resetStats();

      const stats = calibrator.getStats();
      expect(stats.calibrations).toBe(0);
      expect(stats.avgAdjustment).toBe(0);
      expect(stats.upAdjustments).toBe(0);
      expect(stats.downAdjustments).toBe(0);
    });
  });

  describe("singleton", () => {
    it("should return same instance", () => {
      const instance1 = getConfidenceCalibrator();
      const instance2 = getConfidenceCalibrator();

      expect(instance1).toBe(instance2);
    });

    it("should create new instance after reset", () => {
      const instance1 = getConfidenceCalibrator();
      resetConfidenceCalibrator();
      const instance2 = getConfidenceCalibrator();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("calibrateConfidence utility", () => {
    it("should use singleton to calibrate", () => {
      const features: CalibrationFeatures = {
        messageLength: 20,
        ruleWeight: 80,
        matchCount: 3,
        hasEntities: true,
        disambiguationUsed: false,
        source: "rule",
      };

      const result = calibrateConfidence(0.75, features);

      expect(result).toBeGreaterThanOrEqual(0.1);
      expect(result).toBeLessThanOrEqual(0.99);
    });
  });

  describe("edge cases", () => {
    it("should handle zero confidence", () => {
      const features: CalibrationFeatures = {
        messageLength: 0,
        ruleWeight: 0,
        matchCount: 0,
        hasEntities: false,
        disambiguationUsed: false,
        source: "llm",
      };

      const result = calibrator.calibrate(0, features);
      expect(result).toBeGreaterThanOrEqual(0.1); // 受 minConfidence 限制
    });

    it("should handle maximum confidence", () => {
      const features: CalibrationFeatures = {
        messageLength: 100,
        ruleWeight: 100,
        matchCount: 10,
        hasEntities: true,
        disambiguationUsed: true,
        source: "rule",
      };

      const result = calibrator.calibrate(1, features);
      expect(result).toBeLessThanOrEqual(0.99); // 受 maxConfidence 限制
    });

    it("should handle very long messages", () => {
      const features: CalibrationFeatures = {
        messageLength: 10000, // 超长消息
        ruleWeight: 80,
        matchCount: 3,
        hasEntities: true,
        disambiguationUsed: false,
        source: "rule",
      };

      const result = calibrator.calibrate(0.75, features);
      // 消息长度被规范化到 0-1，不应该导致异常
      expect(result).toBeGreaterThanOrEqual(0.1);
      expect(result).toBeLessThanOrEqual(0.99);
    });
  });
});
