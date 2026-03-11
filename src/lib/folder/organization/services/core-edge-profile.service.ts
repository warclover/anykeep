/**
 * Core-Edge Profile Service
 * V4.2 核心区/边缘区画像服务
 *
 * @description 计算和管理文件夹的核心区与边缘区向量画像
 * - 核心区：文件夹最典型内容的中心向量（高置信度匹配）
 * - 边缘区：文件夹边界内容的向量（较低置信度但仍属于该文件夹）
 *
 * @module folder/organization/services/core-edge-profile
 * @version 1.0.0
 * @since 2026-03-11 - Migrated from classification-v1
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import { getCurrentEmbeddingVersion } from "@/lib/utils/embedding-generator";

// ============================================================================
// 数据库 RPC 函数返回类型（类型生成前的临时定义）
// ============================================================================

/** folder_profiles 扩展字段（V4.2 核心/边缘区） */
interface FolderProfileZoneFields {
  core_embedding: number[] | null;
  edge_embedding: number[] | null;
  core_radius: number | null;
  edge_radius: number | null;
  core_sample_ids: number[] | null;
  edge_sample_ids: number[] | null;
  core_count: number | null;
  edge_count: number | null;
  core_tightness: number | null;
  boundary_clarity: number | null;
  zone_computed_at: string | null;
}

// ============================================================================
// 类型定义
// ============================================================================

/** 区域类型 */
export type ZoneType = "core" | "edge" | "outside";

/** 书签向量数据 */
export interface BookmarkVector {
  id: number;
  embedding: number[];
  title?: string;
  createdAt?: string;
}

/** 核心/边缘画像数据 */
export interface CoreEdgeProfile {
  folderId: number;
  userId: string;

  /** 核心区向量 */
  coreEmbedding: number[] | null;
  /** 边缘区向量 */
  edgeEmbedding: number[] | null;

  /** 核心区半径（余弦距离） */
  coreRadius: number;
  /** 边缘区半径 */
  edgeRadius: number;

  /** 核心区书签 ID */
  coreSampleIds: number[];
  /** 边缘区书签 ID */
  edgeSampleIds: number[];

  /** 核心区书签数量 */
  coreCount: number;
  /** 边缘区书签数量 */
  edgeCount: number;

  /** 核心区紧密度 (0-1) */
  coreTightness: number;
  /** 边界清晰度 (0-1) */
  boundaryClarity: number;

  /** 计算时间 */
  zoneComputedAt: string | null;
}

/** 区域匹配结果 */
export interface ZoneMatchResult {
  /** 所属区域 */
  zone: ZoneType;
  /** 与核心区的距离 */
  coreDistance: number;
  /** 与边缘区的距离 */
  edgeDistance: number;
  /** 是否在核心区 */
  isInCore: boolean;
  /** 是否在边缘区 */
  isInEdge: boolean;
  /** 匹配置信度 (0-1) */
  confidence: number;
}

/** 多文件夹匹配结果 */
export interface FolderZoneMatch {
  folderId: number;
  folderName: string;
  /** 核心相似度 */
  coreSimilarity: number;
  /** 边缘相似度 */
  edgeSimilarity: number;
  /** 区域匹配 */
  zoneMatch: ZoneType;
  /** 置信度级别 */
  confidenceLevel: "high" | "medium" | "low" | "none";
}

/** 计算配置 */
export interface CoreEdgeComputeConfig {
  /** 最小书签数量（低于此数不计算核心/边缘） */
  minBookmarks: number;
  /** 核心区百分比（最核心的 N% 书签） */
  corePercentile: number;
  /** 边缘区百分比（最外围的 N% 书签） */
  edgePercentile: number;
  /** 默认核心半径 */
  defaultCoreRadius: number;
  /** 默认边缘半径 */
  defaultEdgeRadius: number;
  /** 核心区最大样本数 */
  maxCoreSamples: number;
  /** 边缘区最大样本数 */
  maxEdgeSamples: number;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: CoreEdgeComputeConfig = {
  minBookmarks: 3,
  corePercentile: 0.3, // 最核心的 30%
  edgePercentile: 0.2, // 最外围的 20%
  defaultCoreRadius: 0.15,
  defaultEdgeRadius: 0.35,
  maxCoreSamples: 10,
  maxEdgeSamples: 5,
};

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 核心/边缘画像服务
 */
export class CoreEdgeProfileService {
  private supabase: SupabaseClient<Database>;
  private config: CoreEdgeComputeConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<CoreEdgeComputeConfig>,
  ) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // 公共 API
  // --------------------------------------------------------------------------

