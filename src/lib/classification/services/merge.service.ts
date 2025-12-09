/**
 * Merge Service (V4.2)
 * 文件夹合并服务 - 检测相似文件夹并建议合并
 *
 * 核心功能：
 * - 检测高相似度文件夹对
 * - 分析标签重叠率
 * - 生成合并建议或自动执行合并
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operationLogService } from "./operation-log.service";
import { logger } from "@/lib/logger";

// ============================================
// Type Definitions
// ============================================

/**
 * Folder with profile for merge analysis
 */
interface FolderProfile {
  folderId: number;
  name: string;
  parentId: number | null;
  bookmarkCount: number;
  embedding: number[] | null;
  commonTags: string[];
}

/**
 * Merge candidate pair
 */
export interface MergeCandidate {
  folder1: FolderProfile;
  folder2: FolderProfile;
  similarity: number;
  tagOverlap: number;
  mergedName: string;
  reason: string;
}

/**
 * Merge suggestion
 */
export interface MergeSuggestion {
  sourceFolders: Array<{
    id: number;
    name: string;
    bookmarkCount: number;
  }>;
  targetFolder: {
    id: number;
    name: string;
  };
  similarity: number;
  tagOverlap: number;
  totalBookmarks: number;
  reason: string;
}

/**
 * Merge execution result
 */
export interface MergeResult {
  success: boolean;
  message: string;
  targetFolderId?: number;
  mergedCount?: number;
}

// ============================================
// Constants
// ============================================

const MERGE_CONFIG = {
  // Minimum similarity to suggest merge
  MIN_SIMILARITY: 0.8,
  // Minimum tag overlap ratio
  MIN_TAG_OVERLAP: 0.6,
  // Minimum bookmarks per folder to consider
  MIN_BOOKMARKS: 2,
  // Maximum folders to analyze
  MAX_FOLDERS_SCAN: 50,
  // Maximum merge suggestions per user
  MAX_SUGGESTIONS: 5,
};

// ============================================
// MergeService Class
// ============================================

