/**
 * 智能分类 v5.0 - FeatureFlag Service
 *
 * 灰度发布控制服务
 */

import type { LoggerService } from '../logger';
import type { FeatureFlagConfig, FeatureFlagResult } from './types';
import { FeatureFlagError } from './types';

/**
 * FeatureFlag Service 类
 */
export class FeatureFlagService {
  private config: FeatureFlagConfig;
  private logger: LoggerService;

  constructor(logger: LoggerService, config?: Partial<FeatureFlagConfig>) {
    this.logger = logger.child({ service: 'FeatureFlagService' });

    // 从环境变量读取配置
    const enabled = process.env.CLASSIFICATION_V5_ENABLED !== 'false';
    const rolloutPercentage = parseInt(
      process.env.CLASSIFICATION_V5_ROLLOUT_PERCENTAGE || '0',
      10
    );
    const whitelist = (process.env.CLASSIFICATION_V5_WHITELIST || '')
      .split(',')
      .filter(id => id.trim().length > 0);
    const blacklist = (process.env.CLASSIFICATION_V5_BLACKLIST || '')
      .split(',')
      .filter(id => id.trim().length > 0);

    this.config = {
      enabled: config?.enabled ?? enabled,
      rolloutPercentage: config?.rolloutPercentage ?? rolloutPercentage,
      whitelist: config?.whitelist ?? whitelist,
      blacklist: config?.blacklist ?? blacklist,
    };

    this.logger.info('FeatureFlag Service 初始化', {
      enabled: this.config.enabled,
      rolloutPercentage: this.config.rolloutPercentage,
      whitelistCount: this.config.whitelist.length,
      blacklistCount: this.config.blacklist.length,
    });
  }

  /**
   * 检查用户是否启用 v5.0
   */
  isV5Enabled(userId: string): boolean {
    const result = this.checkV5Enabled(userId);

    this.logger.debug('Feature Flag 检查', {
      userId,
      enabled: result.enabled,
      reason: result.reason,
      userHash: result.userHash,
    });

    return result.enabled;
  }

  /**
   * 检查用户是否启用 v5.0（详细结果）
   */
  checkV5Enabled(userId: string): FeatureFlagResult {
    // 1. 全局开关检查
    if (!this.config.enabled) {
      return {
        enabled: false,
        reason: 'disabled',
      };
    }

    // 2. 黑名单检查（优先级最高）
    if (this.config.blacklist.includes(userId)) {
      return {
        enabled: false,
        reason: 'blacklisted',
      };
    }

    // 3. 白名单检查
    if (this.config.whitelist.includes(userId)) {
      return {
        enabled: true,
        reason: 'whitelisted',
      };
    }

    // 4. 灰度百分比检查
    const userHash = this.hashUserId(userId);
    const inRollout = (userHash % 100) < this.config.rolloutPercentage;

    return {
      enabled: inRollout,
      reason: inRollout ? 'rollout' : 'not_in_rollout',
      userHash,
    };
  }

  /**
   * 用户 ID 哈希函数
   * 确保同一用户始终得到相同的哈希值
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * 获取当前配置
   */
  getConfig(): FeatureFlagConfig {
    return { ...this.config };
  }

  /**
   * 更新配置（仅用于测试）
   */
  updateConfig(config: Partial<FeatureFlagConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    this.logger.info('FeatureFlag 配置已更新', {
      enabled: this.config.enabled,
      rolloutPercentage: this.config.rolloutPercentage,
    });
  }
}
