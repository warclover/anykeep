/**
 * Inbox Organizer Service
 * Manages intelligent organization of inbox bookmarks
 *
 * V4.2.1 优化:
 * - 修复 N+1 查询问题，使用批量查询 + 内存匹配
 * - 增量更新：新增书签时只计算增量，而非全量重新聚类
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IInboxOrganizerService } from "./interfaces";
import type {
  OrganizationAnalysis,
  OrganizationSuggestion,
  BookmarkCluster,
  SuggestionInput,
  ClusterProcessingStatus,
  FolderProfile,
} from "../types";
import type {
  FolderProfileRepository,
  SuggestionRepository,
  InterestRepository,
} from "../repositories";
import { BookmarkRepository } from "@/repositories/bookmark.repository";
import type { BookmarkForClassification } from "@/repositories/bookmark.repository";
import { INBOX_ORGANIZE_TRIGGERS } from "../constants";
import { clusterBookmarks } from "../utils/clustering";
import { cosineSimilarity, calculateCentroid } from "../utils/similarity";
import { logger } from "@/lib/logger";
import { PerformanceMonitor } from "@/lib/utils/performance-monitor";

/**
 * V4.2.1: 增量分析状态
 * 用于跟踪上次分析的书签集合，判断是否可以进行增量更新
 */
interface IncrementalAnalysisState {
  /** 上次分析时的书签 ID 集合 */
  analyzedBookmarkIds: Set<number>;
  /** 上次分析时间 */
  analyzedAt: Date;
  /** 现有建议与其聚类中心的映射 */
  suggestionCentroids: Map<number, number[]>;
}

/**
 * Service for organizing inbox bookmarks
 */
export class InboxOrganizerService implements IInboxOrganizerService {
  /**
   * V4.2.1: 用户增量分析状态缓存
   * 以用户 ID 为 key，存储上次分析的状态
   */
  private static incrementalStateCache = new Map<
    string,
    IncrementalAnalysisState
  >();

  constructor(
    private folderProfileRepo: FolderProfileRepository,
    private suggestionRepo: SuggestionRepository,
    private interestRepo: InterestRepository,
    private supabase: SupabaseClient,
  ) {}

  /**
   * V4.2.1: 缓存 TTL（5 分钟）
   */
  private readonly CACHE_TTL = 5 * 60 * 1000;

  /**
   * V4.2.1: 增量分析的相似度阈值
   * 新书签与现有聚类匹配时使用
   */
  private readonly INCREMENTAL_MATCH_THRESHOLD = 0.75;