  /**
   * 计算文件夹的核心/边缘画像
   */
  async computeZoneProfile(
    userId: string,
    folderId: number,
  ): Promise<CoreEdgeProfile | null> {
    try {
      // 1. 获取文件夹内所有书签的向量
      const bookmarks = await this.getFolderBookmarkVectors(userId, folderId);

      if (bookmarks.length < this.config.minBookmarks) {
        logger.debug(
          { folderId, bookmarkCount: bookmarks.length },
          "CoreEdgeProfile: Not enough bookmarks for zone calculation",
        );
        return null;
      }

      // 2. 计算文件夹中心向量（所有书签的平均）
      const centroid = this.computeCentroid(bookmarks.map((b) => b.embedding));

      // V4.2.5: 检查 centroid 是否有效
      if (centroid.length === 0) {
        logger.warn(
          { folderId },
          "CoreEdgeProfile: Failed to compute centroid, invalid embeddings",
        );
        return null;
      }

      // 3. 计算每个书签到中心的距离
      const distances = bookmarks.map((b) => ({
        bookmark: b,
        distance: this.cosineDistance(b.embedding, centroid),
      }));

      // 4. 按距离排序
      distances.sort((a, b) => a.distance - b.distance);

      // 5. 划分核心区和边缘区
      const coreCount = Math.max(
        1,
        Math.floor(distances.length * this.config.corePercentile),
      );
      const edgeStart = Math.floor(
        distances.length * (1 - this.config.edgePercentile),
      );

      const coreBookmarks = distances.slice(0, coreCount);
      const edgeBookmarks = distances.slice(edgeStart);

      // 6. 计算核心区向量（核心书签的平均）
      const coreEmbedding = this.computeCentroid(
        coreBookmarks.map((d) => d.bookmark.embedding),
      );

      // 7. 计算边缘区向量（边缘书签的平均，如果与核心不同）
      const edgeEmbedding =
        edgeBookmarks.length > 0
          ? this.computeCentroid(edgeBookmarks.map((d) => d.bookmark.embedding))
          : coreEmbedding;

      // 8. 计算半径
      const coreRadius =
        coreBookmarks.length > 0
          ? Math.max(
              ...coreBookmarks.map((d) =>
                this.cosineDistance(d.bookmark.embedding, coreEmbedding),
              ),
            )
          : this.config.defaultCoreRadius;

      const edgeRadius =
        distances.length > 0
          ? distances[distances.length - 1].distance * 1.1 // 最远距离的 110%
          : this.config.defaultEdgeRadius;

      // 9. 计算核心紧密度
      const coreTightness = this.computeTightness(
        coreBookmarks.map((d) => d.bookmark.embedding),
        coreEmbedding,
      );

      // 10. 计算边界清晰度
      const boundaryClarity = this.computeBoundaryClarity(
        coreRadius,
        edgeRadius,
        distances.map((d) => d.distance),
      );

      // 11. 保存到数据库
      const profile: CoreEdgeProfile = {
        folderId,
        userId,
        coreEmbedding,
        edgeEmbedding,
        coreRadius: Math.max(coreRadius, 0.05), // 最小半径
        edgeRadius: Math.max(edgeRadius, coreRadius * 1.5),
        coreSampleIds: coreBookmarks
          .slice(0, this.config.maxCoreSamples)
          .map((d) => d.bookmark.id),
        edgeSampleIds: edgeBookmarks
          .slice(0, this.config.maxEdgeSamples)
          .map((d) => d.bookmark.id),
        coreCount: coreBookmarks.length,
        edgeCount: edgeBookmarks.length,
        coreTightness,
        boundaryClarity,
        zoneComputedAt: new Date().toISOString(),
      };

      await this.saveZoneProfile(profile);

      logger.info(
        {
          folderId,
          coreCount: profile.coreCount,
          edgeCount: profile.edgeCount,
          coreTightness: profile.coreTightness.toFixed(2),
          boundaryClarity: profile.boundaryClarity.toFixed(2),
        },
        "CoreEdgeProfile: Computed zone profile",
      );

      return profile;
    } catch (error) {
      logger.error(
        {
          folderId,
          error: error instanceof Error ? error.message : String(error),
        },
        "CoreEdgeProfile: Failed to compute zone profile",
      );
      return null;
    }
  }

