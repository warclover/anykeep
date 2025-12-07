/**
 * Bookmark Repository
 * Data access layer for bookmarks (classification-related operations)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimilarBookmarkWithFolder } from "../types";

/**
 * Bookmark data for classification
 */
export interface BookmarkForClassification {
  id: number;
  title: string;
  url: string;
  aiSummary: string | null;
  aiTags: string[];
  embedding: number[] | null;
  folderId: number | null;
  createdAt: Date;
}

/**
 * Repository for bookmark operations related to classification
 */
export class BookmarkRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get bookmark by ID with classification-relevant fields
   */
  async findById(
    bookmarkId: number,
  ): Promise<BookmarkForClassification | null> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, ai_summary, ai_tags, embedding, folder_id, created_at",
      )
      .eq("id", bookmarkId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch bookmark: ${error.message}`);
    }

    return this.mapToBookmark(data);
  }

  /**
   * Get bookmarks in inbox (no folder or in inbox system folder)
   */
  async findInboxBookmarks(
    userId: string,
  ): Promise<BookmarkForClassification[]> {
    // First get inbox folder ID
    const { data: inboxFolder } = await this.supabase
      .from("folders")
      .select("id")
      .eq("user_id", userId)
      .eq("is_system", true)
      .eq("system_type", "INBOX")
      .is("deleted_at", null)
      .single();

    // Query bookmarks without folder OR in inbox folder
    let query = this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, ai_summary, ai_tags, embedding, folder_id, created_at",
      )
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (inboxFolder) {
      query = query.or(`folder_id.is.null,folder_id.eq.${inboxFolder.id}`);
    } else {
      query = query.is("folder_id", null);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      throw new Error(`Failed to fetch inbox bookmarks: ${error.message}`);
    }

    return (data || []).map(this.mapToBookmark);
  }

  /**
   * Find similar bookmarks with their folder info
   */
  async findSimilarWithFolders(
    embedding: number[],
    userId: string,
    limit: number = 10,
  ): Promise<SimilarBookmarkWithFolder[]> {
    const { data, error } = await this.supabase.rpc(
      "find_similar_bookmarks_with_folders",
      {
        query_embedding: embedding,
        p_user_id: userId,
        match_count: limit,
      },
    );

    if (error) {
      throw new Error(`Failed to find similar bookmarks: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      bookmarkId: row.bookmark_id as number,
      bookmarkTitle: row.bookmark_title as string,
      folderId: row.folder_id as number | null,
      folderName: row.folder_name as string | null,
      similarity: row.similarity as number,
    }));
  }

  /**
   * Get bookmarks by folder ID
   */
  async findByFolderId(folderId: number): Promise<BookmarkForClassification[]> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, ai_summary, ai_tags, embedding, folder_id, created_at",
      )
      .eq("folder_id", folderId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch folder bookmarks: ${error.message}`);
    }

    return (data || []).map(this.mapToBookmark);
  }

  /**
   * Move bookmarks to folder
   */
  async moveToFolder(bookmarkIds: number[], folderId: number): Promise<void> {
    const { error } = await this.supabase
      .from("bookmarks")
      .update({ folder_id: folderId, updated_at: new Date().toISOString() })
      .in("id", bookmarkIds);

    if (error) {
      throw new Error(`Failed to move bookmarks: ${error.message}`);
    }
  }

  /**
   * Count user's total bookmarks
   */
  async countByUserId(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to count bookmarks: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Get bookmark embeddings by IDs
   */
  async getEmbeddings(bookmarkIds: number[]): Promise<Map<number, number[]>> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id, embedding")
      .in("id", bookmarkIds)
      .is("deleted_at", null)
      .not("embedding", "is", null);

    if (error) {
      throw new Error(`Failed to fetch embeddings: ${error.message}`);
    }

    const embeddings = new Map<number, number[]>();
    for (const row of data || []) {
      if (row.embedding) {
        embeddings.set(row.id, row.embedding);
      }
    }
    return embeddings;
  }

  /**
   * Map database row to BookmarkForClassification
   */
  private mapToBookmark(
    row: Record<string, unknown>,
  ): BookmarkForClassification {
    return {
      id: row.id as number,
      title: row.title as string,
      url: row.url as string,
      aiSummary: row.ai_summary as string | null,
      aiTags: (row.ai_tags as string[]) || [],
      embedding: row.embedding as number[] | null,
      folderId: row.folder_id as number | null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
