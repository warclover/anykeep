/**
 * 向量搜索服务 — 薄封装
 *
 * 调用 Supabase pgvector RPC 执行相似度搜索。
 * 使用 match_folder_profiles_v5 RPC（与旧系统一致）。
 * 唯一实现，零重导出。
 *
 * @version 2.1.0
 * @since 2026-03-09
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { CLASSIFICATION_CONFIG } from "../config";

/** 文件夹画像搜索结果 */
export interface FolderProfileSearchResult {
  /** 画像 ID（UUID） */
  profileId: string;
  folderId: number;
  folderName: string;
  similarity: number;
}

/**
 * @deprecated 使用 FolderProfileSearchResult 替代
 * 保留以兼容旧代码，后续清理
 */
export type VectorSearchResult = FolderProfileSearchResult;

export interface VectorSearchOptions {
  /** 返回最大数量 */
  limit?: number;
  /** 最低相似度阈值 */
  threshold?: number;
}

/** RPC 返回行类型（与数据库实际返回对齐） */
interface FolderProfileRow {
  profile_id: string;
  folder_id: number;
  folder_name: string;
  match_type: string;
  similarity: number;
}

/**
 * 基于向量相似度搜索最相关的文件夹画像
 *
 * 使用 match_folder_profiles_v5 RPC，与旧系统保持一致。
 * 返回按相似度排序的文件夹画像列表。
 */
export async function searchSimilarFolderProfiles(
  userId: string,
  embedding: number[],
  options?: VectorSearchOptions,
): Promise<FolderProfileSearchResult[]> {
  const limit = options?.limit ?? CLASSIFICATION_CONFIG.vector.searchLimit;
  const threshold =
    options?.threshold ?? CLASSIFICATION_CONFIG.vector.similarityThreshold;

  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc("match_folder_profiles_v5", {
      p_user_id: userId,
      p_content_embedding: JSON.stringify(embedding),
      p_behavior_embedding: JSON.stringify([]),
      p_alpha: 0, // 纯内容搜索
      p_match_threshold: threshold,
      p_match_count: limit,
    });

    if (error) {
      logger.error({ error, userId }, "Vector search failed");
      return [];
    }

    const rows = (data ?? []) as unknown as FolderProfileRow[];
    return rows.map(
      (row): FolderProfileSearchResult => ({
        profileId: row.profile_id,
        folderId: row.folder_id,
        folderName: row.folder_name,
        similarity: row.similarity,
      }),
    );
  } catch (err) {
    logger.error({ err, userId }, "Vector search exception");
    return [];
  }
}

/**
 * @deprecated 使用 searchSimilarFolderProfiles 替代
 */
export const searchSimilarBookmarks = searchSimilarFolderProfiles;
