/**
 * Smart Sorting Service (V4.2)
 * 智能分拣服务 - AI 文件夹进化系统核心
 *
 * 核心功能：
 * - 处理缓存池中的待聚类书签
 * - DBSCAN 密度聚类分析
 * - AI 文件夹命名与重复检测
 * - 自动创建文件夹（Level 1）或生成建议（Level 2/3）
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operationLogService } from "./operation-log.service";
import { generateFolderNameFromBookmarks } from "@/lib/utils/ai-generator";
import { v42Table, v42Rpc } from "@/lib/supabase/v42-types";
import { logger } from "@/lib/logger";
import type { AIFolderSettings } from "@/types/supabase";

// ============================================
// 类型定义
// ============================================

/**
 * 待聚类书签
 */
interface PendingBookmark {
  id: number;
  title: string;
  url: string;
  ai_summary: string | null;
  ai_tags: string[] | null;
  embedding: number[];
  pending_since: string;
  cluster_id: string | null;
}

/**
 * 聚类结果
 */
interface Cluster {
  id: string;
  bookmarks: PendingBookmark[];
  centroid: number[];
  avgSimilarity: number;
  suggestedName: string | null;
  suggestedNameReason: string | null;
}

/**
 * 分拣结果
 */
interface SortingResult {
  processed: number;
  clustered: number;
  foldersCreated: number;
  suggestionsCreated: number;
  errors: string[];
}

/**
 * 文件夹创建建议
 */
interface FolderSuggestion {
  clusterId: string;
  suggestedName: string;
  reason: string;
  bookmarkIds: number[];
  bookmarkTitles: string[];
  confidence: number;
}

// ============================================
// 常量配置
// ============================================

/**
 * DBSCAN 聚类参数
 */
const CLUSTERING_CONFIG = {
  // 最小相似度阈值（余弦相似度）
  MIN_SIMILARITY: 0.65,
  // 最小聚类大小
  MIN_CLUSTER_SIZE: 3,
  // 最大聚类大小
  MAX_CLUSTER_SIZE: 20,
  // 缓存池最小等待时间（小时）
  MIN_WAIT_HOURS: 1,
  // 每次处理的最大书签数
  MAX_BATCH_SIZE: 100,
};

/**
 * 每日创建限制
 */
const DAILY_LIMIT = 6;

// ============================================
// SmartSortingService 类
// ============================================

export class SmartSortingService {
  private supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> | null = null;

