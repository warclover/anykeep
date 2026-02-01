/**
 * 批量分类协调器
 *
 * 核心入口，协调三个阶段的执行：沉淀期 -> 结晶期 -> 精炼期
 *
 * @module classification/batch-classification/coordinator
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  BookmarkWithEmbedding,
  ClassificationProgress,
  ClassificationResult,
  ClusterResult,
  UserDecision,
  StartClassificationRequest,
  StructureMode,
  OriginalStructureAnalysis,
  BatchCluster,
  MappingResult,
} from "./types";
import { KeywordGroupingService } from "./pre-grouping/keyword-grouping";
import { UrlPathGroupingService } from "./pre-grouping/url-path-grouping";
import { sampledDbscanClustering } from "./algorithms/sampled-dbscan";
import { iterativeDbscanClustering } from "./algorithms/iterative-dbscan";
import { MappingPhase } from "./phases/mapping.phase";
import { representativeNamingService } from "./naming/representative-naming";

// ============================================
// 协调器配置
// ============================================

export interface CoordinatorConfig {
  /** 使用分层采样 DBSCAN 的最小书签数 */
  sampledDbscanThreshold: number;
  /** 自动确认置信度阈值 */
  autoConfirmThreshold: number;
  /** 是否保留原始结构 */
  preserveOriginalStructure: boolean;
}

export const DEFAULT_COORDINATOR_CONFIG: CoordinatorConfig = {
  sampledDbscanThreshold: 100,
  autoConfirmThreshold: 0.8,
  preserveOriginalStructure: true,
};

// ============================================
// 批量分类协调器
// ============================================

/**
 * 批量分类协调器
 *
 * 三阶段流程：
 * 1. 沉淀期 (Sedimentation): 特征提取 + L1.5 预分组
 * 2. 结晶期 (Clustering): 分层采样 DBSCAN 聚类
 * 3. 精炼期 (Mapping): 映射到文件夹 + 命名
 */
export class BatchClassificationCoordinator {
  private supabase: SupabaseClient<Database>;
  private config: CoordinatorConfig;
  private keywordGrouping: KeywordGroupingService;
  private urlPathGrouping: UrlPathGroupingService;
  private mappingPhase: MappingPhase;

  constructor(
    supabase: SupabaseClient<Database>,
    config: CoordinatorConfig = DEFAULT_COORDINATOR_CONFIG,
  ) {
    this.supabase = supabase;
    this.config = config;
    this.keywordGrouping = new KeywordGroupingService();
    this.urlPathGrouping = new UrlPathGroupingService();
    this.mappingPhase = new MappingPhase(supabase);
  }

  /**
   * 启动批量分类
   */
  async startClassification(
    request: StartClassificationRequest,
    userId: string,
  ): Promise<string> {
    // 1. 创建事务记录
    const transactionId = await this.createTransaction(request, userId);

    // 2. 异步执行分类流程
    this.executeClassificationAsync(transactionId, request, userId).catch(
      (error) => {
        console.error("Classification failed:", error);
        this.updateProgressError(transactionId, error.message);
      },
    );

    return transactionId;
  }

  /**
   * 获取分类进度
   */
  async getProgress(transactionId: string): Promise<ClassificationProgress> {
    const { data, error } = await this.supabase
      .from("batch_classification_progress")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (error || !data) {
      throw new Error("Progress not found");
    }

    return {
      phase: data.current_phase as ClassificationProgress["phase"],
      progress: data.progress || 0,
      estimatedRemainingSeconds: data.estimated_remaining_seconds || 0,
      phaseDetails:
        data.phase_details as ClassificationProgress["phaseDetails"],
      error: data.error_message
        ? {
            message: data.error_message,
            details: data.error_details as Record<string, unknown>,
          }
        : undefined,
    };
  }

