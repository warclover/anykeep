/**
 * Folder Profile Repository
 * Data access layer for folder profiles
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FolderProfile, SimilarFolder } from "../types";

/**
 * Repository for folder profile operations
 */
export class FolderProfileRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get all folder profiles for a user
   */
  async findByUserId(userId: string): Promise<FolderProfile[]> {
    const { data, error } = await this.supabase
      .from("folder_profiles")
      .select(
        `
        *,
        folders!inner(name, deleted_at)
      `,
      )
      .eq("user_id", userId)
      .is("folders.deleted_at", null);

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
   */
  async searchSimilarFolders(
    embedding: number[],
    userId: string,
    threshold: number = 0.5,
    limit: number = 5,
  ): Promise<SimilarFolder[]> {
    const { data, error } = await this.supabase.rpc("search_similar_folders", {
      query_embedding: embedding,
      p_user_id: userId,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      throw new Error(`Failed to search similar folders: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      folderId: row.folder_id as number,
      folderName: row.folder_name as string,
      bookmarkCount: row.bookmark_count as number,
      topTags: (row.top_tags as string[]) || [],
      sampleTitles: (row.sample_titles as string[]) || [],
      similarity: row.similarity as number,
    }));
  }

  /**
   * Compute folder profile (calls SQL function)
   */
  async computeProfile(folderId: number): Promise<void> {
    const { error } = await this.supabase.rpc("compute_folder_profile", {
      p_folder_id: folderId,
    });

    if (error) {
      throw new Error(`Failed to compute folder profile: ${error.message}`);
    }
  }

  /**
   * Compute all folder profiles for a user
   */
  async computeUserProfiles(userId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc(
      "compute_user_folder_profiles",
      {
        p_user_id: userId,
      },
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
