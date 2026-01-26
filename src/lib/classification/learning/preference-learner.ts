/**
 * Preference Learner Service
 * V4.2 用户偏好学习服务
 *
 * @description 从用户行为中学习分类偏好
 * - 确认/拒绝行为分析
 * - 文件夹使用模式学习
 * - 时间段偏好学习
 * - 来源-分类关联学习
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import { sourceProfileService } from "@/lib/source-profile/source-profile.service";
import { fastPathCacheManager } from "@/lib/classification/router/cache-manager";
import { LEARNING_LIMITS } from "@/lib/trust-mode/config";
// Json 类型保留用于未来扩展

/**
 * 内部负样本记录（简化版，用于内存缓存）
 */
interface InternalNegativeSample {
  url: string;
  sourceId: string;
  rejectedFolderId: number;
  correctedFolderId?: number;
  rejectionReason: string;
  timestamp: Date;
}

/**
 * 内部排除规则（简化版，用于内存缓存）
 */
interface InternalFolderExclusion {
  folderId: number;
  excludedTags: string[];
  excludedSources: string[];
}

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 学习事件类型
 */
export type LearningEventType =
  | "classification_confirmed"
  | "classification_rejected"
  | "classification_modified"
  | "folder_created"
  | "folder_moved"
  | "bookmark_deleted";

/**
 * 学习事件
 */
export interface LearningEvent {
  userId: string;
  eventType: LearningEventType;
  bookmarkId?: number;
  url?: string;
  sourceId?: string;
  originalFolderId?: number;
  newFolderId?: number;
  confidence?: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 分类学习偏好
 *
 * 注意：此类型专用于分类学习系统
 * @see TaskUserPreferences in task-understanding/types - 任务理解层偏好
 * @see SkillExecutionPreferences in ai-skills/core/types - Skill 执行偏好
 */
export interface ClassificationPreferences {
  /** 用户 ID */
  userId: string;
  /** 文件夹偏好（按使用频率排序） */
  folderPreferences: FolderPreference[];
  /** 来源偏好 */
  sourcePreferences: SourcePreference[];
  /** 排除规则 */
  exclusions: InternalFolderExclusion[];
  /** 时间段偏好 */
  timePreferences: TimePreference[];
  /** 学习更新时间 */
  lastUpdated: Date;
}

/** @deprecated 使用 ClassificationPreferences 替代 */
export type UserPreferences = ClassificationPreferences;

/**
 * 文件夹偏好
 */
export interface FolderPreference {
  folderId: number;
  folderName: string;
  /** 使用频率 */
  usageFrequency: number;
  /** 最近使用 */
  lastUsed: Date;
  /** 关联标签 */
  associatedTags: string[];
  /** 关联来源 */
  associatedSources: string[];
}

/**
 * 来源偏好
 */
export interface SourcePreference {
  sourceId: string;
  sourceName: string;
  /** 偏好文件夹 ID */
  preferredFolderId: number;
  /** 样本数 */
  sampleCount: number;
  /** 确认率 */
  confirmationRate: number;
}

/**
 * 时间段偏好
 */
export interface TimePreference {
  /** 时间段（小时） */
  hour: number;
  /** 该时段最常用的文件夹 */
  topFolders: Array<{ folderId: number; count: number }>;
}

/**
 * 学习统计
 */
export interface LearningStats {
  /** 总学习事件数 */
  totalEvents: number;
  /** 确认数 */
  confirmations: number;
  /** 拒绝数 */
  rejections: number;
  /** 修改数 */
  modifications: number;
  /** 学习准确率 */
  accuracy: number;
  /** 最后学习时间 */
  lastLearningTime: Date | null;
}

// ============================================================================
// 偏好学习器
// ============================================================================

/**
 * 用户偏好学习器
 */
export class PreferenceLearner {
  // 负样本缓存（用户拒绝的分类）
  private negativeSamples: Map<string, InternalNegativeSample[]> = new Map();

  /**
   * 记录学习事件
   */
  async recordEvent(event: LearningEvent): Promise<void> {
    switch (event.eventType) {
      case "classification_confirmed":
        await this.handleConfirmation(event);
        break;
      case "classification_rejected":
        await this.handleRejection(event);
        break;
      case "classification_modified":
        await this.handleModification(event);
        break;
      case "folder_created":
        await this.handleFolderCreated(event);
        break;
      case "folder_moved":
        await this.handleFolderMoved(event);
        break;
      case "bookmark_deleted":
        await this.handleBookmarkDeleted(event);
        break;
    }

    // 失效缓存
    fastPathCacheManager.invalidateUser(event.userId);
  }

