/**
 * 用户偏好学习服务
 *
 * 从用户的确认/拒绝行为中学习分类偏好
 *
 * @module classification/batch-classification/learning/user-preference.service
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { UserDecision, StructureMode } from "../types";

// ============================================
// 类型定义
// ============================================

/**
 * 用户偏好配置
 */
export interface UserPreference {
  userId: string;

  /** 命名风格偏好 */
  namingPreferences: {
    preferShortNames: boolean;
    preferEmoji: boolean;
    language: "zh" | "en" | "mixed";
  };

  /** 分类粒度偏好 */
  granularityPreference: "coarse" | "medium" | "fine";

  /** 结构偏好 */
  structurePreference: StructureMode;

  /** 拒绝模式 (domain -> 拒绝次数) */
  rejectionPatterns: Record<string, number>;

  /** 接受模式 (folder_name -> 接受次数) */
  acceptancePatterns: Record<string, number>;

  /** 置信度阈值调整 */
  confidenceAdjustment: number;

  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 学习事件
 */
export interface LearningEvent {
  userId: string;
  transactionId: string;
  clusterId: string;
  action: "accept" | "reject" | "modify";
  suggestedFolderName?: string;
  actualFolderName?: string;
  confidence: number;
  domain?: string;
  timestamp: Date;
}

// ============================================
// 默认偏好
// ============================================

export const DEFAULT_USER_PREFERENCE: Omit<UserPreference, "userId"> = {
  namingPreferences: {
    preferShortNames: true,
    preferEmoji: false,
    language: "zh",
  },
  granularityPreference: "medium",
  structurePreference: "auto",
  rejectionPatterns: {},
  acceptancePatterns: {},
  confidenceAdjustment: 0,
  updatedAt: new Date(),
};

// ============================================
// 用户偏好学习服务
// ============================================

/**
 * 用户偏好学习服务
 *
 * 功能：
 * 1. 记录用户决策
 * 2. 分析决策模式
 * 3. 更新偏好配置
 * 4. 应用偏好到未来分类
 */
export class UserPreferenceLearningService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 获取用户偏好
   */
  async getUserPreference(userId: string): Promise<UserPreference> {
    const { data } = await this.supabase
      .from("user_classification_rules")
      .select("*")
      .eq("user_id", userId)
      .eq("rule_type", "preference")
      .single();

    if (data?.rule_config) {
      const config = data.rule_config as Partial<UserPreference>;
      return {
        userId,
        ...DEFAULT_USER_PREFERENCE,
        ...config,
        updatedAt: new Date(data.updated_at || Date.now()),
      };
    }

    return {
      userId,
      ...DEFAULT_USER_PREFERENCE,
    };
  }

  /**
   * 记录学习事件
   */
  async recordLearningEvent(event: LearningEvent): Promise<void> {
    // 存储到分类反馈表
    await this.supabase.from("classification_feedback").insert({
      user_id: event.userId,
      feedback_type: event.action === "accept" ? "positive" : "negative",
      context: {
        transactionId: event.transactionId,
        clusterId: event.clusterId,
        suggestedFolderName: event.suggestedFolderName,
        actualFolderName: event.actualFolderName,
        confidence: event.confidence,
        domain: event.domain,
      },
    });
  }

  /**
   * 从用���决策中学习
   */
  async learnFromDecisions(
    userId: string,
    transactionId: string,
    decisions: UserDecision[],
    clusterDetails: Map<
      string,
      { suggestedName?: string; confidence: number; domains: string[] }
    >,
  ): Promise<void> {
    const preference = await this.getUserPreference(userId);

    // 分析决策
    for (const decision of decisions) {
      const details = clusterDetails.get(decision.clusterId);
      if (!details) continue;

      // 记录学习事件
      await this.recordLearningEvent({
        userId,
        transactionId,
        clusterId: decision.clusterId,
        action: decision.action,
        suggestedFolderName: details.suggestedName,
        actualFolderName: decision.customName,
        confidence: details.confidence,
        domain: details.domains[0],
        timestamp: new Date(),
      });

      // 更新偏好
      if (decision.action === "reject") {
        // 记录拒绝模式
        for (const domain of details.domains) {
          preference.rejectionPatterns[domain] =
            (preference.rejectionPatterns[domain] || 0) + 1;
        }
      } else if (decision.action === "accept" && details.suggestedName) {
        // 记录接受模式
        preference.acceptancePatterns[details.suggestedName] =
          (preference.acceptancePatterns[details.suggestedName] || 0) + 1;
      } else if (decision.action === "modify" && decision.customName) {
        // 用户修改了名称，学习命名偏好
        this.updateNamingPreference(preference, decision.customName);
      }
    }

    // 调整置信度阈值
    this.adjustConfidenceThreshold(preference, decisions);

    // 保存更新后的偏好
    await this.saveUserPreference(preference);
  }

