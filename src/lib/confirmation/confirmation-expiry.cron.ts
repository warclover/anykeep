/**
 * Confirmation Expiry Cron
 * V4.2 确认消息过期处理定时任务
 *
 * @description 处理过期的待确认消息
 * - 分类确认过期后按建议自动执行
 * - 文件夹操作过期后标记为过期
 * - 发送过期通知给用户
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { confirmationService, type ExpirationResult } from "./confirmation.service";
import { MessageService } from "@/lib/messages/message-service";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Cron 执行结果
 */
export interface CronExecutionResult {
  success: boolean;
  executedAt: Date;
  duration: number;
  result: ExpirationResult;
  notificationsSent: number;
  error?: string;
}

/**
 * Cron 配置
 */
export interface CronConfig {
  /** 是否启用通知 */
  enableNotifications: boolean;
  /** 批量处理大小 */
  batchSize: number;
  /** 是否启用干运行模式（不实际执行） */
  dryRun: boolean;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: CronConfig = {
  enableNotifications: true,
  batchSize: 100,
  dryRun: false,
};

// ============================================================================
// Cron 实现
// ============================================================================

/**
 * 确认消息过期处理 Cron 类
 */
class ConfirmationExpiryCron {
  private config: CronConfig;
  private isRunning: boolean = false;
  private lastResult: CronExecutionResult | null = null;

  constructor(config: Partial<CronConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行过期处理
   */
  async execute(): Promise<CronExecutionResult> {
    if (this.isRunning) {
      logger.warn("Confirmation expiry cron is already running");
      return {
        success: false,
        executedAt: new Date(),
        duration: 0,
        result: {
          processed: 0,
          autoExecuted: 0,
          movedToInbox: 0,
          errors: ["Cron is already running"],
        },
        notificationsSent: 0,
        error: "Cron is already running",
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let notificationsSent = 0;

    try {
      logger.info("Starting confirmation expiry cron");

      // 处理过期确认消息
      const result = await confirmationService.processExpired();

      // 发送通知（如果启用）
      if (this.config.enableNotifications && result.processed > 0) {
        notificationsSent = await this.sendExpirationNotifications(result);
      }

      const executionResult: CronExecutionResult = {
        success: result.errors.length === 0,
        executedAt: new Date(),
        duration: Date.now() - startTime,
        result,
        notificationsSent,
      };

      this.lastResult = executionResult;

      logger.info(
        {
          processed: result.processed,
          autoExecuted: result.autoExecuted,
          movedToInbox: result.movedToInbox,
          errors: result.errors.length,
          duration: executionResult.duration,
        },
        "Confirmation expiry cron completed",
      );

      return executionResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "Confirmation expiry cron failed");

      const executionResult: CronExecutionResult = {
        success: false,
        executedAt: new Date(),
        duration: Date.now() - startTime,
        result: {
          processed: 0,
          autoExecuted: 0,
          movedToInbox: 0,
          errors: [message],
        },
        notificationsSent: 0,
        error: message,
      };

      this.lastResult = executionResult;
      return executionResult;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 发送过期通知
   */
  private async sendExpirationNotifications(
    result: ExpirationResult,
  ): Promise<number> {
    // TODO: 实现按用户分组发送通知
    // 目前 processExpired 没有返回用户信息，需要扩展

    // 占位实现：记录日志
    if (result.autoExecuted > 0) {
      logger.info(
        { count: result.autoExecuted },
        "Auto-executed expired confirmations",
      );
    }

    if (result.movedToInbox > 0) {
      logger.info(
        { count: result.movedToInbox },
        "Moved expired confirmations to inbox",
      );
    }

    return 0;
  }

  /**
   * 获取上次执行结果
   */
  getLastResult(): CronExecutionResult | null {
    return this.lastResult;
  }

  /**
   * 检查是否正在运行
   */
  isCurrentlyRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CronConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): CronConfig {
    return { ...this.config };
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const confirmationExpiryCron = new ConfirmationExpiryCron();

// ============================================================================
// API Route Handler
// ============================================================================

/**
 * Cron API 处理函数
 * @description 用于 Vercel Cron 或手动触发
 */
export async function handleCronRequest(
  options?: Partial<CronConfig>,
): Promise<CronExecutionResult> {
  if (options) {
    confirmationExpiryCron.updateConfig(options);
  }

  return confirmationExpiryCron.execute();
}

// ============================================================================
// 健康检查
// ============================================================================

/**
 * 获取 Cron 健康状态
 */
export function getCronHealthStatus(): {
  isRunning: boolean;
  lastResult: CronExecutionResult | null;
  config: CronConfig;
} {
  return {
    isRunning: confirmationExpiryCron.isCurrentlyRunning(),
    lastResult: confirmationExpiryCron.getLastResult(),
    config: confirmationExpiryCron.getConfig(),
  };
}