  /**
   * 获取 Supabase 客户端（延迟初始化）
   */
  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient();
    }
    return this.supabase;
  }

  /**
   * 处理用户的缓存池
   * 主入口函数，定时任务调用
   */
  async processInboxCache(userId: string): Promise<SortingResult> {
    const result: SortingResult = {
      processed: 0,
      clustered: 0,
      foldersCreated: 0,
      suggestionsCreated: 0,
      errors: [],
    };

    try {
      // 1. 获取用户设置
      const settings = await this.getUserSettings(userId);

      // 如果用户禁用了自动创建，跳过
      if (!settings.enable_auto_create) {
        logger.info({ userId }, "SmartSorting: User disabled auto-create, skipping");
        return result;
      }

      // 2. 检查今日创建额度
      const todayCreated = await this.getTodayFolderCount(userId);
      const dailyLimit = settings.daily_create_limit ?? DAILY_LIMIT;
      const remainingQuota = Math.min(
        dailyLimit - todayCreated,
        DAILY_LIMIT - todayCreated
      );

      if (remainingQuota <= 0) {
        logger.info({ userId }, "SmartSorting: User reached daily limit");
        return result;
      }

      // 3. 获取待聚类书签
      const pendingBookmarks = await this.getPendingBookmarks(userId);
      result.processed = pendingBookmarks.length;

      if (pendingBookmarks.length < CLUSTERING_CONFIG.MIN_CLUSTER_SIZE) {
        logger.info({ count: pendingBookmarks.length }, "SmartSorting: Not enough pending bookmarks");
        return result;
      }

      // 4. 执行 DBSCAN 聚类
      const clusters = this.performClustering(pendingBookmarks);
      result.clustered = clusters.reduce((sum, c) => sum + c.bookmarks.length, 0);

      if (clusters.length === 0) {
        logger.info("SmartSorting: No valid clusters found");
        return result;
      }

      // 5. 为每个聚类生成文件夹名称
      for (const cluster of clusters) {
        try {
          const naming = await this.generateClusterName(cluster);
          cluster.suggestedName = naming.name;
          cluster.suggestedNameReason = naming.reason;
        } catch (namingError) {
          logger.error({ error: namingError }, "SmartSorting: Failed to name cluster");
          cluster.suggestedName = this.generateFallbackName(cluster);
          cluster.suggestedNameReason = "基于关键词自动生成";
        }
      }

      // 6. 根据托管等级处理
      const processedClusters = clusters.slice(0, remainingQuota);

      if (settings.autonomy_level === 1) {
        // Level 1: 全自动创建
        for (const cluster of processedClusters) {
          try {
            await this.autoCreateFolder(userId, cluster);
            result.foldersCreated++;
          } catch {
            result.errors.push(`创建文件夹失败: ${cluster.suggestedName}`);
          }
        }
      } else {
        // Level 2/3: 创建建议
        const autonomyLevel = settings.autonomy_level ?? 2;
        for (const cluster of processedClusters) {
          try {
            await this.createSuggestion(userId, cluster, autonomyLevel);
            result.suggestionsCreated++;
          } catch {
            result.errors.push(`创建建议失败: ${cluster.suggestedName}`);
          }
        }
      }

      // 7. 更新书签的聚类 ID
      await this.updateBookmarkClusters(clusters);

      logger.info({ userId, result }, "SmartSorting: User processed");
      return result;
    } catch (processError) {
      logger.error({ userId, error: processError }, "SmartSorting: Error processing user");
      result.errors.push(processError instanceof Error ? processError.message : "未知错误");
      return result;
    }
  }

  /**
   * 获取用户 AI 文件夹设置
   */
  private async getUserSettings(userId: string): Promise<AIFolderSettings> {
    const supabase = await this.getSupabase();

    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();

    // profile.settings 是 Json 类型，需要类型断言
    const settings = profile?.settings as { ai_folder_settings?: AIFolderSettings } | null;
    const aiSettings = settings?.ai_folder_settings;

    // 合并默认设置
    return {
      autonomy_level: aiSettings?.autonomy_level ?? 2,
      enable_auto_create: aiSettings?.enable_auto_create ?? true,
      enable_auto_split: aiSettings?.enable_auto_split ?? false,
      enable_auto_merge: aiSettings?.enable_auto_merge ?? false,
      enable_auto_rename: aiSettings?.enable_auto_rename ?? false,
      create_notification: aiSettings?.create_notification ?? true,
      report_interval: aiSettings?.report_interval ?? "monthly",
      daily_create_limit: aiSettings?.daily_create_limit ?? DAILY_LIMIT,
    };
  }

  /**
   * 获取今日已创建的文件夹数量
   */
  private async getTodayFolderCount(userId: string): Promise<number> {
    const supabase = await this.getSupabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("folders")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("source", "auto_created")
      .gte("created_at", today.toISOString());

    return count ?? 0;
  }

  /**
   * 获取待聚类书签
   */
  private async getPendingBookmarks(userId: string): Promise<PendingBookmark[]> {
    const supabase = await this.getSupabase();

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - CLUSTERING_CONFIG.MIN_WAIT_HOURS);

    // Note: pending_cluster, pending_since, cluster_id 是 V4.2 新增字段
    const { data, error } = await v42Table(supabase)
      .from("bookmarks")
      .select("id, title, url, ai_summary, ai_tags, embedding, pending_since, cluster_id")
      .eq("user_id", userId)
      .eq("pending_cluster", true)
      .is("deleted_at", null)
      .not("embedding", "is", null)
      .lt("pending_since", cutoffTime.toISOString())
      .order("pending_since", { ascending: true })
      .limit(CLUSTERING_CONFIG.MAX_BATCH_SIZE);

    if (error) {
      console.error("[SmartSorting] Failed to get pending bookmarks:", error);
      return [];
    }

    return (data || []).filter((b: { embedding?: unknown }) => b.embedding != null) as PendingBookmark[];
  }

  /**
   * DBSCAN 聚类算法
   * 基于余弦相似度进行密度聚类
   */
  performClustering(bookmarks: PendingBookmark[]): Cluster[] {
    if (bookmarks.length < CLUSTERING_CONFIG.MIN_CLUSTER_SIZE) {
      return [];
    }

    const clusters: Cluster[] = [];
    const visited = new Set<number>();
    const clustered = new Set<number>();

    // 预计算相似度矩阵
    const similarityMatrix = this.computeSimilarityMatrix(bookmarks);

    for (let i = 0; i < bookmarks.length; i++) {
      if (visited.has(i)) continue;
      visited.add(i);

      // 找到邻居
      const neighbors = this.findNeighbors(i, similarityMatrix);

      if (neighbors.length >= CLUSTERING_CONFIG.MIN_CLUSTER_SIZE - 1) {
        // 扩展聚类
        const clusterIndices = this.expandCluster(
          i,
          neighbors,
          visited,
          clustered,
          similarityMatrix
        );

        if (clusterIndices.length >= CLUSTERING_CONFIG.MIN_CLUSTER_SIZE &&
            clusterIndices.length <= CLUSTERING_CONFIG.MAX_CLUSTER_SIZE) {
          const clusterBookmarks = clusterIndices.map(idx => bookmarks[idx]);
          const centroid = this.computeCentroid(clusterBookmarks);
          const avgSimilarity = this.computeAverageSimilarity(clusterIndices, similarityMatrix);

          clusters.push({
            id: crypto.randomUUID(),
            bookmarks: clusterBookmarks,
            centroid,
            avgSimilarity,
            suggestedName: null,
            suggestedNameReason: null,
          });
        }
      }
    }

    // 按聚类大小排序（大的优先）
    return clusters.sort((a, b) => b.bookmarks.length - a.bookmarks.length);
  }

  /**
   * 计算相似度矩阵
   */
  private computeSimilarityMatrix(bookmarks: PendingBookmark[]): number[][] {
    const n = bookmarks.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const similarity = this.cosineSimilarity(
          bookmarks[i].embedding,
          bookmarks[j].embedding
        );
        matrix[i][j] = similarity;
        matrix[j][i] = similarity;
      }
      matrix[i][i] = 1;
    }

    return matrix;
  }

  /**
   * 余弦相似度计算
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * 找到邻居点
   */
  private findNeighbors(pointIdx: number, similarityMatrix: number[][]): number[] {
    const neighbors: number[] = [];
    const row = similarityMatrix[pointIdx];

    for (let i = 0; i < row.length; i++) {
      if (i !== pointIdx && row[i] >= CLUSTERING_CONFIG.MIN_SIMILARITY) {
        neighbors.push(i);
      }
    }

    return neighbors;
  }

  /**
   * 扩展聚类
   */
  private expandCluster(
    pointIdx: number,
    neighbors: number[],
    visited: Set<number>,
    clustered: Set<number>,
    similarityMatrix: number[][]
  ): number[] {
    const cluster = [pointIdx];
    clustered.add(pointIdx);

    const queue = [...neighbors];

    while (queue.length > 0 && cluster.length < CLUSTERING_CONFIG.MAX_CLUSTER_SIZE) {
      const current = queue.shift()!;

      if (!visited.has(current)) {
        visited.add(current);
        const currentNeighbors = this.findNeighbors(current, similarityMatrix);

        if (currentNeighbors.length >= CLUSTERING_CONFIG.MIN_CLUSTER_SIZE - 1) {
          for (const neighbor of currentNeighbors) {
            if (!clustered.has(neighbor)) {
              queue.push(neighbor);
            }
          }
        }
      }

      if (!clustered.has(current)) {
        cluster.push(current);
        clustered.add(current);
      }
    }

    return cluster;
  }

  /**
   * 计算聚类质心
   */
  private computeCentroid(bookmarks: PendingBookmark[]): number[] {
    if (bookmarks.length === 0) return [];

    const dim = bookmarks[0].embedding.length;
    const centroid = new Array(dim).fill(0);

    for (const bookmark of bookmarks) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += bookmark.embedding[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= bookmarks.length;
    }

    return centroid;
  }

  /**
   * 计算聚类平均相似度
   */
  private computeAverageSimilarity(indices: number[], matrix: number[][]): number {
    if (indices.length <= 1) return 1;

    let sum = 0;
    let count = 0;

    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        sum += matrix[indices[i]][indices[j]];
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * 为聚类生成文件夹名称
   */
  private async generateClusterName(cluster: Cluster): Promise<{ name: string; reason: string }> {
    // 收集聚类信息
    const titles = cluster.bookmarks.map(b => b.title);
    const tags = cluster.bookmarks
      .flatMap(b => b.ai_tags || [])
      .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
      .slice(0, 10);
    const summaries = cluster.bookmarks
      .map(b => b.ai_summary)
      .filter(Boolean)
      .slice(0, 3);

    // 调用 AI 生成名称
    const result = await generateFolderNameFromBookmarks({
      titles,
      tags,
      summaries: summaries as string[],
      count: cluster.bookmarks.length,
    });

    return {
      name: result.name,
      reason: result.reason || "基于内容相似性自动分析",
    };
  }

  /**
   * 生成备用名称（当 AI 生成失败时）
   */
  private generateFallbackName(cluster: Cluster): string {
    // 使用最常见的标签
    const tagCounts = new Map<string, number>();
    for (const bookmark of cluster.bookmarks) {
      for (const tag of bookmark.ai_tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const sortedTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([tag]) => tag);

    if (sortedTags.length > 0) {
      return sortedTags.join(" & ");
    }

    // 使用第一个书签标题的关键词
    const firstTitle = cluster.bookmarks[0]?.title || "新文件夹";
    return firstTitle.length > 20 ? firstTitle.substring(0, 20) + "..." : firstTitle;
  }

  /**
   * 检查重复文件夹
   */
  async checkDuplicateFolder(userId: string, folderName: string): Promise<boolean> {
    const supabase = await this.getSupabase();

    const { count } = await supabase
      .from("folders")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .ilike("name", folderName)
      .is("deleted_at", null);

    return (count ?? 0) > 0;
  }

  /**
   * 自动创建文件夹（Level 1 模式）
   */
  private async autoCreateFolder(userId: string, cluster: Cluster): Promise<void> {
    const supabase = await this.getSupabase();

    // 检查重复
    let finalName = cluster.suggestedName || "新文件夹";
    let isDuplicate = await this.checkDuplicateFolder(userId, finalName);
    let suffix = 1;

    while (isDuplicate && suffix <= 10) {
      finalName = `${cluster.suggestedName} (${suffix})`;
      isDuplicate = await this.checkDuplicateFolder(userId, finalName);
      suffix++;
    }

    // 创建文件夹
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .insert({
        user_id: userId,
        name: finalName,
        source: "auto_created",
        is_system: false,
      })
      .select()
      .single();

    if (folderError || !folder) {
      throw new Error(`创建文件夹失败: ${folderError?.message}`);
    }

    // 移动书签到新文件夹
    const bookmarkIds = cluster.bookmarks.map(b => b.id);
    const { error: moveError } = await supabase
      .from("bookmarks")
      .update({
        folder_id: folder.id,
        pending_cluster: false,
        pending_since: null,
        cluster_id: null,
        cluster_confidence: null,
      })
      .in("id", bookmarkIds);

    if (moveError) {
      throw new Error(`移动书签失败: ${moveError.message}`);
    }

    // 创建操作快照（支持撤销）
    await operationLogService.createFolderWithNotification(
      userId,
      {
        id: folder.id,
        name: finalName,
        parent_id: null,
      },
      cluster.bookmarks.map(b => ({
        id: b.id,
        title: b.title,
        folder_id: null, // 之前在待整理
      })),
      cluster.suggestedNameReason || "AI 自动聚类创建"
    );

    // Note: compute_folder_profile 是 V4.2 RPC 函数
    await v42Rpc(supabase).rpc("compute_folder_profile", { p_folder_id: folder.id });

    logger.info({ folderName: finalName, bookmarkCount: bookmarkIds.length }, "SmartSorting: Auto-created folder");
  }

  /**
   * 创建文件夹建议（Level 2/3 模式）
   */
  private async createSuggestion(
    userId: string,
    cluster: Cluster,
    autonomyLevel: number
  ): Promise<void> {
    const supabase = await this.getSupabase();

    const bookmarkIds = cluster.bookmarks.map(b => b.id);
    const sampleTitles = cluster.bookmarks.slice(0, 5).map(b => b.title);

    // Note: organization_suggestions 是 V4.2 建议表
    const { error } = await v42Table(supabase).from("organization_suggestions").insert({
      user_id: userId,
      suggestion_type: "create_new",
      bookmark_ids: bookmarkIds,
      suggested_folder_name: cluster.suggestedName,
      confidence: Math.round(cluster.avgSimilarity * 100),
      reason: cluster.suggestedNameReason,
      sample_titles: sampleTitles,
      status: "pending",
    });

    if (error) {
      throw new Error(`创建建议失败: ${error.message}`);
    }

    logger.info({ folderName: cluster.suggestedName, autonomyLevel }, "SmartSorting: Created suggestion");
  }

  /**
   * 更新书签的聚类 ID
   */
  private async updateBookmarkClusters(clusters: Cluster[]): Promise<void> {
    const supabase = await this.getSupabase();

    for (const cluster of clusters) {
      const bookmarkIds = cluster.bookmarks.map(b => b.id);

      // Note: cluster_id, cluster_confidence 是 V4.2 新增字段
      await v42Table(supabase)
        .from("bookmarks")
        .update({
          cluster_id: cluster.id,
          cluster_confidence: cluster.avgSimilarity,
        })
        .in("id", bookmarkIds);
    }
  }

  /**
   * 获取用户的聚类预览
   * 用于前端展示待确认的聚类
   */
  async getClusterPreview(userId: string): Promise<FolderSuggestion[]> {
    const supabase = await this.getSupabase();

    // Note: organization_suggestions 是 V4.2 建议表
    const { data: suggestions } = await v42Table(supabase)
      .from("organization_suggestions")
      .select("*")
      .eq("user_id", userId)
      .eq("suggestion_type", "create_new")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!suggestions || suggestions.length === 0) {
      return [];
    }

    return (suggestions as Array<{
      id: number;
      suggested_folder_name: string | null;
      reason: string | null;
      bookmark_ids: number[] | null;
      sample_titles: string[] | null;
      confidence: number;
    }>).map(s => ({
      clusterId: s.id.toString(),
      suggestedName: s.suggested_folder_name || "新文件夹",
      reason: s.reason || "",
      bookmarkIds: s.bookmark_ids || [],
      bookmarkTitles: s.sample_titles || [],
      confidence: s.confidence,
    }));
  }

  /**
   * 确认创建文件夹（用户批准建议）
   */
  async confirmCreate(
    userId: string,
    suggestionId: number,
    customName?: string
  ): Promise<{ success: boolean; folderId?: number; error?: string }> {
    const supabase = await this.getSupabase();

    // Note: organization_suggestions 是 V4.2 建议表
    const { data: suggestion, error: fetchError } = await v42Table(supabase)
      .from("organization_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .single();

    if (fetchError || !suggestion) {
      return { success: false, error: "建议不存在或已处理" };
    }

    const typedSuggestion = suggestion as {
      suggested_folder_name: string | null;
      bookmark_ids: number[] | null;
    };
    const folderName = customName || typedSuggestion.suggested_folder_name || "新文件夹";

    // 创建文件夹
    const { data: folder, error: createError } = await supabase
      .from("folders")
      .insert({
        user_id: userId,
        name: folderName,
        source: "auto_created",
        is_system: false,
      })
      .select()
      .single();

    if (createError || !folder) {
      return { success: false, error: `创建文件夹失败: ${createError?.message}` };
    }

    // Note: pending_cluster, pending_since, cluster_id, cluster_confidence 是 V4.2 新增字段
    await v42Table(supabase)
      .from("bookmarks")
      .update({
        folder_id: folder.id,
        pending_cluster: false,
        pending_since: null,
        cluster_id: null,
        cluster_confidence: null,
      })
      .in("id", typedSuggestion.bookmark_ids || []);

    // 更新建议状态
    await v42Table(supabase)
      .from("organization_suggestions")
      .update({
        status: "accepted",
        target_folder_id: folder.id,
        responded_at: new Date().toISOString(),
      })
      .eq("id", suggestionId);

    // Note: compute_folder_profile 是 V4.2 RPC 函数
    await v42Rpc(supabase).rpc("compute_folder_profile", { p_folder_id: folder.id });

    return { success: true, folderId: folder.id };
  }

  /**
   * 拒绝创建建议
   */
  async rejectCreate(userId: string, suggestionId: number): Promise<boolean> {
    const supabase = await this.getSupabase();

    // Note: organization_suggestions 是 V4.2 建议表
    const { error } = await v42Table(supabase)
      .from("organization_suggestions")
      .update({
        status: "rejected",
        responded_at: new Date().toISOString(),
      })
      .eq("id", suggestionId)
      .eq("user_id", userId)
      .eq("status", "pending");

    if (error) {
      console.error("[SmartSorting] Failed to reject suggestion:", error);
      return false;
    }

    // 清除相关书签的聚类标记（让它们重新进入聚类池）
    const { data: suggestion } = await v42Table(supabase)
      .from("organization_suggestions")
      .select("bookmark_ids")
      .eq("id", suggestionId)
      .single();

    const typedSuggestion = suggestion as { bookmark_ids: number[] | null } | null;
    if (typedSuggestion?.bookmark_ids) {
      // Note: cluster_id, cluster_confidence 是 V4.2 新增字段
      await v42Table(supabase)
        .from("bookmarks")
        .update({
          cluster_id: null,
          cluster_confidence: null,
        })
        .in("id", typedSuggestion.bookmark_ids);
    }

    return true;
  }
}

// 导出单例
export const smartSortingService = new SmartSortingService();
