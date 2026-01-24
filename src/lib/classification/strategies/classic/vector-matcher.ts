/**
 * Vector Matcher Strategy
 * V4.2 核心区增强版向量匹配器
 *
 * @description
 * 使用向量相似度匹配书签到文件夹，支持：
 * - 传统 profile_embedding 匹配
 * - 核心区向量匹配（更高置信度）
 * - 区域置信度加成
 */

import type { IMatcher, MatcherOptions } from "./interfaces";
import type { MatchResult, MatcherContext, VectorMatchDetail } from "../types";
import {
  CLASSIFICATION_WEIGHTS,
  CLASSIFICATION_THRESHOLDS,
} from "../constants";
import type { FolderProfileRepository } from "../repositories";
import type {
  CoreEdgeProfileService,
  FolderZoneMatch,
  ZoneType,
} from "../profile";

/**
 * 扩展的向量匹配详情（包含区域信息）
 */
export interface ZoneAwareVectorMatchDetail extends VectorMatchDetail {
  /** 区域匹配类型 */
  zoneMatch?: ZoneType;
  /** 核心区相似度 */
  coreSimilarity?: number;
  /** 边缘区相似度 */
  edgeSimilarity?: number;
  /** 区域置信度级别 */
  zoneConfidenceLevel?: "high" | "medium" | "low" | "none";
}

/**
 * Vector-based folder matching strategy
 * Uses cosine similarity between bookmark embedding and folder profile embeddings
 */
export class VectorMatcher implements IMatcher {
  readonly name = "vector";
  readonly weight: number;

  private folderProfileRepo: FolderProfileRepository;
  private coreEdgeService?: CoreEdgeProfileService;
  private threshold: number;
  private enableZoneMatching: boolean;

  constructor(
    folderProfileRepo: FolderProfileRepository,
    options?: MatcherOptions & {
      coreEdgeService?: CoreEdgeProfileService;
      enableZoneMatching?: boolean;
    },
  ) {
    this.folderProfileRepo = folderProfileRepo;
    this.coreEdgeService = options?.coreEdgeService;
    this.enableZoneMatching = options?.enableZoneMatching ?? true;
    this.weight = options?.weight ?? CLASSIFICATION_WEIGHTS.VECTOR;
    this.threshold =
      options?.thresholds?.similarity ??
      CLASSIFICATION_THRESHOLDS.VECTOR_SIMILARITY;
  }

  /**
   * Match bookmark to folders using vector similarity
   * 优先使用核心区匹配，回退到传统 profile 匹配
   */
  async match(context: MatcherContext): Promise<MatchResult[]> {
    if (!context.embedding || context.embedding.length === 0) {
      return [];
    }

    // 尝试核心区匹配（如果启用且服务可用）
    if (this.enableZoneMatching && this.coreEdgeService) {
      const zoneMatches = await this.matchWithCoreZone(context);
      if (zoneMatches.length > 0) {
        return zoneMatches;
      }
    }

    // 回退到传统 profile 匹配
    return this.matchWithProfile(context);
  }

  /**
   * 使用核心区向量进行匹配
   */
  private async matchWithCoreZone(
    context: MatcherContext,
  ): Promise<ZoneAwareVectorMatchDetail[]> {
    if (!this.coreEdgeService) return [];

    try {
      const zoneMatches = await this.coreEdgeService.searchMatchingFolders(
        context.userId,
        context.embedding,
        5,
        this.threshold,
      );

      if (zoneMatches.length === 0) {
        return [];
      }

      // 获取文件夹的额外信息（topTags, sampleTitles 等）
      const enrichedMatches = await this.enrichZoneMatches(
        context.userId,
        zoneMatches,
      );

      return enrichedMatches;
    } catch {
      // 核心区匹配失败，返回空数组让其回退到传统匹配
      return [];
    }
  }

