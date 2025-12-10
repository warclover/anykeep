/**
 * Split Service (V4.2)
 * 文件夹分拆服务 - 检测低内聚文件夹并建议分拆
 *
 * 核心功能：
 * - 检测低内聚度文件夹
 * - 使用聚类算法识别子主题
 * - 生成分拆建议或自动执行分拆
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { v42Table, v42Rpc } from "@/lib/supabase/v42-types";
import { operationLogService } from "./operation-log.service";
import { generateFolderNameFromBookmarks } from "@/lib/utils/ai-generator";
import { logger } from "@/lib/logger";

// ============================================
// Type Definitions
// ============================================

/**
 * Folder with profile data
 */
interface FolderWithProfile {
  id: number;
  name: string;
  parent_id: number | null;
  user_id: string;
  bookmark_count: number;
  internal_similarity: number | null;
}

/**
 * Bookmark for clustering
 */
interface ClusterableBookmark {
  id: number;
  title: string;
  ai_summary: string | null;
  ai_tags: string[] | null;
  embedding: number[];
}

/**
 * Sub-cluster result
 */
interface SubCluster {
  bookmarks: ClusterableBookmark[];
  centroid: number[];
  suggestedName: string | null;
  avgSimilarity: number;
}

/**
 * Split suggestion
 */
export interface SplitSuggestion {
  folderId: number;
  folderName: string;
  currentCount: number;
  internalSimilarity: number;
  subClusters: Array<{
    suggestedName: string;
    bookmarkCount: number;
    bookmarkIds: number[];
    sampleTitles: string[];
    avgSimilarity: number;
  }>;
  reason: string;
}

/**
 * Split execution result
 */
export interface SplitResult {
  success: boolean;
  message: string;
  newFolders?: Array<{ id: number; name: string; bookmarkCount: number }>;
}

// ============================================
// Constants
// ============================================

const SPLIT_CONFIG = {
  // Minimum internal similarity threshold (below this suggests split)
  MIN_INTERNAL_SIMILARITY: 0.55,
  // Minimum bookmarks to consider splitting
  MIN_BOOKMARKS_FOR_SPLIT: 10,
  // Maximum bookmarks to process at once
  MAX_BOOKMARKS_BATCH: 100,
  // Minimum sub-cluster size
  MIN_SUBCLUSTER_SIZE: 3,
  // Maximum number of new folders from a split
  MAX_NEW_FOLDERS: 5,
  // Similarity threshold for sub-clustering
  SUBCLUSTER_SIMILARITY: 0.65,
};

// ============================================
// SplitService Class
// ============================================