  /**
   * 获取调整后的置信度阈值
   */
  getAdjustedConfidenceThreshold(
    preference: UserPreference,
    baseThreshold: number,
  ): number {
    return Math.max(
      0.3,
      Math.min(0.95, baseThreshold + preference.confidenceAdjustment),
    );
  }

  /**
   * 检查域名是否经常被拒绝
   */
  isDomainFrequentlyRejected(
    preference: UserPreference,
    domain: string,
  ): boolean {
    return (preference.rejectionPatterns[domain] || 0) >= 3;
  }

  /**
   * 获取推荐的分类粒度
   */
  getRecommendedGranularity(preference: UserPreference): {
    minClusterSize: number;
    maxClusterSize: number;
  } {
    switch (preference.granularityPreference) {
      case "coarse":
        return { minClusterSize: 5, maxClusterSize: 50 };
      case "fine":
        return { minClusterSize: 2, maxClusterSize: 10 };
      default:
        return { minClusterSize: 3, maxClusterSize: 20 };
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private updateNamingPreference(
    preference: UserPreference,
    customName: string,
  ): void {
    // 检测是否使用 emoji
    const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(customName);
    if (hasEmoji) {
      preference.namingPreferences.preferEmoji = true;
    }

    // 检测名称长度偏好
    if (customName.length <= 5) {
      preference.namingPreferences.preferShortNames = true;
    } else if (customName.length > 10) {
      preference.namingPreferences.preferShortNames = false;
    }

    // 检测语言偏好
    const hasChinese = /[\u4e00-\u9fa5]/.test(customName);
    const hasEnglish = /[a-zA-Z]/.test(customName);

    if (hasChinese && hasEnglish) {
      preference.namingPreferences.language = "mixed";
    } else if (hasChinese) {
      preference.namingPreferences.language = "zh";
    } else if (hasEnglish) {
      preference.namingPreferences.language = "en";
    }
  }

  private adjustConfidenceThreshold(
    preference: UserPreference,
    decisions: UserDecision[],
  ): void {
    const acceptCount = decisions.filter((d) => d.action === "accept").length;
    const rejectCount = decisions.filter((d) => d.action === "reject").length;
    const total = decisions.length;

    if (total === 0) return;

    const acceptRate = acceptCount / total;

    // 如果接受率很高，降低阈值（更信任 AI）
    if (acceptRate > 0.8) {
      preference.confidenceAdjustment = Math.max(
        -0.1,
        preference.confidenceAdjustment - 0.02,
      );
    }
    // 如果拒绝率很高，提高阈值（更谨慎）
    else if (rejectCount / total > 0.5) {
      preference.confidenceAdjustment = Math.min(
        0.2,
        preference.confidenceAdjustment + 0.05,
      );
    }
  }

  private async saveUserPreference(preference: UserPreference): Promise<void> {
    const { userId, updatedAt: _updatedAt, ...config } = preference;

    await this.supabase.from("user_classification_rules").upsert(
      {
        user_id: userId,
        rule_type: "preference",
        rule_config: config,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,rule_type",
      },
    );
  }
}

// ============================================
// 导出
// ============================================

export function createUserPreferenceLearningService(
  supabase: SupabaseClient<Database>,
): UserPreferenceLearningService {
  return new UserPreferenceLearningService(supabase);
}
