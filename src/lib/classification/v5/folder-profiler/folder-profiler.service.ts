/**
 * 智能分类 v5.0 - FolderProfiler Service
 *
 * 文件夹画像管理服务（整合所有组件）
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggerService } from "../shared/logger";
import type { IEmbeddingService } from "../shared/embedding";
import type { LLMService } from "../shared/llm";
import { AlphaCalculator } from "./alpha-calculator";
import { LazyUpdater } from "./lazy-updater";
import {
  DualSourceBuilder,
  type BookmarkData,
  type BehaviorData,
  type ParentContext,
} from "./dual-source-builder";
import type { FolderProfile, FolderStats, FolderProfilerConfig } from "./types";
import { FolderProfilerError } from "./types";

/**
 * 数据库记录类型
 */
interface FolderProfileDbRecord {
  id: number;
  user_id: string;
  folder_id: number;
  content_embedding: number[];
  behavior_embedding: number[];
  alpha_coefficient: number;
  last_updated_at: string;
  bookmark_count: number;
  needs_update: boolean;
  avg_classification_score: number | null;
  total_classifications: number;
  created_at: string;
  updated_at: string;
}

/**
 * FolderProfiler Service 类
 */
export class FolderProfilerService {
  private logger: LoggerService;
  private supabase: SupabaseClient;
  private embeddingService: IEmbeddingService;
  private llmService?: LLMService;
  private alphaCalculator: AlphaCalculator;
  private lazyUpdater: LazyUpdater;
  private dualSourceBuilder: DualSourceBuilder;
  private config: FolderProfilerConfig;

  constructor(
    logger: LoggerService,
    supabase: SupabaseClient,
    embeddingService: IEmbeddingService,
    llmService?: LLMService,
    config?: Partial<FolderProfilerConfig>,
  ) {
    this.logger = logger.child({ service: "FolderProfilerService" });
    this.supabase = supabase;
    this.embeddingService = embeddingService;
    this.llmService = llmService;

    this.config = {
      timeThresholdDays: config?.timeThresholdDays ?? 7,
      newBookmarksThreshold: config?.newBookmarksThreshold ?? 10,
      accuracyThreshold: config?.accuracyThreshold ?? 0.85,
      alphaRange: config?.alphaRange ?? { min: 0.2, max: 0.8 },
    };

    // 初始化组件（v5.1: 传递 enableV51Features 和 LLMService）
    const enableV51Features =
      process.env.CLASSIFICATION_V5_1_ENABLED !== "false";
    this.alphaCalculator = new AlphaCalculator(logger, {
      enableV51Features,
    });
    this.lazyUpdater = new LazyUpdater(logger, {
      timeThresholdDays: this.config.timeThresholdDays,
      newBookmarksThreshold: this.config.newBookmarksThreshold,
      accuracyThreshold: this.config.accuracyThreshold,
    });
    // v5.1: 传递 LLMService 以启用冷启动语义膨胀
    this.dualSourceBuilder = new DualSourceBuilder(
      logger,
      embeddingService,
      llmService,
      { enableV51Features },
    );
  }

  /**
   * 获取文件夹画像
   */
  async getProfile(
    userId: string,
    folderId: string,
  ): Promise<FolderProfile | null> {
    const { data, error } = await this.supabase
      .from("classification_folder_profiles_v5")
      .select("*")
      .eq("user_id", userId)
      .eq("folder_id", folderId)
      .single();

    if (error) {
      // PGRST116: 未找到记录
      if (error.code === "PGRST116") {
        return null;
      }
      // PGRST301: RLS 策略拒绝访问
      if (error.code === "PGRST301") {
        throw new FolderProfilerError(
          `Access denied for folder profile: ${error.message}`,
          error,
        );
      }
      // 其他错误（网络超时、权限问题等）
      throw new FolderProfilerError(
        `Failed to get profile: ${error.message}`,
        error,
      );
    }

    return this.mapToProfile(data);
  }

