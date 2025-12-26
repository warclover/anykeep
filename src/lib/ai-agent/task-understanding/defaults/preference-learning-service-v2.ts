/**
 * 偏好学习服务 V2
 *
 * 基于事后反馈学习用户偏好，而不是主动询问
 *
 * 学习来源：
 * - 用户接受执行结果 → 强化当前默认值
 * - 用户撤销操作 → 弱化当前默认值
 * - 用户调整结果 → 学习新的偏好
 *
 * @version 2.0.0
 * @since 2025-12-26
 */

import { createLogger } from "@/lib/logger";
import type {
  SmartDefault,
  TaskUnderstanding,
  TaskExecutionResult,
  UserPreferences,
  PreferenceLearningRecord,
  OrganizeMethod,
} from "../types";

const logger = createLogger("PreferenceLearningServiceV2");

// =============================================================================
// 配置
// =============================================================================

/**
 * 偏好学习配置
 */
export interface LearningConfig {
  /** 成为偏好的阈值（使用次数） */
  preferenceThreshold: number;

  /** 撤销时的弱化权重 */
  undoWeakenWeight: number;

  /** 接受时的强化权重 */
  acceptReinforceWeight: number;

  /** 最大记录历史数 */
  maxRecordHistory: number;

  /** 是否启用异步学习 */
  asyncLearning: boolean;
}

const DEFAULT_CONFIG: LearningConfig = {
  preferenceThreshold: 3, // 使用 3 次以上成为偏好
  undoWeakenWeight: 2, // 撤销时权重 -2
  acceptReinforceWeight: 1, // 接受时权重 +1
  maxRecordHistory: 1000, // 最多保留 1000 条记录
  asyncLearning: true, // 异步学习，不阻塞主流程
};

// =============================================================================
// 偏好学习服务 V2
// =============================================================================

/**
 * 偏好学习服务 V2
 *
 * 从用户的撤销/调整行为中学习，而不是主动询问
 */
export class PreferenceLearningServiceV2 {
  private config: LearningConfig;

