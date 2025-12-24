/**
 * ProgressReporter 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type { ProgressReporter } from "../progress-reporter";
import {
  createProgressReporter,
  createSimpleProgressReporter,
} from "../progress-reporter";
import type { StepDefinition } from "../types";

describe("ProgressReporter", () => {
  describe("initialization", () => {
    it("should initialize with step definitions", () => {
      const steps: StepDefinition[] = [
        { id: "step1", name: "第一步", weight: 1 },
        { id: "step2", name: "第二步", weight: 2 },
        { id: "step3", name: "第三步", weight: 1 },
      ];

      const reporter = createProgressReporter(steps);

      expect(reporter.getTotalStepsCount()).toBe(3);
      expect(reporter.getCompletedStepsCount()).toBe(0);
      expect(reporter.getOverallPercent()).toBe(0);
    });

    it("should normalize weights to sum to 1", () => {
      const steps: StepDefinition[] = [
        { id: "step1", name: "第一步", weight: 2 },
        { id: "step2", name: "第二步", weight: 2 },
      ];

      const reporter = createProgressReporter(steps);

      // 每个步骤完成应该贡献 50%
      reporter.startNextStep();
      reporter.completeCurrentStep();

      expect(reporter.getOverallPercent()).toBe(50);
    });
  });

  describe("step progression", () => {
    let reporter: ProgressReporter;
    const steps: StepDefinition[] = [
      { id: "step1", name: "分析数据", weight: 1 },
      { id: "step2", name: "处理内容", weight: 2 },
      { id: "step3", name: "生成报告", weight: 1 },
    ];

    beforeEach(() => {
      reporter = createProgressReporter(steps);
    });

    it("should start first step correctly", () => {
      const chunk = reporter.startNextStep("开始分析");

      expect(chunk.type).toBe("progress");
      expect(chunk.data.step).toBe("分析数据");
      expect(chunk.data.stepIndex).toBe(0);
      expect(chunk.data.totalSteps).toBe(3);
      expect(reporter.getCurrentStepName()).toBe("分析数据");
    });

    it("should complete step and start next", () => {
      reporter.startNextStep();
      const chunk = reporter.startNextStep("进入下一步");

      expect(chunk.data.step).toBe("处理内容");
      expect(chunk.data.stepIndex).toBe(1);
      expect(reporter.getCompletedStepsCount()).toBe(1);
    });

    it("should track overall progress based on weights", () => {
      // 总权重 = 4, step1 权重 = 1/4 = 25%
      reporter.startNextStep();
      reporter.completeCurrentStep();

      expect(reporter.getOverallPercent()).toBe(25);

      // step2 权重 = 2/4 = 50%, 完成后总进度 75%
      reporter.startNextStep();
      reporter.completeCurrentStep();

      expect(reporter.getOverallPercent()).toBe(75);

      // step3 权重 = 1/4 = 25%, 完成后总进度 100%
      reporter.startNextStep();
      reporter.completeCurrentStep();

      expect(reporter.getOverallPercent()).toBe(100);
    });

    it("should track partial step progress", () => {
      reporter.startNextStep();
      reporter.updateProgress(50);

      // step1 权重 25%, 50% 进度 = 12.5% 总进度
      const percent = reporter.getOverallPercent();
      expect(percent).toBeGreaterThan(0);
      expect(percent).toBeLessThan(25);
    });
  });

  describe("progress updates", () => {
    let reporter: ProgressReporter;

    beforeEach(() => {
      reporter = createProgressReporter([
        { id: "step1", name: "步骤1", weight: 1 },
        { id: "step2", name: "步骤2", weight: 1 },
      ]);
    });

    it("should throttle frequent updates", () => {
      reporter.startNextStep();

      // 第一次更新应该成功
      const chunk1 = reporter.updateProgress(10);
      expect(chunk1).not.toBeNull();

      // 立即再次更新应该被节流
      const chunk2 = reporter.updateProgress(20);
      expect(chunk2).toBeNull();
    });

    it("should clamp progress values to 0-100", () => {
      reporter.startNextStep();

      // 更新应该成功但值被限制
      reporter.updateProgress(-10);
      reporter.updateProgress(150);

      // 百分比应该在合理范围内
      const percent = reporter.getOverallPercent();
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
    });
  });

  describe("step failure", () => {
    it("should mark step as failed", () => {
      const reporter = createProgressReporter([
        { id: "step1", name: "步骤1", weight: 1 },
      ]);

      reporter.startNextStep();
      const chunk = reporter.failCurrentStep("处理失败");

      expect(chunk.type).toBe("progress");
      expect(chunk.data.message).toBe("处理失败");
      expect(reporter.hasFailed()).toBe(true);
    });
  });

  describe("state queries", () => {
    it("should return current state", () => {
      const reporter = createProgressReporter([
        { id: "step1", name: "步骤1", weight: 1 },
        { id: "step2", name: "步骤2", weight: 1 },
      ]);

      reporter.startNextStep();

      const state = reporter.getState();

      expect(state.currentStepIndex).toBe(0);
      expect(state.currentStep).toBe("步骤1");
      expect(state.percent).toBe(0);
      expect(state.steps.length).toBe(2);
      expect(state.startTime).toBeDefined();
    });

    it("should track duration", () => {
      const reporter = createProgressReporter([
        { id: "step1", name: "步骤1", weight: 1 },
      ]);

      const duration = reporter.getDuration();

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it("should detect completion", () => {
      const reporter = createProgressReporter([
        { id: "step1", name: "步骤1", weight: 1 },
      ]);

      expect(reporter.isCompleted()).toBe(false);

      reporter.startNextStep();
      reporter.completeCurrentStep();

      expect(reporter.isCompleted()).toBe(true);
    });
  });

  describe("reset", () => {
    it("should reset all progress", () => {
      const reporter = createProgressReporter([
        { id: "step1", name: "步骤1", weight: 1 },
        { id: "step2", name: "步骤2", weight: 1 },
      ]);

      reporter.startNextStep();
      reporter.completeCurrentStep();
      reporter.startNextStep();

      expect(reporter.getCompletedStepsCount()).toBe(1);

      reporter.reset();

      expect(reporter.getCompletedStepsCount()).toBe(0);
      expect(reporter.getOverallPercent()).toBe(0);
      expect(reporter.isCompleted()).toBe(false);
    });
  });

  describe("createSimpleProgressReporter", () => {
    it("should create reporter from step names", () => {
      const reporter = createSimpleProgressReporter([
        "分析数据",
        "处理内容",
        "生成报告",
      ]);

      expect(reporter.getTotalStepsCount()).toBe(3);

      reporter.startNextStep();
      expect(reporter.getCurrentStepName()).toBe("分析数据");
    });
  });
});