  /**
   * 检查书签属于哪个区域
   */
  async checkBookmarkZone(
    folderId: number,
    bookmarkEmbedding: number[],
  ): Promise<ZoneMatchResult> {
    // 使用数据库函数检查
    // V4.2.4: 修复向量参数格式，pgvector 需要 [1,2,3,...] 格式而非 JSON 字符串
    const { data: results, error } = await this.supabase.rpc(
      "check_bookmark_zone",
      {
        p_folder_id: folderId,
        p_bookmark_embedding: `[${bookmarkEmbedding.join(",")}]`,
      },
    );

    if (error || !results || results.length === 0) {
      // 回退到内存计算
      const profile = await this.getZoneProfile(folderId);
      if (!profile || !profile.coreEmbedding) {
        return {
          zone: "outside",
          coreDistance: 1,
          edgeDistance: 1,
          isInCore: false,
          isInEdge: false,
          confidence: 0,
        };
      }

      return this.computeZoneMatch(
        bookmarkEmbedding,
        profile.coreEmbedding,
        profile.edgeEmbedding,
        profile.coreRadius,
        profile.edgeRadius,
      );
    }

    const result = results[0];
    return {
      zone: result.zone as ZoneType,
      coreDistance: result.core_distance ?? 1,
      edgeDistance: result.edge_distance ?? 1,
      isInCore: result.is_in_core ?? false,
      isInEdge: result.is_in_edge ?? false,
      confidence: result.confidence ?? 0,
    };
  }

  /**
   * 搜索匹配的文件夹（基于核心区相似度）
   */
  async searchMatchingFolders(
    userId: string,
    queryEmbedding: number[],
    limit = 5,
    minSimilarity = 0.5,
  ): Promise<FolderZoneMatch[]> {
    // V4.2.4: 修复向量参数格式，pgvector 需要 [1,2,3,...] 格式而非 JSON 字符串
    const { data: results, error } = await this.supabase.rpc(
      "search_folders_by_core_similarity",
      {
        p_user_id: userId,
        p_query_embedding: `[${queryEmbedding.join(",")}]`,
        p_limit: limit,
        p_min_similarity: minSimilarity,
      },
    );

    if (error || !results) {
      logger.warn(
        { error: error?.message },
        "CoreEdgeProfile: Failed to search folders by core similarity",
      );
      return [];
    }

    return results.map((row) => ({
      folderId: row.folder_id,
      folderName: row.folder_name,
      coreSimilarity: row.core_similarity,
      edgeSimilarity: row.edge_similarity,
      zoneMatch: row.zone_match as ZoneType,
      confidenceLevel: row.confidence_level as
        | "high"
        | "medium"
        | "low"
        | "none",
    }));
  }

  /**
   * 获取文件夹的区域画像
   */
  async getZoneProfile(folderId: number): Promise<CoreEdgeProfile | null> {
    const { data, error } = await this.supabase
      .from("folder_profiles")
      .select("*")
      .eq("folder_id", folderId)
      .single();

    if (error || !data) {
      return null;
    }

    // 类型断言处理新字段（迁移前可能不存在）
    const zoneData = data as unknown as {
      folder_id: number;
      user_id: string;
    } & Partial<FolderProfileZoneFields>;

    return {
      folderId: zoneData.folder_id,
      userId: zoneData.user_id,
      coreEmbedding: zoneData.core_embedding ?? null,
      edgeEmbedding: zoneData.edge_embedding ?? null,
      coreRadius: zoneData.core_radius ?? this.config.defaultCoreRadius,
      edgeRadius: zoneData.edge_radius ?? this.config.defaultEdgeRadius,
      coreSampleIds: zoneData.core_sample_ids ?? [],
      edgeSampleIds: zoneData.edge_sample_ids ?? [],
      coreCount: zoneData.core_count ?? 0,
      edgeCount: zoneData.edge_count ?? 0,
      coreTightness: zoneData.core_tightness ?? 0,
      boundaryClarity: zoneData.boundary_clarity ?? 0,
      zoneComputedAt: zoneData.zone_computed_at ?? null,
    };
  }

