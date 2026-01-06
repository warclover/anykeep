/**
 * AI Skills 事件发射器
 *
 * 封装 Skill 执行过程中的事件发布逻辑，与 EventBus 集成
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import { eventBus } from "@/lib/shared/event-bus";
import {
  AISkillsEvents,
  type SkillExecutionStartedEvent,
  type SkillExecutionCompletedEvent,
  type SkillStepStartedEvent,
  type SkillStepCompletedEvent,
  type SkillDeliverableCreatedEvent,
  type SkillConfirmationRequestedEvent,
  type SkillConfirmationRespondedEvent,
  type SkillCancelledEvent,
} from "@/lib/shared/event-bus/event-types";

// ============================================
// 类型定义
// ============================================

/** 事件发射器配置 */
export interface SkillEventEmitterConfig {
  /** 是否启用事件发射 */
  enabled?: boolean;
  /** 是否启用调试日志 */
  debug?: boolean;
}

/** 步骤跟踪状态 */
interface StepTrackingState {
  stepId: string;
  stepName: string;
  stepIndex: number;
  startTime: number;
}

// ============================================
// 事件发射器类
// ============================================

/**
 * Skill 事件发射器
 *
 * 用于在 Skill 执行过程中发布标准化事件
 *
 * @example
 * ```typescript
 * const emitter = new SkillEventEmitter('knowledge_review', 'Knowledge Review');
 *
 * emitter.emitExecutionStarted({
 *   userId: 'user-123',
 *   mode: 'orchestration',
 *   estimatedSteps: 5,
 * });
 *
 * emitter.emitStepStarted({
 *   userId: 'user-123',
 *   stepIndex: 0,
 *   stepId: 'analyze',
 *   stepName: '分析数据',
 *   totalSteps: 5,
 * });
 * ```
 */
export class SkillEventEmitter {
  private config: Required<SkillEventEmitterConfig>;
  private executionStartTime: number | null = null;
  private currentStep: StepTrackingState | null = null;

  constructor(
    private readonly skillId: string,
    private readonly skillName: string,
    config: SkillEventEmitterConfig = {},
  ) {
    this.config = {
      enabled: config.enabled ?? true,
      debug: config.debug ?? false,
    };
  }

  // ============================================
  // 执行生命周期事件
  // ============================================

  /**
   * 发射执行开始事件
   */
  emitExecutionStarted(params: {
    userId: string;
    mode: "atomic" | "orchestration";
    requestId?: string;
    estimatedSteps?: number;
  }): void {
    if (!this.config.enabled) return;

    this.executionStartTime = Date.now();

    const event: SkillExecutionStartedEvent = {
      userId: params.userId,
      skillId: this.skillId,
      skillName: this.skillName,
      mode: params.mode,
      requestId: params.requestId,
      estimatedSteps: params.estimatedSteps,
      timestamp: new Date().toISOString(),
    };

    eventBus.emit(AISkillsEvents.EXECUTION_STARTED, event);
  }

  /**
   * 发射执行完成事件
   */
  emitExecutionCompleted(params: {
    userId: string;
    mode: "atomic" | "orchestration";
    success: boolean;
    completedSteps?: number;
    hasDeliverable: boolean;
    errorMessage?: string;
    errorCode?: string;
  }): void {
    if (!this.config.enabled) return;

    const durationMs = this.executionStartTime
      ? Date.now() - this.executionStartTime
      : 0;

    const event: SkillExecutionCompletedEvent = {
      userId: params.userId,
      skillId: this.skillId,
      skillName: this.skillName,
      mode: params.mode,
      success: params.success,
      durationMs,
      completedSteps: params.completedSteps,
      hasDeliverable: params.hasDeliverable,
      errorMessage: params.errorMessage,
      errorCode: params.errorCode,
      timestamp: new Date().toISOString(),
    };

    eventBus.emit(AISkillsEvents.EXECUTION_COMPLETED, event);

    // 重置状态
    this.executionStartTime = null;
    this.currentStep = null;
  }

  // ============================================
  // 步骤生命周期事件
  // ============================================

  /**
   * 发射步骤开始事件
   */
  emitStepStarted(params: {
    userId: string;
    stepIndex: number;
    stepId: string;
    stepName: string;
    totalSteps: number;
  }): void {
    if (!this.config.enabled) return;

    // 跟踪当前步骤
    this.currentStep = {
      stepId: params.stepId,
      stepName: params.stepName,
      stepIndex: params.stepIndex,
      startTime: Date.now(),
    };

    const event: SkillStepStartedEvent = {
      userId: params.userId,
      skillId: this.skillId,
      stepIndex: params.stepIndex,
      stepId: params.stepId,
      stepName: params.stepName,
      totalSteps: params.totalSteps,
      timestamp: new Date().toISOString(),
    };

    eventBus.emit(AISkillsEvents.STEP_STARTED, event);
  }

