/**
 * V3.0 增量画像更新服务
 *
 * 核心概念：在书签操作时增量更新文件夹画像，避免全量重算带来的性能开销
 *
 * 触发场景：
 * 1. 书签创建/导入时 -> 更新目标文件夹画像
 * 2. 书签移动时 -> 更新源和目标文件夹画像
 * 3. 书签删除时 -> 更新原所属文件夹画像
 * 4. 书签标签变更时 -> 更新所属文件夹画像
 *
 * 优化策略：
 * - 批量操作合并（debounce 500ms）
 * - 增量计算而非全量重算
 * - 后台异步执行，不阻塞主流程
 *
 * @module folder/organization/services/incremental-profile
 * @version 1.0.0
 * @since 2026-03-11 - Migrated from classification-v1
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TypedSupabaseClient } from "@/types/supabase";
import { logger } from "@/lib/logger";
import { getCurrentEmbeddingVersion } from "@/lib/utils/embedding-generator";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 书签变更事件
 */
export interface BookmarkChangeEvent {
  type: "create" | "move" | "delete" | "update_tags";
  bookmarkId: number;
  userId: string;
  fromFolderId?: number | null;
  toFolderId?: number | null;
  tags?: string[];
  embedding?: number[];
  /** 作者/来源标识（source_name 优先，fallback author） */
  authorKey?: string;
}

/**
 * 画像更新结果
 */
export interface ProfileUpdateResult {
  success: boolean;
  folderId: number;
  updatedAt: Date;
  changes?: {
    bookmarkCountDelta: number;
    tagsAdded: string[];
    tagsRemoved: string[];
  };
}

/**
 * 增量更新配置
 */
export interface IncrementalProfileConfig {
  /** 批量合并延迟（毫秒） */
  debounceMs: number;

  /** 是否启用增量更新 */
  enabled: boolean;

  /** 最大批量大小 */
  maxBatchSize: number;

  /** 标签频率最小阈值（低于此值的标签被移除） */
  minTagFrequency: number;

  /** Top N 标签数量 */
  topTagsCount: number;
}

const DEFAULT_CONFIG: IncrementalProfileConfig = {
  debounceMs: 500,
  enabled: true,
  maxBatchSize: 50,
  minTagFrequency: 1,
  topTagsCount: 10,
};

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 增量画像更新服务
 */
export class IncrementalProfileService {
  private supabase: TypedSupabaseClient;
  private config: IncrementalProfileConfig;

