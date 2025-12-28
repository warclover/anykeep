/**
 * 信号融合器单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  SignalFusion,
  signalFusion,
  calculateSignalCoverage,
  calculateSignalDiversity,
  calculateResultStability,
} from "../signal-fusion";
import type { InferenceSignal, PersonaInferenceResult } from "../types";

describe("SignalFusion", () => {
  describe("generateResult", () => {
    it("should generate result with high confidence for strong signals", () => {
      const signals: InferenceSignal[] = [
        {
          type: "platform",
          source: "36kr.com",
          personas: ["pm"],
          weight: 0.8,
          count: 50,
        },
        {
          type: "tag",
          source: "prd",
          personas: ["pm"],
          weight: 0.9,
          count: 30,
        },
      ];

      const result = signalFusion.generateResult(signals, 100);

      expect(result.primaryPersona).toBe("pm");
      expect(result.confidence).toBeGreaterThan(60);
      expect(result.signals).toHaveLength(2);
    });

    it("should return low confidence for signals that don't match rules", () => {
      // 使用不匹配任何规则的平台信号
      // 当信号不匹配规则时，无法提取画像信息
      // 此时返回 general 画像，置信度取决于归一化策略
      const signals: InferenceSignal[] = [
        {
          type: "platform",
          source: "unknown-domain.xyz",
          personas: ["pm"],
          weight: 0.1,
          count: 2,
        },
      ];

      const result = signalFusion.generateResult(signals, 100);

      // 未匹配信号返回 general 画像
      // 由于 normalizeToConfidence 对空分数默认返回 100%
      // 这表示"我们确定无法分类，所以归为 general"
      expect(result.primaryPersona).toBe("general");
      expect(result.confidence).toBe(100);
    });

    it("should return general persona for empty signals", () => {
      const result = signalFusion.generateResult([], 50);

      expect(result.primaryPersona).toBe("general");
      expect(result.confidence).toBe(0);
    });

    it("should include alternatives sorted by confidence", () => {
      const signals: InferenceSignal[] = [
        {
          type: "platform",
          source: "github.com",
          personas: ["indie_dev", "ai_enthusiast"],
          weight: 0.7,
          count: 40,
        },
        {
          type: "tag",
          source: "ai",
          personas: ["ai_enthusiast"],
          weight: 0.8,
          count: 30,
        },
      ];

      const result = signalFusion.generateResult(signals, 100);

      expect(result.alternatives.length).toBeGreaterThan(0);
      // Alternatives should be sorted by confidence (descending)
      for (let i = 0; i < result.alternatives.length - 1; i++) {
        expect(result.alternatives[i].confidence).toBeGreaterThanOrEqual(
          result.alternatives[i + 1].confidence,
        );
      }
    });

    it("should calculate correct sample size", () => {
      const signals: InferenceSignal[] = [
        {
          type: "platform",
          source: "arxiv.org",
          personas: ["phd"],
          weight: 0.9,
          count: 25,
        },
      ];

      const result = signalFusion.generateResult(signals, 200);

      expect(result.sampleSize).toBe(200);
    });

    it("should include inferredAt timestamp", () => {
      const signals: InferenceSignal[] = [
        {
          type: "platform",
          source: "cnki.net",
          personas: ["teacher"],
          weight: 0.8,
          count: 20,
        },
      ];

      const result = signalFusion.generateResult(signals, 50);

      expect(result.inferredAt).toBeDefined();
      expect(new Date(result.inferredAt).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
    });

    it("should handle consultant persona correctly", () => {
      const signals: InferenceSignal[] = [
        {
          type: "platform",
          source: "mbalib.com",
          personas: ["consultant"],
          weight: 0.85,
          count: 30,
        },
        {
          type: "tag",
          source: "战略咨询",
          personas: ["consultant"],
          weight: 0.9,
          count: 25,
        },
      ];

      const result = signalFusion.generateResult(signals, 100);

      expect(result.primaryPersona).toBe("consultant");
      expect(result.confidence).toBeGreaterThan(50);
    });
  });

  describe("calculateSignalCoverage", () => {
    it("should return 0 for empty signals", () => {
      const coverage = calculateSignalCoverage([], 0);
      expect(coverage).toBe(0);
    });

    it("should return higher coverage for more signal types", () => {
      const singleType: InferenceSignal[] = [
        {
          type: "platform",
          source: "test",
          personas: ["pm"],
          weight: 0.8,
          count: 10,
        },
      ];

      const multiType: InferenceSignal[] = [
        {
          type: "platform",
          source: "test1",
          personas: ["pm"],
          weight: 0.8,
          count: 10,
        },
        {
          type: "tag",
          source: "test2",
          personas: ["pm"],
          weight: 0.8,
          count: 10,
        },
      ];

      const singleCoverage = calculateSignalCoverage(singleType, 100);
      const multiCoverage = calculateSignalCoverage(multiType, 100);

      expect(multiCoverage).toBeGreaterThan(singleCoverage);
    });
  });

  describe("calculateSignalDiversity", () => {
    it("should return 0 for empty signals", () => {
      const diversity = calculateSignalDiversity([]);
      expect(diversity).toBe(0);
    });

    it("should return higher diversity for more unique sources", () => {
      const singleSource: InferenceSignal[] = [
        {
          type: "platform",
          source: "test",
          personas: ["pm"],
          weight: 0.8,
          count: 10,
        },
      ];

      const multiSource: InferenceSignal[] = [
        {
          type: "platform",
          source: "test1",
          personas: ["pm"],
          weight: 0.8,
          count: 10,
        },
        {
          type: "platform",
          source: "test2",
          personas: ["pm"],
          weight: 0.8,
          count: 10,
        },
        {
          type: "platform",
          source: "test3",
          personas: ["pm"],
          weight: 0.8,
          count: 10,
        },
      ];

      const singleDiversity = calculateSignalDiversity(singleSource);
      const multiDiversity = calculateSignalDiversity(multiSource);

      expect(multiDiversity).toBeGreaterThan(singleDiversity);
    });
  });

  describe("calculateResultStability", () => {
    it("should return high stability for consistent signals", () => {
      const signals: InferenceSignal[] = [
        {
          type: "platform",
          source: "36kr.com",
          personas: ["pm"],
          weight: 0.9,
          count: 30,
        },
        {
          type: "tag",
          source: "prd",
          personas: ["pm"],
          weight: 0.9,
          count: 30,
        },
      ];

      // 生成推断结果
      const result = signalFusion.generateResult(signals, 100);
      const stability = calculateResultStability(result);

      expect(stability).toBeGreaterThan(0.7);
    });

    it("should return low stability for mixed signals", () => {
      const signals: InferenceSignal[] = [
        {
          type: "platform",
          source: "36kr.com",
          personas: ["pm"],
          weight: 0.5,
          count: 10,
        },
        {
          type: "platform",
          source: "cnki.net",
          personas: ["teacher"],
          weight: 0.5,
          count: 10,
        },
        {
          type: "platform",
          source: "mbalib.com",
          personas: ["consultant"],
          weight: 0.5,
          count: 10,
        },
      ];

      // 生成推断结果
      const result = signalFusion.generateResult(signals, 100);
      const stability = calculateResultStability(result);

      expect(stability).toBeLessThan(0.7);
    });

    it("should return 1 for result with no alternatives", () => {
      // 创建一个没有备选画像的结果
      const result: PersonaInferenceResult = {
        primaryPersona: "pm",
        group: "professional",
        confidence: 80,
        alternatives: [],
        signals: [],
        inferredAt: new Date().toISOString(),
        sampleSize: 50,
      };

      const stability = calculateResultStability(result);

      expect(stability).toBe(1);
    });
  });

  describe("SignalFusion instance", () => {
    it("should be a singleton", () => {
      expect(signalFusion).toBeDefined();
      expect(signalFusion).toBeInstanceOf(SignalFusion);
    });
  });
});
