/**
 * Trust Mode Classification Service
 * V4.2 托管模式感知的分类服务
 *
 * @description 在现有分类服务基础上集成托管模式
 * - 快慢路径路由
 * - 托管模式决策
 * - 来源画像更新
 *
 * 遵循开闭原则：不修改现有 ClassificationService，而是包装它
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import { sourceProfileService } from "@/lib/source-profile/source-profile.service";
import {
  contentRouter,
  shouldUseFastPath,
  type RouteDecision,
} from "@/lib/classification/router/content-router";
import type {
  ClassificationResult,
  BookmarkInput,
} from "@/lib/classification/types";
import { extractSourceFromUrl } from "@/types/source-profile";
import { logger } from "@/lib/logger";
import {
  getConfidenceCalibrationService,
  getAccuracyTracker,
  type MatcherResult as CalibrationMatcherResult,
} from "@/lib/classification/calibration";

// 默认得分结构
const DEFAULT_SCORES = {
  vectorScore: 0,
  historyScore: 0,
  aiScore: 0,
};

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 增强的分类输入
 */
export interface EnhancedBookmarkInput extends BookmarkInput {
  /** URL */
  url: string;
  /** 来源名称（可选） */
  sourceName?: string;
  /** 内容（可选，用于复杂度分析） */
  content?: string;
}

/**
 * 增强的分类结果
 */
export interface EnhancedClassificationResult extends ClassificationResult {
  /** 使用的路径 */
  routePath: "fast" | "slow" | "hybrid";
  /** 托管模式决策 */
  trustModeDecision: {
    /** 是否自动执行 */
    autoExecuted: boolean;
    /** 是否需要确认 */
    requiresConfirmation: boolean;
    /** 决策理由 */
    reason: string;
  };
  /** 来源匹配信息 */
  sourceMatch?: {
    sourceId: string;
    sourceName?: string;
    confidence: number;
  };
  /** 处理时间（毫秒） */
  processingTimeMs: number;
  /** 置信度校准信息 */
  calibration?: {
    /** 原始置信度 */
    rawConfidence: number;
    /** 校准后置信度 */
    calibratedConfidence: number;
    /** 一致性分数 */
    agreementScore: number;
    /** 一致性级别 */
    agreementLevel: "high" | "medium" | "low" | "conflict";
  };
}

/**
 * 分类服务接口（用于依赖注入）
 */
export interface IClassificationService {
  classify(
    userId: string,
    bookmark: BookmarkInput,
  ): Promise<ClassificationResult>;
}

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 托管模式感知的分类服务
 */
export class TrustModeClassificationService {
  constructor(private classificationService: IClassificationService) {}

  /**
   * 分类入口（托管模式感知）
   */
  async classify(
    userId: string,
    bookmark: EnhancedBookmarkInput,
  ): Promise<EnhancedClassificationResult> {
    const startTime = performance.now();

    try {
      // 1. 获取用户托管模式
      const trustMode = await trustModeService.getUserTrustMode(userId);

      // 2. Manual 模式：直接放入待整理
      if (trustMode === "manual") {
        return this.createManualModeResult(bookmark, startTime);
      }

      // 3. 路由决策
      const routeDecision = await contentRouter.route({
        userId,
        url: bookmark.url,
        title: bookmark.title,
        content: bookmark.content,
        tags: bookmark.tags,
        sourceName: bookmark.sourceName,
      });

      // 4. 根据路径执行分类
      let classificationResult: ClassificationResult;

      if (shouldUseFastPath(routeDecision) && routeDecision.fastPathResult) {
        // 快速路径
        classificationResult = await this.executeFastPath(
          userId,
          bookmark,
          routeDecision,
        );
      } else {
        // 慢速路径
        classificationResult = await this.executeSlowPath(userId, bookmark);
      }

      // 5. 混合路径验证
      if (routeDecision.needsSlowPathValidation) {
        classificationResult = await this.validateWithSlowPath(
          userId,
          bookmark,
          classificationResult,
          routeDecision,
        );
      }

      // 5.5. 置信度校准
      const calibrationResult = await this.calibrateConfidence(
        userId,
        classificationResult,
        routeDecision,
      );

      // 更新置信度
      classificationResult = {
        ...classificationResult,
        confidence: calibrationResult.calibratedConfidence,
      };

      // 6. 托管模式决策
      const isNewFolderAction =
        classificationResult.action === "auto_create" ||
        classificationResult.action === "suggest_create";
      const trustModeDecision =
        await trustModeService.getClassificationDecision({
          userId,
          confidence: classificationResult.confidence,
          isNewFolder: isNewFolderAction,
        });

      // 7. 更新来源画像
      await this.updateSourceProfile(userId, bookmark, classificationResult);

      // 8. 记录决策统计
      if (trustModeDecision.shouldAutoExecute) {
        await trustModeService.recordAutoDecision(userId);
      }

      const processingTimeMs = performance.now() - startTime;

      // 9. 构建增强结果
      return this.buildEnhancedResult(
        classificationResult,
        routeDecision,
        trustModeDecision,
        processingTimeMs,
        calibrationResult,
      );
    } catch (error) {
      logger.error(
        {
          userId,
          title: bookmark.title,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "trust_mode_classification_error",
        },
        "TrustModeClassification: Unexpected error",
      );

      // 回退到原始分类服务
      const fallbackResult = await this.classificationService.classify(
        userId,
        bookmark,
      );

      return {
        ...fallbackResult,
        routePath: "slow",
        trustModeDecision: {
          autoExecuted: true,
          requiresConfirmation: false,
          reason: "Fallback to original classification",
        },
        processingTimeMs: performance.now() - startTime,
      };
    }
  }

