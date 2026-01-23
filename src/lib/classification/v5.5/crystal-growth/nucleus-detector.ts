/**
 * V5.5 晶核检测器
 *
 * 检测混沌池中的书签是否能形成晶核：
 * - 搜索语义相近的邻居书签
 * - 判断是否达到结晶阈值
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { NucleusResult, NeighborBookmark } from "./types";
import { CRYSTAL_CONFIG } from "./types";

export class NucleusDetector {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 检测书签是否能形成晶核
   *
   * @param userId 用户 ID
   * @param bookmarkId 触发检测的书签 ID
   * @param threshold 晶核形成阈值（默认 3）
   * @returns 晶核检测结果
   */
  async detect(
    userId: string,
    bookmarkId: number,
    threshold: number = CRYSTAL_CONFIG.NUCLEATION_THRESHOLD,
  ): Promise<NucleusResult> {
    const startTime = performance.now();

    try {
      // 获取触发书签的信息
      const triggerBookmark = await this.getBookmarkInfo(bookmarkId);
      if (!triggerBookmark) {
        logger.warn({ userId, bookmarkId }, "V5.5: Trigger bookmark not found");
        return this.emptyResult();
      }

      // 查找混沌池中的邻居
      const neighbors = await this.findNeighbors(
        userId,
        bookmarkId,
        CRYSTAL_CONFIG.NUCLEUS_RADIUS,
        CRYSTAL_CONFIG.MAX_NEIGHBORS,
      );

      const neighborsCount = neighbors.length;

      // 检查是否达到阈值（邻居数 + 1（自己） >= 阈值）
      if (neighborsCount + 1 < threshold) {
        logger.debug(
          {
            userId,
            bookmarkId,
            neighborsCount,
            threshold,
            latencyMs: performance.now() - startTime,
          },
          "V5.5: Nucleus not formed - insufficient neighbors",
        );

        return {
          formed: false,
          neighborsCount,
          clusterBookmarkIds: [],
          clusterTitles: [],
        };
      }

      // 形成晶核：取最相似的邻居（不超过阈值-1个）
      const selectedNeighbors = neighbors.slice(0, threshold - 1);
      const clusterBookmarkIds = [
        bookmarkId,
        ...selectedNeighbors.map((n) => n.bookmark_id),
      ];
      const clusterTitles = [
        triggerBookmark.title,
        ...selectedNeighbors.map((n) => n.title),
      ];
      const avgSimilarity = this.calculateAvgSimilarity(selectedNeighbors);

      logger.info(
        {
          userId,
          bookmarkId,
          neighborsCount,
          clusterSize: clusterBookmarkIds.length,
          avgSimilarity,
          latencyMs: performance.now() - startTime,
        },
        "V5.5: Nucleus formed!",
      );

      return {
        formed: true,
        neighborsCount,
        clusterBookmarkIds,
        clusterTitles,
        avgSimilarity,
      };
    } catch (error) {
      logger.error(
        { userId, bookmarkId, error },
        "V5.5: Nucleus detection failed",
      );
      return this.emptyResult();
    }
  }

  /**
   * 查找混沌池中的邻居书签
   */
  private async findNeighbors(
    userId: string,
    bookmarkId: number,
    radius: number,
    limit: number,
  ): Promise<NeighborBookmark[]> {
    const { data, error } = await this.supabase.rpc(
      "find_chaos_pool_neighbors",
      {
        p_user_id: userId,
        p_bookmark_id: bookmarkId,
        p_radius: radius,
        p_limit: limit,
      },
    );

    if (error) {
      logger.error(
        { userId, bookmarkId, error },
        "V5.5: Failed to find neighbors",
      );
      return [];
    }

    return (data ?? []) as NeighborBookmark[];
  }

  /**
   * 获取书签基本信息
   */
  private async getBookmarkInfo(
    bookmarkId: number,
  ): Promise<{ id: number; title: string } | null> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id, title")
      .eq("id", bookmarkId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return { id: data.id, title: data.title };
  }

  /**
   * 计算平均相似度
   */
  private calculateAvgSimilarity(neighbors: NeighborBookmark[]): number {
    if (neighbors.length === 0) return 0;
    const sum = neighbors.reduce((acc, n) => acc + n.similarity, 0);
    return Math.round((sum / neighbors.length) * 1000) / 1000;
  }

  /**
   * 返回空结果
   */
  private emptyResult(): NucleusResult {
    return {
      formed: false,
      neighborsCount: 0,
      clusterBookmarkIds: [],
      clusterTitles: [],
    };
  }
}
