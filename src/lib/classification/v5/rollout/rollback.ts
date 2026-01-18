/**
 * 智能分类 v5.0 - 回滚程序
 *
 * 功能：
 * 1. 自动回滚触发（基于监控指标）
 * 2. 手动回滚执行
 * 3. 回滚状态追踪
 * 4. 回滚后验证
 */

import { LoggerService } from '../shared/logger';
import { MonitoringService, type MonitoringReport } from './monitoring';
import { FeatureFlagService, RolloutStage } from './feature-flag';

/**
 * 回滚原因
 */
export enum RollbackReason {
  HIGH_ERROR_RATE = 'high_error_rate',
  HIGH_LATENCY = 'high_latency',
  HIGH_CORRECTION_RATE = 'high_correction_rate',
  MANUAL = 'manual',
  SYSTEM_FAILURE = 'system_failure',
}

/**
 * 回滚状态
 */
export enum RollbackStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * 回滚记录
 */
export interface RollbackRecord {
  /** 回滚 ID */
  id: string;
  /** 回滚原因 */
  reason: RollbackReason;
  /** 回滚前阶段 */
  fromStage: RolloutStage;
  /** 回滚后阶段 */
  toStage: RolloutStage;
  /** 回滚状态 */
  status: RollbackStatus;
  /** 触发时间 */
  triggeredAt: string;
  /** 完成时间 */
  completedAt?: string;
  /** 触发者（用户 ID 或 'system'） */
  triggeredBy: string;
  /** 相关指标 */
  metrics?: Record<string, number>;
  /** 错误信息 */
  error?: string;
}

/**
 * 自动回滚配置
 */
interface AutoRollbackConfig {
  /** 是否启用自动回滚 */
  enabled: boolean;
  /** 错误率阈值（%） */
  errorRateThreshold: number;
  /** 延迟阈值（毫秒） */
  latencyThreshold: number;
  /** 用户纠正率阈值（%） */
  correctionRateThreshold: number;
  /** 检查间隔（秒） */
  checkIntervalSeconds: number;
}

/**
 * 默认自动回滚配置
 */
const DEFAULT_AUTO_ROLLBACK_CONFIG: AutoRollbackConfig = {
  enabled: true,
  errorRateThreshold: 10, // 10% 错误率触发回滚
  latencyThreshold: 2000, // 2s P95 延迟触发回滚
  correctionRateThreshold: 30, // 30% 纠正率触发回滚
  checkIntervalSeconds: 60, // 每分钟检查一次
};

/**
 * 回滚服务
 */