  /**
   * 批量分类
   */
  async classifyBatch(
    userId: string,
    bookmarks: EnhancedBookmarkInput[],
  ): Promise<EnhancedClassificationResult[]> {
    const results: EnhancedClassificationResult[] = [];

    // 获取托管模式（只查询一次）
    const trustMode = await trustModeService.getUserTrustMode(userId);

    // Manual 模式：全部放入待整理
    if (trustMode === "manual") {
      return bookmarks.map((bookmark) =>
        this.createManualModeResult(bookmark, performance.now()),
      );
    }

    // 批量路由
    const routeDecisions = await contentRouter.batchRoute(
      bookmarks.map((b) => ({
        userId,
        url: b.url,
        title: b.title,
        content: b.content,
        tags: b.tags,
        sourceName: b.sourceName,
      })),
    );

    // 按路径分组
    const fastPathBookmarks: EnhancedBookmarkInput[] = [];
    const slowPathBookmarks: EnhancedBookmarkInput[] = [];

    for (const bookmark of bookmarks) {
      const decision = routeDecisions.get(bookmark.url);
      if (decision && shouldUseFastPath(decision)) {
        fastPathBookmarks.push(bookmark);
      } else {
        slowPathBookmarks.push(bookmark);
      }
    }

    // 并行执行快速和慢速路径
    const [fastResults, slowResults] = await Promise.all([
      this.executeFastPathBatch(userId, fastPathBookmarks, routeDecisions),
      this.executeSlowPathBatch(userId, slowPathBookmarks),
    ]);

    // V4.2.4: 修复结果映射错误 - 使用 URL 作为唯一键
    // 原代码使用 reason 存储但用 title 查询，导致键不匹配
    const resultMap = new Map<string, EnhancedClassificationResult>();

    // 将快速路径结果按 URL 映射
    for (let i = 0; i < fastResults.length; i++) {
      const bookmark = fastPathBookmarks[i];
      if (bookmark) {
        resultMap.set(bookmark.url, fastResults[i]);
      }
    }

    // 将慢速路径结果按 URL 映射
    for (let i = 0; i < slowResults.length; i++) {
      const bookmark = slowPathBookmarks[i];
      if (bookmark) {
        resultMap.set(bookmark.url, slowResults[i]);
      }
    }

    // 按原始顺序返回结果
    for (const bookmark of bookmarks) {
      const result = resultMap.get(bookmark.url);
      if (result) {
        results.push(result);
      } else {
        // 仅在缓存未命中时才调用 classify（理论上不应发生）
        logger.warn(
          { url: bookmark.url },
          "TrustModeClassification: Batch result not found, falling back to single classify",
        );
        results.push(await this.classify(userId, bookmark));
      }
    }

    return results;
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 执行快速路径
   */
  private async executeFastPath(
    userId: string,
    bookmark: EnhancedBookmarkInput,
    routeDecision: RouteDecision,
  ): Promise<ClassificationResult> {
    const fastResult = routeDecision.fastPathResult;
    if (!fastResult) {
      throw new Error("fastPathResult is required for fast path execution");
    }

    if (fastResult.suggestedFolderId) {
      // 快速路径命中
      return {
        folderId: fastResult.suggestedFolderId,
        folderName: "", // 需要后续查询填充
        confidence: fastResult.confidence,
        reason: fastResult.matchDetails,
        action: "classify",
        scores: DEFAULT_SCORES,
        matchType: "source_profile",
      };
    }

    // 快速路径未命中，回退到慢速路径
    return this.executeSlowPath(userId, bookmark);
  }

  /**
   * 执行慢速路径
   */
  private async executeSlowPath(
    userId: string,
    bookmark: BookmarkInput,
  ): Promise<ClassificationResult> {
    return this.classificationService.classify(userId, bookmark);
  }

  /**
   * 混合路径验证
   */
  private async validateWithSlowPath(
    userId: string,
    bookmark: EnhancedBookmarkInput,
    fastResult: ClassificationResult,
    _routeDecision: RouteDecision,
  ): Promise<ClassificationResult> {
    // 运行慢速路径获取验证结果
    const slowResult = await this.executeSlowPath(userId, bookmark);

    // 如果两个结果一致，增加置信度
    if (fastResult.folderId === slowResult.folderId) {
      return {
        ...fastResult,
        confidence: Math.min(95, fastResult.confidence + 10),
        reason: `${fastResult.reason} (validated by slow path)`,
      };
    }

    // 如果不一致，使用慢速路径结果（更准确）
    if (slowResult.confidence > fastResult.confidence) {
      return {
        ...slowResult,
        reason: `${slowResult.reason} (fast path overridden)`,
      };
    }

    return fastResult;
  }

  /**
   * 快速路径批量执行
   */
  private async executeFastPathBatch(
    userId: string,
    bookmarks: EnhancedBookmarkInput[],
    routeDecisions: Map<string, RouteDecision>,
  ): Promise<EnhancedClassificationResult[]> {
    const results: EnhancedClassificationResult[] = [];

    for (const bookmark of bookmarks) {
      const startTime = performance.now();
      const decision = routeDecisions.get(bookmark.url);

      if (!decision?.fastPathResult?.suggestedFolderId) {
        // 回退到慢速路径
        const slowResult = await this.executeSlowPath(userId, bookmark);
        results.push({
          ...slowResult,
          routePath: "slow",
          trustModeDecision: {
            autoExecuted: true,
            requiresConfirmation: false,
            reason: "Fast path fallback",
          },
          processingTimeMs: performance.now() - startTime,
        });
        continue;
      }

      const fastResult = decision.fastPathResult;
      results.push({
        folderId: fastResult.suggestedFolderId,
        folderName: "",
        confidence: fastResult.confidence,
        reason: fastResult.matchDetails,
        action: "classify",
        scores: DEFAULT_SCORES,
        routePath: "fast",
        trustModeDecision: {
          autoExecuted: true,
          requiresConfirmation: false,
          reason: "Fast path match",
        },
        sourceMatch: fastResult.sourceMatch
          ? {
              sourceId: fastResult.sourceMatch.profile?.sourceId || "",
              sourceName: fastResult.sourceMatch.profile?.sourceName,
              confidence: fastResult.confidence,
            }
          : undefined,
        processingTimeMs: performance.now() - startTime,
      });
    }

    return results;
  }

  /**
   * 慢速路径批量执行
   */
  private async executeSlowPathBatch(
    userId: string,
    bookmarks: EnhancedBookmarkInput[],
  ): Promise<EnhancedClassificationResult[]> {
    const results: EnhancedClassificationResult[] = [];

    for (const bookmark of bookmarks) {
      const startTime = performance.now();
      const classificationResult = await this.executeSlowPath(userId, bookmark);

      results.push({
        ...classificationResult,
        routePath: "slow",
        trustModeDecision: {
          autoExecuted: true,
          requiresConfirmation: false,
          reason: "Slow path classification",
        },
        processingTimeMs: performance.now() - startTime,
      });
    }

    return results;
  }

  /**
   * 更新来源画像
   */
  private async updateSourceProfile(
    userId: string,
    bookmark: EnhancedBookmarkInput,
    result: ClassificationResult,
  ): Promise<void> {
    try {
      const sourceInfo = extractSourceFromUrl(bookmark.url);
      if (sourceInfo.sourceId && sourceInfo.sourceId !== "unknown") {
        await sourceProfileService.updateOnClassification({
          userId,
          sourceId: sourceInfo.sourceId,
          newFolderId: result.folderId || undefined,
          confidence: result.confidence,
          newDomains: bookmark.tags,
        });
      }
    } catch (error) {
      // 来源画像更新失败不影响主流程
      logger.warn(
        {
          userId,
          url: bookmark.url,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "source_profile_update_failed",
        },
        "TrustModeClassification: Source profile update failed",
      );
    }
  }

  /**
   * 创建 Manual 模式结果
   */
  private createManualModeResult(
    _bookmark: EnhancedBookmarkInput,
    startTime: number,
  ): EnhancedClassificationResult {
    return {
      folderId: null,
      folderName: "",
      confidence: 0,
      reason: "Manual mode - classification disabled",
      action: "inbox",
      scores: DEFAULT_SCORES,
      routePath: "fast",
      trustModeDecision: {
        autoExecuted: false,
        requiresConfirmation: false,
        reason: "Manual mode - classification disabled",
      },
      processingTimeMs: performance.now() - startTime,
    };
  }

  /**
   * 置信度校准
   */
  private async calibrateConfidence(
    userId: string,
    classificationResult: ClassificationResult,
    routeDecision: RouteDecision,
  ): Promise<{
    calibratedConfidence: number;
    rawConfidence: number;
    agreementScore: number;
    agreementLevel: "high" | "medium" | "low" | "conflict";
  }> {
    const rawConfidence = classificationResult.confidence;

    try {
      const calibrationService = getConfidenceCalibrationService();

      // 构建匹配器结果（如果有多个匹配源）
      const matcherResults: CalibrationMatcherResult[] = [];

      // 添加主分类结果
      matcherResults.push({
        matcherName: "primary",
        folderId: classificationResult.folderId,
        confidence: rawConfidence / 100,
        weight: 1.0,
      });

      // 如果有快速路径结果，添加为另一个匹配器
      if (routeDecision.fastPathResult?.suggestedFolderId) {
        matcherResults.push({
          matcherName: "source_profile",
          folderId: routeDecision.fastPathResult.suggestedFolderId,
          confidence: routeDecision.fastPathResult.confidence / 100,
          weight: 0.8,
        });
      }

      // 执行校准
      const calibrated = await calibrationService.calibrateConfidence(
        userId,
        rawConfidence / 100,
        classificationResult.folderId,
        matcherResults.length > 1 ? matcherResults : undefined,
      );

      return {
        calibratedConfidence: Math.round(calibrated.calibratedConfidence * 100),
        rawConfidence,
        agreementScore: calibrated.matcherAgreement?.agreementScore ?? 1,
        agreementLevel: calibrated.matcherAgreement?.agreementLevel ?? "high",
      };
    } catch (error) {
      // 校准失败时返回原始置信度
      logger.warn(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "calibration_failed",
        },
        "TrustModeClassification: Confidence calibration failed",
      );

      return {
        calibratedConfidence: rawConfidence,
        rawConfidence,
        agreementScore: 1,
        agreementLevel: "high",
      };
    }
  }

