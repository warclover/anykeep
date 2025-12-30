/**
 * Folder Auto-Organization Service
 * V4.2 文件夹自动合并/拆分策略服务
 *
 * @description
 * 根据文件夹画像和书签聚类分析，自动生成合并/拆分建议：
 * - 检测相似文件夹并建议合并
 * - 检测过大/多主题文件夹并建议拆分
 * - 检测过小文件夹并建议合并到父级
 * - 与托管模式联动（全托管自动执行，半托管需确认）
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { DBSCANCluster, cosineDistance } from "../algorithms/dbscan-cluster";
import { folderExecutorService } from "@/lib/folder";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

/** 组织建议类型 */
export type OrganizationSuggestionType =
  | "merge_similar" // 合并相似文件夹
  | "merge_small" // 合并过小文件夹
  | "split_large" // 拆分过大文件夹
  | "split_multi_topic" // 拆分多主题文件夹
  | "rename"; // 重命名建议

/** 组织建议 */
export interface OrganizationSuggestion {
  /** 建议 ID */
  id: string;
  /** 建议类型 */
  type: OrganizationSuggestionType;
  /** 置信度 (0-100) */
  confidence: number;
  /** 优先级 (1-5, 1最高) */
  priority: number;
  /** 建议描述 */
  description: string;
  /** 建议原因 */
  reason: string;
  /** 涉及的文件夹 */
  folders: Array<{
    id: number;
    name: string;
    bookmarkCount: number;
  }>;
  /** 建议操作详情 */
  action:
    | MergeSuggestionAction
    | SplitSuggestionAction
    | RenameSuggestionAction;
  /** 生成时间 */
  createdAt: string;
}

/** 合并建议操作 */
export interface MergeSuggestionAction {
  type: "merge";
  targetFolderId: number;
  targetFolderName: string;
  sourceFolderIds: number[];
  estimatedBookmarkCount: number;
}

/** 拆分建议操作 */
export interface SplitSuggestionAction {
  type: "split";
  sourceFolderId: number;
  suggestedSubFolders: Array<{
    name: string;
    bookmarkIds: number[];
    topTags: string[];
  }>;
}

/** 重命名建议操作 */
export interface RenameSuggestionAction {
  type: "rename";
  folderId: number;
  currentName: string;
  suggestedName: string;
}

/** 自动组织配置 */
export interface AutoOrganizationConfig {
  /** 相似度阈值（用于合并检测） */
  similarityThreshold: number;
  /** 过小文件夹阈值（书签数） */
  smallFolderThreshold: number;
  /** 过大文件夹阈值（书签数） */
  largeFolderThreshold: number;
  /** 多主题检测的聚类数阈值 */
  multiTopicClusterThreshold: number;
  /** 是否启用自动执行（全托管模式） */
  autoExecute: boolean;
  /** 最大建议数量 */
  maxSuggestions: number;
}

const DEFAULT_CONFIG: AutoOrganizationConfig = {
  similarityThreshold: 0.75,
  smallFolderThreshold: 3,
  largeFolderThreshold: 50,
  multiTopicClusterThreshold: 3,
  autoExecute: false,
  maxSuggestions: 10,
};

// ============================================================================
// Service Implementation
// ============================================================================

