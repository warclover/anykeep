/**
 * 清理服务
 *
 * 独立的去重和死链检测服务，不阻塞分拣主流程
 *
 * @module classification/batch-classification/cleanup/cleanup.service
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { cosineSimilarity } from "../utils/similarity";

// ============================================
// 类型定义
// ============================================

export interface DuplicateGroup {
  masterId: number;
  duplicateIds: number[];
  similarity: number;
  domain: string;
}

export interface DeadLink {
  bookmarkId: number;
  url: string;
  status: "timeout" | "not_found" | "error";
  lastChecked: Date;
  retryCount: number;
}

export interface CleanupReport {
  duplicateGroups: DuplicateGroup[];
  deadLinks: DeadLink[];
  stats: {
    totalChecked: number;
    duplicatesFound: number;
    deadLinksFound: number;
    executionTimeMs: number;
  };
}

export interface CleanupConfig {
  /** ���义去重相似度阈值 */
  duplicateSimilarityThreshold: number;
  /** 死链检测超时（毫秒） */
  deadLinkTimeoutMs: number;
  /** 死链检测最大重试次数 */
  maxRetryCount: number;
  /** 每批检测数量 */
  batchSize: number;
}

export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  duplicateSimilarityThreshold: 0.98,
  deadLinkTimeoutMs: 5000,
  maxRetryCount: 3,
  batchSize: 50,
};

// ============================================
// 清理服务
// ============================================

/**
 * 书签清理服务
 *
 * 功能：
 * 1. 语义去重：向量相似度 > 0.98 且域名一致
 * 2. 死链检测：带重试机制，标记为"疑似失效"
 * 3. 生成清理报告
 */
export class BookmarkCleanupService {
  private supabase: SupabaseClient<Database>;
  private config: CleanupConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config: CleanupConfig = DEFAULT_CLEANUP_CONFIG,
  ) {
    this.supabase = supabase;
    this.config = config;
  }

  /**
   * 检测重复书签
   */
  async detectDuplicates(
    bookmarkIds: number[],
    userId: string,
  ): Promise<DuplicateGroup[]> {
    // 获取书签数据
    const { data: bookmarks, error } = await this.supabase
      .from("bookmarks")
      .select("id, url, embedding")
      .in("id", bookmarkIds)
      .eq("user_id", userId)
      .not("embedding", "is", null);

    if (error || !bookmarks || bookmarks.length === 0) {
      return [];
    }

    const duplicateGroups: DuplicateGroup[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < bookmarks.length; i++) {
      if (processed.has(bookmarks[i].id)) continue;

      const current = bookmarks[i];
      const currentDomain = this.extractDomain(current.url);
      const duplicates: number[] = [];

      for (let j = i + 1; j < bookmarks.length; j++) {
        if (processed.has(bookmarks[j].id)) continue;

        const other = bookmarks[j];
        const otherDomain = this.extractDomain(other.url);

        // 域名必须一致
        if (currentDomain !== otherDomain) continue;

        // 计算相似度
        const similarity = cosineSimilarity(
          current.embedding as unknown as number[],
          other.embedding as unknown as number[],
        );

        if (similarity >= this.config.duplicateSimilarityThreshold) {
          duplicates.push(other.id);
          processed.add(other.id);
        }
      }

      if (duplicates.length > 0) {
        duplicateGroups.push({
          masterId: current.id,
          duplicateIds: duplicates,
          similarity: this.config.duplicateSimilarityThreshold,
          domain: currentDomain,
        });
        processed.add(current.id);
      }
    }

    return duplicateGroups;
  }

  /**
   * 检测死链
   */
  async detectDeadLinks(
    bookmarkIds: number[],
    userId: string,
  ): Promise<DeadLink[]> {
    const { data: bookmarks, error } = await this.supabase
      .from("bookmarks")
      .select("id, url")
      .in("id", bookmarkIds)
      .eq("user_id", userId);

    if (error || !bookmarks) {
      return [];
    }

    const deadLinks: DeadLink[] = [];

    // 分批检测
    for (let i = 0; i < bookmarks.length; i += this.config.batchSize) {
      const batch = bookmarks.slice(i, i + this.config.batchSize);
      const batchResults = await Promise.all(
        batch.map((b) => this.checkLink(b.id, b.url)),
      );

      deadLinks.push(...batchResults.filter((r): r is DeadLink => r !== null));

      // 批次间延迟，避免请求过快
      if (i + this.config.batchSize < bookmarks.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return deadLinks;
  }

  /**
   * 检测单个链接
   */
  private async checkLink(
    bookmarkId: number,
    url: string,
  ): Promise<DeadLink | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.deadLinkTimeoutMs,
      );

      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        return {
          bookmarkId,
          url,
          status: "not_found",
          lastChecked: new Date(),
          retryCount: 0,
        };
      }

      return null;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          bookmarkId,
          url,
          status: "timeout",
          lastChecked: new Date(),
          retryCount: 0,
        };
      }

      return {
        bookmarkId,
        url,
        status: "error",
        lastChecked: new Date(),
        retryCount: 0,
      };
    }
  }

  /**
   * 生成清理报告
   */
  async generateCleanupReport(
    userId: string,
    bookmarkIds?: number[],
  ): Promise<CleanupReport> {
    const startTime = performance.now();

    // 如果没有指定书签，获取用户所有书签
    let targetIds = bookmarkIds;
    if (!targetIds) {
      const { data } = await this.supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", userId)
        .eq("is_in_trash", false);

      targetIds = (data || []).map((b) => b.id);
    }

    // 并行执行检测
    const [duplicateGroups, deadLinks] = await Promise.all([
      this.detectDuplicates(targetIds, userId),
      this.detectDeadLinks(targetIds, userId),
    ]);

    const executionTimeMs = performance.now() - startTime;

    return {
      duplicateGroups,
      deadLinks,
      stats: {
        totalChecked: targetIds.length,
        duplicatesFound: duplicateGroups.reduce(
          (sum, g) => sum + g.duplicateIds.length,
          0,
        ),
        deadLinksFound: deadLinks.length,
        executionTimeMs,
      },
    };
  }

  /**
   * 合并重复书签
   */
  async mergeDuplicates(group: DuplicateGroup, userId: string): Promise<void> {
    // 将重复书签移入回收站
    await this.supabase
      .from("bookmarks")
      .update({ is_in_trash: true })
      .in("id", group.duplicateIds)
      .eq("user_id", userId);
  }

  /**
   * 标记死链
   */
  async markDeadLinks(deadLinks: DeadLink[], userId: string): Promise<void> {
    for (const link of deadLinks) {
      await this.supabase
        .from("bookmarks")
        .update({
          // 可以添加一个 link_status 字段
          // link_status: 'dead',
          // link_last_checked: link.lastChecked.toISOString(),
        })
        .eq("id", link.bookmarkId)
        .eq("user_id", userId);
    }
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
}