  /**
   * 使用传统 profile_embedding 进行匹配
   */
  private async matchWithProfile(
    context: MatcherContext,
  ): Promise<VectorMatchDetail[]> {
    const similarFolders = await this.folderProfileRepo.searchSimilarFolders(
      context.embedding,
      context.userId,
      this.threshold,
      5,
    );

    return similarFolders.map(
      (folder): VectorMatchDetail => ({
        folderId: folder.folderId,
        folderName: folder.folderName,
        score: Math.round(folder.similarity * 100),
        confidence: Math.round(folder.similarity * 100),
        reason: `Vector similarity: ${(folder.similarity * 100).toFixed(0)}%`,
        topTags: folder.topTags,
        sampleTitles: folder.sampleTitles,
        bookmarkCount: folder.bookmarkCount,
        metadata: {
          similarity: folder.similarity,
          topTags: folder.topTags,
          sampleTitles: folder.sampleTitles,
          matchSource: "profile",
        },
      }),
    );
  }

  /**
   * 丰富区域匹配结果（添加 topTags, sampleTitles 等）
   */
  private async enrichZoneMatches(
    userId: string,
    zoneMatches: FolderZoneMatch[],
  ): Promise<ZoneAwareVectorMatchDetail[]> {
    // 获取传统 profile 数据作为补充
    const profiles = await this.folderProfileRepo.findByUserId(userId);
    const profileMap = new Map(profiles.map((p) => [p.folderId, p]));

    return zoneMatches.map((match): ZoneAwareVectorMatchDetail => {
      const profile = profileMap.get(match.folderId);

      // 根据区域类型计算置信度加成
      const baseConfidence = Math.round(match.coreSimilarity * 100);
      const zoneBonus = this.calculateZoneBonus(
        match.zoneMatch,
        match.confidenceLevel,
      );
      const finalConfidence = Math.min(100, baseConfidence + zoneBonus);

      return {
        folderId: match.folderId,
        folderName: match.folderName,
        score: finalConfidence,
        confidence: finalConfidence,
        reason: this.buildZoneReason(match),
        topTags: profile?.topTags ?? [],
        sampleTitles: profile?.sampleTitles ?? [],
        bookmarkCount: profile?.bookmarkCount ?? 0,
        zoneMatch: match.zoneMatch,
        coreSimilarity: match.coreSimilarity,
        edgeSimilarity: match.edgeSimilarity,
        zoneConfidenceLevel: match.confidenceLevel,
        metadata: {
          similarity: match.coreSimilarity,
          topTags: profile?.topTags ?? [],
          sampleTitles: profile?.sampleTitles ?? [],
          matchSource: "core_zone",
          zoneMatch: match.zoneMatch,
          coreSimilarity: match.coreSimilarity,
          edgeSimilarity: match.edgeSimilarity,
          confidenceLevel: match.confidenceLevel,
        },
      };
    });
  }

  /**
   * 计算区域置信度加成
   */
  private calculateZoneBonus(
    zone: ZoneType,
    confidenceLevel: "high" | "medium" | "low" | "none",
  ): number {
    // 核心区匹配给予更高加成
    const zoneBonus = {
      core: 15,
      edge: 5,
      outside: 0,
    };

    const levelBonus = {
      high: 10,
      medium: 5,
      low: 0,
      none: -5,
    };

    return zoneBonus[zone] + levelBonus[confidenceLevel];
  }

  /**
   * 构建区域匹配的原因说明
   */
  private buildZoneReason(match: FolderZoneMatch): string {
    const similarity = (match.coreSimilarity * 100).toFixed(0);

    switch (match.zoneMatch) {
      case "core":
        return `Core zone match: ${similarity}% (high confidence)`;
      case "edge":
        return `Edge zone match: ${similarity}% (moderate confidence)`;
      default:
        return `Vector similarity: ${similarity}%`;
    }
  }

  /**
   * Check if vector matching is available
   */
  async isAvailable(context: MatcherContext): Promise<boolean> {
    // Vector matching requires embedding
    return context.embedding != null && context.embedding.length > 0;
  }

  /**
   * 设置核心区服务（用于动态注入）
   */
  setCoreEdgeService(service: CoreEdgeProfileService): void {
    this.coreEdgeService = service;
  }

  /**
   * 启用/禁用区域匹配
   */
  setZoneMatchingEnabled(enabled: boolean): void {
    this.enableZoneMatching = enabled;
  }
}
