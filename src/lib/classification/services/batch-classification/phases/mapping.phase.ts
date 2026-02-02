/**
 * 映射阶段
 *
 * 将聚类结果与用户现有文件夹匹配，或触发新文件夹创建
 *
 * @module classification/batch-classification/phases/mapping.phase
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  BatchCluster,
  MappingResult,
  FolderMatch,
  BookmarkWithEmbedding,
  ConflictType,
} from "../types";
import { vacuumDetector } from "../conflict/vacuum-detector";
import { cosineSimilarity } from "../../smart-sorting/clustering/similarity";

// ============================================
// 映射配置
// ============================================

export interface MappingConfig {
  /** 精准匹配阈值 */
  exactMatchThreshold: number;
  /** 模糊匹配阈值 */
  fuzzyMatchThreshold: number;
  /** 最大候选文件夹数 */
  maxCandidates: number;
}

export const DEFAULT_MAPPING_CONFIG: MappingConfig = {
  exactMatchThreshold: 0.75,
  fuzzyMatchThreshold: 0.5,
  maxCandidates: 5,
};

// ============================================
// 映射阶段服务
// ============================================

/**
 * 映射阶段服务
 *
 * 功能：
 * 1. 计算簇质心与��件夹向量的相似度
 * 2. 应用空洞检测逻辑
 * 3. 生成映射建议
 */
export class MappingPhase {
  private supabase: SupabaseClient<Database>;
  private config: MappingConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config: MappingConfig = DEFAULT_MAPPING_CONFIG,
  ) {
    this.supabase = supabase;
    this.config = config;
  }

  /**
   * 执行映射阶段
   */
  async execute(
    clusters: BatchCluster[],
    bookmarkMap: Map<number, BookmarkWithEmbedding>,
    userId: string,
  ): Promise<MappingResult[]> {
    // 1. 获取用户现有文件夹的向量表示
    const folderProfiles = await this.getFolderProfiles(userId);

    // 2. 为每个簇找到最佳匹配
    const mappingResults: MappingResult[] = [];

    for (const cluster of clusters) {
      const result = await this.mapCluster(
        cluster,
        folderProfiles,
        bookmarkMap,
      );
      mappingResults.push(result);
    }

    return mappingResults;
  }

  /**
   * 获取文件夹向量表示
   */
  private async getFolderProfiles(userId: string): Promise<FolderProfile[]> {
    const { data, error } = await this.supabase
      .from("folder_profiles")
      .select(
        `
        folder_id,
        centroid_vector,
        internal_similarity,
        bookmark_count,
        folders!inner (
          id,
          name,
          is_system
        )
      `,
      )
      .eq("user_id", userId)
      .eq("folders.is_system", false)
      .gt("bookmark_count", 0);

    if (error) {
      console.error("Failed to fetch folder profiles:", error);
      return [];
    }

    return (data || [])
      .filter((p) => p.centroid_vector && p.folders)
      .map((p) => ({
        folderId: p.folder_id,
        folderName: (p.folders as unknown as { name: string }).name,
        centroid: p.centroid_vector as unknown as number[],
        cohesion: p.internal_similarity || 0,
        bookmarkCount: p.bookmark_count || 0,
      }));
  }

  /**
   * 映射单个簇
   */
  private async mapCluster(
    cluster: BatchCluster,
    folderProfiles: FolderProfile[],
    bookmarkMap: Map<number, BookmarkWithEmbedding>,
  ): Promise<MappingResult> {
    // 1. 计算与所有文件夹的相似度
    const matches: FolderMatch[] = [];

    for (const profile of folderProfiles) {
      const similarity = cosineSimilarity(cluster.centroid, profile.centroid);
      matches.push({
        folderId: profile.folderId,
        folderName: profile.folderName,
        similarity,
        cohesion: profile.cohesion,
      });
    }

    // 2. 按相似度排序，取前 N 个
    matches.sort((a, b) => b.similarity - a.similarity);
    const topMatches = matches.slice(0, this.config.maxCandidates);

    // 3. ���洞检测
    const vacuumResult = vacuumDetector.shouldCreateNewFolder(
      cluster,
      topMatches,
    );

    // 4. 检测冲突类型
    const conflictType = this.detectConflictType(
      cluster,
      topMatches,
      bookmarkMap,
    );

    // 5. 生成映射结果
    if (vacuumResult.shouldCreate) {
      return {
        clusterId: cluster.id,
        action: "CREATE",
        confidence: cluster.cohesion,
        conflictType,
      };
    }

    const best = topMatches[0];

    if (best.similarity >= this.config.exactMatchThreshold) {
      return {
        clusterId: cluster.id,
        action: "MERGE",
        targetFolderId: best.folderId,
        confidence: best.similarity,
        conflictType,
      };
    }

    return {
      clusterId: cluster.id,
      action: "SUGGEST_MERGE",
      targetFolderId: best.folderId,
      confidence: best.similarity,
      warning: best.cohesion < 0.4 ? "target_folder_messy" : undefined,
      conflictType,
    };
  }

  /**
   * 检测冲突类型
   */
  private detectConflictType(
    cluster: BatchCluster,
    topMatches: FolderMatch[],
    bookmarkMap: Map<number, BookmarkWithEmbedding>,
  ): ConflictType {
    if (topMatches.length === 0) {
      return "none";
    }

    // 检查原始路径与建议路径是否一致
    const originalPaths = new Set<string>();
    for (const memberId of cluster.memberIds) {
      const bookmark = bookmarkMap.get(memberId);
      if (bookmark?.originalPath) {
        originalPaths.add(bookmark.originalPath);
      }
    }

    if (originalPaths.size === 0) {
      return "none";
    }

    const suggestedFolder = topMatches[0].folderName;

    // 检查是否有路径不匹配
    for (const path of originalPaths) {
      if (
        !path.includes(suggestedFolder) &&
        !suggestedFolder.includes(path.split("/").pop() || "")
      ) {
        return "path_mismatch";
      }
    }

    // 检查是否模棱两可
    if (topMatches.length >= 2) {
      const diff = topMatches[0].similarity - topMatches[1].similarity;
      if (diff < 0.1) {
        return "ambiguous";
      }
    }

    return "none";
  }
}

// ============================================
// 辅助类型
// ============================================

interface FolderProfile {
  folderId: number;
  folderName: string;
  centroid: number[];
  cohesion: number;
  bookmarkCount: number;
}
