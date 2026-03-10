/**
 * Folder Profile Repository
 * Data access layer for folder profiles
 *
 * V4.2.15: 添加向量搜索超时控制
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FolderProfile, SimilarFolder } from "../types";
import { SimilarFolderRowSchema, parseRows } from "./validation-schemas";

/**
 * V4.2.15: 向量搜索超时时间（毫秒）
 */
const VECTOR_SEARCH_TIMEOUT_MS = 5000;

/**
 * 带超时的 Promise 包装器
 * 支持 PromiseLike（Supabase 的 PostgrestFilterBuilder 是 thenable）
 */
function withTimeout<T>(
  promiseLike: PromiseLike<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  return Promise.race([
    Promise.resolve(promiseLike),
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`向量搜索超时: ${operation} 超过 ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

/**
 * Repository for folder profile operations
 */
export class FolderProfileRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get all folder profiles for a user (excludes system folders)
   */
  async findByUserId(userId: string): Promise<FolderProfile[]> {
    const { data, error } = await this.supabase
      .from("folder_profiles")
      .select(
        `
        *,
        folders!inner(name, deleted_at, is_system)
      `,
      )
      .eq("user_id", userId)
      .is("folders.deleted_at", null)
      .eq("folders.is_system", false); // 排除系统文件夹

    if (error) {
      throw new Error(`Failed to fetch folder profiles: ${error.message}`);
    }

    return (data || []).map(this.mapToFolderProfile);
  }

  /**
   * Get folder profile by folder ID
   */
  async findByFolderId(folderId: number): Promise<FolderProfile | null> {
    const { data, error } = await this.supabase
      .from("folder_profiles")
      .select(
        `
        *,
        folders!inner(name, deleted_at)
      `,
      )
      .eq("folder_id", folderId)
      .is("folders.deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(`Failed to fetch folder profile: ${error.message}`);
    }

    return this.mapToFolderProfile(data);
  }

  /**
   * Search similar folders using vector similarity
   * V4.2.15: 添加 5 秒超时保护
   */
  async searchSimilarFolders(
    embedding: number[],
    userId: string,
    threshold: number = 0.5,
    limit: number = 5,
  ): Promise<SimilarFolder[]> {
    // V4.2.15: 使用 Promise.race 添加超时保护
    const { data, error } = await withTimeout(
      this.supabase.rpc("search_similar_folders", {
        query_embedding: embedding,
        p_user_id: userId,
        match_threshold: threshold,
        match_count: limit,
      }),
      VECTOR_SEARCH_TIMEOUT_MS,
      "searchSimilarFolders",
    );

    if (error) {
      throw new Error(`Failed to search similar folders: ${error.message}`);
    }

    // 运行时验证数据库返回结果
    const validatedRows = parseRows(
      SimilarFolderRowSchema,
      data || [],
      "searchSimilarFolders",
    );

    return validatedRows.map((row) => ({
      folderId: row.folder_id,
      folderName: row.folder_name,
      bookmarkCount: row.bookmark_count,
      topTags: row.top_tags ?? [],
      sampleTitles: row.sample_titles ?? [],
      similarity: row.similarity,
    }));
  }

  /**
   * Compute folder profile (calls SQL function)
   * V4.2.15: 添加 10 秒超时保护（计算操作耗时较长）
   */
  async computeProfile(folderId: number): Promise<void> {
    const { error } = await withTimeout(
      this.supabase.rpc("compute_folder_profile", {
        p_folder_id: folderId,
      }),
      10000, // 计算操作允许更长时间
      "computeProfile",
    );

    if (error) {
      throw new Error(`Failed to compute folder profile: ${error.message}`);
    }
  }

  /**
   * Compute all folder profiles for a user
   * V4.2.15: 添加 30 秒超时保护（批量计算操作）
   */
  async computeUserProfiles(userId: string): Promise<number> {
    const { data, error } = await withTimeout(
      this.supabase.rpc("compute_user_folder_profiles", {
        p_user_id: userId,
      }),
      30000, // 批量计算允许 30 秒
      "computeUserProfiles",
    );

    if (error) {
      throw new Error(
        `Failed to compute user folder profiles: ${error.message}`,
      );
    }

    return data as number;
  }

  /**
   * Update folder profile source
   */
  async updateSource(folderId: number, source: string): Promise<void> {
    const { error } = await this.supabase
      .from("folder_profiles")
      .update({ source, updated_at: new Date().toISOString() })
      .eq("folder_id", folderId);

    if (error) {
      throw new Error(
        `Failed to update folder profile source: ${error.message}`,
      );
    }
  }

  /**
   * Delete folder profile
   */
  async delete(folderId: number): Promise<void> {
    const { error } = await this.supabase
      .from("folder_profiles")
      .delete()
      .eq("folder_id", folderId);

    if (error) {
      throw new Error(`Failed to delete folder profile: ${error.message}`);
    }
  }

  /**
   * Map database row to FolderProfile
   */
  private mapToFolderProfile(row: Record<string, unknown>): FolderProfile {
    return {
      id: row.id as number,
      userId: row.user_id as string,
      folderId: row.folder_id as number,
      folderName: (row.folders as Record<string, unknown>)?.name as string,
      profileEmbedding: row.profile_embedding as number[] | null,
      bookmarkCount: row.bookmark_count as number,
      lastBookmarkAt: row.last_bookmark_at
        ? new Date(row.last_bookmark_at as string)
        : null,
      topTags: (row.top_tags as string[]) || [],
      sampleTitles: (row.sample_titles as string[]) || [],
      internalSimilarity: row.internal_similarity as number | null,
      source: row.source as string | null,
      computedAt: new Date(row.computed_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