  /**
   * 创建或更新文件夹画像
   *
   * @param parentId - v5.1: 父文件夹 ID（用于层级意图继承）
   */
  async upsertProfile(
    userId: string,
    folderId: string,
    folderName: string,
    folderDescription: string | undefined,
    bookmarks: BookmarkData[],
    behaviors: BehaviorData[],
    stats: FolderStats,
    parentId?: number,
  ): Promise<FolderProfile> {
    this.logger.info("创建/更新文件夹画像", {
      userId,
      folderId,
      folderName,
      bookmarkCount: bookmarks.length,
      behaviorCount: behaviors.length,
      parentId,
    });

    // v5.1: 获取父文件夹上下文（用于冷启动增强）
    let parentContext: ParentContext | undefined;
    if (parentId) {
      parentContext = await this.getParentContext(userId, parentId);
      if (parentContext) {
        this.logger.debug("获取父文件夹上下文成功", {
          parentId,
          parentName: parentContext.name,
          hasParentEmbedding: !!parentContext.embedding,
        });
      }
    }

    // 1. 构建双源向量(基于生命周期阶段)
    const vectors = await this.dualSourceBuilder.build(
      folderId,
      folderName,
      folderDescription,
      bookmarks,
      behaviors,
      { parentContext },
    );

    // 2. 计算 α 系数
    const alpha = this.alphaCalculator.calculate(stats);

    // 3. 插入或更新数据库
    const { data, error } = await this.supabase
      .from("classification_folder_profiles_v5")
      .upsert({
        user_id: userId,
        folder_id: folderId,
        content_embedding: vectors.contentEmbedding,
        behavior_embedding: vectors.behaviorEmbedding,
        alpha_coefficient: alpha,
        bookmark_count: bookmarks.length,
        needs_update: false,
        last_updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new FolderProfilerError(
        `Failed to upsert profile: ${error.message}`,
        error,
      );
    }

    return this.mapToProfile(data);
  }

  /**
   * v5.1: 获取父文件夹上下文
   *
   * 安全增强：参数验证 + user_id 二次验证
   */
  private async getParentContext(
    userId: string,
    parentId: number,
  ): Promise<ParentContext | undefined> {
    // 1. 参数验证
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      this.logger.warn("getParentContext 参数无效: userId 为空", {
        userId,
        parentId,
      });
      return undefined;
    }

    if (
      typeof parentId !== "number" ||
      parentId <= 0 ||
      !Number.isInteger(parentId)
    ) {
      this.logger.warn("getParentContext 参数无效: parentId 不合法", {
        userId,
        parentId,
      });
      return undefined;
    }

    try {
      // 2. 查询父文件夹名称（同时获取 user_id 用于二次验证）
      const { data: parentFolder, error: folderError } = await this.supabase
        .from("folders")
        .select("name, user_id")
        .eq("id", parentId)
        .eq("user_id", userId)
        .single();

      if (folderError || !parentFolder) {
        this.logger.debug("父文件夹不存在或无权访问", {
          parentId,
          error: folderError?.message,
        });
        return undefined;
      }

      // 3. 二次验证 user_id（应用层安全检查，防止 RLS 绕过）
      if (parentFolder.user_id !== userId) {
        this.logger.error(
          "用户ID不匹配，可能存在越权访问",
          new Error("User ID mismatch - potential unauthorized access"),
          {
            requestedUserId: userId,
            actualUserId: parentFolder.user_id,
            parentId,
          },
        );
        return undefined;
      }

      // 4. 查询父文件夹画像（如果存在）
      const parentProfile = await this.getProfile(userId, String(parentId));

      if (parentProfile) {
        // 父文件夹有画像，返回名称和融合后的向量
        return {
          name: parentFolder.name,
          embedding: this.combineVectors(
            parentProfile.contentEmbedding,
            parentProfile.behaviorEmbedding,
            parentProfile.alphaCoefficient,
          ),
        };
      }

      // 父文件夹没有画像，只返回名称（用于 LLM 上下文）
      return { name: parentFolder.name };
    } catch (error) {
      this.logger.error(
        "getParentContext 异常",
        error instanceof Error ? error : new Error(String(error)),
        { userId, parentId },
      );
      return undefined;
    }
  }

  /**
   * v5.1: 融合内容向量和行为向量
   *
   * 公式: combined = α * content + (1-α) * behavior
   */
  private combineVectors(
    contentEmbedding: number[],
    behaviorEmbedding: number[],
    alpha: number,
  ): number[] {
    const dimension = contentEmbedding.length;
    const result = new Array(dimension);

    for (let i = 0; i < dimension; i++) {
      result[i] =
        alpha * contentEmbedding[i] + (1 - alpha) * behaviorEmbedding[i];
    }

    return result;
  }

  /**
   * 检查是否需要更新画像
   */
  async checkNeedsUpdate(
    userId: string,
    folderId: string,
    currentBookmarkCount: number,
  ): Promise<boolean> {
    const profile = await this.getProfile(userId, folderId);
    if (!profile) {
      return true; // 画像不存在，需要创建
    }

    const trigger = this.lazyUpdater.shouldUpdate(
      profile,
      currentBookmarkCount,
    );
    return trigger.shouldUpdate;
  }

  /**
   * 映射数据库记录到 FolderProfile
   */
  private mapToProfile(data: FolderProfileDbRecord): FolderProfile {
    return {
      id: data.id,
      userId: data.user_id,
      folderId: data.folder_id,
      contentEmbedding: data.content_embedding,
      behaviorEmbedding: data.behavior_embedding,
      alphaCoefficient: data.alpha_coefficient,
      lastUpdatedAt: new Date(data.last_updated_at),
      bookmarkCount: data.bookmark_count,
      needsUpdate: data.needs_update,
      avgClassificationScore: data.avg_classification_score,
      totalClassifications: data.total_classifications,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