  /**
   * 记录分类结果（用于准确率跟踪）
   */
  async recordOutcome(
    userId: string,
    bookmarkId: number,
    folderId: number | null,
    predictedConfidence: number,
    isCorrect: boolean,
  ): Promise<void> {
    try {
      const accuracyTracker = getAccuracyTracker();
      await accuracyTracker.recordOutcome({
        userId,
        bookmarkId,
        folderId,
        predictedConfidence: predictedConfidence / 100,
        isCorrect,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.warn(
        {
          userId,
          bookmarkId,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "record_outcome_failed",
        },
        "TrustModeClassification: Failed to record outcome",
      );
    }
  }

  /**
   * 构建增强结果
   */
  private buildEnhancedResult(
    classificationResult: ClassificationResult,
    routeDecision: RouteDecision,
    trustModeDecision: {
      shouldAutoExecute: boolean;
      requiresConfirmation: boolean;
      reason: string;
    },
    processingTimeMs: number,
    calibration?: {
      calibratedConfidence: number;
      rawConfidence: number;
      agreementScore: number;
      agreementLevel: "high" | "medium" | "low" | "conflict";
    },
  ): EnhancedClassificationResult {
    return {
      ...classificationResult,
      routePath: routeDecision.path,
      trustModeDecision: {
        autoExecuted: trustModeDecision.shouldAutoExecute,
        requiresConfirmation: trustModeDecision.requiresConfirmation,
        reason: trustModeDecision.reason,
      },
      sourceMatch: routeDecision.fastPathResult?.sourceMatch
        ? {
            sourceId:
              routeDecision.fastPathResult.sourceMatch.profile?.sourceId || "",
            sourceName:
              routeDecision.fastPathResult.sourceMatch.profile?.sourceName,
            confidence: routeDecision.fastPathResult.confidence,
          }
        : undefined,
      processingTimeMs,
      calibration: calibration
        ? {
            rawConfidence: calibration.rawConfidence,
            calibratedConfidence: calibration.calibratedConfidence,
            agreementScore: calibration.agreementScore,
            agreementLevel: calibration.agreementLevel,
          }
        : undefined,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建托管模式分类服务实例
 */
export function createTrustModeClassificationService(
  classificationService: IClassificationService,
): TrustModeClassificationService {
  return new TrustModeClassificationService(classificationService);
}