export class FolderAutoOrganizationService {
  private supabase: SupabaseClient<Database>;
  private config: AutoOrganizationConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<AutoOrganizationConfig>,
  ) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * 分析用户文件夹并生成组织建议
   */
  async analyzeAndSuggest(userId: string): Promise<OrganizationSuggestion[]> {
    const suggestions: OrganizationSuggestion[] = [];

    try {
      // 1. 获取用户所有文件夹及其画像
      const folders = await this.getUserFoldersWithProfiles(userId);
      if (folders.length < 2) {
        return [];
      }

      // 2. 检测相似文件夹（合并建议）
      const mergeSimilarSuggestions = await this.detectSimilarFolders(
        userId,
        folders,
      );
      suggestions.push(...mergeSimilarSuggestions);

      // 3. 检测过小文件夹（合并建议）
      const mergeSmallSuggestions = this.detectSmallFolders(folders);
      suggestions.push(...mergeSmallSuggestions);

      // 4. 检测过大/多主题文件夹（拆分建议）
      const splitSuggestions = await this.detectFoldersNeedingSplit(
        userId,
        folders,
      );
      suggestions.push(...splitSuggestions);

      // 5. 按优先级排序并限制数量
      suggestions.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.confidence - a.confidence;
      });

      return suggestions.slice(0, this.config.maxSuggestions);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "AutoOrganization: Failed to analyze folders",
      );
      return [];
    }
  }

  /**
   * 执行建议（用于全托管模式或用户确认后）
   */
  async executeSuggestion(
    userId: string,
    suggestion: OrganizationSuggestion,
  ): Promise<{ success: boolean; message: string }> {
    try {
      switch (suggestion.action.type) {
        case "merge":
          return await this.executeMergeSuggestion(userId, suggestion.action);

        case "split":
          return await this.executeSplitSuggestion(userId, suggestion.action);

        case "rename":
          return await this.executeRenameSuggestion(userId, suggestion.action);

        default:
          return { success: false, message: "未知的建议类型" };
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "AutoOrganization: Failed to execute suggestion",
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : "执行失败",
      };
    }
  }

  // ==========================================================================
  // Detection Methods
  // ==========================================================================

  /**
   * 检测相似文件夹
   */
  private async detectSimilarFolders(
    userId: string,
    folders: FolderWithProfile[],
  ): Promise<OrganizationSuggestion[]> {
    const suggestions: OrganizationSuggestion[] = [];
    const processedPairs = new Set<string>();

    // 筛选有向量的文件夹
    const foldersWithEmbedding = folders.filter(
      (f) => f.profile_embedding && f.profile_embedding.length > 0,
    );

    for (let i = 0; i < foldersWithEmbedding.length; i++) {
      for (let j = i + 1; j < foldersWithEmbedding.length; j++) {
        const folderA = foldersWithEmbedding[i];
        const folderB = foldersWithEmbedding[j];

        const pairKey = [folderA.id, folderB.id].sort().join("-");
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        // 安全检查：虽然已筛选，但 TypeScript 无法推断
        if (!folderA.profile_embedding || !folderB.profile_embedding) continue;

        // 计算相似度
        const similarity =
          1 -
          cosineDistance(folderA.profile_embedding, folderB.profile_embedding);

        if (similarity >= this.config.similarityThreshold) {
          // 选择书签更多的作为目标文件夹
          const [target, source] =
            folderA.bookmark_count >= folderB.bookmark_count
              ? [folderA, folderB]
              : [folderB, folderA];

          suggestions.push({
            id: `merge_similar_${pairKey}`,
            type: "merge_similar",
            confidence: Math.round(similarity * 100),
            priority: 2,
            description: `建议合并「${source.name}」到「${target.name}」`,
            reason: `这两个文件夹内容相似度达 ${Math.round(similarity * 100)}%`,
            folders: [
              {
                id: target.id,
                name: target.name,
                bookmarkCount: target.bookmark_count,
              },
              {
                id: source.id,
                name: source.name,
                bookmarkCount: source.bookmark_count,
              },
            ],
            action: {
              type: "merge",
              targetFolderId: target.id,
              targetFolderName: target.name,
              sourceFolderIds: [source.id],
              estimatedBookmarkCount:
                target.bookmark_count + source.bookmark_count,
            },
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * 检测过小文件夹
   */
  private detectSmallFolders(
    folders: FolderWithProfile[],
  ): OrganizationSuggestion[] {
    const suggestions: OrganizationSuggestion[] = [];

    // 筛选过小的非系统文件夹
    const smallFolders = folders.filter(
      (f) =>
        !f.is_system &&
        f.bookmark_count > 0 &&
        f.bookmark_count < this.config.smallFolderThreshold,
    );

    // 按父文件夹分组
    const byParent = new Map<number | null, FolderWithProfile[]>();
    for (const folder of smallFolders) {
      const parentId = folder.parent_id;
      const parentFolders = byParent.get(parentId);
      if (parentFolders) {
        parentFolders.push(folder);
      } else {
        byParent.set(parentId, [folder]);
      }
    }

    // 为每组生成合并建议
    for (const [parentId, group] of byParent) {
      if (group.length < 2) continue;

      // 找到同级别中最大的文件夹作为目标
      const targetFolder = group.reduce((a, b) =>
        a.bookmark_count >= b.bookmark_count ? a : b,
      );
      const sourceFolders = group.filter((f) => f.id !== targetFolder.id);

      if (sourceFolders.length === 0) continue;

      const totalBookmarks = group.reduce(
        (sum, f) => sum + f.bookmark_count,
        0,
      );

      suggestions.push({
        id: `merge_small_${parentId || "root"}_${Date.now()}`,
        type: "merge_small",
        confidence: 70,
        priority: 3,
        description: `建议将 ${sourceFolders.length} 个小文件夹合并到「${targetFolder.name}」`,
        reason: `这些文件夹书签数都少于 ${this.config.smallFolderThreshold} 个`,
        folders: group.map((f) => ({
          id: f.id,
          name: f.name,
          bookmarkCount: f.bookmark_count,
        })),
        action: {
          type: "merge",
          targetFolderId: targetFolder.id,
          targetFolderName: targetFolder.name,
          sourceFolderIds: sourceFolders.map((f) => f.id),
          estimatedBookmarkCount: totalBookmarks,
        },
        createdAt: new Date().toISOString(),
      });
    }

    return suggestions;
  }

  /**
   * 检测需要拆分的文件夹
   */
  private async detectFoldersNeedingSplit(
    userId: string,
    folders: FolderWithProfile[],
  ): Promise<OrganizationSuggestion[]> {
    const suggestions: OrganizationSuggestion[] = [];

    // 筛选过大的文件夹
    const largeFolders = folders.filter(
      (f) =>
        !f.is_system && f.bookmark_count >= this.config.largeFolderThreshold,
    );

    for (const folder of largeFolders) {
      // 获取文件夹内的书签
      const { data: bookmarks } = await this.supabase
        .from("bookmarks")
        .select("id, title, ai_tags, embedding")
        .eq("folder_id", folder.id)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (!bookmarks || bookmarks.length < this.config.largeFolderThreshold) {
        continue;
      }

      // 使用 DBSCAN 聚类分析
      const clusterer = new DBSCANCluster<(typeof bookmarks)[0]>({
        epsilon: 0.35,
        minPoints: 3,
      });

      const clusterResults = clusterer.cluster(
        bookmarks,
        (b) => b.embedding as number[] | null,
      );

      const summary = clusterer.getSummary(
        clusterResults,
        (b) => b.embedding as number[] | null,
      );

      // 如果有多个显著的聚类，建议拆分
      const significantClusters = summary.filter((s) => s.size >= 5);

      if (
        significantClusters.length >= this.config.multiTopicClusterThreshold
      ) {
        // 为每个聚类生成子文件夹建议
        const suggestedSubFolders: SplitSuggestionAction["suggestedSubFolders"] =
          [];

        for (const cluster of significantClusters) {
          const clusterBookmarks = clusterResults
            .filter((r) => r.clusterId === cluster.clusterId)
            .map((r) => r.item);

          // 提取主题标签
          const tagCounts = new Map<string, number>();
          for (const b of clusterBookmarks) {
            for (const tag of b.ai_tags || []) {
              tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
          }
          const topTags = Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([tag]) => tag);

          // 生成子文件夹名称
          const subFolderName =
            topTags.length > 0
              ? topTags.slice(0, 2).join(" + ")
              : `${folder.name} - 子集${cluster.clusterId + 1}`;

          suggestedSubFolders.push({
            name: subFolderName,
            bookmarkIds: clusterBookmarks.map((b) => b.id),
            topTags,
          });
        }

        suggestions.push({
          id: `split_${folder.id}_${Date.now()}`,
          type: "split_multi_topic",
          confidence: Math.min(90, 60 + significantClusters.length * 10),
          priority: 2,
          description: `建议将「${folder.name}」拆分为 ${significantClusters.length} 个子文件夹`,
          reason: `检测到 ${significantClusters.length} 个不同主题的内容群，总计 ${folder.bookmark_count} 个书签`,
          folders: [
            {
              id: folder.id,
              name: folder.name,
              bookmarkCount: folder.bookmark_count,
            },
          ],
          action: {
            type: "split",
            sourceFolderId: folder.id,
            suggestedSubFolders,
          },
          createdAt: new Date().toISOString(),
        });
      }
    }

    return suggestions;
  }

  // ==========================================================================
  // Execution Methods
  // ==========================================================================

  /**
   * 执行合并建议
   */
  private async executeMergeSuggestion(
    userId: string,
    action: MergeSuggestionAction,
  ): Promise<{ success: boolean; message: string }> {
    const result = await folderExecutorService.executeMerge({
      userId,
      targetFolderId: action.targetFolderId,
      sourceFolderIds: action.sourceFolderIds,
      reason: "auto_organization_merge",
    });

    return { success: result.success, message: result.message };
  }

  /**
   * 执行拆分建议
   */
  private async executeSplitSuggestion(
    userId: string,
    action: SplitSuggestionAction,
  ): Promise<{ success: boolean; message: string }> {
    const result = await folderExecutorService.executeSplit({
      userId,
      sourceFolderId: action.sourceFolderId,
      subFolders: action.suggestedSubFolders.map((sf) => ({
        name: sf.name,
        bookmarkIds: sf.bookmarkIds,
      })),
      reason: "auto_organization_split",
    });

    return { success: result.success, message: result.message };
  }

  /**
   * 执行重命名建议
   */
  private async executeRenameSuggestion(
    userId: string,
    action: RenameSuggestionAction,
  ): Promise<{ success: boolean; message: string }> {
    const result = await folderExecutorService.executeRename({
      userId,
      folderId: action.folderId,
      newName: action.suggestedName,
      reason: "auto_organization_rename",
    });

    return { success: result.success, message: result.message };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * 获取用户文件夹及其画像
   */
  private async getUserFoldersWithProfiles(
    userId: string,
  ): Promise<FolderWithProfile[]> {
    const { data, error } = await this.supabase
      .from("folders")
      .select(
        `
        id,
        name,
        parent_id,
        is_system,
        folder_profiles (
          bookmark_count,
          profile_embedding,
          top_tags
        )
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error || !data) {
      logger.warn(
        { error: error?.message },
        "AutoOrganization: Failed to get folders",
      );
      return [];
    }

    return data.map((f) => {
      const profile = Array.isArray(f.folder_profiles)
        ? f.folder_profiles[0]
        : f.folder_profiles;
      return {
        id: f.id,
        name: f.name,
        parent_id: f.parent_id,
        is_system: f.is_system ?? false,
        bookmark_count: profile?.bookmark_count ?? 0,
        profile_embedding: profile?.profile_embedding as number[] | null,
        top_tags: (profile?.top_tags as string[]) ?? [],
      };
    });
  }
}

// ============================================================================
// Types (Internal)
// ============================================================================

interface FolderWithProfile {
  id: number;
  name: string;
  parent_id: number | null;
  is_system: boolean;
  bookmark_count: number;
  profile_embedding: number[] | null;
  top_tags: string[];
}

// ============================================================================
// Factory & Export
// ============================================================================

export function createFolderAutoOrganizationService(
  supabase: SupabaseClient<Database>,
  config?: Partial<AutoOrganizationConfig>,
): FolderAutoOrganizationService {
  return new FolderAutoOrganizationService(supabase, config);
}

export default FolderAutoOrganizationService;
