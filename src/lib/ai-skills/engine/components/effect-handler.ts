import { logger } from "@/lib/logger";
import {
  type EffectManager,
  createEffectManager,
  type EffectHandler,
  type UnifiedEffect,
  type EffectType,
  type ConfirmationEffect,
  type NotificationEffect,
  type AuditEffect,
  type ConfirmationServiceResult,
  confirmationService,
  notificationService,
  auditLogService,
} from "../../effects";
import type { EngineConfigManager } from "./config-manager";

/**
 * 引擎副作用处理器
 *
 * 职责：
 * - 封装 EffectManager 实例
 * - 管理默认的系统 Effect 监听器（确认、通知、审计）
 * - 处理监听器的生命周期
 * - 暴露 Effect 发送和确认请求方法
 */
export class EngineEffectHandler {
  private effectManager: EffectManager;
  private effectListenerIds: string[] = [];
  private configManager: EngineConfigManager;

  constructor(configManager: EngineConfigManager) {
    this.configManager = configManager;
    this.effectManager = createEffectManager({
      debug: configManager.debug,
    });
  }

  /**
   * 初始化系统默认监听器
   */
  initSystemListeners(): void {
    // 监���确认效果并记录日志
    const confirmationListenerId = this.effectManager.on<ConfirmationEffect>(
      "confirmation",
      async (effect) => {
        logger.debug(
          { confirmationId: effect.payload.id },
          "UnifiedEngine: Processing confirmation effect",
        );
      },
    );
    this.effectListenerIds.push(confirmationListenerId);

    // 监听通知效果并转发到 NotificationService
    const notificationListenerId = this.effectManager.on<NotificationEffect>(
      "notification",
      async (effect) => {
        await notificationService.notify({
          level: effect.payload.level,
          title: effect.payload.title,
          message: effect.payload.message,
          autoCloseMs: effect.payload.autoCloseMs,
          userId: effect.context.userId,
        });
      },
    );
    this.effectListenerIds.push(notificationListenerId);

    // 监听审计效果并转发到 AuditLogService
    const auditListenerId = this.effectManager.on<AuditEffect>(
      "audit",
      async (effect) => {
        await auditLogService.log({
          action: effect.payload.action,
          resourceType: effect.payload.resourceType,
          resourceIds: effect.payload.resourceIds,
          changes: effect.payload.changes,
          userId: effect.context.userId,
          source: effect.context.source,
        });
      },
    );
    this.effectListenerIds.push(auditListenerId);
  }

  /**
   * 更新配置
   */
  updateConfig(): void {
    this.effectManager.updateConfig({ debug: this.configManager.debug });
  }

  /**
   * 获取底层管理器（仅供兼容性使用）
   */
  getManager(): EffectManager {
    return this.effectManager;
  }

  /**
   * 注册 Effect 监听器
   */
  on<T extends UnifiedEffect = UnifiedEffect>(
    type: EffectType | "*",
    handler: EffectHandler<T>,
  ): string {
    const listenerId = this.effectManager.on(type, handler);
    this.effectListenerIds.push(listenerId);
    return listenerId;
  }

  /**
   * 取消 Effect 监听
   */
  off(listenerId: string): boolean {
    const index = this.effectListenerIds.indexOf(listenerId);
    if (index !== -1) {
      this.effectListenerIds.splice(index, 1);
    }
    return this.effectManager.off(listenerId);
  }

  /**
   * 发送 Effect
   */
  async emit(effect: UnifiedEffect): Promise<void> {
    await this.effectManager.emit(effect);
  }

  /**
   * 请求用户确认
   */
  async requestConfirmation(options: {
    title: string;
    message: string;
    options: Array<{ id: string; label: string; variant?: string }>;
    userId: string;
    source: "tool" | "skill";
    toolName?: string;
    skillId?: string;
    timeoutMs?: number;
  }): Promise<ConfirmationServiceResult> {
    const pending = confirmationService.createConfirmation({
      title: options.title,
      message: options.message,
      options: options.options,
      userId: options.userId,
      source: options.source,
      toolName: options.toolName,
      skillId: options.skillId,
      timeoutMs: options.timeoutMs,
    });

    return confirmationService.waitForConfirmation(
      pending.id,
      options.timeoutMs,
    );
  }

  /**
   * 响应确认请求
   */
  respondToConfirmation(
    confirmationId: string,
    selectedOption: string,
    data?: unknown,
  ): boolean {
    return confirmationService.respondToConfirmation(
      confirmationId,
      selectedOption,
      data,
    );
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.effectManager.getStats();
  }

  /**
   * 销毁资源
   */
  dispose(): void {
    for (const listenerId of this.effectListenerIds) {
      this.effectManager.off(listenerId);
    }
    this.effectListenerIds = [];
  }
}
