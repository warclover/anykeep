/**
 * Negative Sample Service
 * V4.2 负样本学习服务
 *
 * @description 管理文件夹排除规则（负样本）
 * - 记录用户移出操作
 * - 记录用户拒绝建议
 * - 批量学习排除模式
 * - 负样本查询与匹配
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { BaseSupabaseService } from "@/lib/classification/services/base-supabase.service";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 排除类型
 */
export type ExclusionType = "tag" | "source" | "embedding" | "keyword";

/**
 * 创建来源
 */
export type CreatedFrom =
  | "user_move"
  | "user_reject"
  | "bulk_move"
  | "auto_learn";

/**
 * 文件夹排除规则记录
 */
export interface FolderExclusionRecord {
  id: number;
  user_id: string;
  folder_id: number;
  exclusion_type: ExclusionType;
  excluded_tag: string | null;
  excluded_source_id: string | null;
  excluded_keyword: string | null;
  excluded_embedding: number[] | null;
  weight: number;
  created_from: CreatedFrom;
  original_bookmark_id: number | null;
  expires_at: string | null;
  created_at: string;
}

/**
 * 创建排除规则输入
 */
export interface CreateExclusionInput {
  userId: string;
  folderId: number;
  exclusionType: ExclusionType;
  excludedValue: string | number[];
  weight?: number;
  createdFrom: CreatedFrom;
  originalBookmarkId?: number;
  expiresInDays?: number;
}

/**
 * 批量创建排除规则输入
 */
export interface BatchCreateExclusionInput {
  userId: string;
  folderId: number;
  exclusions: Array<{
    type: ExclusionType;
    value: string | number[];
    weight?: number;
  }>;
  createdFrom: CreatedFrom;
  originalBookmarkId?: number;
}

/**
 * 查询过滤条件
 */
export interface ExclusionQueryFilters {
  folderId?: number;
  exclusionType?: ExclusionType;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 负样本匹配结果
 */
export interface NegativeSampleMatch {
  folderId: number;
  matchType: ExclusionType;
  matchedValue: string;
  weight: number;
  penalty: number;
}

/**
 * 学习事件输入
 */
export interface LearnFromMoveInput {
  userId: string;
  bookmarkId: number;
  sourceFolderId: number;
  targetFolderId: number;
  bookmarkTags?: string[];
  bookmarkSourceId?: string;
  bookmarkEmbedding?: number[];
}

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 负样本学习服务
 */
class NegativeSampleService extends BaseSupabaseService {
  private readonly TABLE_NAME = "folder_exclusions";
  private readonly DEFAULT_EXPIRATION_DAYS = 90; // 默认 90 天过期
  private readonly DEFAULT_WEIGHT = 0.5;

  // ============================================================================
  // 创建操作
  // ============================================================================