  constructor(
    private storage: PreferenceLearningStorage,
    config: Partial<LearningConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // 公共方法 - 学习入口
  // ===========================================================================

  /**
   * 从执行结果学习
   *
   * @param userId 用户 ID
   * @param understanding 任务理解
   * @param result 执行结果
   * @param userAction 用户行为
   */
  async learnFromExecution(
    userId: string,
    understanding: TaskUnderstanding,
    result: TaskExecutionResult,
    userAction: "accepted" | "undone" | "adjusted",
  ): Promise<void> {
    if (this.config.asyncLearning) {
      // 异步学习，不阻塞主流程
      this.learnAsync(userId, understanding, result, userAction).catch(
        (error) => {
          logger.error({ userId, userAction, error }, "异步学习失败");
        },
      );
    } else {
      await this.learnSync(userId, understanding, result, userAction);
    }
  }

  /**
   * 获取用户偏好
   */
  async getPreferences(userId: string): Promise<UserPreferences | null> {
    return this.storage.getPreferences(userId);
  }

  /**
   * 获取学习记录（用于调试和分析）
   */
  async getLearningRecords(
    userId: string,
    limit: number = 50,
  ): Promise<PreferenceLearningRecord[]> {
    return this.storage.getLearningRecords(userId, limit);
  }

  /**
   * 重置用户偏好（用于测试或用户主动重置）
   */
  async resetPreferences(userId: string): Promise<void> {
    await this.storage.resetPreferences(userId);
    logger.info({ userId }, "重置用户偏好");
  }

  // ===========================================================================
  // 私有方法 - 学习逻辑
  // ===========================================================================

  /**
   * 同步学习
   */
  private async learnSync(
    userId: string,
    understanding: TaskUnderstanding,
    result: TaskExecutionResult,
    userAction: "accepted" | "undone" | "adjusted",
  ): Promise<void> {
    const appliedDefaults = understanding.appliedDefaults;

    switch (userAction) {
      case "accepted":
        // 用户接受了结果 → 强化当前默认值
        for (const defaultVal of appliedDefaults) {
          await this.reinforceDefault(userId, defaultVal);
        }
        break;

      case "undone":
        // 用户撤销了 → 弱化当前默认值
        for (const defaultVal of appliedDefaults) {
          await this.weakenDefault(userId, defaultVal);
        }
        break;

      case "adjusted":
        // 用户调整了 → 学习新的偏好
        if (result.adjustment) {
          await this.learnNewPreference(
            userId,
            result.adjustment.content,
            appliedDefaults,
          );
        }
        break;
    }

    // 记录学习历史
    await this.recordLearning(
      userId,
      understanding,
      userAction,
      result.adjustment?.content,
    );
  }

  /**
   * 异步学习
   */
  private async learnAsync(
    userId: string,
    understanding: TaskUnderstanding,
    result: TaskExecutionResult,
    userAction: "accepted" | "undone" | "adjusted",
  ): Promise<void> {
    // 使用 setImmediate 或 setTimeout 延迟执行
    await new Promise<void>((resolve) => {
      setTimeout(async () => {
        try {
          await this.learnSync(userId, understanding, result, userAction);
        } finally {
          resolve();
        }
      }, 0);
    });
  }

  /**
   * 强化默认值
   */
  private async reinforceDefault(
    userId: string,
    defaultVal: SmartDefault,
  ): Promise<void> {
    const prefs =
      (await this.storage.getPreferences(userId)) ||
      this.createEmptyPreferences(userId);

    // 增加使用计数
    prefs.defaultUsage = prefs.defaultUsage || {};
    prefs.defaultUsage[defaultVal.field] =
      prefs.defaultUsage[defaultVal.field] || {};
    prefs.defaultUsage[defaultVal.field][defaultVal.value] =
      (prefs.defaultUsage[defaultVal.field][defaultVal.value] || 0) +
      this.config.acceptReinforceWeight;

    // 如果某个值使用次数超过阈值，设为用户偏好
    const currentCount = prefs.defaultUsage[defaultVal.field][defaultVal.value];
    if (currentCount >= this.config.preferenceThreshold) {
      this.promoteToPreference(prefs, defaultVal.field, defaultVal.value);
    }

    prefs.updatedAt = new Date();
    await this.storage.savePreferences(prefs);

    logger.debug(
      {
        userId,
        field: defaultVal.field,
        value: defaultVal.value,
        newCount: currentCount,
      },
      "强化默认值",
    );
  }

  /**
   * 弱化默认值
   */
  private async weakenDefault(
    userId: string,
    defaultVal: SmartDefault,
  ): Promise<void> {
    const prefs =
      (await this.storage.getPreferences(userId)) ||
      this.createEmptyPreferences(userId);

    prefs.defaultUsage = prefs.defaultUsage || {};
    prefs.defaultUsage[defaultVal.field] =
      prefs.defaultUsage[defaultVal.field] || {};

    const currentCount =
      prefs.defaultUsage[defaultVal.field][defaultVal.value] || 0;
    const newCount = Math.max(0, currentCount - this.config.undoWeakenWeight);
    prefs.defaultUsage[defaultVal.field][defaultVal.value] = newCount;

    // 如果计数降到 0 以下且是当前偏好，移除偏好
    if (newCount === 0) {
      this.demoteFromPreference(prefs, defaultVal.field, defaultVal.value);
    }

    prefs.updatedAt = new Date();
    await this.storage.savePreferences(prefs);

    logger.debug(
      {
        userId,
        field: defaultVal.field,
        value: defaultVal.value,
        newCount,
      },
      "弱化默认值",
    );
  }

  /**
   * 学习新偏好
   */
  private async learnNewPreference(
    userId: string,
    adjustmentContent: string,
    appliedDefaults: SmartDefault[],
  ): Promise<void> {
    // 解析用户调整内容，提取新的偏好值
    const newPreferences = this.parseAdjustmentContent(
      adjustmentContent,
      appliedDefaults,
    );

    for (const [field, value] of Object.entries(newPreferences)) {
      // 弱化原来的默认值
      const originalDefault = appliedDefaults.find((d) => d.field === field);
      if (originalDefault) {
        await this.weakenDefault(userId, originalDefault);
      }

      // 强化新的值
      await this.reinforceDefault(userId, {
        field,
        value,
        source: "context_infer",
        confidence: 0.9,
      });
    }

    logger.info({ userId, newPreferences }, "学习新偏好");
  }

  /**
   * 解析用户调整内容
   */
  private parseAdjustmentContent(
    content: string,
    _appliedDefaults: SmartDefault[],
  ): Record<string, string> {
    const newPreferences: Record<string, string> = {};
    const lowerContent = content.toLowerCase();

    // 解析整理方式
    const organizeMethodMap: Record<string, OrganizeMethod> = {
      按时间: "time",
      按主题: "topic",
      按平台: "platform",
      按作者: "author",
      自动: "auto",
    };

    for (const [keyword, method] of Object.entries(organizeMethodMap)) {
      if (lowerContent.includes(keyword)) {
        newPreferences["organizeMethod"] = method;
        break;
      }
    }

    // 可以继续添加其他字段的解析逻辑

    return newPreferences;
  }

  /**
   * 提升为偏好
   */
  private promoteToPreference(
    prefs: UserPreferences,
    field: string,
    value: string,
  ): void {
    switch (field) {
      case "organizeMethod":
        prefs.preferredOrganizeMethod = value as OrganizeMethod;
        break;
      case "targetFolder":
        prefs.frequentFolders = prefs.frequentFolders || [];
        if (!prefs.frequentFolders.includes(value)) {
          prefs.frequentFolders.unshift(value);
          // 最多保留 5 个常用文件夹
          prefs.frequentFolders = prefs.frequentFolders.slice(0, 5);
        }
        break;
      case "tag":
        prefs.frequentTags = prefs.frequentTags || [];
        if (!prefs.frequentTags.includes(value)) {
          prefs.frequentTags.unshift(value);
          // 最多保留 10 个常用标签
          prefs.frequentTags = prefs.frequentTags.slice(0, 10);
        }
        break;
    }

    logger.info({ userId: prefs.userId, field, value }, "提升为偏好");
  }

  /**
   * 从偏好中移除
   */
  private demoteFromPreference(
    prefs: UserPreferences,
    field: string,
    value: string,
  ): void {
    switch (field) {
      case "organizeMethod":
        if (prefs.preferredOrganizeMethod === value) {
          prefs.preferredOrganizeMethod = undefined;
        }
        break;
      case "targetFolder":
        prefs.frequentFolders = (prefs.frequentFolders || []).filter(
          (f) => f !== value,
        );
        break;
      case "tag":
        prefs.frequentTags = (prefs.frequentTags || []).filter(
          (t) => t !== value,
        );
        break;
    }
  }

  /**
   * 记录学习历史
   */
  private async recordLearning(
    userId: string,
    understanding: TaskUnderstanding,
    userAction: "accepted" | "undone" | "adjusted",
    adjustedValue?: string,
  ): Promise<void> {
    for (const defaultVal of understanding.appliedDefaults) {
      const record: PreferenceLearningRecord = {
        userId,
        taskType: understanding.matchedTemplate || "unknown",
        appliedDefault: defaultVal,
        userAction,
        adjustedValue,
        recordedAt: new Date(),
      };

      await this.storage.saveLearningRecord(record);
    }
  }

  /**
   * 创建空偏好对象
   */
  private createEmptyPreferences(userId: string): UserPreferences {
    return {
      userId,
      defaultUsage: {},
      updatedAt: new Date(),
    };
  }
}

// =============================================================================
// 存储接口
// =============================================================================

/**
 * 偏好学习存储接口
 *
 * 用于解耦学习服务和具体存储实现
 */
export interface PreferenceLearningStorage {
  /**
   * 获取用户偏好
   */
  getPreferences(userId: string): Promise<UserPreferences | null>;