  /**
   * 获取用户偏好
   */
  async getUserPreferences(userId: string): Promise<ClassificationPreferences> {
    const supabase = await createClient();

    // 并行加载数据
    const [foldersData, bookmarksData, exclusionsData] = await Promise.all([
      // 获取文件夹使用统计
      supabase
        .from("folders")
        .select("id, name, updated_at")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(50),
      // 获取最近书签分类
      supabase
        .from("bookmarks")
        .select("folder_id, url, tags, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500) as unknown as Promise<{
        data: Array<{
          folder_id: number | null;
          url: string;
          tags: string[] | null;
          created_at: string;
        }> | null;
        error: unknown;
      }>,
      // 获取排除规则
      this.getExclusions(userId),
    ]);

    // 构建文件夹偏好
    const folderPreferences = await this.buildFolderPreferences(
      foldersData.data || [],
      bookmarksData.data || [],
    );

    // 构建来源偏好
    const sourcePreferences = await this.buildSourcePreferences(userId);

    // 构建时间偏好
    const timePreferences = this.buildTimePreferences(bookmarksData.data || []);

    return {
      userId,
      folderPreferences,
      sourcePreferences,
      exclusions: exclusionsData,
      timePreferences,
      lastUpdated: new Date(),
    };
  }

  /**
   * 获取学习统计
   */
  async getLearningStats(userId: string): Promise<LearningStats> {
    const supabase = await createClient();

    // 获取待确认记录统计
    const { data: confirmations } = await supabase
      .from("pending_confirmations")
      .select("status, updated_at")
      .eq("user_id", userId);

    const stats = {
      totalEvents: 0,
      confirmations: 0,
      rejections: 0,
      modifications: 0,
      accuracy: 0,
      lastLearningTime: null as Date | null,
    };

    if (confirmations) {
      for (const c of confirmations) {
        stats.totalEvents++;
        if (c.status === "confirmed") stats.confirmations++;
        if (c.status === "rejected") stats.rejections++;
        if (c.status === "modified") stats.modifications++;

        const updatedAt = new Date(c.updated_at);
        if (!stats.lastLearningTime || updatedAt > stats.lastLearningTime) {
          stats.lastLearningTime = updatedAt;
        }
      }

      // 计算准确率
      const total =
        stats.confirmations + stats.rejections + stats.modifications;
      if (total > 0) {
        stats.accuracy = (stats.confirmations / total) * 100;
      }
    }

    return stats;
  }