  /**
   * Analyze inbox and generate organization suggestions
   * V4.2.1: 添加智能缓存 + 增量更新
   * - 如果有未过期的 pending 建议且数据未变，直接返回
   * - 如果只有新增书签，尝试增量更新而非全量重新聚类
   */
  async analyze(userId: string): Promise<OrganizationAnalysis> {
    const monitor = new PerformanceMonitor("InboxOrganizerAnalyze");
    const bookmarkRepo = new BookmarkRepository(this.supabase, userId);

    // Get inbox bookmarks
    // Note: bookmarkRepo uses internal userId from constructor
    const inboxBookmarks = await monitor.measure("FetchInboxBookmarks", () =>
      bookmarkRepo.findInboxBookmarks(),
    );

    if (inboxBookmarks.length < INBOX_ORGANIZE_TRIGGERS.COUNT_THRESHOLD) {
      // Not enough bookmarks to analyze
      return {
        inboxCount: inboxBookmarks.length,
        suggestions: [],
        lastAnalyzedAt: null,
        nextSuggestedAnalyzeAt: null,
      };
    }

    // V4.2.1: 智能缓存检查 - 如果有 pending 建议且未过期，直接返回
    // 添加 try-catch 确保即使建议查询失败也能继续分析
    let existingSuggestions: OrganizationSuggestion[] = [];
    try {
      existingSuggestions = await monitor.measure(
        "FetchExistingSuggestions",
        () => this.suggestionRepo.findPendingByUserId(userId),
      );
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
        },
        "Inbox Organizer: Failed to fetch existing suggestions, continuing with full analysis",
      );
    }

    if (existingSuggestions.length > 0) {
      const oldestSuggestion = existingSuggestions.reduce((oldest, s) =>
        s.createdAt < oldest.createdAt ? s : oldest,
      );
      const suggestionAge =
        Date.now() - new Date(oldestSuggestion.createdAt).getTime();

      // 获取上次分析状态
      const lastState = InboxOrganizerService.incrementalStateCache.get(userId);
      const currentBookmarkIds = new Set(inboxBookmarks.map((b) => b.id));

      // 如果建议未过期（小于 5 分钟），检查是否完全缓存命中
      if (suggestionAge < this.CACHE_TTL && lastState) {
        // 检查是否有任何变化
        const hasRemovals = [...lastState.analyzedBookmarkIds].some(
          (id) => !currentBookmarkIds.has(id),
        );
        const newBookmarkIds = [...currentBookmarkIds].filter(
          (id) => !lastState.analyzedBookmarkIds.has(id),
        );

        // 完全缓存命中：没有变化
        if (!hasRemovals && newBookmarkIds.length === 0) {
          logger.debug(
            {
              userId,
              existingSuggestionsCount: existingSuggestions.length,
              suggestionAgeMs: suggestionAge,
              cacheHit: "full",
            },
            "Inbox Organizer: Full cache hit - returning existing suggestions",
          );

          return {
            inboxCount: inboxBookmarks.length,
            suggestions: existingSuggestions,
            lastAnalyzedAt: oldestSuggestion.createdAt,
            nextSuggestedAnalyzeAt: this.getNextAnalyzeDate(),
          };
        }

        // V4.2.1: 增量更新场景 - 只有新增书签，没有删除
        if (!hasRemovals && newBookmarkIds.length > 0) {
          const incrementalResult = await monitor.measure(
            "IncrementalAnalysis",
            () =>
              this.tryIncrementalAnalysis(
                userId,
                inboxBookmarks,
                existingSuggestions,
                newBookmarkIds,
                lastState,
              ),
          );

          if (incrementalResult) {
            const perfReport = monitor.getReport();
            logger.info(
              {
                userId,
                newBookmarkCount: newBookmarkIds.length,
                updatedSuggestionCount: incrementalResult.suggestions.length,
                performanceMs: Math.round(perfReport.totalDuration),
                action: "inbox_incremental_update",
              },
              "Inbox Organizer: Incremental update successful",
            );

            return incrementalResult;
          }
          // 增量更新失败，继续全量分析
        }
      }
    }

    // 全量分析
    return this.performFullAnalysis(userId, inboxBookmarks, monitor);
  }

  /**
   * V4.2.1: 执行全量聚类分析
   * 当增量更新不适用时调用
   */
  private async performFullAnalysis(
    userId: string,
    inboxBookmarks: BookmarkForClassification[],
    monitor: PerformanceMonitor,
  ): Promise<OrganizationAnalysis> {
    // Delete old pending suggestions
    await monitor.measure("DeleteOldSuggestions", () =>
      this.suggestionRepo.deletePendingByUserId(userId),
    );

    // Get embeddings for clustering
    const bookmarksWithEmbedding = inboxBookmarks.filter(
      (b) => b.embedding && b.embedding.length > 0,
    );

    if (
      bookmarksWithEmbedding.length < INBOX_ORGANIZE_TRIGGERS.MIN_CLUSTER_SIZE
    ) {
      return {
        inboxCount: inboxBookmarks.length,
        suggestions: [],
        lastAnalyzedAt: new Date(),
        nextSuggestedAnalyzeAt: this.getNextAnalyzeDate(),
      };
    }

    // Cluster bookmarks (synchronous operation)
    const clusterStart = performance.now();
    const clusters = clusterBookmarks(
      bookmarksWithEmbedding.map((b) => {
        const embedding = b.embedding;
        if (!embedding?.length)
          throw new Error("Missing embedding for cluster");
        return { id: b.id, embedding, title: b.title };
      }),
      INBOX_ORGANIZE_TRIGGERS.CLUSTER_SIMILARITY,
      INBOX_ORGANIZE_TRIGGERS.MIN_CLUSTER_SIZE,
    );
    monitor.mark("ClusterBookmarks", {
      clusterCount: clusters.length,
      durationMs: Math.round(performance.now() - clusterStart),
    });

    // Generate suggestions from clusters
    const suggestionInputs: SuggestionInput[] = [];

    // V4.2.1: 批量预取所有文件夹配置，避免 N+1 查询
    const [folderProfiles, { data: folderStats }] = await monitor.measure(
      "FetchFolderProfiles",
      () =>
        Promise.all([
          this.folderProfileRepo.findByUserId(userId),
          this.supabase.rpc("get_user_folder_stats", { p_user_id: userId }),
        ]),
    );
    const canCreateMore = folderStats?.can_create_more ?? true;

    // 构建建议与其聚类中心的映射（用于增量更新）
    const suggestionCentroids = new Map<number, number[]>();

    for (const cluster of clusters) {
      const matchedFolder = this.matchClusterInMemory(
        cluster.centroid,
        folderProfiles,
      );

      if (matchedFolder) {
        suggestionInputs.push({
          suggestionType: "move_to_existing",
          bookmarkIds: cluster.bookmarkIds,
          targetFolderId: matchedFolder.folderId,
          confidence: Math.round(matchedFolder.similarity * 100),
          reason: `${cluster.bookmarkIds.length} bookmarks similar to "${matchedFolder.folderName}"`,
          sampleTitles: cluster.sampleTitles.slice(0, 3),
        });
      } else if (canCreateMore) {
        const suggestedName = await this.generateFolderName(cluster);
        suggestionInputs.push({
          suggestionType: "create_new",
          bookmarkIds: cluster.bookmarkIds,
          suggestedFolderName: suggestedName,
          confidence: Math.round(cluster.avgSimilarity * 100),
          reason: `${cluster.bookmarkIds.length} similar bookmarks could form a new category`,
          sampleTitles: cluster.sampleTitles.slice(0, 3),
        });
      }
    }

    // Save suggestions
    const savedSuggestions = await monitor.measure("SaveSuggestions", () =>
      this.suggestionRepo.createBatch(userId, suggestionInputs),
    );

    // 保存增量分析状态（用于下次增量更新）
    const analyzedBookmarkIds = new Set(inboxBookmarks.map((b) => b.id));
    for (let i = 0; i < savedSuggestions.length && i < clusters.length; i++) {
      suggestionCentroids.set(savedSuggestions[i].id, clusters[i].centroid);
    }

    InboxOrganizerService.incrementalStateCache.set(userId, {
      analyzedBookmarkIds,
      analyzedAt: new Date(),
      suggestionCentroids,
    });

    // Update last organize timestamp
    await this.interestRepo.updateLastInboxOrganizeAt(userId);

    const perfReport = monitor.getReport();
    logger.info(
      {
        userId,
        inboxCount: inboxBookmarks.length,
        clusterCount: clusters.length,
        suggestionCount: savedSuggestions.length,
        performanceMs: Math.round(perfReport.totalDuration),
        action: "inbox_full_analyzed",
      },
      "Inbox Organizer: Full analysis complete",
    );

    return {
      inboxCount: inboxBookmarks.length,
      suggestions: savedSuggestions,
      lastAnalyzedAt: new Date(),
      nextSuggestedAnalyzeAt: this.getNextAnalyzeDate(),
    };
  }

  /**
   * V4.2.1: 尝试增量分析
   * 当只有新增书签时，尝试将新书签匹配到现有建议，而非全量重新聚类
   *
   * @returns OrganizationAnalysis if incremental update succeeded, null if full analysis needed
   */
  private async tryIncrementalAnalysis(
    userId: string,
    inboxBookmarks: BookmarkForClassification[],
    existingSuggestions: OrganizationSuggestion[],
    newBookmarkIds: number[],
    lastState: IncrementalAnalysisState,
  ): Promise<OrganizationAnalysis | null> {
    // 获取新书签的详细信息
    const newBookmarks = inboxBookmarks.filter((b) =>
      newBookmarkIds.includes(b.id),
    );
    const newBookmarksWithEmbedding = newBookmarks.filter(
      (b) => b.embedding && b.embedding.length > 0,
    );

    // 如果新书签太多（>10），回退到全量分析以保证聚类质量
    if (newBookmarksWithEmbedding.length > 10) {
      logger.debug(
        { userId, newBookmarkCount: newBookmarksWithEmbedding.length },
        "Inbox Organizer: Too many new bookmarks, falling back to full analysis",
      );
      return null;
    }

    // 如果新书签没有 embedding，跳过
    if (newBookmarksWithEmbedding.length === 0) {
      logger.debug(
        { userId, newBookmarkCount: newBookmarks.length },
        "Inbox Organizer: New bookmarks have no embeddings, skipping incremental",
      );
      // 返回现有建议（无变化）
      return {
        inboxCount: inboxBookmarks.length,
        suggestions: existingSuggestions,
        lastAnalyzedAt: lastState.analyzedAt,
        nextSuggestedAnalyzeAt: this.getNextAnalyzeDate(),
      };
    }

    // 尝试将每个新书签匹配到现有建议
    const updatedSuggestions = new Map<
      number,
      {
        newBookmarkIds: number[];
        newTitles: string[];
      }
    >();
    const unmatchedBookmarks: BookmarkForClassification[] = [];

    for (const bookmark of newBookmarksWithEmbedding) {
      const embedding = bookmark.embedding;
      if (!embedding) continue;
      let matched = false;

      // 遍历现有建议，寻找最佳匹配
      for (const suggestion of existingSuggestions) {
        const centroid = lastState.suggestionCentroids.get(suggestion.id);
        if (!centroid) continue;

        const similarity = cosineSimilarity(embedding, centroid);
        if (similarity >= this.INCREMENTAL_MATCH_THRESHOLD) {
          // 找到匹配，记录需要更新的建议
          const existing = updatedSuggestions.get(suggestion.id) || {
            newBookmarkIds: [],
            newTitles: [],
          };
          existing.newBookmarkIds.push(bookmark.id);
          existing.newTitles.push(bookmark.title);
          updatedSuggestions.set(suggestion.id, existing);
          matched = true;
          break;
        }
      }

      if (!matched) {
        unmatchedBookmarks.push(bookmark);
      }
    }

    // 如果有太多未匹配的书签，回退到全量分析
    if (unmatchedBookmarks.length >= INBOX_ORGANIZE_TRIGGERS.MIN_CLUSTER_SIZE) {
      logger.debug(
        { userId, unmatchedCount: unmatchedBookmarks.length },
        "Inbox Organizer: Too many unmatched bookmarks, falling back to full analysis",
      );
      return null;
    }

    // 更新匹配到的建议
    const updatedSuggestionList: OrganizationSuggestion[] = [];

    for (const suggestion of existingSuggestions) {
      const updates = updatedSuggestions.get(suggestion.id);

      if (updates && updates.newBookmarkIds.length > 0) {
        // 合并书签 ID 和标题
        const mergedBookmarkIds = [
          ...suggestion.bookmarkIds,
          ...updates.newBookmarkIds,
        ];
        const mergedTitles = [
          ...suggestion.sampleTitles,
          ...updates.newTitles,
        ].slice(0, 5);

        // 更新建议
        await this.suggestionRepo.updateBookmarkIds(
          suggestion.id,
          mergedBookmarkIds,
          mergedTitles,
        );

        // 更新聚类中心（加入新书签的 embeddings）
        const newEmbeddings = newBookmarksWithEmbedding
          .filter((b) => updates.newBookmarkIds.includes(b.id))
          .filter((b) => b.embedding && b.embedding.length > 0)
          .map((b) => b.embedding as number[]);

        if (newEmbeddings.length > 0) {
          const oldCentroid = lastState.suggestionCentroids.get(suggestion.id);
          if (oldCentroid) {
            // 简化处理：使用加权平均更新中心点
            const allEmbeddings = [oldCentroid, ...newEmbeddings];
            const newCentroid = calculateCentroid(allEmbeddings);
            lastState.suggestionCentroids.set(suggestion.id, newCentroid);
          }
        }

        // 更新返回的建议对象
        updatedSuggestionList.push({
          ...suggestion,
          bookmarkIds: mergedBookmarkIds,
          sampleTitles: mergedTitles,
        });
      } else {
        updatedSuggestionList.push(suggestion);
      }
    }

    // 更新增量状态
    const newAnalyzedIds = new Set([
      ...lastState.analyzedBookmarkIds,
      ...newBookmarkIds,
    ]);
    InboxOrganizerService.incrementalStateCache.set(userId, {
      ...lastState,
      analyzedBookmarkIds: newAnalyzedIds,
      analyzedAt: new Date(),
    });

    return {
      inboxCount: inboxBookmarks.length,
      suggestions: updatedSuggestionList,
      lastAnalyzedAt: new Date(),
      nextSuggestedAnalyzeAt: this.getNextAnalyzeDate(),
    };
  }

  /**
   * Apply an organization suggestion
   */
  async applySuggestion(userId: string, suggestionId: number): Promise<void> {
    const suggestion = await this.suggestionRepo.findById(suggestionId);

    if (!suggestion) {
      throw new Error("Suggestion not found");
    }

    if (suggestion.userId !== userId) {
      throw new Error("Unauthorized");
    }

    if (suggestion.status !== "pending") {
      throw new Error("Suggestion is not pending");
    }

    if (suggestion.suggestionType === "move_to_existing") {
      if (!suggestion.targetFolderId) {
        throw new Error("Target folder not specified");
      }

      // Move bookmarks to target folder
      const bookmarkRepo = new BookmarkRepository(this.supabase, userId);
      await bookmarkRepo.moveToFolder(
        suggestion.bookmarkIds,
        suggestion.targetFolderId,
      );

      // Update folder profile (non-blocking)
      try {
        await this.folderProfileRepo.computeProfile(suggestion.targetFolderId);
      } catch (profileError) {
        logger.warn(
          { error: profileError, folderId: suggestion.targetFolderId },
          "Failed to compute folder profile, continuing",
        );
      }
    } else if (suggestion.suggestionType === "create_new") {
      if (!suggestion.suggestedFolderName) {
        throw new Error("Folder name not specified");
      }

      // V4.2.16: 检查是否已存在同名文件夹（去重检查）
      const { data: existingFolder } = await this.supabase
        .from("folders")
        .select("id, name")
        .eq("user_id", userId)
        .eq("name", suggestion.suggestedFolderName)
        .is("deleted_at", null)
        .maybeSingle();

      let targetFolderId: number;

      if (existingFolder) {
        // 同名文件夹已存在，复用该文件夹
        targetFolderId = existingFolder.id;
        logger.info(
          {
            userId,
            suggestionId,
            existingFolderId: targetFolderId,
            folderName: suggestion.suggestedFolderName,
            action: "reuse_existing_folder",
          },
          "Inbox Organizer: Reusing existing folder instead of creating new",
        );
      } else {
        // 创建新文件夹
        const { data: newFolder, error } = await this.supabase
          .from("folders")
          .insert({
            user_id: userId,
            name: suggestion.suggestedFolderName,
            is_system: false,
            source: "clustering",
          })
          .select("id")
          .single();

        if (error) {
          logger.error(
            { error, userId, folderName: suggestion.suggestedFolderName },
            "Failed to create folder",
          );
          throw new Error(`Failed to create folder: ${error.message}`);
        }

        targetFolderId = newFolder.id;

        // Compute profile for new folder
        try {
          await this.folderProfileRepo.computeProfile(targetFolderId);
        } catch (profileError) {
          // Profile computation failure should not block the operation
          logger.warn(
            { error: profileError, folderId: targetFolderId },
            "Failed to compute folder profile, continuing",
          );
        }
      }

      // Move bookmarks to target folder
      const bookmarkRepo = new BookmarkRepository(this.supabase, userId);
      await bookmarkRepo.moveToFolder(suggestion.bookmarkIds, targetFolderId);
    }

    // Mark suggestion as accepted
    await this.suggestionRepo.accept(suggestionId);

    logger.info(
      {
        userId,
        suggestionId,
        type: suggestion.suggestionType,
        bookmarkCount: suggestion.bookmarkIds.length,
        action: "suggestion_applied",
      },
      "Inbox Organizer: Suggestion applied",
    );
  }

  /**
   * Reject an organization suggestion
   */
  async rejectSuggestion(userId: string, suggestionId: number): Promise<void> {
    const suggestion = await this.suggestionRepo.findById(suggestionId);

    if (!suggestion) {
      throw new Error("Suggestion not found");
    }

    if (suggestion.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await this.suggestionRepo.reject(suggestionId);

    logger.info(
      { userId, suggestionId, action: "suggestion_rejected" },
      "Inbox Organizer: Suggestion rejected",
    );
  }

  /**
   * Match cluster to existing folder (DB query - deprecated, use matchClusterInMemory)
   * @deprecated Use matchClusterInMemory for batch processing
   */
  private async matchClusterToFolder(
    centroid: number[],
    userId: string,
  ): Promise<{
    folderId: number;
    folderName: string;
    similarity: number;
  } | null> {
    const similarFolders = await this.folderProfileRepo.searchSimilarFolders(
      centroid,
      userId,
      INBOX_ORGANIZE_TRIGGERS.FOLDER_MATCH_THRESHOLD,
      1,
    );

    if (similarFolders.length === 0) {
      return null;
    }

    return {
      folderId: similarFolders[0].folderId,
      folderName: similarFolders[0].folderName,
      similarity: similarFolders[0].similarity,
    };
  }

  /**
   * V4.2.1: 在内存中匹配聚类到现有文件夹
   * 避免 N+1 查询问题，使用预取的文件夹配置进行内存匹配
   */
  private matchClusterInMemory(
    centroid: number[],
    folderProfiles: FolderProfile[],
    threshold: number = INBOX_ORGANIZE_TRIGGERS.FOLDER_MATCH_THRESHOLD,
  ): {
    folderId: number;
    folderName: string;
    similarity: number;
  } | null {
    let bestMatch: {
      folderId: number;
      folderName: string;
      similarity: number;
    } | null = null;

    for (const profile of folderProfiles) {
      // 跳过没有向量或名称的文件夹
      if (
        !profile.profileEmbedding ||
        profile.profileEmbedding.length === 0 ||
        !profile.folderName
      ) {
        continue;
      }

      // 计算余弦相似度
      const similarity = cosineSimilarity(centroid, profile.profileEmbedding);

      // 检查是否超过阈值且是目前最佳匹配
      if (similarity >= threshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = {
            folderId: profile.folderId,
            folderName: profile.folderName,
            similarity,
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Generate folder name from cluster
   */
  private async generateFolderName(cluster: BookmarkCluster): Promise<string> {
    // If AI suggested a name, use it
    if (cluster.suggestedName) {
      return cluster.suggestedName;
    }

    // Otherwise, generate from sample titles
    // Extract common words from titles
    const words = cluster.sampleTitles
      .join(" ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.toLowerCase());

    // Count word frequency
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    // Get top words
    const topWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([word]) => word);

    if (topWords.length > 0) {
      return topWords.join("·");
    }

    return `分类${Date.now()}`;
  }

  /**
   * Get next suggested analyze date
   */
  private getNextAnalyzeDate(): Date {
    const next = new Date();
    next.setDate(
      next.getDate() + INBOX_ORGANIZE_TRIGGERS.DAYS_SINCE_LAST_ORGANIZE,
    );
    return next;
  }

  /**
   * V4.2: 获取聚类处理状态
   */
  async getClusterProcessingStatus(
    userId: string,
  ): Promise<ClusterProcessingStatus> {
    // 1. 获取待聚类书签数量
    const { count: pendingClusterCount, error: pendingError } =
      await this.supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("pending_cluster", true)
        .is("deleted_at", null);

    if (pendingError) {
      logger.warn(
        { error: pendingError, userId },
        "Failed to get pending cluster count",
      );
    }

    // 2. 获取当前聚类数量（已分配 cluster_id 的书签）
    const { data: clusterData, error: clusterError } = await this.supabase
      .from("bookmarks")
      .select("cluster_id")
      .eq("user_id", userId)
      .not("cluster_id", "is", null)
      .is("deleted_at", null);

    if (clusterError) {
      logger.warn({ error: clusterError, userId }, "Failed to get cluster IDs");
    }

    // 统计不同的 cluster_id 数量
    const uniqueClusterIds = new Set(
      clusterData?.map((b) => b.cluster_id) ?? [],
    );
    const clusterCount = uniqueClusterIds.size;

    // 3. 获取待确认的聚类建议
    const { count: pendingSuggestionCount, error: suggestionError } =
      await this.supabase
        .from("classification_suggestions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pending")
        .eq("suggested_action", "create_folder");

    if (suggestionError) {
      logger.warn(
        { error: suggestionError, userId },
        "Failed to get pending suggestion count",
      );
    }

    // 4. 获取上次处理时间（从用户兴趣表或直接从书签表）
    const { data: lastProcessed } = await this.supabase
      .from("bookmarks")
      .select("updated_at")
      .eq("user_id", userId)
      .not("cluster_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    // 5. 计算下次计划处理时间（每日凌晨 4:00）
    const nextScheduledAt = this.getNextCronTime(4); // 4:00 AM

    return {
      pendingClusterCount: pendingClusterCount ?? 0,
      clusterCount,
      lastProcessedAt: lastProcessed?.updated_at
        ? new Date(lastProcessed.updated_at)
        : null,
      nextScheduledAt,
      hasPendingSuggestions: (pendingSuggestionCount ?? 0) > 0,
    };
  }

  /**
   * 获取下一个 cron 执行时间
   */
  private getNextCronTime(hour: number): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);

    // 如果今天的时间已过，则设为明天
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * V4.2.1: 计算书签数据哈希
   * 基于最新待整理书签的更新时间生成哈希，用于缓存失效判断
   */
  private async computeBookmarkHash(userId: string): Promise<string> {
    const { data } = await this.supabase
      .from("bookmarks")
      .select("id, updated_at")
      .eq("user_id", userId)
      .is("folder_id", null)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1);

    const latestUpdate = data?.[0]?.updated_at || "";
    const latestId = data?.[0]?.id || 0;
    return `${userId}-${latestId}-${latestUpdate}`;
  }
}