  /**
   * 获取分类结果
   */
  async getResults(transactionId: string): Promise<ClassificationResult> {
    // 获取事务信息
    const { data: transaction } = await this.supabase
      .from("batch_import_transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // 获取聚类结果
    const { data: clusters } = await this.supabase
      .from("import_clusters")
      .select(
        `
        *,
        import_cluster_members (
          bookmark_id,
          distance_to_centroid,
          is_representative,
          representative_type
        )
      `,
      )
      .eq("import_batch_id", transaction.batch_id);

    // 获取未聚类的书签
    const { data: unclustered } = await this.supabase
      .from("bookmarks")
      .select("id")
      .eq("import_batch_id", transaction.batch_id)
      .eq("classification_status", "processing");

    // 转换为结果格式
    const clusterResults: ClusterResult[] = (clusters || []).map((c) => ({
      id: c.id,
      index: c.cluster_index,
      memberCount: c.member_count || 0,
      suggestedName: c.suggested_name,
      suggestedNameConfidence: c.suggested_name_confidence || 0,
      suggestedFolderId: c.suggested_folder_id,
      suggestedFolderName: null, // TODO: 关联查询
      matchConfidence: c.match_confidence || 0,
      matchType:
        (c.match_type as "exact" | "fuzzy" | "create_new") || "create_new",
      conflictType:
        (c.conflict_type as ClusterResult["conflictType"]) || "none",
      conflictDetails: c.conflict_details as Record<string, unknown>,
      status: (c.status as ClusterResult["status"]) || "pending",
      representatives: { core: [], edge: [] }, // TODO: 填充代表元
    }));

    return {
      transactionId,
      clusters: clusterResults,
      conflicts: [], // TODO: 从数据库获取冲突
      unclustered: (unclustered || []).map((b) => b.id),
      stats: {
        totalBookmarks: transaction.total_bookmarks || 0,
        clusteredCount: clusterResults.reduce(
          (sum, c) => sum + c.memberCount,
          0,
        ),
        unclusteredCount: (unclustered || []).length,
        clusterCount: clusterResults.length,
        conflictCount: 0,
        estimatedCost: 0,
      },
    };
  }

  /**
   * 确认分类结果
   */
  async confirmResults(
    transactionId: string,
    decisions: UserDecision[],
    userId: string,
  ): Promise<void> {
    // 1. 获取事务
    const { data: transaction } = await this.supabase
      .from("batch_import_transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("user_id", userId)
      .single();

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // 2. 处理每个决策
    for (const decision of decisions) {
      await this.processDecision(decision, transaction.batch_id!);
    }

    // 3. 更新事务状态
    await this.supabase
      .from("batch_import_transactions")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", transactionId);
  }

  /**
   * 撤销分类
   */
  async undoClassification(
    transactionId: string,
    userId: string,
  ): Promise<{ restoredBookmarks: number; deletedFolders: number }> {
    // 1. 检查是否可撤销
    const { data: transaction } = await this.supabase
      .from("batch_import_transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("user_id", userId)
      .single();

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (!transaction.undo_available || transaction.status !== "confirmed") {
      throw new Error("Undo not available");
    }

    if (
      transaction.undo_deadline &&
      new Date(transaction.undo_deadline) < new Date()
    ) {
      throw new Error("Undo deadline passed");
    }

    // 2. 恢复快照
    const snapshot = transaction.pre_confirm_snapshot as {
      bookmarkStates?: Record<string, { folder_id: number | null }>;
    };

    let restoredBookmarks = 0;

    if (snapshot?.bookmarkStates) {
      for (const [bookmarkId, state] of Object.entries(
        snapshot.bookmarkStates,
      )) {
        await this.supabase
          .from("bookmarks")
          .update({ folder_id: state.folder_id })
          .eq("id", parseInt(bookmarkId));
        restoredBookmarks++;
      }
    }

    // 3. 删除本次创建的文件夹
    // TODO: 实现文件夹删除逻辑

    // 4. 更新事务状态
    await this.supabase
      .from("batch_import_transactions")
      .update({
        status: "undone",
        undo_available: false,
      })
      .eq("id", transactionId);

    return { restoredBookmarks, deletedFolders: 0 };
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 创建事务记录
   */
  private async createTransaction(
    request: StartClassificationRequest,
    userId: string,
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from("batch_import_transactions")
      .insert({
        batch_id: request.batchId || request.importSessionId,
        user_id: userId,
        status: "pending",
        structure_mode: request.structureMode || "auto",
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error("Failed to create transaction");
    }

    // 创建进度记录
    await this.supabase.from("batch_classification_progress").insert({
      transaction_id: data.id,
      user_id: userId,
      current_phase: "sedimentation",
      progress: 0,
    });

    return data.id;
  }

  /**
   * 异步执行分类流程
   */
  private async executeClassificationAsync(
    transactionId: string,
    request: StartClassificationRequest,
    userId: string,
  ): Promise<void> {
    try {
      // Phase 1: 沉淀期 - 获取书签并提取特征
      await this.updateProgress(transactionId, "sedimentation", 10);
      const bookmarks = await this.loadBookmarks(request, userId);
      await this.updateProgress(transactionId, "sedimentation", 50);

      // 分析原始结构
      const structureAnalysis = this.analyzeOriginalStructure(bookmarks);
      // 确定结构处理模式（用于后续扩展）
      this.determineStructureMode(request.structureMode, structureAnalysis);

      // L1.5 预分组（用于后续优化）
      await this.keywordGrouping.preGroupByKeywords(bookmarks);
      await this.updateProgress(transactionId, "sedimentation", 100);

      // Phase 2: 结晶期 - 聚类
      await this.updateProgress(transactionId, "clustering", 10);
      const clusteringResult =
        bookmarks.length > this.config.sampledDbscanThreshold
          ? await sampledDbscanClustering(bookmarks)
          : await iterativeDbscanClustering(bookmarks);
      await this.updateProgress(transactionId, "clustering", 100);

      // Phase 3: 精炼期 - 映射与命名
      await this.updateProgress(transactionId, "mapping", 10);
      const bookmarkMap = new Map(bookmarks.map((b) => [b.id, b]));
      const mappingResults = await this.mappingPhase.execute(
        clusteringResult.clusters,
        bookmarkMap,
        userId,
      );
      await this.updateProgress(transactionId, "mapping", 50);

      // 生成命名
      for (const cluster of clusteringResult.clusters) {
        const nameResult =
          await representativeNamingService.generateClusterName(
            cluster,
            bookmarkMap,
          );
        // 更新数据库
        await this.saveClusterResult(
          transactionId,
          cluster,
          mappingResults.find((m) => m.clusterId === cluster.id),
          nameResult,
          bookmarkMap,
          userId,
        );
      }

      await this.updateProgress(transactionId, "completed", 100);

      // 更新事务状态
      await this.supabase
        .from("batch_import_transactions")
        .update({
          status: "ready",
          total_bookmarks: bookmarks.length,
          total_clusters: clusteringResult.clusters.length,
          structure_analysis: structureAnalysis,
        })
        .eq("id", transactionId);
    } catch (error) {
      await this.updateProgressError(
        transactionId,
        error instanceof Error ? error.message : "Unknown error",
      );
      throw error;
    }
  }

  /**
   * 加载书签
   */
  private async loadBookmarks(
    request: StartClassificationRequest,
    userId: string,
  ): Promise<BookmarkWithEmbedding[]> {
    let query = this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, embedding, created_at, original_path, original_path_parts, ai_tags",
      )
      .eq("user_id", userId)
      .not("embedding", "is", null);

    if (request.bookmarkIds && request.bookmarkIds.length > 0) {
      query = query.in("id", request.bookmarkIds);
    } else if (request.batchId || request.importSessionId) {
      query = query.eq(
        "import_batch_id",
        request.batchId || request.importSessionId,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to load bookmarks: ${error.message}`);
    }

    return (data || []).map((b) => ({
      id: b.id,
      title: b.title || "",
      url: b.url,
      domain: this.extractDomain(b.url),
      meaningfulDomain: this.extractMeaningfulDomain(b.url),
      embedding: b.embedding as number[],
      createdAt: new Date(b.created_at!),
      originalPath: b.original_path,
      originalPathParts: b.original_path_parts as string[] | null,
      keywords: (b.ai_tags as string[]) || [],
      description: null,
      platform: "other",
    }));
  }

  /**
   * 分析原始结构
   */
  private analyzeOriginalStructure(
    bookmarks: BookmarkWithEmbedding[],
  ): OriginalStructureAnalysis {
    const folders = new Map<string, number>();
    let classifiedCount = 0;
    let totalDepth = 0;

    for (const bookmark of bookmarks) {
      if (bookmark.originalPath && bookmark.originalPath !== "/") {
        classifiedCount++;
        const depth = bookmark.originalPath.split("/").length;
        totalDepth += depth;
        folders.set(
          bookmark.originalPath,
          (folders.get(bookmark.originalPath) || 0) + 1,
        );
      }
    }

    const validFolders = Array.from(folders.entries()).filter(
      ([_, count]) => count >= 3,
    );
    const classifiedRatio = classifiedCount / bookmarks.length;
    const avgDepth = classifiedCount > 0 ? totalDepth / classifiedCount : 0;

    // 结构质量评分
    const structureQuality =
      classifiedRatio * 0.4 +
      (validFolders.length / Math.max(folders.size, 1)) * 0.3 +
      (avgDepth > 1 && avgDepth < 4 ? 0.2 : 0) +
      (folders.size > 0 ? 0.1 : 0);

    return {
      folderCount: folders.size,
      validFolderCount: validFolders.length,
      classifiedRatio,
      avgDepth,
      structureQuality,
      recommendedMode:
        structureQuality > 0.7
          ? "preserve"
          : structureQuality > 0.3
            ? "hybrid"
            : "rebuild",
    };
  }

  /**
   * 确定结构处理模式
   */
  private determineStructureMode(
    requestMode: StructureMode | undefined,
    analysis: OriginalStructureAnalysis,
  ): StructureMode {
    if (requestMode && requestMode !== "auto") {
      return requestMode;
    }
    return analysis.recommendedMode;
  }

  /**
   * 保存聚类结果
   */
  private async saveClusterResult(
    transactionId: string,
    cluster: BatchCluster,
    mapping: MappingResult | undefined,
    nameResult: { name: string; confidence: number },
    bookmarkMap: Map<number, BookmarkWithEmbedding>,
    userId: string,
  ): Promise<void> {
    // 获取 batch_id
    const { data: transaction } = await this.supabase
      .from("batch_import_transactions")
      .select("batch_id")
      .eq("id", transactionId)
      .single();

    // 插入聚类记录
    const { data: clusterData } = await this.supabase
      .from("import_clusters")
      .insert({
        import_batch_id: transaction?.batch_id,
        user_id: userId,
        cluster_index: cluster.index,
        centroid: cluster.centroid,
        cohesion: cluster.cohesion,
        member_count: cluster.memberIds.length,
        suggested_name: nameResult.name,
        suggested_name_confidence: nameResult.confidence,
        suggested_folder_id: mapping?.targetFolderId,
        match_confidence: mapping?.confidence || 0,
        match_type:
          mapping?.action === "MERGE"
            ? "exact"
            : mapping?.action === "SUGGEST_MERGE"
              ? "fuzzy"
              : "create_new",
        conflict_type: mapping?.conflictType || "none",
        status: "pending",
      })
      .select("id")
      .single();

    if (!clusterData) return;

    // 插入成员关系
    const members = cluster.memberIds.map((bookmarkId) => ({
      cluster_id: clusterData.id,
      bookmark_id: bookmarkId,
      distance_to_centroid: 0, // TODO: 计算实际距离
      is_representative:
        cluster.representatives.core.includes(bookmarkId) ||
        cluster.representatives.edge.includes(bookmarkId),
      representative_type: cluster.representatives.core.includes(bookmarkId)
        ? "core"
        : cluster.representatives.edge.includes(bookmarkId)
          ? "edge"
          : null,
    }));

    await this.supabase.from("import_cluster_members").insert(members);
  }

  /**
   * 处理用户决策
   */
  private async processDecision(
    decision: UserDecision,
    _batchId: string,
  ): Promise<void> {
    if (decision.action === "accept") {
      // 接受建议：移动书签到目标文件夹
      const { data: cluster } = await this.supabase
        .from("import_clusters")
        .select("suggested_folder_id, import_cluster_members(bookmark_id)")
        .eq("id", decision.clusterId)
        .single();

      if (cluster?.suggested_folder_id) {
        const bookmarkIds = (
          cluster.import_cluster_members as { bookmark_id: number }[]
        ).map((m) => m.bookmark_id);
        await this.supabase
          .from("bookmarks")
          .update({
            folder_id: cluster.suggested_folder_id,
            classification_status: "confirmed",
          })
          .in("id", bookmarkIds);
      }
    } else if (decision.action === "modify" && decision.targetFolderId) {
      // 修改：移动到用户指定的文件夹
      const { data: cluster } = await this.supabase
        .from("import_clusters")
        .select("import_cluster_members(bookmark_id)")
        .eq("id", decision.clusterId)
        .single();

      if (cluster) {
        const bookmarkIds = (
          cluster.import_cluster_members as { bookmark_id: number }[]
        ).map((m) => m.bookmark_id);
        await this.supabase
          .from("bookmarks")
          .update({
            folder_id: decision.targetFolderId,
            classification_status: "confirmed",
          })
          .in("id", bookmarkIds);
      }
    }

    // 更新簇状态
    await this.supabase
      .from("import_clusters")
      .update({
        status: decision.action === "reject" ? "rejected" : "confirmed",
      })
      .eq("id", decision.clusterId);
  }

  /**
   * 更新进度
   */
  private async updateProgress(
    transactionId: string,
    phase: string,
    progress: number,
  ): Promise<void> {
    await this.supabase
      .from("batch_classification_progress")
      .update({
        current_phase: phase,
        progress,
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);
  }

  /**
   * 更新进度错误
   */
  private async updateProgressError(
    transactionId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.supabase
      .from("batch_classification_progress")
      .update({
        current_phase: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    await this.supabase
      .from("batch_import_transactions")
      .update({ status: "processing" })
      .eq("id", transactionId);
  }

  /**
   * 提取域名
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  /**
   * 提取有意义的域名
   */
  private extractMeaningfulDomain(url: string): string {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;

      if (hostname === "github.com" || hostname === "gitlab.com") {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length > 0) {
          return `${hostname}/${parts[0]}`;
        }
      }

      return hostname;
    } catch {
      return url;
    }
  }
}
