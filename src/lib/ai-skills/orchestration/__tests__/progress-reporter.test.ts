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

  // ============================================
  // Phase 3.1: 心跳功能测试
  // ============================================

  describe("heartbeat", () => {
    let reporter: ProgressReporter;

    beforeEach(() => {
      reporter = createProgressReporter([
        { id: "step1", name: "步骤1", weight: 1 },
        { id: "step2", name: "步骤2", weight: 1 },
      ]);
      jest.useFakeTimers();
    });

    afterEach(() => {
      reporter.stopHeartbeat();
      jest.useRealTimers();
    });

    it("应启动心跳并定期调用回调", () => {
      const callback = jest.fn();
      reporter.startNextStep();

      reporter.startHeartbeat(callback);

      // 初始状态
      expect(reporter.isHeartbeatRunning()).toBe(true);
      expect(callback).not.toHaveBeenCalled();

      // 前进 500ms（默认间隔）
      jest.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(1);

      // 再前进 500ms
      jest.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("心跳应包含当前进度信息", () => {
      const callback = jest.fn();
      reporter.startNextStep();
      reporter.updateProgress(45);

      reporter.startHeartbeat(callback);
      jest.advanceTimersByTime(500);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "heartbeat",
          data: expect.objectContaining({
            currentStep: "步骤1",
            percent: expect.any(Number),
            timestamp: expect.any(Number),
            elapsedMs: expect.any(Number),
          }),
        }),
      );
    });

    it("应停止心跳", () => {
      const callback = jest.fn();
      reporter.startHeartbeat(callback);
      expect(reporter.isHeartbeatRunning()).toBe(true);

      reporter.stopHeartbeat();
      expect(reporter.isHeartbeatRunning()).toBe(false);

      // 前进时间，回调不应被调用
      jest.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it("重置时应停止心跳", () => {
      const callback = jest.fn();
      reporter.startHeartbeat(callback);
      expect(reporter.isHeartbeatRunning()).toBe(true);

      reporter.reset();
      expect(reporter.isHeartbeatRunning()).toBe(false);
    });

    it("多次 stopHeartbeat 应安全", () => {
      reporter.stopHeartbeat();
      reporter.stopHeartbeat();
      expect(reporter.isHeartbeatRunning()).toBe(false);
    });
  });

  // ============================================
  // Phase 3.2: ETA 估算测试
  // ============================================

  describe("ETA 估算", () => {
    let reporter: ProgressReporter;

    beforeEach(() => {
      reporter = createProgressReporter([
        { id: "step1", name: "步骤1", weight: 1 },
        { id: "step2", name: "步骤2", weight: 1 },
        { id: "step3", name: "步骤3", weight: 1 },
        { id: "step4", name: "步骤4", weight: 1 },
      ]);
    });

    it("进度低于 5% 时应返回 undefined", () => {
      reporter.startNextStep();
      // 0% 进度，ETA 应为 undefined
      const eta = reporter.getEta();
      expect(eta.etaMs).toBeUndefined();
      expect(eta.etaFormatted).toBeUndefined();
    });

    it("进度 >= 5% 时应返回 ETA 估算", () => {
      jest.useFakeTimers();

      // 设置进度约为 25%（完成第一个步骤）
      reporter.startNextStep();
      // 等待 1 秒
      jest.advanceTimersByTime(1000);
      reporter.completeCurrentStep();

      // 25% 进度，已用 1 秒，预计剩余 3 秒
      const eta = reporter.getEta();
      expect(eta.etaMs).toBeDefined();
      expect(eta.etaMs).toBeGreaterThan(0);
      expect(eta.etaFormatted).toBeDefined();

      jest.useRealTimers();
    });

    it("formatEta 应正确格式化不同时间范围", () => {
      // 测试 formatEta 方法
      // 注意：formatEta 是私有方法，通过 getEta 间接测试

      // 测试即将完成（< 5秒）
      expect(reporter.formatEta(3000)).toBe("即将完成");

      // 测试秒级（5-60秒，四舍五入到5秒）
      expect(reporter.formatEta(7000)).toBe("约 10 秒"); // 7秒 -> ceil(7/5)*5 = 10
      expect(reporter.formatEta(23000)).toBe("约 25 秒"); // 23秒 -> ceil(23/5)*5 = 25
      expect(reporter.formatEta(55000)).toBe("约 55 秒"); // 55秒 -> ceil(55/5)*5 = 55

      // 测试分钟级（1-60分钟）
      expect(reporter.formatEta(90000)).toBe("约 2 分钟");
      expect(reporter.formatEta(5 * 60 * 1000)).toBe("约 5 分钟");

      // 测试小时级
      expect(reporter.formatEta(65 * 60 * 1000)).toBe("约 1 小时 5 分钟"); // 65分钟 = 1小时5分
      expect(reporter.formatEta(2 * 60 * 60 * 1000)).toBe("约 2 小时");
    });

    it("formatEta 处理边界值", () => {
      expect(reporter.formatEta(undefined)).toBeUndefined();
      expect(reporter.formatEta(-1)).toBeUndefined();
    });

    it("calculateEtaMs 应限制最大值为 30 分钟", () => {
      jest.useFakeTimers();

      reporter.startNextStep();
      // 仅 6.25% 进度（步骤内 25%），已用 10 分钟
      reporter.updateProgress(25);
      jest.advanceTimersByTime(10 * 60 * 1000);

      const eta = reporter.getEta();
      // 即使线性估算超过 30 分钟，也应该被限制
      if (eta.etaMs !== undefined) {
        expect(eta.etaMs).toBeLessThanOrEqual(30 * 60 * 1000);
      }

      jest.useRealTimers();
    });

    it("进度块应包含 ETA 信息", () => {
      jest.useFakeTimers();

      reporter.startNextStep();
      jest.advanceTimersByTime(2000);
      reporter.completeCurrentStep();

      const chunk = reporter.startNextStep("开始步骤2");

      // 进度已达 25%，应该有 ETA
      expect(chunk.data.etaMs).toBeDefined();
      expect(chunk.data.etaFormatted).toBeDefined();

      jest.useRealTimers();
    });

    it("心跳应包含 ETA 信息", () => {
      jest.useFakeTimers();

      const callback = jest.fn();
      reporter.startNextStep();
      jest.advanceTimersByTime(1000);
      reporter.completeCurrentStep();
      reporter.startNextStep();

      reporter.startHeartbeat(callback);
      jest.advanceTimersByTime(500);

      expect(callback).toHaveBeenCalled();
      const chunk = callback.mock.calls[0][0];
      // 25% 进度，应该有 ETA
      expect(chunk.data.etaMs).toBeDefined();
      expect(chunk.data.etaFormatted).toBeDefined();

      reporter.stopHeartbeat();
      jest.useRealTimers();
    });
  });
});