  // 待处理的更新队列（按 folderId 分组）
  private pendingUpdates: Map<number, BookmarkChangeEvent[]> = new Map();
  private updateTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<IncrementalProfileConfig>,
  ) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 处理书签变更事件
   */
  async handleBookmarkChange(event: BookmarkChangeEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    logger.debug(
      {
        action: "incremental_profile_event",
        eventType: event.type,
        bookmarkId: event.bookmarkId,
        fromFolderId: event.fromFolderId,
        toFolderId: event.toFolderId,
      },
      "IncrementalProfileService: Received event",
    );

    // 根据事件类型确定需要更新的文件夹
    const foldersToUpdate: number[] = [];

    switch (event.type) {
      case "create":
        if (event.toFolderId) {
          foldersToUpdate.push(event.toFolderId);
        }
        break;

      case "move":
        if (event.fromFolderId) {
          foldersToUpdate.push(event.fromFolderId);
        }
        if (event.toFolderId) {
          foldersToUpdate.push(event.toFolderId);
        }
        break;

      case "delete":
        if (event.fromFolderId) {
          foldersToUpdate.push(event.fromFolderId);
        }
        break;

      case "update_tags":
        if (event.toFolderId) {
          foldersToUpdate.push(event.toFolderId);
        }
        break;
    }

    // 将事件加入待处理队列
    for (const folderId of foldersToUpdate) {
      this.queueUpdate(folderId, event);
    }
  }

  /**
   * 将更新加入队列（带 debounce）
   */
  private queueUpdate(folderId: number, event: BookmarkChangeEvent): void {
    // 获取或创建该文件夹的事件队列
    const events = this.pendingUpdates.get(folderId) || [];
    events.push(event);
    this.pendingUpdates.set(folderId, events);

    // 清除之前的定时器
    const existingTimer = this.updateTimers.get(folderId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置新的定时器
    const timer = setTimeout(() => {
      this.flushUpdates(folderId);
    }, this.config.debounceMs);

    this.updateTimers.set(folderId, timer);
  }

  /**
   * 执行待处理的更新
   */
  private async flushUpdates(folderId: number): Promise<void> {
    const events = this.pendingUpdates.get(folderId);
    if (!events || events.length === 0) {
      return;
    }

    // 清空队列
    this.pendingUpdates.delete(folderId);
    this.updateTimers.delete(folderId);

    try {
      // 执行增量更新
      await this.performIncrementalUpdate(folderId, events);

      logger.info(
        {
          action: "incremental_profile_updated",
          folderId,
          eventCount: events.length,
        },
        "IncrementalProfileService: Profile updated",
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          folderId,
          eventCount: events.length,
        },
        "IncrementalProfileService: Update failed",
      );

      // 失败时回退到全量更新
      await this.fallbackToFullUpdate(folderId);
    }
  }

  /**
   * 执行增量更新
   */
  private async performIncrementalUpdate(
    folderId: number,
    events: BookmarkChangeEvent[],
  ): Promise<ProfileUpdateResult> {
    // 1. 获取当前画像
    const { data: currentProfile } = await this.supabase
      .from("folder_profiles")
      .select("*")
      .eq("folder_id", folderId)
      .single();

    if (!currentProfile) {
      // 如果画像不存在，执行全量更新
      return this.fallbackToFullUpdate(folderId);
    }

    // 2. 分析事件，计算增量变化
    let bookmarkCountDelta = 0;
    const tagsToAdd: string[] = [];
    const embeddingsToAdd: number[][] = [];
    const authorsToAdd: string[] = [];
    let needsAuthorFullRecompute = false;

    for (const event of events) {
      switch (event.type) {
        case "create":
          if (event.toFolderId === folderId) {
            bookmarkCountDelta += 1;
            if (event.tags) {
              tagsToAdd.push(...event.tags);
            }
            if (event.embedding) {
              embeddingsToAdd.push(event.embedding);
            }
            if (event.authorKey) {
              authorsToAdd.push(event.authorKey);
            }
          }
          break;

        case "move":
          if (event.toFolderId === folderId) {
            bookmarkCountDelta += 1;
            if (event.tags) {
              tagsToAdd.push(...event.tags);
            }
            if (event.embedding) {
              embeddingsToAdd.push(event.embedding);
            }
            if (event.authorKey) {
              authorsToAdd.push(event.authorKey);
            }
          }
          if (event.fromFolderId === folderId) {
            bookmarkCountDelta -= 1;
            // 删减操作需要全量重算 author 统计
            needsAuthorFullRecompute = true;
          }
          break;

        case "delete":
          if (event.fromFolderId === folderId) {
            bookmarkCountDelta -= 1;
            // 删减操作需要全量重算 author 统计
            needsAuthorFullRecompute = true;
          }
          break;

        case "update_tags":
          if (event.tags && event.toFolderId === folderId) {
            tagsToAdd.push(...event.tags);
          }
          break;
      }
    }

    // 3. 更新标签统计
    const currentTopTags = (currentProfile.top_tags as string[]) || [];
    const newTopTags = this.mergeAndRankTags(currentTopTags, tagsToAdd);

    // 4. 增量更新 embedding（加权平均）
    let newEmbedding = currentProfile.profile_embedding as number[] | null;
    if (embeddingsToAdd.length > 0 && newEmbedding) {
      newEmbedding = this.mergeEmbeddings(
        newEmbedding,
        currentProfile.bookmark_count as number,
        embeddingsToAdd,
      );
    }

    // 5. 计算新书签数量（top_authors 增量更新需要此值）
    const newBookmarkCount = Math.max(
      0,
      (currentProfile.bookmark_count as number) + bookmarkCountDelta,
    );

    // 6. 增量更新 top_authors（使用 type assertion：top_authors 为新增列，尚未同步到生成类型）
    type AuthorEntry = { name: string; count: number; ratio: number };
    const currentAuthors = (
      currentProfile as unknown as { top_authors: AuthorEntry[] | null }
    ).top_authors;
    let newTopAuthors: AuthorEntry[] | null = currentAuthors;

    if (needsAuthorFullRecompute) {
      // 删减操作 → 通过 RPC 全量重算 author 统计（新增 RPC，尚未同步到生成类型）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.supabase.rpc as any)("recompute_folder_top_authors", {
        p_folder_id: folderId,
      });
      // RPC 已直接更新 DB，读回最新值
      type TopAuthorsRow = { top_authors: AuthorEntry[] | null };
      const { data: rawRefreshed } = await this.supabase
        .from("folder_profiles")
        .select("top_authors" as "id")
        .eq("folder_id", folderId)
        .single();
      const refreshed = rawRefreshed as unknown as TopAuthorsRow | null;
      newTopAuthors = refreshed?.top_authors ?? null;
    } else if (authorsToAdd.length > 0) {
      newTopAuthors = this.mergeAuthors(
        newTopAuthors ?? [],
        authorsToAdd,
        newBookmarkCount,
      );
    }

    // 7. 更新画像

    // V4.2.7: 添加 embedding 版本追踪
    const updatePayload: Record<string, unknown> = {
      bookmark_count: newBookmarkCount,
      top_tags: newTopTags,
      top_authors: newTopAuthors ?? [],
      profile_embedding: newEmbedding
        ? (JSON.stringify(newEmbedding) as unknown as string)
        : null,
      // V4.2.7: 更新 embedding 版本（如果 embedding 有变化）
      ...(embeddingsToAdd.length > 0 && newEmbedding
        ? { profile_embedding_version: getCurrentEmbeddingVersion() }
        : {}),
      last_bookmark_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await this.supabase
      .from("folder_profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updatePayload as any)
      .eq("folder_id", folderId);

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    return {
      success: true,
      folderId,
      updatedAt: new Date(),
      changes: {
        bookmarkCountDelta,
        tagsAdded: tagsToAdd,
        tagsRemoved: [],
      },
    };
  }

  /**
   * 合并并排序标签
   */
  private mergeAndRankTags(
    existingTags: string[],
    newTags: string[],
  ): string[] {
    // 统计所有标签的频率
    const tagFrequency = new Map<string, number>();

    // 现有标签初始权重
    for (let i = 0; i < existingTags.length; i++) {
      const tag = existingTags[i].toLowerCase();
      // 权重随位置递减
      tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + (10 - i * 0.5));
    }

    // 新标签增加频率
    for (const tag of newTags) {
      const normalizedTag = tag.toLowerCase();
      tagFrequency.set(
        normalizedTag,
        (tagFrequency.get(normalizedTag) || 0) + 1,
      );
    }

    // 排序并取 Top N
    const sortedTags = Array.from(tagFrequency.entries())
      .filter(([, freq]) => freq >= this.config.minTagFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.topTagsCount)
      .map(([tag]) => tag);

    return sortedTags;
  }

  /**
   * 合并 embeddings（加权平均）
   */
  private mergeEmbeddings(
    currentEmbedding: number[],
    currentCount: number,
    newEmbeddings: number[][],
  ): number[] {
    if (newEmbeddings.length === 0) {
      return currentEmbedding;
    }

    const dimension = currentEmbedding.length;
    const result = new Array(dimension).fill(0);

    // 计算新 embeddings 的平均
    const newAvg = new Array(dimension).fill(0);
    for (const emb of newEmbeddings) {
      for (let i = 0; i < dimension && i < emb.length; i++) {
        newAvg[i] += emb[i];
      }
    }
    for (let i = 0; i < dimension; i++) {
      newAvg[i] /= newEmbeddings.length;
    }

    // 加权合并
    const totalCount = currentCount + newEmbeddings.length;
    for (let i = 0; i < dimension; i++) {
      result[i] =
        (currentEmbedding[i] * currentCount +
          newAvg[i] * newEmbeddings.length) /
        totalCount;
    }

    return result;
  }

  /**
   * 增量合并作者统计
   *
   * 新增作者：已有则 count+1，否则追加条目。
   * 重算 ratio 并取 Top 10。
   */
  private mergeAuthors(
    existing: Array<{ name: string; count: number; ratio: number }>,
    newAuthors: string[],
    totalBookmarkCount: number,
  ): Array<{ name: string; count: number; ratio: number }> {
    // 构建 name → count 映射
    const authorMap = new Map<string, number>();
    for (const entry of existing) {
      authorMap.set(entry.name.toLowerCase().trim(), entry.count);
    }

    // 累加新作者
    for (const author of newAuthors) {
      const key = author.toLowerCase().trim();
      if (!key) continue;
      authorMap.set(key, (authorMap.get(key) ?? 0) + 1);
    }

    // 排序取 Top 10，重算 ratio
    const denominator = Math.max(totalBookmarkCount, 1);
    return Array.from(authorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        name,
        count,
        ratio: Math.round((count / denominator) * 10000) / 10000,
      }));
  }

  /**
   * 回退到全量更新
   */
  private async fallbackToFullUpdate(
    folderId: number,
  ): Promise<ProfileUpdateResult> {
    logger.info(
      { folderId, action: "fallback_full_update" },
      "IncrementalProfileService: Fallback to full update",
    );

    try {
      // 调用数据库函数执行全量计算
      const { error } = await this.supabase.rpc("compute_folder_profile", {
        p_folder_id: folderId,
      });

      if (error) {
        throw new Error(`Full update failed: ${error.message}`);
      }

      return {
        success: true,
        folderId,
        updatedAt: new Date(),
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          folderId,
        },
        "IncrementalProfileService: Full update also failed",
      );

      return {
        success: false,
        folderId,
        updatedAt: new Date(),
      };
    }
  }

  /**
   * 强制刷新所有待处理的更新
   */
  async flushAll(): Promise<void> {
    const folderIds = Array.from(this.pendingUpdates.keys());
    for (const folderId of folderIds) {
      await this.flushUpdates(folderId);
    }
  }

  /**
   * 批量处理书签变更
   */
  async handleBatchChanges(events: BookmarkChangeEvent[]): Promise<void> {
    // 按文件夹分组
    const byFolder = new Map<number, BookmarkChangeEvent[]>();

    for (const event of events) {
      if (event.toFolderId) {
        const existing = byFolder.get(event.toFolderId) || [];
        existing.push(event);
        byFolder.set(event.toFolderId, existing);
      }
      if (event.fromFolderId && event.fromFolderId !== event.toFolderId) {
        const existing = byFolder.get(event.fromFolderId) || [];
        existing.push(event);
        byFolder.set(event.fromFolderId, existing);
      }
    }

    // 并行更新所有受影响的文件夹
    const updatePromises = Array.from(byFolder.entries()).map(
      ([folderId, folderEvents]) =>
        this.performIncrementalUpdate(folderId, folderEvents),
    );

    await Promise.allSettled(updatePromises);
  }

  /**
   * 初始化文件夹画像（新创建文件夹时）
   */
  async initializeProfile(
    folderId: number,
    userId: string,
    initialBookmark?: {
      tags?: string[];
      embedding?: number[];
    },
  ): Promise<void> {
    try {
      // 检查是否已存在
      const { data: existing } = await this.supabase
        .from("folder_profiles")
        .select("id")
        .eq("folder_id", folderId)
        .single();

      if (existing) {
        logger.debug(
          { folderId },
          "IncrementalProfileService: Profile already exists",
        );
        return;
      }

      // 获取文件夹名称
      const { data: folder } = await this.supabase
        .from("folders")
        .select("name")
        .eq("id", folderId)
        .single();

      // 创建初始画像
      // V4.2.7: 添加 embedding 版本追踪
      const { error } = await this.supabase.from("folder_profiles").insert({
        user_id: userId,
        folder_id: folderId,
        folder_name: folder?.name || `文件夹 ${folderId}`,
        bookmark_count: initialBookmark ? 1 : 0,
        top_tags: initialBookmark?.tags || [],
        profile_embedding: initialBookmark?.embedding
          ? (JSON.stringify(initialBookmark.embedding) as unknown as string)
          : null,
        // V4.2.7: 保存 embedding 版本
        profile_embedding_version: initialBookmark?.embedding
          ? getCurrentEmbeddingVersion()
          : null,
        sample_titles: [],
        source: "incremental",
        computed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw new Error(`Failed to initialize profile: ${error.message}`);
      }

      logger.info(
        { folderId, userId },
        "IncrementalProfileService: Profile initialized",
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          folderId,
        },
        "IncrementalProfileService: Failed to initialize profile",
      );
    }
  }
}

/**
 * 创建增量画像更新服务
 */
export function createIncrementalProfileService(
  supabase: SupabaseClient<Database>,
  config?: Partial<IncrementalProfileConfig>,
): IncrementalProfileService {
  return new IncrementalProfileService(supabase, config);
}