  /**
   * 保存用户偏好
   */
  savePreferences(prefs: UserPreferences): Promise<void>;

  /**
   * 重置用户偏好
   */
  resetPreferences(userId: string): Promise<void>;

  /**
   * 保存学习记录
   */
  saveLearningRecord(record: PreferenceLearningRecord): Promise<void>;

  /**
   * 获取学习记录
   */
  getLearningRecords(
    userId: string,
    limit: number,
  ): Promise<PreferenceLearningRecord[]>;
}

// =============================================================================
// 内存存储实现（用于开发和测试）
// =============================================================================

/**
 * 内存存储实现
 */
export class InMemoryPreferenceLearningStorage
  implements PreferenceLearningStorage
{
  private preferences: Map<string, UserPreferences> = new Map();
  private learningRecords: Map<string, PreferenceLearningRecord[]> = new Map();

  async getPreferences(userId: string): Promise<UserPreferences | null> {
    return this.preferences.get(userId) || null;
  }

  async savePreferences(prefs: UserPreferences): Promise<void> {
    this.preferences.set(prefs.userId, prefs);
  }

  async resetPreferences(userId: string): Promise<void> {
    this.preferences.delete(userId);
    this.learningRecords.delete(userId);
  }

  async saveLearningRecord(record: PreferenceLearningRecord): Promise<void> {
    const records = this.learningRecords.get(record.userId) || [];
    records.push(record);
    // 限制记录数量
    if (records.length > 1000) {
      records.shift();
    }
    this.learningRecords.set(record.userId, records);
  }

  async getLearningRecords(
    userId: string,
    limit: number,
  ): Promise<PreferenceLearningRecord[]> {
    const records = this.learningRecords.get(userId) || [];
    return records.slice(-limit);
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建偏好学习服务
 */
export function createPreferenceLearningServiceV2(
  storage: PreferenceLearningStorage,
  config?: Partial<LearningConfig>,
): PreferenceLearningServiceV2 {
  return new PreferenceLearningServiceV2(storage, config);
}
