/**
 * 智能分类 v5.0 - FolderProfiler Service
 *
 * 文件夹画像管理服务（整合所有组件）
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggerService } from "../shared/logger";
import type { EmbeddingService } from "../shared/embedding";
import { AlphaCalculator } from "./alpha-calculator";
import { LazyUpdater } from "./lazy-updater";
import {
  DualSourceBuilder,
  type BookmarkData,
  type BehaviorData,
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
  private embeddingService: EmbeddingService;
  private alphaCalculator: AlphaCalculator;
  private lazyUpdater: LazyUpdater;
  private dualSourceBuilder: DualSourceBuilder;
  private config: FolderProfilerConfig;

  constructor(
    logger: LoggerService,
    supabase: SupabaseClient,
    embeddingService: EmbeddingService,
    config?: Partial<FolderProfilerConfig>,
  ) {
    this.logger = logger.child({ service: "FolderProfilerService" });
    this.supabase = supabase;
    this.embeddingService = embeddingService;

    this.config = {
      timeThresholdDays: config?.timeThresholdDays ?? 7,
      newBookmarksThreshold: config?.newBookmarksThreshold ?? 10,
      accuracyThreshold: config?.accuracyThreshold ?? 0.85,
      alphaRange: config?.alphaRange ?? { min: 0.2, max: 0.8 },
    };

    // 初始化组件
    this.alphaCalculator = new AlphaCalculator(logger);
    this.lazyUpdater = new LazyUpdater(logger, {
      timeThresholdDays: this.config.timeThresholdDays,
      newBookmarksThreshold: this.config.newBookmarksThreshold,
      accuracyThreshold: this.config.accuracyThreshold,
    });
    this.dualSourceBuilder = new DualSourceBuilder(logger, embeddingService);
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
      if (error.code === "PGRST116") {
        // 未找到记录
        return null;
      }
      throw new FolderProfilerError(
        `Failed to get profile: ${error.message}`,
        error,
      );
    }

    return this.mapToProfile(data);
  }

  /**
   * 创建或更新文件夹画像
   */
  async upsertProfile(
    userId: string,
    folderId: string,
    folderName: string,
    folderDescription: string | undefined,
    bookmarks: BookmarkData[],
    behaviors: BehaviorData[],
    stats: FolderStats,
  ): Promise<FolderProfile> {
    this.logger.info("创建/更新文件夹画像", {
      userId,
      folderId,
      folderName,
      bookmarkCount: bookmarks.length,
      behaviorCount: behaviors.length,
    });

    // 1. 构建双源向量(基于生命周期阶段)
    const vectors = await this.dualSourceBuilder.build(
      folderId,
      folderName,
      folderDescription,
      bookmarks,
      behaviors,
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