  /**
   * 批量更新用户所有文件夹的区域画像
   */
  async computeAllZoneProfiles(userId: string): Promise<number> {
    // 获取所有文件夹
    const { data: folders, error } = await this.supabase
      .from("folder_profiles")
      .select("folder_id")
      .eq("user_id", userId);

    if (error || !folders) {
      return 0;
    }

    let updatedCount = 0;
    for (const folder of folders) {
      const result = await this.computeZoneProfile(userId, folder.folder_id);
      if (result) updatedCount++;
    }

    return updatedCount;
  }

  // --------------------------------------------------------------------------
  // 私有方法
  // --------------------------------------------------------------------------

  /**
   * 获取文件夹内所有书签的向量
   */
  private async getFolderBookmarkVectors(
    userId: string,
    folderId: number,
  ): Promise<BookmarkVector[]> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id, embedding, title, created_at")
      .eq("user_id", userId)
      .eq("folder_id", folderId)
      .is("deleted_at", null)
      .not("embedding", "is", null);

    if (error || !data) {
      return [];
    }

    return data
      .filter((b) => b.embedding)
      .map((b) => ({
        id: b.id,
        // Supabase 返回 embedding 为 JSON 字符串或 number[]
        embedding: (typeof b.embedding === "string"
          ? JSON.parse(b.embedding)
          : b.embedding) as number[],
        title: b.title ?? undefined,
        createdAt: b.created_at ?? undefined,
      }));
  }

  /**
   * 计算向量集合的中心点
   * V4.2.5: 增强空数组和维度不一致的处理
   */
  private computeCentroid(vectors: number[][]): number[] {
    // V4.2.5: 空数组返回空数组，调用方需要检查
    if (vectors.length === 0) {
      logger.warn("computeCentroid: empty vectors array");
      return [];
    }

    const dim = vectors[0].length;

    // V4.2.5: 检查维度有效性
    if (dim === 0) {
      logger.warn("computeCentroid: vectors have zero dimensions");
      return [];
    }

    const centroid = new Array(dim).fill(0);

    for (const vec of vectors) {
      // V4.2.5: 跳过维度不一致的向量
      if (vec.length !== dim) {
        logger.warn(
          { expected: dim, actual: vec.length },
          "computeCentroid: skipping vector with mismatched dimensions",
        );
        continue;
      }
      for (let i = 0; i < dim; i++) {
        centroid[i] += vec[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= vectors.length;
    }

    // 归一化
    return this.normalize(centroid);
  }

  /**
   * 归一化向量
   */
  private normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vec;
    return vec.map((v) => v / norm);
  }

  /**
   * 计算余弦距离
   */
  private cosineDistance(a: number[], b: number[]): number {
    const similarity = this.cosineSimilarity(a, b);
    return 1 - similarity;
  }

  /**
   * 计算余弦相似度
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
   * 计算紧密度
   */
  private computeTightness(vectors: number[][], centroid: number[]): number {
    if (vectors.length === 0) return 0;

    const avgDistance =
      vectors.reduce(
        (sum, vec) => sum + this.cosineDistance(vec, centroid),
        0,
      ) / vectors.length;

    // 紧密度 = 1 - 平均距离（归一化到 0-1）
    return Math.max(0, Math.min(1, 1 - avgDistance * 2));
  }

  /**
   * 计算边界清晰度
   */
  private computeBoundaryClarity(
    coreRadius: number,
    edgeRadius: number,
    distances: number[],
  ): number {
    if (distances.length === 0 || edgeRadius <= coreRadius) return 0;

    // 计算距离分布的双峰性
    const gap = edgeRadius - coreRadius;
    const coreBookmarks = distances.filter((d) => d <= coreRadius);
    const edgeBookmarks = distances.filter(
      (d) => d > coreRadius && d <= edgeRadius,
    );

    if (coreBookmarks.length === 0 || edgeBookmarks.length === 0) {
      return 0.5;
    }

    // 清晰度 = 间隙比例 * 分布均匀度
    const gapRatio = gap / edgeRadius;
    const distributionBalance =
      1 -
      Math.abs(
        coreBookmarks.length / distances.length - this.config.corePercentile,
      );

    return Math.max(0, Math.min(1, gapRatio * 0.5 + distributionBalance * 0.5));
  }

  /**
   * 内存计算区域匹配
   * V4.2.5: 添加零除保护
   */
  private computeZoneMatch(
    queryEmbedding: number[],
    coreEmbedding: number[],
    edgeEmbedding: number[] | null,
    coreRadius: number,
    edgeRadius: number,
  ): ZoneMatchResult {
    const coreDistance = this.cosineDistance(queryEmbedding, coreEmbedding);
    const edgeDistance = edgeEmbedding
      ? this.cosineDistance(queryEmbedding, edgeEmbedding)
      : coreDistance;

    // V4.2.5: 确保半径最小值，防止除零
    const safeCoreRadius = Math.max(coreRadius, 0.01);
    const safeEdgeRadius = Math.max(edgeRadius, safeCoreRadius * 1.5);

    const isInCore = coreDistance <= safeCoreRadius;
    const isInEdge = edgeDistance <= safeEdgeRadius;

    let zone: ZoneType = "outside";
    let confidence = 0;

    if (isInCore) {
      zone = "core";
      confidence = 0.7 + (1 - coreDistance / safeCoreRadius) * 0.3;
    } else if (isInEdge) {
      zone = "edge";
      confidence = 0.4 + (1 - edgeDistance / safeEdgeRadius) * 0.3;
    } else {
      confidence = Math.max(0, 0.3 - (edgeDistance - safeEdgeRadius) * 2);
    }

    return {
      zone,
      coreDistance,
      edgeDistance,
      isInCore,
      isInEdge,
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  }

  /**
   * 保存区域画像
   * V4.2.7: 添加 embedding 版本追踪字段
   */
  private async saveZoneProfile(profile: CoreEdgeProfile): Promise<void> {
    const embeddingVersion = getCurrentEmbeddingVersion();

    const updateData = {
      core_embedding: profile.coreEmbedding,
      edge_embedding: profile.edgeEmbedding,
      core_radius: profile.coreRadius,
      edge_radius: profile.edgeRadius,
      core_sample_ids: profile.coreSampleIds,
      edge_sample_ids: profile.edgeSampleIds,
      core_count: profile.coreCount,
      edge_count: profile.edgeCount,
      core_tightness: profile.coreTightness,
      boundary_clarity: profile.boundaryClarity,
      zone_computed_at: profile.zoneComputedAt,
      // V4.2.7: embedding 版本追踪
      core_embedding_version: profile.coreEmbedding ? embeddingVersion : null,
      edge_embedding_version: profile.edgeEmbedding ? embeddingVersion : null,
    };

    const { error } = await this.supabase
      .from("folder_profiles")
      .update(
        updateData as unknown as Database["public"]["Tables"]["folder_profiles"]["Update"],
      )
      .eq("folder_id", profile.folderId);

    if (error) {
      logger.error(
        { folderId: profile.folderId, error: error.message },
        "CoreEdgeProfile: Failed to save zone profile",
      );
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建核心/边缘画像服务实例
 */
export function createCoreEdgeProfileService(
  supabase: SupabaseClient<Database>,
  config?: Partial<CoreEdgeComputeConfig>,
): CoreEdgeProfileService {
  return new CoreEdgeProfileService(supabase, config);
}

export default CoreEdgeProfileService;
