/**
 * ProgressReporter - 进度报告器
 *
 * 职责：
 * - 管理多步骤任务的进度状态
 * - 计算基于权重的进度百分比
 * - 生成进度消息
 * - 支持嵌套步骤
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type { StepDefinition, ProgressState } from "./types";
import type { ProgressChunk, HeartbeatChunk } from "../output/types";

/** Default heartbeat interval in milliseconds */
const DEFAULT_HEARTBEAT_INTERVAL = 500;

/**
 * 进度报告器配置
 */
interface ProgressReporterConfig {
  /** 是否自动计算百分比 */
  autoCalculatePercent?: boolean;
  /** 进度更新最小间隔（毫秒） */
  minUpdateInterval?: number;
  /** 是否启用平滑过渡 */
  smoothTransition?: boolean;
  /** 心跳间隔（毫秒），默认 500ms */
  heartbeatInterval?: number;
}

/**
 * 步骤状态
 */
interface StepState {
  /** 步骤定义 */
  definition: StepDefinition;
  /** 步骤状态 */
  status: "pending" | "running" | "completed" | "failed";
  /** 步骤进度（0-100） */
  progress: number;
  /** 开始时间 */
  startTime?: number;
  /** 结束时间 */
  endTime?: number;
}

/**
 * 进度报告器
 */
export class ProgressReporter {
  private steps: StepState[] = [];
  private currentStepIndex = -1;
  private startTime: number;
  private lastUpdateTime = 0;
  private config: Required<ProgressReporterConfig>;
  // Phase 1: 心跳定时器
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatStartTime: number = 0;

  constructor(steps: StepDefinition[], config: ProgressReporterConfig = {}) {
    this.config = {
      autoCalculatePercent: true,
      minUpdateInterval: 100,
      smoothTransition: true,
      heartbeatInterval: DEFAULT_HEARTBEAT_INTERVAL,
      ...config,
    };

    this.startTime = Date.now();

    // 初始化步骤状态，确保权重总和为 1
    const totalWeight = steps.reduce((sum, s) => sum + (s.weight || 1), 0);
    this.steps = steps.map((def) => ({
      definition: {
        ...def,
        weight: (def.weight || 1) / totalWeight,
      },
      status: "pending",
      progress: 0,
    }));
  }

  /**
   * 开始下一步
   *
   * @param message - 步骤消息
   * @returns 进度块
   */
  startNextStep(message?: string): ProgressChunk {
    // 完成当前步骤
    if (
      this.currentStepIndex >= 0 &&
      this.currentStepIndex < this.steps.length
    ) {
      this.steps[this.currentStepIndex].status = "completed";
      this.steps[this.currentStepIndex].progress = 100;
      this.steps[this.currentStepIndex].endTime = Date.now();
    }

    // 进入下一步
    this.currentStepIndex++;

    if (this.currentStepIndex < this.steps.length) {
      const step = this.steps[this.currentStepIndex];
      step.status = "running";
      step.progress = 0;
      step.startTime = Date.now();
    }

    return this.createProgressChunk(message);
  }

  /**
   * 更新当前步骤进度
   *
   * @param progress - 步骤内进度（0-100）
   * @param message - 进度消息
   * @returns 进度块（如果距离上次更新时间足够长）
   */
  updateProgress(progress: number, message?: string): ProgressChunk | null {
    const now = Date.now();

    // 检查更新间隔
    if (now - this.lastUpdateTime < this.config.minUpdateInterval) {
      return null;
    }

    if (
      this.currentStepIndex >= 0 &&
      this.currentStepIndex < this.steps.length
    ) {
      this.steps[this.currentStepIndex].progress = Math.max(
        0,
        Math.min(100, progress),
      );
    }

    this.lastUpdateTime = now;
    return this.createProgressChunk(message);
  }

  /**
   * 完成当前步骤
   *
   * @param message - 完成消息
   * @returns 进度块
   */
  completeCurrentStep(message?: string): ProgressChunk {
    if (
      this.currentStepIndex >= 0 &&
      this.currentStepIndex < this.steps.length
    ) {
      this.steps[this.currentStepIndex].status = "completed";
      this.steps[this.currentStepIndex].progress = 100;
      this.steps[this.currentStepIndex].endTime = Date.now();
    }

    return this.createProgressChunk(message);
  }

