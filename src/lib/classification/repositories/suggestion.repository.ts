/**
 * Suggestion Repository
 * Data access layer for organization suggestions
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OrganizationSuggestion,
  SuggestionInput,
  SuggestionStatus,
} from "../types";

/**
 * Repository for suggestion operations
 */
export class SuggestionRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get pending suggestions for a user
   * 优雅降级：如果表不存在返回空数组
   */
  async findPendingByUserId(userId: string): Promise<OrganizationSuggestion[]> {
    try {
      const { data, error } = await this.supabase
        .from("organization_suggestions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        // 表不存在时返回空数组（优雅降级）
        if (
          error.code === "42P01" ||
          error.message?.includes("does not exist")
        ) {
          console.info(
            "[SuggestionRepository] organization_suggestions table does not exist, returning empty array",
          );
          return [];
        }
        throw new Error(`Failed to fetch suggestions: ${error.message}`);
      }

      return (data || []).map(this.mapToSuggestion);
    } catch (error) {
      // 捕获所有错误并优雅降级
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("does not exist")) {
        console.info(
          "[SuggestionRepository] organization_suggestions table does not exist, returning empty array",
        );
        return [];
      }
      throw error;
    }
  }

  /**
   * Get suggestion by ID
   */
  async findById(suggestionId: number): Promise<OrganizationSuggestion | null> {
    const { data, error } = await this.supabase
      .from("organization_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch suggestion: ${error.message}`);
    }

    return this.mapToSuggestion(data);
  }

  /**
   * Create a new suggestion
   */
  async create(
    userId: string,
    input: SuggestionInput,
  ): Promise<OrganizationSuggestion> {
    const { data, error } = await this.supabase
      .from("organization_suggestions")
      .insert({
        user_id: userId,
        suggestion_type: input.suggestionType,
        bookmark_ids: input.bookmarkIds,
        target_folder_id: input.targetFolderId,
        suggested_folder_name: input.suggestedFolderName,
        confidence: input.confidence,
        reason: input.reason,
        sample_titles: input.sampleTitles || [],
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create suggestion: ${error.message}`);
    }

    return this.mapToSuggestion(data);
  }

  /**
   * Create multiple suggestions
   */
  async createBatch(
    userId: string,
    inputs: SuggestionInput[],
  ): Promise<OrganizationSuggestion[]> {
    if (inputs.length === 0) {
      return [];
    }

    const insertData = inputs.map((input) => ({
      user_id: userId,
      suggestion_type: input.suggestionType,
      bookmark_ids: input.bookmarkIds,
      target_folder_id: input.targetFolderId,
      suggested_folder_name: input.suggestedFolderName,
      confidence: input.confidence,
      reason: input.reason,
      sample_titles: input.sampleTitles || [],
      status: "pending",
    }));

    const { data, error } = await this.supabase
      .from("organization_suggestions")
      .insert(insertData)
      .select();

    if (error) {
      throw new Error(`Failed to create suggestions: ${error.message}`);
    }

    return (data || []).map(this.mapToSuggestion);
  }

  /**
   * Update suggestion status
   */
  async updateStatus(
    suggestionId: number,
    status: SuggestionStatus,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("organization_suggestions")
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq("id", suggestionId);

    if (error) {
      throw new Error(`Failed to update suggestion status: ${error.message}`);
    }
  }

  /**
   * Mark suggestion as accepted
   */
  async accept(suggestionId: number): Promise<void> {
    await this.updateStatus(suggestionId, "accepted");
  }

  /**
   * Mark suggestion as rejected
   */
  async reject(suggestionId: number): Promise<void> {
    await this.updateStatus(suggestionId, "rejected");
  }

  /**
   * Delete old pending suggestions for user
   * (Called before generating new suggestions)
   */
  async deletePendingByUserId(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("organization_suggestions")
      .delete()
      .eq("user_id", userId)
      .eq("status", "pending");

    if (error) {
      throw new Error(`Failed to delete pending suggestions: ${error.message}`);
    }
  }

  /**
   * Expire old suggestions (calls SQL function)
   */
  async expireOldSuggestions(): Promise<number> {
    const { data, error } = await this.supabase.rpc("expire_old_suggestions");

    if (error) {
      throw new Error(`Failed to expire suggestions: ${error.message}`);
    }

    return data as number;
  }

  /**
   * Count pending suggestions for user
   */
  async countPendingByUserId(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("organization_suggestions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");

    if (error) {
      throw new Error(`Failed to count suggestions: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * V4.2.1: Update suggestion with new bookmark IDs (for incremental analysis)
   * Adds new bookmarks to existing suggestion and updates sample titles
   */
  async updateBookmarkIds(
    suggestionId: number,
    newBookmarkIds: number[],
    newSampleTitles: string[],
    newConfidence?: number,
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      bookmark_ids: newBookmarkIds,
      sample_titles: newSampleTitles.slice(0, 5), // Keep max 5 sample titles
    };

    if (newConfidence !== undefined) {
      updates.confidence = newConfidence;
    }

    const { error } = await this.supabase
      .from("organization_suggestions")
      .update(updates)
      .eq("id", suggestionId);

    if (error) {
      throw new Error(
        `Failed to update suggestion bookmark IDs: ${error.message}`,
      );
    }
  }

  /**
   * Map database row to OrganizationSuggestion
   */
  private mapToSuggestion(
    row: Record<string, unknown>,
  ): OrganizationSuggestion {
    return {
      id: row.id as number,
      userId: row.user_id as string,
      suggestionType:
        row.suggestion_type as OrganizationSuggestion["suggestionType"],
      bookmarkIds: (row.bookmark_ids as number[]) || [],
      targetFolderId: row.target_folder_id as number | null,
      suggestedFolderName: row.suggested_folder_name as string | null,
      confidence: row.confidence as number,
      reason: row.reason as string | null,
      sampleTitles: (row.sample_titles as string[]) || [],
      status: row.status as OrganizationSuggestion["status"],
      createdAt: new Date(row.created_at as string),
      respondedAt: row.responded_at
        ? new Date(row.responded_at as string)
        : null,
    };
  }
}