  /**
   * 检查是否应排除某文件夹
   */
  async shouldExcludeFolder(
    userId: string,
    folderId: number,
    sourceId?: string,
    tags?: string[],
  ): Promise<boolean> {
    const exclusions = await this.getExclusions(userId);

    for (const exclusion of exclusions) {
      if (exclusion.folderId !== folderId) continue;

      // 检查来源排除
      if (sourceId && exclusion.excludedSources?.includes(sourceId)) {
        return true;
      }

      // 检查标签排除
      if (tags && exclusion.excludedTags) {
        for (const tag of tags) {
          if (exclusion.excludedTags.includes(tag.toLowerCase())) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 添加排除规则
   */
  async addExclusion(
    userId: string,
    folderId: number,
    sourceId?: string,
    tag?: string,
  ): Promise<void> {
    const exclusions = await this.getExclusions(userId);
    let folderExclusion = exclusions.find((e) => e.folderId === folderId);

    if (!folderExclusion) {
      folderExclusion = {
        folderId,
        excludedTags: [],
        excludedSources: [],
      };
      exclusions.push(folderExclusion);
    }

    if (sourceId && !folderExclusion.excludedSources.includes(sourceId)) {
      folderExclusion.excludedSources = [
        ...folderExclusion.excludedSources,
        sourceId,
      ].slice(0, LEARNING_LIMITS.MAX_EXCLUDED_SOURCES);
    }

    if (tag && !folderExclusion.excludedTags.includes(tag.toLowerCase())) {
      folderExclusion.excludedTags = [
        ...folderExclusion.excludedTags,
        tag.toLowerCase(),
      ].slice(0, LEARNING_LIMITS.MAX_EXCLUDED_TAGS);
    }

    await this.saveExclusions(userId, exclusions);
  }

  // ============================================================================
  // 私有方法 - 事件处理
  // ============================================================================

  /**
   * 处理确认事件
   */
  private async handleConfirmation(event: LearningEvent): Promise<void> {
    const { userId, sourceId, newFolderId, confidence } = event;

    if (!sourceId || !newFolderId) return;

    // 更新来源画像
    await sourceProfileService.updateOnClassification({
      userId,
      sourceId,
      newFolderId,
      confidence,
    });

    // 增加可信度
    await sourceProfileService.updateTrustScore(userId, sourceId, 5);
  }

  /**
   * 处理拒绝事件
   */
  private async handleRejection(event: LearningEvent): Promise<void> {
    const { userId, sourceId, originalFolderId, url, metadata } = event;

    // 记录负样本
    const negativeSample: InternalNegativeSample = {
      url: url || "",
      sourceId: sourceId || "",
      rejectedFolderId: originalFolderId || 0,
      rejectionReason: (metadata?.reason as string) || "user_rejected",
      timestamp: event.timestamp,
    };

    const userSamples = this.negativeSamples.get(userId) || [];
    userSamples.push(negativeSample);
    this.negativeSamples.set(userId, userSamples.slice(-100)); // 保留最近 100 条

    // 降低来源可信度
    if (sourceId) {
      await sourceProfileService.updateTrustScore(userId, sourceId, -10);
    }

    // 检查是否需要创建排除规则
    if (originalFolderId && sourceId) {
      const rejectCount = userSamples.filter(
        (s) =>
          s.rejectedFolderId === originalFolderId && s.sourceId === sourceId,
      ).length;

      if (rejectCount >= LEARNING_LIMITS.MIN_SAMPLES_FOR_EXCLUSION) {
        await this.addExclusion(userId, originalFolderId, sourceId);
      }
    }
  }

  /**
   * 处理修改事件
   */
  private async handleModification(event: LearningEvent): Promise<void> {
    const { userId, sourceId, originalFolderId, newFolderId, confidence } =
      event;

    if (!sourceId || !newFolderId) return;

    // 更新来源画像到正确的文件夹
    await sourceProfileService.updateOnClassification({
      userId,
      sourceId,
      newFolderId,
      confidence,
    });

    // 如果有原始文件夹，记录这次修正
    if (originalFolderId && originalFolderId !== newFolderId) {
      // 可能需要记录负样本
      const negativeSample: InternalNegativeSample = {
        url: event.url || "",
        sourceId,
        rejectedFolderId: originalFolderId,
        correctedFolderId: newFolderId,
        rejectionReason: "user_corrected",
        timestamp: event.timestamp,
      };

      const userSamples = this.negativeSamples.get(userId) || [];
      userSamples.push(negativeSample);
      this.negativeSamples.set(userId, userSamples.slice(-100));
    }
  }

  /**
   * 处理文件夹创建事件
   */
  private async handleFolderCreated(_event: LearningEvent): Promise<void> {
    // 新文件夹创建时，可以记录来源和标签关联
    // 用于未来的智能推荐
  }

  /**
   * 处理文件夹移动事件
   */
  private async handleFolderMoved(event: LearningEvent): Promise<void> {
    const {
      userId,
      sourceId,
      originalFolderId: _originalFolderId,
      newFolderId,
    } = event;

    // 更新来源画像
    if (sourceId && newFolderId) {
      await sourceProfileService.updateOnClassification({
        userId,
        sourceId,
        newFolderId,
      });
    }
  }

  /**
   * 处理书签删除事件
   */
  private async handleBookmarkDeleted(_event: LearningEvent): Promise<void> {
    // 书签删除可能表明分类不当
    // 记录用于分析
  }

  // ============================================================================
  // 私有方法 - 偏好构建
  // ============================================================================

  /**
   * 构建文件夹偏好
   */
  private async buildFolderPreferences(
    folders: Array<{ id: number; name: string; updated_at: string | null }>,
    bookmarks: Array<{
      folder_id: number | null;
      url: string;
      tags: string[] | null;
      created_at: string;
    }>,
  ): Promise<FolderPreference[]> {
    // 统计每个文件夹的使用情况
    const folderStats = new Map<
      number,
      {
        count: number;
        lastUsed: Date;
        tags: Set<string>;
        sources: Set<string>;
      }
    >();

    for (const bookmark of bookmarks) {
      if (!bookmark.folder_id) continue;

      const stats = folderStats.get(bookmark.folder_id) || {
        count: 0,
        lastUsed: new Date(0),
        tags: new Set<string>(),
        sources: new Set<string>(),
      };

      stats.count++;

      const createdAt = new Date(bookmark.created_at);
      if (createdAt > stats.lastUsed) {
        stats.lastUsed = createdAt;
      }

      if (bookmark.tags) {
        for (const tag of bookmark.tags) {
          stats.tags.add(tag.toLowerCase());
        }
      }

      try {
        const domain = new URL(bookmark.url).hostname;
        stats.sources.add(domain);
      } catch {
        // Invalid URL
      }

      folderStats.set(bookmark.folder_id, stats);
    }

    // 构建偏好列表
    const preferences: FolderPreference[] = [];

    for (const folder of folders) {
      const stats = folderStats.get(folder.id);

      preferences.push({
        folderId: folder.id,
        folderName: folder.name,
        usageFrequency: stats?.count || 0,
        lastUsed:
          stats?.lastUsed ||
          (folder.updated_at ? new Date(folder.updated_at) : new Date()),
        associatedTags: stats ? [...stats.tags].slice(0, 20) : [],
        associatedSources: stats ? [...stats.sources].slice(0, 10) : [],
      });
    }

    // 按使用频率排序
    preferences.sort((a, b) => b.usageFrequency - a.usageFrequency);

    return preferences.slice(0, 30);
  }

  /**
   * 构建来源偏好
   */
  private async buildSourcePreferences(
    userId: string,
  ): Promise<SourcePreference[]> {
    const sourceProfiles = await sourceProfileService.findAllByUserId(userId);

    return sourceProfiles
      .filter((p) => p.sampleCount >= 3 && p.frequentFolders.length > 0)
      .map((p) => ({
        sourceId: p.sourceId,
        sourceName: p.sourceName,
        preferredFolderId: p.frequentFolders[0],
        sampleCount: p.sampleCount,
        confirmationRate: p.avgConfidence || 0,
      }))
      .slice(0, 50);
  }

  /**
   * 构建时间偏好
   */
  private buildTimePreferences(
    bookmarks: Array<{ folder_id: number | null; created_at: string }>,
  ): TimePreference[] {
    // 按小时统计文件夹使用
    const hourlyStats = new Map<number, Map<number, number>>();

    for (const bookmark of bookmarks) {
      if (!bookmark.folder_id) continue;

      const hour = new Date(bookmark.created_at).getHours();
      const folderMap = hourlyStats.get(hour) || new Map();
      folderMap.set(
        bookmark.folder_id,
        (folderMap.get(bookmark.folder_id) || 0) + 1,
      );
      hourlyStats.set(hour, folderMap);
    }

    // 构建时间偏好
    const preferences: TimePreference[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const folderMap = hourlyStats.get(hour);
      if (!folderMap || folderMap.size === 0) continue;

      const topFolders = [...folderMap.entries()]
        .map(([folderId, count]) => ({ folderId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      preferences.push({ hour, topFolders });
    }

    return preferences;
  }

  // ============================================================================
  // 私有方法 - 排除规则
  // ============================================================================

  /**
   * 获取用户排除规则
   */
  private async getExclusions(
    userId: string,
  ): Promise<InternalFolderExclusion[]> {
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();

    const settings = profile?.settings as Record<string, unknown> | null;
    return (settings?.folderExclusions as InternalFolderExclusion[]) || [];
  }

  /**
   * 保存用户排除规则
   */
  private async saveExclusions(
    userId: string,
    exclusions: InternalFolderExclusion[],
  ): Promise<void> {
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();

    const currentSettings =
      (profile?.settings as Record<string, unknown>) || {};

    await supabase
      .from("profiles")
      .update({
        settings: {
          ...currentSettings,

          folderExclusions: exclusions,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })
      .eq("id", userId);
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const preferenceLearner = new PreferenceLearner();