export class RollbackService {
  private logger: LoggerService;
  private featureFlagService: FeatureFlagService;
  private monitoringService: MonitoringService;
  private config: AutoRollbackConfig;
  private rollbackHistory: RollbackRecord[] = [];
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    logger: LoggerService,
    featureFlagService: FeatureFlagService,
    monitoringService: MonitoringService,
    config?: Partial<AutoRollbackConfig>
  ) {
    this.logger = logger.child({ service: 'RollbackService' });
    this.featureFlagService = featureFlagService;
    this.monitoringService = monitoringService;
    this.config = {
      ...DEFAULT_AUTO_ROLLBACK_CONFIG,
      ...config,
    };
  }

  /**
   * 启动自动回滚监控
   */
  startAutoRollbackMonitoring(): void {
    if (!this.config.enabled) {
      this.logger.info('自动回滚未启用');
      return;
    }

    if (this.checkInterval) {
      this.logger.warn('自动回滚监控已在运行');
      return;
    }

    this.logger.info('启动自动回滚监控', {
      checkIntervalSeconds: this.config.checkIntervalSeconds,
    });

    this.checkInterval = setInterval(
      () => this.checkAndRollback(),
      this.config.checkIntervalSeconds * 1000
    );
  }

  /**
   * 停止自动回滚监控
   */
  stopAutoRollbackMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.info('停止自动回滚监控');
    }
  }

  /**
   * 检查并执行自动回滚
   */
  private async checkAndRollback(): Promise<void> {
    try {
      this.logger.debug('检查是否需要回滚');

      // 1. 生成最近 5 分钟的监控报告
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 5 * 60 * 1000);
      const report = await this.monitoringService.generateReport(
        startTime,
        endTime
      );

      // 2. 检查是否触发回滚条件
      const rollbackReason = this.shouldRollback(report);
      if (!rollbackReason) {
        this.logger.debug('指标正常，无需回滚');
        return;
      }

      // 3. 执行自动回滚
      this.logger.warn('触发自动回滚', { reason: rollbackReason });
      await this.executeRollback(rollbackReason, 'system', report);
    } catch (error) {
      this.logger.error(
        '自动回滚检查失败',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 判断是否应该回滚
   */
  private shouldRollback(report: MonitoringReport): RollbackReason | null {
    const { classification, health } = report;

    // 1. 检查错误率
    if (health.errorRate >= this.config.errorRateThreshold) {
      return RollbackReason.HIGH_ERROR_RATE;
    }

    // 2. 检查延迟
    if (classification.p95LatencyMs >= this.config.latencyThreshold) {
      return RollbackReason.HIGH_LATENCY;
    }

    // 3. 检查用户纠正率
    if (
      classification.userCorrectionRate >= this.config.correctionRateThreshold
    ) {
      return RollbackReason.HIGH_CORRECTION_RATE;
    }

    return null;
  }

  /**
   * 执行回滚
   */
  async executeRollback(
    reason: RollbackReason,
    triggeredBy: string,
    report?: MonitoringReport
  ): Promise<RollbackRecord> {
    const rollbackId = this.generateRollbackId();
    const currentStage = this.featureFlagService.getConfig().stage;

    this.logger.info('开始执行回滚', {
      rollbackId,
      reason,
      currentStage,
      triggeredBy,
    });

    // 1. 创建回滚记录
    const record: RollbackRecord = {
      id: rollbackId,
      reason,
      fromStage: currentStage,
      toStage: this.getPreviousStage(currentStage),
      status: RollbackStatus.IN_PROGRESS,
      triggeredAt: new Date().toISOString(),
      triggeredBy,
      metrics: report
        ? {
            errorRate: report.health.errorRate,
            p95LatencyMs: report.classification.p95LatencyMs,
            correctionRate: report.classification.userCorrectionRate,
          }
        : undefined,
    };

    this.rollbackHistory.push(record);

    try {
      // 2. 执行回滚操作
      await this.performRollback(record.toStage);

      // 3. 验证回滚结果
      await this.validateRollback();

      // 4. 更新记录状态
      record.status = RollbackStatus.COMPLETED;
      record.completedAt = new Date().toISOString();

      this.logger.info('回滚完成', {
        rollbackId,
        fromStage: record.fromStage,
        toStage: record.toStage,
      });

      return record;
    } catch (error) {
      // 回滚失败
      record.status = RollbackStatus.FAILED;
      record.error = error instanceof Error ? error.message : String(error);
      record.completedAt = new Date().toISOString();

      this.logger.error(
        '回滚失败',
        error instanceof Error ? error : undefined,
        {
          rollbackId,
        }
      );

      throw error;
    }
  }

  /**
   * 执行回滚操作
   */
  private async performRollback(targetStage: RolloutStage): Promise<void> {
    this.logger.info('执行回滚操作', { targetStage });

    // 1. 更新 Feature Flag
    this.featureFlagService.setStage(targetStage);

    // 2. 如果回滚到 DISABLED，清空白名单
    if (targetStage === RolloutStage.DISABLED) {
      const config = this.featureFlagService.getConfig();
      config.whitelist.forEach((userId) => {
        this.featureFlagService.removeFromWhitelist(userId);
      });
    }

    // 3. 等待配置生效
    await this.sleep(1000);
  }

  /**
   * 验证回滚结果
   */
  private async validateRollback(): Promise<void> {
    this.logger.info('验证回滚结果');

    // 1. 检查 Feature Flag 配置
    const config = this.featureFlagService.getConfig();
    this.logger.info('当前配置', { config });

    // 2. 等待一段时间后检查指标
    await this.sleep(30000); // 等待 30 秒

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 2 * 60 * 1000);
    const report = await this.monitoringService.generateReport(
      startTime,
      endTime
    );

    // 3. 检查指标是否恢复正常
    if (report.health.errorRate >= this.config.errorRateThreshold) {
      throw new Error('回滚后错误率仍然过高');
    }

    this.logger.info('回滚验证通过');
  }

  /**
   * 获取上一个阶段
   */
  private getPreviousStage(currentStage: RolloutStage): RolloutStage {
    const stages = [
      RolloutStage.DISABLED,
      RolloutStage.CANARY,
      RolloutStage.EARLY,
      RolloutStage.MAJORITY,
      RolloutStage.FULL,
    ];

    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex <= 0) {
      return RolloutStage.DISABLED;
    }

    return stages[currentIndex - 1];
  }

  /**
   * 生成回滚 ID
   */
  private generateRollbackId(): string {
    return `rollback-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * 获取回滚历史
   */
  getRollbackHistory(): RollbackRecord[] {
    return [...this.rollbackHistory];
  }

  /**
   * 获取最近的回滚记录
   */
  getLatestRollback(): RollbackRecord | null {
    if (this.rollbackHistory.length === 0) {
      return null;
    }
    return this.rollbackHistory[this.rollbackHistory.length - 1];
  }

  /**
   * 工具方法：延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