  /**
   * 发射步骤完成事件
   */
  emitStepCompleted(params: {
    userId: string;
    stepIndex: number;
    stepId: string;
    stepName: string;
    success: boolean;
    progressPercent: number;
  }): void {
    if (!this.config.enabled) return;

    const durationMs = this.currentStep?.startTime
      ? Date.now() - this.currentStep.startTime
      : 0;

    const event: SkillStepCompletedEvent = {
      userId: params.userId,
      skillId: this.skillId,
      stepIndex: params.stepIndex,
      stepId: params.stepId,
      stepName: params.stepName,
      success: params.success,
      durationMs,
      progressPercent: params.progressPercent,
      timestamp: new Date().toISOString(),
    };

    eventBus.emit(AISkillsEvents.STEP_COMPLETED, event);

    // 清除当前步骤跟踪
    this.currentStep = null;
  }

  // ============================================
  // 交付物事件
  // ============================================

  /**
   * 发射交付物创建事件
   */
  emitDeliverableCreated(params: {
    userId: string;
    deliverableId: string;
    deliverableType: string;
    format: string;
    downloadable: boolean;
    shareable: boolean;
  }): void {
    if (!this.config.enabled) return;

    const event: SkillDeliverableCreatedEvent = {
      userId: params.userId,
      skillId: this.skillId,
      deliverableId: params.deliverableId,
      deliverableType: params.deliverableType,
      format: params.format,
      downloadable: params.downloadable,
      shareable: params.shareable,
      timestamp: new Date().toISOString(),
    };

    eventBus.emit(AISkillsEvents.DELIVERABLE_CREATED, event);
  }

  // ============================================
  // 确认事件
  // ============================================

  /**
   * 发射确认请求事件
   */
  emitConfirmationRequested(params: {
    userId: string;
    confirmationId: string;
    confirmationType: "proceed" | "select" | "custom";
    optionCount: number;
  }): void {
    if (!this.config.enabled) return;

    const event: SkillConfirmationRequestedEvent = {
      userId: params.userId,
      skillId: this.skillId,
      confirmationId: params.confirmationId,
      confirmationType: params.confirmationType,
      optionCount: params.optionCount,
      timestamp: new Date().toISOString(),
    };

    eventBus.emit(AISkillsEvents.CONFIRMATION_REQUESTED, event);
  }

  /**
   * 发射确认响应事件
   */
  emitConfirmationResponded(params: {
    userId: string;
    confirmationId: string;
    selectedOption: string;
    confirmed: boolean;
    responseTimeMs: number;
  }): void {
    if (!this.config.enabled) return;

    const event: SkillConfirmationRespondedEvent = {
      userId: params.userId,
      skillId: this.skillId,
      confirmationId: params.confirmationId,
      selectedOption: params.selectedOption,
      confirmed: params.confirmed,
      responseTimeMs: params.responseTimeMs,
      timestamp: new Date().toISOString(),
    };

    eventBus.emit(AISkillsEvents.CONFIRMATION_RESPONDED, event);
  }

  // ============================================
  // 取消事件
  // ============================================

  /**
   * 发射取消事件
   */
  emitCancelled(params: {
    userId: string;
    reason: "user_requested" | "timeout" | "error" | "system";
    completedSteps: number;
    totalSteps: number;
  }): void {
    if (!this.config.enabled) return;

    const elapsedMs = this.executionStartTime
      ? Date.now() - this.executionStartTime
      : 0;

    const event: SkillCancelledEvent = {
      userId: params.userId,
      skillId: this.skillId,
      reason: params.reason,
      completedSteps: params.completedSteps,
      totalSteps: params.totalSteps,
      elapsedMs,
      timestamp: new Date().toISOString(),
    };

    eventBus.emit(AISkillsEvents.CANCELLED, event);

    // 重置状态
    this.executionStartTime = null;
    this.currentStep = null;
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 获取当前执行时长
   */
  getElapsedMs(): number {
    return this.executionStartTime ? Date.now() - this.executionStartTime : 0;
  }

  /**
   * 获取当前步骤信息
   */
  getCurrentStep(): StepTrackingState | null {
    return this.currentStep;
  }

  /**
   * 禁用事件发射
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * 启用事件发射
   */
  enable(): void {
    this.config.enabled = true;
  }
}

// ============================================
// 便捷函数
// ============================================

/**
 * 创建 Skill 事件发射器
 */
export function createSkillEventEmitter(
  skillId: string,
  skillName: string,
  config?: SkillEventEmitterConfig,
): SkillEventEmitter {
  return new SkillEventEmitter(skillId, skillName, config);
}
