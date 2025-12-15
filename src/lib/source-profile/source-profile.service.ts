/**
 * Source Profile Service
 * V4.2 来源画像服务
 *
 * @description 管理公众号/网站的内容画像
 * - 从 URL 识别来源
 * - 维护来源的历史分类记录
 * - 提供快速匹配建议
 *
 * @note 数据库表 source_profiles 在迁移 20251211100001 中创建
 *       在迁移应用并重新生成类型之前，使用类型断言
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { BaseSupabaseService } from "@/lib/classification/services/base-supabase.service";
import type {
  SourceProfile,
  SourceType,
  ContentType,
  SourceMatchResult,
  CreateSourceProfileInput,
  UpdateSourceProfileInput,
} from "@/types/source-profile";
import {
  extractSourceFromUrl,
  HIGH_TRUST_THRESHOLD,
} from "@/types/source-profile";
import { FAST_PATH_THRESHOLDS } from "@/lib/trust-mode/config";

// 表名常量（迁移后会在 Supabase 类型中）
const SOURCE_PROFILES_TABLE = "source_profiles" as const;

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 数据库返回的原始数据
 */
interface SourceProfileRow {
  id: number;
  user_id: string;
  source_id: string;
  source_name: string | null;
  source_type: SourceType;
  domains: string[];
  trust_score: number;
  content_type: ContentType;
  frequent_folders: number[];
  sample_count: number;
  avg_confidence: number | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 来源画像服务
 */
export class SourceProfileService extends BaseSupabaseService {
  // ============================================================================
  // 公开方法
  // ============================================================================

  /**
   * 从 URL 获取或创建来源画像
   */
  async getOrCreateFromUrl(
    userId: string,
    url: string,
    sourceName?: string,
  ): Promise<SourceProfile | null> {
    const extractedSource = extractSourceFromUrl(url);

    if (!extractedSource.sourceId || extractedSource.sourceId === "unknown") {
      return null;
    }

    const existing = await this.findBySourceId(
      userId,
      extractedSource.sourceId,
    );

    if (existing) {
      return existing;
    }

    // 创建新画像
    return this.create({
      userId,
      sourceId: extractedSource.sourceId,
      sourceName: sourceName || extractedSource.sourceName || "",
      sourceType: extractedSource.sourceType,
    });
  }

  /**
   * 根据来源 ID 查找画像
   */
  async findBySourceId(
    userId: string,
    sourceId: string,
  ): Promise<SourceProfile | null> {
    const supabase = await this.getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(SOURCE_PROFILES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("source_id", sourceId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch source profile: ${error.message}`);
    }

    return this.mapToProfile(data as SourceProfileRow);
  }

  /**
   * 获取用户所有来源画像
   */
  async findAllByUserId(userId: string): Promise<SourceProfile[]> {
    const supabase = await this.getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(SOURCE_PROFILES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("sample_count", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch source profiles: ${error.message}`);
    }

    return (data || []).map((row: SourceProfileRow) => this.mapToProfile(row));
  }

