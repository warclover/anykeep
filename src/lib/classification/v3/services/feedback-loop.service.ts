/**
 * V3.0 反馈闭环服务
 *
 * 负责：
 * 1. 记录分类决策的完整上下文
 * 2. 处理用户反馈
 * 3. 计算动态权重调整
 * 4. 提供学习数据分析
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  DecisionRepository,
  type CreateDecisionInput,
  type UpdateFeedbackInput,
  type WeightAdjustments,
  type DecisionType,
  type UserAction,
  type MatcherScores,
  type CandidateFolder,
} from "../repositories/decision.repository";
import { V3_CONFIG } from "../config";
import { logger } from "@/lib/logger";

/**
 * 分类结果上下文（从分类服务传入）
 */
export interface ClassificationContext {
  bookmarkId: number;
  userId: string;
  decisionType: DecisionType;
  finalFolderId?: number;
  finalFolderName?: string;
  confidence: number;
  matcherScores: MatcherScores;
  candidates: CandidateFolder[];
  aiSkipped: boolean;
  aiModel?: string;
  aiResponseTimeMs?: number;
}

/**
 * 反馈闭环服务
 */
export class FeedbackLoopService {
  private decisionRepo: DecisionRepository;
  private cachedWeights: Map<
    string,
    { weights: WeightAdjustments; expiry: number }
  > = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟缓存

  constructor(supabase: SupabaseClient<Database>) {
    this.decisionRepo = new DecisionRepository(supabase);
  }

  /**
   * 记录分类决策
   * 在每次分类完成后调用
   */
  async recordDecision(context: ClassificationContext): Promise<number> {
    if (!V3_CONFIG.enableFeedbackLoop) {
      logger.debug("Feedback loop disabled, skipping decision recording");
      return 0;
    }

    const input: CreateDecisionInput = {
      userId: context.userId,
      bookmarkId: context.bookmarkId,
      decisionType: context.decisionType,
      finalFolderId: context.finalFolderId,
      finalFolderName: context.finalFolderName,
      confidence: context.confidence,
      matcherScores: context.matcherScores,
      candidates: context.candidates,
      aiSkipped: context.aiSkipped,
      aiModel: context.aiModel,
      aiPromptVersion: V3_CONFIG.enableCoTPrompt ? "cot_v1" : "simple_v2",
      aiResponseTimeMs: context.aiResponseTimeMs,
      clientVersion: "v3.0.0",
    };

    try {
      const decisionId = await this.decisionRepo.create(input);
      logger.info(
        {
          decisionId,
          bookmarkId: context.bookmarkId,
          decisionType: context.decisionType,
          confidence: context.confidence,
          aiSkipped: context.aiSkipped,
        },
        "Classification decision recorded",
      );
      return decisionId;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to record classification decision",
      );
      // 不抛出错误，避免影响主流程
      return 0;
    }
  }

  /**
   * 记录用户反馈
   * 当用户接受、拒绝建议或手动移动书签时调用
   */
  async recordFeedback(
    bookmarkId: number,
    userId: string,
    action: UserAction,
    chosenFolderId?: number,
  ): Promise<void> {
    if (!V3_CONFIG.enableFeedbackLoop) {
      return;
    }

    const input: UpdateFeedbackInput = {
      bookmarkId,
      userId,
      userAction: action,
      userChosenFolderId: chosenFolderId,
    };

    try {
      await this.decisionRepo.updateFeedback(input);

      // 清除缓存的权重，强制重新计算
      this.cachedWeights.delete(userId);

      logger.info(
        { bookmarkId, action, chosenFolderId },
        "User feedback recorded",
      );
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to record user feedback",
      );
    }
  }

  /**
   * 获取用户的动态权重调整
   * 带缓存，避免频繁查询数据库
   */
  async getWeightAdjustments(userId: string): Promise<WeightAdjustments> {
    if (!V3_CONFIG.enableDynamicWeights) {
      // 返回默认权重
      return {
        vector: 0.4,
        history: 0.3,
        ai: 0.3,
        dataSufficient: false,
        sampleSize: 0,
      };
    }

    // 检查缓存
    const cached = this.cachedWeights.get(userId);
    if (cached && cached.expiry > Date.now()) {
      return cached.weights;
    }

    // 从数据库获取
    const weights = await this.decisionRepo.getWeightAdjustments(userId);

    // 更新缓存
    this.cachedWeights.set(userId, {
      weights,
      expiry: Date.now() + this.CACHE_TTL_MS,
    });

    return weights;
  }

  /**
   * 获取用户的分类统计
   */
  async getUserStats(userId: string, days: number = 30) {
    return this.decisionRepo.getUserStats(userId, days);
  }

  /**
   * 判断是否应该调整 k-NN 直接锁定阈值
   */
  async shouldAdjustKnnThreshold(userId: string): Promise<number> {
    const weights = await this.getWeightAdjustments(userId);
    return weights.knnDirectThreshold ?? V3_CONFIG.knnDirectThreshold;
  }

  /**
   * 清除缓存（用于测试或强制刷新）
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.cachedWeights.delete(userId);
    } else {
      this.cachedWeights.clear();
    }
  }
}

/**
 * 辅助函数：将分类结果转换为决策类型
 */
export function determineDecisionType(
  confidence: number,
  aiSkipped: boolean,
  matchedByUniversal: boolean,
): DecisionType {
  if (aiSkipped) {
    return "knn_direct";
  }
  if (matchedByUniversal) {
    return "universal_match";
  }
  if (confidence >= V3_CONFIG.highConfidenceThreshold) {
    return "auto_classified";
  }
  if (confidence >= V3_CONFIG.mediumConfidenceThreshold) {
    return "suggestion_shown";
  }
  return "to_inbox";
}