export class SplitService {
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
   * Get folders that are candidates for splitting
   */
  async getSplitCandidates(userId: string): Promise<FolderWithProfile[]> {
    const supabase = await this.getSupabase();

    // Query folders with low internal similarity and enough bookmarks (V4.2 表)
    const { data, error } = await v42Table(supabase)
      .from("folder_profiles")
      .select(
        `
        folder_id,
        internal_similarity,
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
      .lt("internal_similarity", SPLIT_CONFIG.MIN_INTERNAL_SIMILARITY)
      .gte("bookmark_count", SPLIT_CONFIG.MIN_BOOKMARKS_FOR_SPLIT)
      .order("internal_similarity", { ascending: true })
      .limit(10);

    if (error) {
      logger.error(
        { error: error.message },
        "SplitService: Failed to get split candidates",
      );
      return [];
    }

    // 类型断言
    type ProfileRow = {
      folder_id: number;
      internal_similarity: number | null;
      bookmark_count: number;
      folders: {
        id: number;
        name: string;
        parent_id: number | null;
        user_id: string;
      };
    };
    const typedData = (data || []) as ProfileRow[];

    return typedData.map((item: ProfileRow) => ({
      id: item.folders.id,
      name: item.folders.name,
      parent_id: item.folders.parent_id,
      user_id: item.folders.user_id,
      bookmark_count: item.bookmark_count,
      internal_similarity: item.internal_similarity,
    }));
  }

  /**
   * Analyze a folder and generate split suggestions
   */
  async analyzeSplitOptions(
    userId: string,
    folderId: number,
  ): Promise<SplitSuggestion | null> {
    const supabase = await this.getSupabase();

    // 1. Get folder info
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id, name, parent_id")
      .eq("id", folderId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (folderError || !folder) {
      logger.warn({ folderId }, "SplitService: Folder not found");
      return null;
    }

    // 2. Get folder profile
    // Note: folder_profiles 是 V4.2 新增表
    const { data: profileData } = await v42Table(supabase)
      .from("folder_profiles")
      .select("internal_similarity, bookmark_count")
      .eq("folder_id", folderId)
      .single();

    // 类型断言
    const profile = profileData as {
      internal_similarity: number | null;
      bookmark_count: number;
    } | null;

    if (
      !profile ||
      profile.bookmark_count < SPLIT_CONFIG.MIN_BOOKMARKS_FOR_SPLIT
    ) {
      return null;
    }

    // 3. Get bookmarks with embeddings
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from("bookmarks")
      .select("id, title, ai_summary, ai_tags, embedding")
      .eq("folder_id", folderId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("embedding", "is", null)
      .limit(SPLIT_CONFIG.MAX_BOOKMARKS_BATCH);

    if (
      bookmarksError ||
      !bookmarks ||
      bookmarks.length < SPLIT_CONFIG.MIN_BOOKMARKS_FOR_SPLIT
    ) {
      return null;
    }

    // 转换 embedding 从数据库字符串格式到 number[]
    const clusterableBookmarks: ClusterableBookmark[] = bookmarks
      .filter((b) => b.embedding)
      .map((b) => ({
        id: b.id,
        title: b.title,
        ai_summary: b.ai_summary,
        ai_tags: b.ai_tags,
        embedding:
          typeof b.embedding === "string"
            ? JSON.parse(b.embedding)
            : b.embedding,
      }));

    // 4. Perform sub-clustering
    const subClusters = this.performSubClustering(clusterableBookmarks);

    if (subClusters.length < 2) {
      // No meaningful split possible
      return null;
    }

    // 5. Generate names for sub-clusters
    const namedClusters = await Promise.all(
      subClusters
        .slice(0, SPLIT_CONFIG.MAX_NEW_FOLDERS)
        .map(async (cluster) => {
          const name = await this.generateSubClusterName(cluster);
          return {
            suggestedName: name,
            bookmarkCount: cluster.bookmarks.length,
            bookmarkIds: cluster.bookmarks.map((b) => b.id),
            sampleTitles: cluster.bookmarks.slice(0, 3).map((b) => b.title),
            avgSimilarity: cluster.avgSimilarity,
          };
        }),
    );

    return {
      folderId: folder.id,
      folderName: folder.name,
      currentCount: profile.bookmark_count,
      internalSimilarity: profile.internal_similarity || 0,
      subClusters: namedClusters,
      reason: `文件夹内聚度较低 (${Math.round((profile.internal_similarity || 0) * 100)}%)，检测到 ${namedClusters.length} 个子主题`,
    };
  }

  /**
   * Execute folder split
   */
  async executeSplit(
    userId: string,
    folderId: number,
    subClusterConfig: Array<{
      name: string;
      bookmarkIds: number[];
    }>,
  ): Promise<SplitResult> {
    const supabase = await this.getSupabase();

    try {
      // 1. Get original folder
      const { data: originalFolder, error: folderError } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .eq("id", folderId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (folderError || !originalFolder) {
        return { success: false, message: "原文件夹不存在" };
      }

      const newFolders: Array<{
        id: number;
        name: string;
        bookmarkCount: number;
      }> = [];
      const bookmarkMoves: Array<{
        bookmark_id: number;
        from_folder_id: number;
        to_folder_id: number;
      }> = [];

      // 2. Create new folders and move bookmarks
      for (const config of subClusterConfig) {
        // Create new folder
        const { data: newFolder, error: createError } = await supabase
          .from("folders")
          .insert({
            user_id: userId,
            name: config.name,
            parent_id: originalFolder.parent_id,
            source: "auto_split",
          })
          .select()
          .single();

        if (createError || !newFolder) {
          logger.error(
            { error: createError?.message },
            "SplitService: Failed to create sub-folder",
          );
          continue;
        }

        // Move bookmarks
        const { error: moveError } = await supabase
          .from("bookmarks")
          .update({ folder_id: newFolder.id })
          .in("id", config.bookmarkIds)
          .eq("user_id", userId);

        if (moveError) {
          logger.error(
            { error: moveError.message },
            "SplitService: Failed to move bookmarks",
          );
          continue;
        }

        newFolders.push({
          id: newFolder.id,
          name: newFolder.name,
          bookmarkCount: config.bookmarkIds.length,
        });

        // Record moves for snapshot
        for (const bookmarkId of config.bookmarkIds) {
          bookmarkMoves.push({
            bookmark_id: bookmarkId,
            from_folder_id: folderId,
            to_folder_id: newFolder.id,
          });
        }

        // Compute profile for new folder
        // Note: compute_folder_profile 是 V4.2 新增 RPC
        await v42Rpc(supabase).rpc("compute_folder_profile", {
          p_folder_id: newFolder.id,
        });
      }

      if (newFolders.length === 0) {
        return { success: false, message: "创建子文件夹失败" };
      }

      // 3. Check if original folder is now empty
      const { count: remainingCount } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", folderId)
        .is("deleted_at", null);

      if (remainingCount === 0) {
        // Soft delete empty original folder
        await supabase
          .from("folders")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", folderId);
      }

      // 4. Create operation snapshot for undo
      await operationLogService.splitFolderWithNotification(
        userId,
        {
          id: originalFolder.id,
          name: originalFolder.name,
          parent_id: originalFolder.parent_id,
        },
        newFolders.map((f) => ({
          id: f.id,
          name: f.name,
          parent_id: originalFolder.parent_id,
        })),
        bookmarkMoves,
        `文件夹「${originalFolder.name}」分拆为 ${newFolders.length} 个子文件夹`,
      );

      return {
        success: true,
        message: `已将「${originalFolder.name}」分拆为 ${newFolders.length} 个文件夹`,
        newFolders,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "SplitService: Split execution failed",
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : "分拆操作失败",
      };
    }
  }

  /**
   * Perform sub-clustering using k-means style approach
   */
  private performSubClustering(bookmarks: ClusterableBookmark[]): SubCluster[] {
    if (bookmarks.length < SPLIT_CONFIG.MIN_SUBCLUSTER_SIZE * 2) {
      return [];
    }

    const clusters: SubCluster[] = [];
    const assigned = new Set<number>();

    // Simple greedy clustering
    const similarityMatrix = this.computeSimilarityMatrix(bookmarks);

    // 循环保护：最多迭代 bookmarks.length 次
    const maxIterations = bookmarks.length;
    let iterations = 0;

    while (assigned.size < bookmarks.length && iterations < maxIterations) {
      iterations++;
      // Find the unassigned bookmark with lowest average similarity to others
      let seedIdx = -1;
      let lowestAvg = Infinity;

      for (let i = 0; i < bookmarks.length; i++) {
        if (assigned.has(i)) continue;

        let sum = 0;
        let count = 0;
        for (let j = 0; j < bookmarks.length; j++) {
          if (i !== j && !assigned.has(j)) {
            sum += similarityMatrix[i][j];
            count++;
          }
        }
        const avg = count > 0 ? sum / count : 0;
        if (avg < lowestAvg) {
          lowestAvg = avg;
          seedIdx = i;
        }
      }

      if (seedIdx === -1) break;

      // Grow cluster from seed
      const clusterIndices: number[] = [seedIdx];
      assigned.add(seedIdx);

      for (let i = 0; i < bookmarks.length; i++) {
        if (assigned.has(i)) continue;

        // Check if this bookmark is similar enough to cluster
        const avgSimilarityToCluster =
          clusterIndices.reduce(
            (sum, idx) => sum + similarityMatrix[i][idx],
            0,
          ) / clusterIndices.length;

        if (avgSimilarityToCluster >= SPLIT_CONFIG.SUBCLUSTER_SIMILARITY) {
          clusterIndices.push(i);
          assigned.add(i);
        }
      }

      if (clusterIndices.length >= SPLIT_CONFIG.MIN_SUBCLUSTER_SIZE) {
        const clusterBookmarks = clusterIndices.map((idx) => bookmarks[idx]);
        clusters.push({
          bookmarks: clusterBookmarks,
          centroid: this.computeCentroid(clusterBookmarks),
          suggestedName: null,
          avgSimilarity: this.computeClusterSimilarity(
            clusterIndices,
            similarityMatrix,
          ),
        });
      }
    }

    return clusters.sort((a, b) => b.bookmarks.length - a.bookmarks.length);
  }

  /**
   * Compute similarity matrix
   */
  private computeSimilarityMatrix(
    bookmarks: ClusterableBookmark[],
  ): number[][] {
    const n = bookmarks.length;
    const matrix: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sim = this.cosineSimilarity(
          bookmarks[i].embedding,
          bookmarks[j].embedding,
        );
        matrix[i][j] = sim;
        matrix[j][i] = sim;
      }
      matrix[i][i] = 1;
    }

    return matrix;
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
   * Compute cluster centroid
   */
  private computeCentroid(bookmarks: ClusterableBookmark[]): number[] {
    if (bookmarks.length === 0) return [];

    const dim = bookmarks[0].embedding.length;
    const centroid = new Array(dim).fill(0);

    for (const b of bookmarks) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += b.embedding[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= bookmarks.length;
    }

    return centroid;
  }

  /**
   * Compute average similarity within cluster
   */
  private computeClusterSimilarity(
    indices: number[],
    matrix: number[][],
  ): number {
    if (indices.length <= 1) return 1;

    let sum = 0,
      count = 0;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        sum += matrix[indices[i]][indices[j]];
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * Generate name for sub-cluster
   */
  private async generateSubClusterName(cluster: SubCluster): Promise<string> {
    try {
      const titles = cluster.bookmarks.map((b) => b.title);
      const tags = cluster.bookmarks
        .flatMap((b) => b.ai_tags || [])
        .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
        .slice(0, 10);
      const summaries = cluster.bookmarks
        .map((b) => b.ai_summary)
        .filter(Boolean)
        .slice(0, 3);

      const result = await generateFolderNameFromBookmarks({
        titles,
        tags,
        summaries: summaries as string[],
        count: cluster.bookmarks.length,
      });

      return result.name;
    } catch {
      // Fallback: use most common tag
      const tagCounts = new Map<string, number>();
      for (const b of cluster.bookmarks) {
        for (const tag of b.ai_tags || []) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      const topTag = Array.from(tagCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0];

      return topTag || cluster.bookmarks[0]?.title.slice(0, 20) || "子文件夹";
    }
  }
}

// Export singleton
export const splitService = new SplitService();