  /**
   * 标记当前步骤失败
   *
   * @param message - 失败消息
   * @returns 进度块
   */
  failCurrentStep(message?: string): ProgressChunk {
    if (
      this.currentStepIndex >= 0 &&
      this.currentStepIndex < this.steps.length
    ) {
      this.steps[this.currentStepIndex].status = "failed";
      this.steps[this.currentStepIndex].endTime = Date.now();
    }

    return this.createProgressChunk(message || "步骤执行失败");
  }

  /**
   * 获取当前步骤名称
   */
  getCurrentStepName(): string {
    if (
      this.currentStepIndex >= 0 &&
      this.currentStepIndex < this.steps.length
    ) {
      return this.steps[this.currentStepIndex].definition.name;
    }
    return "未知步骤";
  }

  /**
   * 获取总体进度百分比
   */
  getOverallPercent(): number {
    if (!this.config.autoCalculatePercent) {
      return 0;
    }

    let percent = 0;

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const weight = step.definition.weight || 1 / this.steps.length;

      if (step.status === "completed") {
        percent += weight * 100;
      } else if (step.status === "running") {
        percent += weight * step.progress;
      }
    }

    return Math.round(percent);
  }

  /**
   * 获取完成的步骤数
   */
  getCompletedStepsCount(): number {
    return this.steps.filter((s) => s.status === "completed").length;
  }

  /**
   * 获取总步骤数
   */
  getTotalStepsCount(): number {
    return this.steps.length;
  }

  /**
   * 获取当前进度状态
   */
  getState(): ProgressState {
    return {
      currentStepIndex: Math.max(0, this.currentStepIndex),
      currentStep: this.getCurrentStepName(),
      percent: this.getOverallPercent(),
      steps: this.steps.map((s) => s.definition),
      startTime: this.startTime,
    };
  }

  /**
   * 获取执行时间（毫秒）
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 是否所有步骤都已完成
   */
  isCompleted(): boolean {
    return this.steps.every(
      (s) => s.status === "completed" || s.status === "failed",
    );
  }

  /**
   * 是否有步骤失败
   */
  hasFailed(): boolean {
    return this.steps.some((s) => s.status === "failed");
  }

  /**
   * 创建进度块
   */
  private createProgressChunk(message?: string): ProgressChunk {
    const currentStep =
      this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length
        ? this.steps[this.currentStepIndex]
        : null;

    return {
      type: "progress",
      data: {
        step: currentStep?.definition.name || "完成",
        percent: this.getOverallPercent(),
        message:
          message ||
          currentStep?.definition.description ||
          currentStep?.definition.name ||
          "",
        timestamp: Date.now(),
        stepIndex: Math.max(0, this.currentStepIndex),
        totalSteps: this.steps.length,
      },
    };
  }

  /**
   * 重置进度
   */
  reset(): void {
    this.stopHeartbeat(); // 停止心跳
    this.currentStepIndex = -1;
    this.startTime = Date.now();
    this.lastUpdateTime = 0;

    for (const step of this.steps) {
      step.status = "pending";
      step.progress = 0;
      step.startTime = undefined;
      step.endTime = undefined;
    }
  }

  // ============================================
  // Phase 1: 心跳功能
  // ============================================

  /**
   * 启动心跳
   *
   * 每隔配置的时间间隔（默认 500ms）调用回调函数
   * 用于长时间任务时保持前端连接活跃
   *
   * @param callback - 心跳回调函数
   */
  startHeartbeat(callback: (chunk: HeartbeatChunk) => void): void {
    this.stopHeartbeat(); // 确保没有重复的心跳
    this.heartbeatStartTime = Date.now();

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const chunk: HeartbeatChunk = {
        type: "heartbeat",
        data: {
          currentStep: this.getCurrentStepName(),
          percent: this.getOverallPercent(),
          timestamp: now,
          elapsedMs: now - this.heartbeatStartTime,
        },
      };
      callback(chunk);
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 心跳是否正在运行
   */
  isHeartbeatRunning(): boolean {
    return this.heartbeatInterval !== null;
  }
}

/**
 * 创建进度报告器
 */
export function createProgressReporter(
  steps: StepDefinition[],
  config?: ProgressReporterConfig,
): ProgressReporter {
  return new ProgressReporter(steps, config);
}

/**
 * 从步骤名称列表快速创建进度报告器
 */
export function createSimpleProgressReporter(
  stepNames: string[],
): ProgressReporter {
  const steps: StepDefinition[] = stepNames.map((name, index) => ({
    id: `step-${index + 1}`,
    name,
    weight: 1,
  }));

  return new ProgressReporter(steps);
}