export class MergeService {
  private supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  > | null = null;

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient();
    }
    return this.supabase;
  }

  /**
   * Get merge candidates for a user
   */
  async getMergeCandidates(userId: string): Promise<MergeCandidate[]> {
    const supabase = await this.getSupabase();

    // 1. Get all folders with profiles
    const { data: profiles, error } = await supabase
      .from("folder_profiles")
      .select(
        `
        folder_id,
        profile_embedding,
        common_tags,
        bookmark_count,
        folders!inner (
          id,
          name,
          parent_id,
          user_id,
          deleted_at
        )
      `,
      )
      .eq("folders.user_id", userId)
      .is("folders.deleted_at", null)
      .gte("bookmark_count", MERGE_CONFIG.MIN_BOOKMARKS)
      .not("profile_embedding", "is", null)
      .limit(MERGE_CONFIG.MAX_FOLDERS_SCAN);

    if (error || !profiles || profiles.length < 2) {
      return [];
    }

    // 2. Convert to FolderProfile format
    const folderProfiles: FolderProfile[] = profiles.map((p) => {
      const folder = p.folders as unknown as {
        id: number;
        name: string;
        parent_id: number | null;
      };
      return {
        folderId: folder.id,
        name: folder.name,
        parentId: folder.parent_id,
        bookmarkCount: p.bookmark_count,
        embedding: p.profile_embedding as number[] | null,
        commonTags: (p.common_tags as string[]) || [],
      };
    });

    // 3. Find similar pairs
    const candidates: MergeCandidate[] = [];

    for (let i = 0; i < folderProfiles.length; i++) {
      for (let j = i + 1; j < folderProfiles.length; j++) {
        const folder1 = folderProfiles[i];
        const folder2 = folderProfiles[j];

        // Skip if same parent (likely intentionally separate)
        if (
          folder1.parentId === folder2.parentId &&
          folder1.parentId !== null
        ) {
          continue;
        }

        // Calculate similarity
        const similarity = this.calculateSimilarity(folder1, folder2);
        const tagOverlap = this.calculateTagOverlap(
          folder1.commonTags,
          folder2.commonTags,
        );

        if (
          similarity >= MERGE_CONFIG.MIN_SIMILARITY ||
          tagOverlap >= MERGE_CONFIG.MIN_TAG_OVERLAP
        ) {
          // Determine target folder (larger one or alphabetically first)
          const [target, source] =
            folder1.bookmarkCount >= folder2.bookmarkCount
              ? [folder1, folder2]
              : [folder2, folder1];

          candidates.push({
            folder1: target,
            folder2: source,
            similarity,
            tagOverlap,
            mergedName: this.suggestMergedName(target, source),
            reason: this.generateMergeReason(
              similarity,
              tagOverlap,
              target,
              source,
            ),
          });
        }
      }
    }

    // Sort by similarity (descending) and limit
    return candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, MERGE_CONFIG.MAX_SUGGESTIONS);
  }

  /**
   * Get detailed merge suggestion
   */
  async getMergeSuggestion(
    userId: string,
    folderIds: number[],
  ): Promise<MergeSuggestion | null> {
    if (folderIds.length < 2) return null;

    const supabase = await this.getSupabase();

    // Get folder details
    const { data: folders, error } = await supabase
      .from("folders")
      .select(
        `
        id,
        name,
        parent_id,
        folder_profiles (
          bookmark_count,
          profile_embedding,
          common_tags
        )
      `,
      )
      .in("id", folderIds)
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error || !folders || folders.length < 2) {
      return null;
    }

    // Calculate metrics
    const folderProfiles = folders.map((f) => {
      const profile = f.folder_profiles?.[0];
      return {
        id: f.id,
        name: f.name,
        bookmarkCount: profile?.bookmark_count || 0,
        embedding: profile?.profile_embedding as number[] | null,
        commonTags: (profile?.common_tags as string[]) || [],
      };
    });

    // Find target (largest folder)
    const sorted = [...folderProfiles].sort(
      (a, b) => b.bookmarkCount - a.bookmarkCount,
    );
    const target = sorted[0];
    const sources = sorted.slice(1);

    // Calculate overall similarity
    let totalSimilarity = 0;
    let pairCount = 0;
    let totalTagOverlap = 0;

    for (let i = 0; i < folderProfiles.length; i++) {
      for (let j = i + 1; j < folderProfiles.length; j++) {
        if (folderProfiles[i].embedding && folderProfiles[j].embedding) {
          totalSimilarity += this.cosineSimilarity(
            folderProfiles[i].embedding!,
            folderProfiles[j].embedding!,
          );
        }
        totalTagOverlap += this.calculateTagOverlap(
          folderProfiles[i].commonTags,
          folderProfiles[j].commonTags,
        );
        pairCount++;
      }
    }

    const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;
    const avgTagOverlap = pairCount > 0 ? totalTagOverlap / pairCount : 0;
    const totalBookmarks = folderProfiles.reduce(
      (sum, f) => sum + f.bookmarkCount,
      0,
    );

    return {
      sourceFolders: sources.map((s) => ({
        id: s.id,
        name: s.name,
        bookmarkCount: s.bookmarkCount,
      })),
      targetFolder: {
        id: target.id,
        name: target.name,
      },
      similarity: avgSimilarity,
      tagOverlap: avgTagOverlap,
      totalBookmarks,
      reason: `${folderProfiles.length} 个文件夹内容相似度 ${Math.round(avgSimilarity * 100)}%，标签重叠 ${Math.round(avgTagOverlap * 100)}%`,
    };
  }

  /**
   * Execute folder merge
   */
  async executeMerge(
    userId: string,
    sourceFolderIds: number[],
    targetFolderId: number,
    newName?: string,
  ): Promise<MergeResult> {
    const supabase = await this.getSupabase();

    try {
      // 1. Validate folders
      const { data: folders, error: folderError } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .in("id", [...sourceFolderIds, targetFolderId])
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (folderError || !folders) {
        return { success: false, message: "获取文件夹信息失败" };
      }

      const targetFolder = folders.find((f) => f.id === targetFolderId);
      const sourceFolders = folders.filter((f) =>
        sourceFolderIds.includes(f.id),
      );

      if (!targetFolder) {
        return { success: false, message: "目标文件夹不存在" };
      }

      if (sourceFolders.length === 0) {
        return { success: false, message: "源文件夹不存在" };
      }

      // 2. Get bookmarks to merge
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from("bookmarks")
        .select("id, title, folder_id")
        .in("folder_id", sourceFolderIds)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (bookmarksError) {
        return { success: false, message: "获取书签信息失败" };
      }

      const mergedBookmarks = bookmarks || [];

      // 3. Move all bookmarks to target folder
      if (mergedBookmarks.length > 0) {
        const { error: moveError } = await supabase
          .from("bookmarks")
          .update({ folder_id: targetFolderId })
          .in("folder_id", sourceFolderIds)
          .eq("user_id", userId);

        if (moveError) {
          return {
            success: false,
            message: `移动书签失败: ${moveError.message}`,
          };
        }
      }

      // 4. Update target folder name if provided
      if (newName && newName !== targetFolder.name) {
        await supabase
          .from("folders")
          .update({ name: newName })
          .eq("id", targetFolderId);
      }

      // 5. Soft delete source folders
      const { error: deleteError } = await supabase
        .from("folders")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", sourceFolderIds);

      if (deleteError) {
        logger.warn(
          { error: deleteError.message },
          "MergeService: Failed to delete source folders",
        );
      }

      // 6. Recompute target folder profile
      await supabase.rpc("compute_folder_profile", {
        p_folder_id: targetFolderId,
      });

      // 7. Create operation snapshot for undo
      await operationLogService.mergeFoldersWithNotification(
        userId,
        sourceFolders.map((f) => ({
          id: f.id,
          name: f.name,
          parent_id: f.parent_id,
        })),
        {
          id: targetFolder.id,
          name: newName || targetFolder.name,
          parent_id: targetFolder.parent_id,
        },
        mergedBookmarks.map((b) => ({
          id: b.id,
          title: b.title,
          folder_id: b.folder_id,
        })),
        `合并 ${sourceFolders.length} 个文件夹到「${newName || targetFolder.name}」`,
      );

      return {
        success: true,
        message: `已合并 ${sourceFolders.length} 个文件夹，共 ${mergedBookmarks.length} 条书签`,
        targetFolderId,
        mergedCount: mergedBookmarks.length,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "MergeService: Merge execution failed",
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : "合并操作失败",
      };
    }
  }

  /**
   * Calculate similarity between two folders
   */
  private calculateSimilarity(
    folder1: FolderProfile,
    folder2: FolderProfile,
  ): number {
    if (!folder1.embedding || !folder2.embedding) {
      // Fall back to tag-based similarity
      return this.calculateTagOverlap(folder1.commonTags, folder2.commonTags);
    }

    return this.cosineSimilarity(folder1.embedding, folder2.embedding);
  }

  /**
   * Calculate tag overlap ratio
   */
  private calculateTagOverlap(tags1: string[], tags2: string[]): number {
    if (tags1.length === 0 && tags2.length === 0) return 0;
    if (tags1.length === 0 || tags2.length === 0) return 0;

    const set1 = new Set(tags1.map((t) => t.toLowerCase()));
    const set2 = new Set(tags2.map((t) => t.toLowerCase()));

    let overlap = 0;
    for (const tag of set1) {
      if (set2.has(tag)) overlap++;
    }

    const union = new Set([...set1, ...set2]).size;
    return union > 0 ? overlap / union : 0;
  }

  /**
   * Cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Suggest merged folder name
   */
  private suggestMergedName(
    target: FolderProfile,
    source: FolderProfile,
  ): string {
    // Use the name of the larger folder, or the shorter/simpler name
    if (target.bookmarkCount > source.bookmarkCount * 2) {
      return target.name;
    }

    // Pick the shorter, more general name
    if (target.name.length <= source.name.length) {
      return target.name;
    }

    return source.name;
  }

  /**
   * Generate human-readable merge reason
   */
  private generateMergeReason(
    similarity: number,
    tagOverlap: number,
    target: FolderProfile,
    source: FolderProfile,
  ): string {
    const reasons: string[] = [];

    if (similarity >= 0.9) {
      reasons.push("内容高度相似");
    } else if (similarity >= 0.8) {
      reasons.push("内容相似");
    }

    if (tagOverlap >= 0.8) {
      reasons.push("标签几乎相同");
    } else if (tagOverlap >= 0.6) {
      reasons.push("标签重叠较多");
    }

    // Check if names are similar
    const name1 = target.name.toLowerCase();
    const name2 = source.name.toLowerCase();
    if (name1.includes(name2) || name2.includes(name1)) {
      reasons.push("文件夹名称相近");
    }

    return reasons.length > 0
      ? reasons.join("，") + `（相似度 ${Math.round(similarity * 100)}%）`
      : `相似度 ${Math.round(similarity * 100)}%`;
  }

  /**
   * Check if two folders are merge candidates
   */
  async areMergeCandidates(
    userId: string,
    folderId1: number,
    folderId2: number,
  ): Promise<{ canMerge: boolean; similarity: number; tagOverlap: number }> {
    const supabase = await this.getSupabase();

    const { data: profiles } = await supabase
      .from("folder_profiles")
      .select("folder_id, profile_embedding, common_tags")
      .in("folder_id", [folderId1, folderId2]);

    if (!profiles || profiles.length < 2) {
      return { canMerge: false, similarity: 0, tagOverlap: 0 };
    }

    const p1 = profiles.find((p) => p.folder_id === folderId1);
    const p2 = profiles.find((p) => p.folder_id === folderId2);

    if (!p1 || !p2) {
      return { canMerge: false, similarity: 0, tagOverlap: 0 };
    }

    const similarity =
      p1.profile_embedding && p2.profile_embedding
        ? this.cosineSimilarity(
            p1.profile_embedding as number[],
            p2.profile_embedding as number[],
          )
        : 0;

    const tagOverlap = this.calculateTagOverlap(
      (p1.common_tags as string[]) || [],
      (p2.common_tags as string[]) || [],
    );

    return {
      canMerge:
        similarity >= MERGE_CONFIG.MIN_SIMILARITY ||
        tagOverlap >= MERGE_CONFIG.MIN_TAG_OVERLAP,
      similarity,
      tagOverlap,
    };
  }
}

// Export singleton
export const mergeService = new MergeService();