  /**
   * 创建单条排除规则
   */
  async createExclusion(
    input: CreateExclusionInput,
  ): Promise<FolderExclusionRecord | null> {
    const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

    const expiresAt = input.expiresInDays
      ? new Date(
          Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;

    const insertData: Database["public"]["Tables"]["folder_exclusions"]["Insert"] =
      {
        user_id: input.userId,
        folder_id: input.folderId,
        exclusion_type: input.exclusionType,
        weight: input.weight ?? this.DEFAULT_WEIGHT,
        created_from: input.createdFrom,
        original_bookmark_id: input.originalBookmarkId || null,
        expires_at: expiresAt,
      };

    // 根据类型设置排除值
    switch (input.exclusionType) {
      case "tag":
        insertData.excluded_tag = input.excludedValue as string;
        break;
      case "source":
        insertData.excluded_source_id = input.excludedValue as string;
        break;
      case "keyword":
        insertData.excluded_keyword = input.excludedValue as string;
        break;
      case "embedding":
        // Database type expects string | number[] | null for excluded_embedding
        // But pgvector usually works with string or number[] in insert, though generated types might say string
        // We'll cast to any if needed or stick to the type.
        // generated type says: excluded_embedding: string | number[] | null;
        insertData.excluded_embedding = input.excludedValue as number[];
        break;
    }

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .upsert(insertData, {
        onConflict: this.getUniqueConstraintName(input.exclusionType),
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      // 忽略唯一约束冲突
      if (error.code === "23505") {
        logger.debug({ input }, "Exclusion already exists");
        return null;
      }
      logger.error({ error, input }, "Failed to create exclusion");
      throw new Error(`Failed to create exclusion: ${error.message}`);
    }

    return data;
  }

  /**
   * 批量创建排除规则
   */
  async createBatchExclusions(
    input: BatchCreateExclusionInput,
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const exclusion of input.exclusions) {
      try {
        const result = await this.createExclusion({
          userId: input.userId,
          folderId: input.folderId,
          exclusionType: exclusion.type,
          excludedValue: exclusion.value,
          weight: exclusion.weight,
          createdFrom: input.createdFrom,
          originalBookmarkId: input.originalBookmarkId,
          expiresInDays: this.DEFAULT_EXPIRATION_DAYS,
        });

        if (result) {
          created++;
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }

    return { created, skipped };
  }

  // ============================================================================
  // 查询操作
  // ============================================================================

  /**
   * 获取用户的所有排除规则
   */
  async getUserExclusions(
    userId: string,
    filters?: ExclusionQueryFilters,
  ): Promise<FolderExclusionRecord[]> {
    const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

    let query = supabase
      .from(this.TABLE_NAME)
      .select("*")
      .eq("user_id", userId);

    if (filters?.folderId) {
      query = query.eq("folder_id", filters.folderId);
    }

    if (filters?.exclusionType) {
      query = query.eq("exclusion_type", filters.exclusionType);
    }

    if (!filters?.includeExpired) {
      query = query.or(
        "expires_at.is.null,expires_at.gt." + new Date().toISOString(),
      );
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 50) - 1,
      );
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      logger.error({ error, userId, filters }, "Failed to query exclusions");
      throw new Error(`Failed to query exclusions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 获取文件夹的排除规则
   */
  async getFolderExclusions(
    userId: string,
    folderId: number,
  ): Promise<FolderExclusionRecord[]> {
    return this.getUserExclusions(userId, { folderId });
  }

  /**
   * 获取指定标签的排除规则
   */
  async getTagExclusions(
    userId: string,
    tags: string[],
  ): Promise<Map<number, NegativeSampleMatch[]>> {
    const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select("folder_id, excluded_tag, weight")
      .eq("user_id", userId)
      .eq("exclusion_type", "tag")
      .in("excluded_tag", tags)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());

    if (error) {
      logger.error({ error, userId, tags }, "Failed to query tag exclusions");
      throw new Error(`Failed to query tag exclusions: ${error.message}`);
    }

    // 按文件夹分组
    const result = new Map<number, NegativeSampleMatch[]>();
    for (const row of data || []) {
      const matches = result.get(row.folder_id) || [];
      matches.push({
        folderId: row.folder_id,
        matchType: "tag",
        matchedValue: row.excluded_tag,
        weight: row.weight,
        penalty: row.weight * 0.3, // 标签排除惩罚 30%
      });
      result.set(row.folder_id, matches);
    }

    return result;
  }

  /**
   * 获取指定来源的排除规则
   */
  async getSourceExclusions(
    userId: string,
    sourceId: string,
  ): Promise<Map<number, NegativeSampleMatch[]>> {
    const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select("folder_id, excluded_source_id, weight")
      .eq("user_id", userId)
      .eq("exclusion_type", "source")
      .eq("excluded_source_id", sourceId)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());

    if (error) {
      logger.error(
        { error, userId, sourceId },
        "Failed to query source exclusions",
      );
      throw new Error(`Failed to query source exclusions: ${error.message}`);
    }

    // 按文件夹分组
    const result = new Map<number, NegativeSampleMatch[]>();
    for (const row of data || []) {
      const matches = result.get(row.folder_id) || [];
      matches.push({
        folderId: row.folder_id,
        matchType: "source",
        matchedValue: row.excluded_source_id,
        weight: row.weight,
        penalty: row.weight * 0.4, // 来源排除惩罚 40%
      });
      result.set(row.folder_id, matches);
    }

    return result;
  }

  // ============================================================================
  // 学习操作
  // ============================================================================

  /**
   * 从用户移动操作中学习
   */
  async learnFromMove(input: LearnFromMoveInput): Promise<{
    exclusionsCreated: number;
    details: string[];
  }> {
    const details: string[] = [];
    let exclusionsCreated = 0;

    // 1. 记录标签排除
    if (input.bookmarkTags && input.bookmarkTags.length > 0) {
      const { created } = await this.createBatchExclusions({
        userId: input.userId,
        folderId: input.sourceFolderId,
        exclusions: input.bookmarkTags.map((tag) => ({
          type: "tag" as ExclusionType,
          value: tag,
          weight: 0.3, // 初始权重较低
        })),
        createdFrom: "user_move",
        originalBookmarkId: input.bookmarkId,
      });
      exclusionsCreated += created;
      if (created > 0) {
        details.push(`Created ${created} tag exclusions`);
      }
    }

    // 2. 记录来源排除
    if (input.bookmarkSourceId) {
      try {
        const result = await this.createExclusion({
          userId: input.userId,
          folderId: input.sourceFolderId,
          exclusionType: "source",
          excludedValue: input.bookmarkSourceId,
          weight: 0.4,
          createdFrom: "user_move",
          originalBookmarkId: input.bookmarkId,
          expiresInDays: this.DEFAULT_EXPIRATION_DAYS,
        });
        if (result) {
          exclusionsCreated++;
          details.push("Created source exclusion");
        }
      } catch {
        // 忽略错误
      }
    }

    // 3. 记录向量排除（可选，消耗较大）
    // 暂时不实现向量排除，因为存储和匹配成本较高

    logger.info(
      {
        userId: input.userId,
        bookmarkId: input.bookmarkId,
        sourceFolderId: input.sourceFolderId,
        exclusionsCreated,
      },
      "Learned from user move",
    );

    return { exclusionsCreated, details };
  }

  /**
   * 从用户拒绝建议中学习
   */
  async learnFromRejection(input: {
    userId: string;
    bookmarkId: number;
    rejectedFolderId: number;
    bookmarkTags?: string[];
    bookmarkSourceId?: string;
  }): Promise<{ exclusionsCreated: number }> {
    let exclusionsCreated = 0;

    // 拒绝建议时，权重较高
    const weight = 0.6;

    // 1. 记录标签排除
    if (input.bookmarkTags && input.bookmarkTags.length > 0) {
      const { created } = await this.createBatchExclusions({
        userId: input.userId,
        folderId: input.rejectedFolderId,
        exclusions: input.bookmarkTags.map((tag) => ({
          type: "tag" as ExclusionType,
          value: tag,
          weight,
        })),
        createdFrom: "user_reject",
        originalBookmarkId: input.bookmarkId,
      });
      exclusionsCreated += created;
    }

    // 2. 记录来源排除
    if (input.bookmarkSourceId) {
      try {
        const result = await this.createExclusion({
          userId: input.userId,
          folderId: input.rejectedFolderId,
          exclusionType: "source",
          excludedValue: input.bookmarkSourceId,
          weight,
          createdFrom: "user_reject",
          originalBookmarkId: input.bookmarkId,
          expiresInDays: this.DEFAULT_EXPIRATION_DAYS,
        });
        if (result) {
          exclusionsCreated++;
        }
      } catch {
        // 忽略错误
      }
    }

    logger.info(
      {
        userId: input.userId,
        bookmarkId: input.bookmarkId,
        rejectedFolderId: input.rejectedFolderId,
        exclusionsCreated,
      },
      "Learned from rejection",
    );

    return { exclusionsCreated };
  }

  // ============================================================================
  // 更新与删除
  // ============================================================================

  /**
   * 更新排除规则权重
   */
  async updateWeight(id: number, weight: number): Promise<void> {
    const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

    const { error } = await supabase
      .from(this.TABLE_NAME)
      .update({ weight })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to update weight: ${error.message}`);
    }
  }

  /**
   * 删除排除规则
   */
  async deleteExclusion(id: number): Promise<void> {
    const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

    const { error } = await supabase
      .from(this.TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete exclusion: ${error.message}`);
    }
  }

  /**
   * 清理过期规则
   */
  async cleanupExpired(): Promise<number> {
    const supabase = (await this.getSupabase()) as SupabaseClient<Database>;

    const { data, error } = await supabase.rpc(
      "cleanup_expired_folder_exclusions",
    );

    if (error) {
      logger.error({ error }, "Failed to cleanup expired exclusions");
      return 0;
    }

    return data || 0;
  }

  // ============================================================================
  // 统计
  // ============================================================================

  /**
   * 获取用户排除规则统计
   */
  async getUserStats(userId: string): Promise<{
    total: number;
    byType: Record<ExclusionType, number>;
    byFolder: Record<number, number>;
  }> {
    const exclusions = await this.getUserExclusions(userId);

    const byType: Record<ExclusionType, number> = {
      tag: 0,
      source: 0,
      embedding: 0,
      keyword: 0,
    };

    const byFolder: Record<number, number> = {};

    for (const exclusion of exclusions) {
      byType[exclusion.exclusion_type]++;
      byFolder[exclusion.folder_id] = (byFolder[exclusion.folder_id] || 0) + 1;
    }

    return {
      total: exclusions.length,
      byType,
      byFolder,
    };
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 获取唯一约束名称
   */
  private getUniqueConstraintName(type: ExclusionType): string {
    switch (type) {
      case "tag":
        return "idx_folder_exclusions_unique_tag";
      case "source":
        return "idx_folder_exclusions_unique_source";
      case "keyword":
        return "idx_folder_exclusions_unique_keyword";
      default:
        return "";
    }
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const negativeSampleService = new NegativeSampleService();