  /**
   * 创建来源画像
   */
  async create(input: CreateSourceProfileInput): Promise<SourceProfile> {
    const supabase = await this.getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(SOURCE_PROFILES_TABLE)
      .insert({
        user_id: input.userId,
        source_id: input.sourceId,
        source_name: input.sourceName,
        source_type: input.sourceType,
        domains: input.domains || [],
        content_type: input.contentType || "unknown",
        frequent_folders: input.folderId ? [input.folderId] : [],
        sample_count: 1,
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create source profile: ${error.message}`);
    }

    return this.mapToProfile(data as SourceProfileRow);
  }

  /**
   * 更新来源画像（分类时调用）
   */
  async updateOnClassification(input: UpdateSourceProfileInput): Promise<void> {
    const { userId, sourceId, newFolderId, confidence, newDomains } = input;

    const supabase = await this.getSupabase();

    // 使用 RPC 函数原子更新
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("upsert_source_profile", {
      p_user_id: userId,
      p_source_id: sourceId,
      p_source_name: null,
      p_source_type: "website",
      p_folder_id: newFolderId || null,
      p_confidence: confidence || null,
    });

    if (error) {
      // 如果 RPC 失败，回退到直接更新
      await this.updateDirectly(input);
    }

    // 如果有新领域标签，单独更新
    if (newDomains && newDomains.length > 0) {
      await this.addDomains(userId, sourceId, newDomains);
    }
  }

  /**
   * 直接更新来源画像（备用方法）
   */
  private async updateDirectly(input: UpdateSourceProfileInput): Promise<void> {
    const { userId, sourceId, newFolderId, confidence } = input;

    const existing = await this.findBySourceId(userId, sourceId);
    if (!existing) {
      return;
    }

    const supabase = await this.getSupabase();

    // 更新高频文件夹
    let frequentFolders = existing.frequentFolders;
    if (newFolderId && !frequentFolders.includes(newFolderId)) {
      frequentFolders = [...frequentFolders, newFolderId];
    }

    // 计算新的平均置信度
    const newSampleCount = existing.sampleCount + 1;
    const newAvgConfidence = confidence
      ? ((existing.avgConfidence || 0) * existing.sampleCount + confidence) /
        newSampleCount
      : existing.avgConfidence;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(SOURCE_PROFILES_TABLE)
      .update({
        frequent_folders: frequentFolders,
        sample_count: newSampleCount,
        avg_confidence: newAvgConfidence,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("source_id", sourceId);

    if (error) {
      throw new Error(`Failed to update source profile: ${error.message}`);
    }
  }

  /**
   * 添加领域标签
   */
  async addDomains(
    userId: string,
    sourceId: string,
    domains: string[],
  ): Promise<void> {
    const existing = await this.findBySourceId(userId, sourceId);
    if (!existing) {
      return;
    }

    const supabase = await this.getSupabase();

    // 合并去重
    const mergedDomains = [...new Set([...existing.domains, ...domains])];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(SOURCE_PROFILES_TABLE)
      .update({
        domains: mergedDomains,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("source_id", sourceId);

    if (error) {
      throw new Error(`Failed to add domains: ${error.message}`);
    }
  }

  /**
   * 移除领域标签
   */
  async removeDomains(
    userId: string,
    sourceId: string,
    domainsToRemove: string[],
  ): Promise<void> {
    const existing = await this.findBySourceId(userId, sourceId);
    if (!existing) {
      return;
    }

    const supabase = await this.getSupabase();

    // 过滤掉要移除的标签
    const filteredDomains = existing.domains.filter(
      (d) => !domainsToRemove.includes(d),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(SOURCE_PROFILES_TABLE)
      .update({
        domains: filteredDomains,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("source_id", sourceId);

    if (error) {
      throw new Error(`Failed to remove domains: ${error.message}`);
    }
  }

  /**
   * 快速匹配：基于来源画像推荐文件夹
   */
  async getQuickMatch(userId: string, url: string): Promise<SourceMatchResult> {
    const extractedSource = extractSourceFromUrl(url);

    if (!extractedSource.sourceId || extractedSource.sourceId === "unknown") {
      return { found: false };
    }

    const profile = await this.findBySourceId(userId, extractedSource.sourceId);

    if (!profile) {
      return { found: false };
    }

    // 检查是否有足够样本
    if (profile.sampleCount < FAST_PATH_THRESHOLDS.MIN_SOURCE_SAMPLES) {
      return {
        found: true,
        profile,
        confidence: 30,
        reason: "Insufficient samples for high-confidence match",
      };
    }

    // 获取最高频的文件夹
    if (profile.frequentFolders.length === 0) {
      return {
        found: true,
        profile,
        confidence: 40,
        reason: "No folder history for this source",
      };
    }

    // 计算置信度
    // 基于样本数和历史准确率
    const sampleBonus = Math.min(profile.sampleCount * 2, 20); // 最多 +20
    const trustBonus = profile.trustScore > HIGH_TRUST_THRESHOLD ? 10 : 0;
    const baseConfidence = profile.avgConfidence || 60;
    const confidence = Math.min(baseConfidence + sampleBonus + trustBonus, 95);

    // 只有高于阈值才推荐
    if (confidence < FAST_PATH_THRESHOLDS.MIN_SOURCE_CONFIDENCE) {
      return {
        found: true,
        profile,
        confidence,
        reason: "Confidence below threshold",
      };
    }

    return {
      found: true,
      profile,
      suggestedFolderId: profile.frequentFolders[0],
      confidence,
      reason: `Source match: ${profile.sourceName || profile.sourceId} (${profile.sampleCount} samples)`,
    };
  }

  /**
   * 批量获取来源匹配
   */
  async getBatchQuickMatches(
    userId: string,
    urls: string[],
  ): Promise<Map<string, SourceMatchResult>> {
    const results = new Map<string, SourceMatchResult>();

    // 提取所有来源 ID
    const sourceIds = urls
      .map((url) => extractSourceFromUrl(url).sourceId)
      .filter((id) => id && id !== "unknown");

    if (sourceIds.length === 0) {
      return results;
    }

    // 批量查询
    const supabase = await this.getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(SOURCE_PROFILES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .in("source_id", sourceIds);

    if (error) {
      console.error("Batch source query failed:", error);
      return results;
    }

    // 构建 sourceId -> profile 映射
    const profileMap = new Map<string, SourceProfile>();
    for (const row of data || []) {
      const profile = this.mapToProfile(row as SourceProfileRow);
      profileMap.set(profile.sourceId, profile);
    }

    // 为每个 URL 生成结果
    for (const url of urls) {
      const sourceInfo = extractSourceFromUrl(url);
      const profile = profileMap.get(sourceInfo.sourceId);

      if (!profile) {
        results.set(url, { found: false });
        continue;
      }

      const matchResult = this.calculateMatchResult(profile);
      results.set(url, matchResult);
    }

    return results;
  }

  /**
   * 更新来源可信度
   *
   * V4.2.6: 使用 RPC 函数实现原子更新，避免竞态条件
   * 之前的实现是 read-modify-write 模式，在高并发场景下可能导致数据不一致
   */
  async updateTrustScore(
    userId: string,
    sourceId: string,
    adjustment: number,
  ): Promise<void> {
    const supabase = await this.getSupabase();

    // V4.2.6: 使用原子 RPC 函数更新信任分数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc(
      "adjust_source_trust_score",
      {
        p_user_id: userId,
        p_source_id: sourceId,
        p_adjustment: adjustment,
      },
    );

    if (error) {
      // 如果 RPC 函数不存在（迁移未运行），回退到原来的实现
      if (error.code === "42883" || error.message?.includes("does not exist")) {
        await this.updateTrustScoreFallback(userId, sourceId, adjustment);
        return;
      }
      throw new Error(`Failed to update trust score: ${error.message}`);
    }

    // 检查是否找到了记录
    if (data && !data.found) {
      // 来源画像不存在，忽略更新
      return;
    }
  }

  /**
   * V4.2.6: 降级的信任分数更新方法（当 RPC 函数不可用时）
   * 注意：此方法存在竞态条件风险，仅作为降级方案
   */
  private async updateTrustScoreFallback(
    userId: string,
    sourceId: string,
    adjustment: number,
  ): Promise<void> {
    const existing = await this.findBySourceId(userId, sourceId);
    if (!existing) {
      return;
    }

    const supabase = await this.getSupabase();
    const newScore = Math.max(
      0,
      Math.min(100, existing.trustScore + adjustment),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(SOURCE_PROFILES_TABLE)
      .update({
        trust_score: newScore,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("source_id", sourceId);

    if (error) {
      throw new Error(`Failed to update trust score: ${error.message}`);
    }
  }

  /**
   * 删除来源画像
   */
  async delete(userId: string, sourceId: string): Promise<void> {
    const supabase = await this.getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(SOURCE_PROFILES_TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("source_id", sourceId);

    if (error) {
      throw new Error(`Failed to delete source profile: ${error.message}`);
    }
  }

  /**
   * 清除用户缓存
   * @description 来源画像服务当前不使用内存缓存，此方法为接口一致性保留
   */
  clearUserCache(_userId: string): void {
    // 当前实现不使用内存缓存，每次从数据库读取
    // 未来可扩展为 Redis 或内存缓存
  }

  /**
   * 清除所有缓存
   * @description 来源画像服务当前不使用内存缓存，此方法为接口一致性保留
   */
  clearAllCache(): void {
    // 当前实现不使用内存缓存
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 计算匹配结果
   */
  private calculateMatchResult(profile: SourceProfile): SourceMatchResult {
    if (profile.sampleCount < FAST_PATH_THRESHOLDS.MIN_SOURCE_SAMPLES) {
      return {
        found: true,
        profile,
        confidence: 30,
        reason: "Insufficient samples",
      };
    }

    if (profile.frequentFolders.length === 0) {
      return {
        found: true,
        profile,
        confidence: 40,
        reason: "No folder history",
      };
    }

    const sampleBonus = Math.min(profile.sampleCount * 2, 20);
    const trustBonus = profile.trustScore > HIGH_TRUST_THRESHOLD ? 10 : 0;
    const baseConfidence = profile.avgConfidence || 60;
    const confidence = Math.min(baseConfidence + sampleBonus + trustBonus, 95);

    if (confidence < FAST_PATH_THRESHOLDS.MIN_SOURCE_CONFIDENCE) {
      return {
        found: true,
        profile,
        confidence,
        reason: "Confidence below threshold",
      };
    }

    return {
      found: true,
      profile,
      suggestedFolderId: profile.frequentFolders[0],
      confidence,
      reason: `Source match (${profile.sampleCount} samples)`,
    };
  }

  /**
   * 映射数据库行到业务对象
   */
  private mapToProfile(row: SourceProfileRow): SourceProfile {
    return {
      sourceId: row.source_id,
      sourceName: row.source_name || "",
      sourceType: row.source_type,
      domains: row.domains || [],
      trustScore: row.trust_score,
      contentType: row.content_type,
      frequentFolders: row.frequent_folders || [],
      sampleCount: row.sample_count,
      avgConfidence: row.avg_confidence || undefined,
      lastSeenAt: row.last_seen_at || undefined,
    };
  }
}

// ============================================================================
// 单例导出
// ============================================================================

/**
 * 来源画像服务单例
 */
export const sourceProfileService = new SourceProfileService();
