/**
 * 收件箱聚类整理
 *
 * 加载 inbox 中的书签，按向量相似度聚类，
 * 为每个聚类推荐目标文件夹或建议创建新文件夹。
 *
 * 迁移自旧系统 services/inbox-organizer.service.ts
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { CLASSIFICATION_CONFIG } from "../config";
import { classify } from "../classify";
import type { ClassifyRequest, ClassifyResult } from "../types";

/** 聚类结果 */
export interface InboxCluster {
  /** 聚类中的书签 */
  bookmarks: InboxBookmark[];
  /** 推荐目标文件夹（来自 classify） */
  suggestedFolderId: number | null;
  suggestedFolderName: string | null;
  /** 是否建议创建新文件夹 */
  suggestCreateNew: boolean;
  /** 建议的新文件夹名 */
  suggestedNewFolderName?: string;
  /** 聚类置信度 */
  confidence: number;
}

/** inbox 书签 */
export interface InboxBookmark {
  id: string;
  title: string;
  url?: string;
  summary?: string;
  tags: string[];
  embedding?: number[];
}

/** 整理结果 */
export interface OrganizeResult {
  clusters: InboxCluster[];
  /** 未能聚类的散落书签 */
  unclustered: InboxBookmark[];
  totalMs: number;
}

/**
 * 整理收件箱
 *
 * @param userId - 用户 ID
 * @returns 聚类结果 + 分类建议
 */
export async function organizeInbox(userId: string): Promise<OrganizeResult> {
  const startTime = Date.now();
  const { minClusterSize, clusterSimilarity, folderMatchThreshold } =
    CLASSIFICATION_CONFIG.inboxOrganize;

  // 1. 加载 inbox 书签
  const bookmarks = await loadInboxBookmarks(userId);

  if (bookmarks.length < minClusterSize) {
    return {
      clusters: [],
      unclustered: bookmarks,
      totalMs: Date.now() - startTime,
    };
  }

  // 2. 简单聚类（基于向量余弦相似度）
  const clusters = clusterByEmbedding(
    bookmarks,
    clusterSimilarity,
    minClusterSize,
  );

  // 3. 为每个聚类推荐文件夹
  const enrichedClusters: InboxCluster[] = [];

  for (const cluster of clusters) {
    // 选聚类中心（第一个有 embedding 的）
    const representative = cluster[0];

    const request: ClassifyRequest = {
      bookmarkId: representative.id,
      title: representative.title,
      url: representative.url,
      summary: representative.summary,
      tags: representative.tags,
      userId,
    };

    let result: ClassifyResult;
    try {
      result = await classify(request);
    } catch {
      enrichedClusters.push({
        bookmarks: cluster,
        suggestedFolderId: null,
        suggestedFolderName: null,
        suggestCreateNew: true,
        confidence: 0,
      });
      continue;
    }

    const meetsThreshold = result.confidence >= folderMatchThreshold;

    enrichedClusters.push({
      bookmarks: cluster,
      suggestedFolderId: meetsThreshold ? result.folderId : null,
      suggestedFolderName: meetsThreshold ? result.folderName : null,
      suggestCreateNew: !meetsThreshold,
      suggestedNewFolderName: result.suggestedFolderName,
      confidence: result.confidence,
    });
  }

  // 4. 收集未聚类的书签
  const clusteredIds = new Set(clusters.flat().map((b) => b.id));
  const unclustered = bookmarks.filter((b) => !clusteredIds.has(b.id));

  const totalMs = Date.now() - startTime;

  logger.info(
    {
      userId,
      totalBookmarks: bookmarks.length,
      clusterCount: enrichedClusters.length,
      unclusteredCount: unclustered.length,
      totalMs,
    },
    "InboxOrganize: complete",
  );

  return { clusters: enrichedClusters, unclustered, totalMs };
}

// ============================================================================
// 内部函数
// ============================================================================

/**
 * 加载 inbox 中的书签（folder_id 为 null 的）
 */
async function loadInboxBookmarks(userId: string): Promise<InboxBookmark[]> {
  const supabase = await createClient();

  type BookmarkRow = {
    id: string;
    title: string;
    url: string | null;
    summary: string | null;
    tags: string[] | null;
    embedding: number[] | null;
  };

  const { data: rawData, error } = await supabase
    .from("bookmarks")
    .select("id, title, url, summary, tags, embedding")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .is("folder_id", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    logger.error({ error, userId }, "InboxOrganize: load failed");
    return [];
  }

  const data = (rawData ?? []) as unknown as BookmarkRow[];

  return data.map((row) => ({
    id: String(row.id),
    title: row.title ?? "",
    url: row.url ?? undefined,
    summary: row.summary ?? undefined,
    tags: row.tags ?? [],
    embedding: row.embedding ?? undefined,
  }));
}

/**
 * 简单贪婪聚类
 *
 * 遍历书签，如果当前书签与某个聚类的中心相似度 >= threshold，
 * 则加入该聚类；否则新建聚类。
 * 最后过滤掉小于 minSize 的聚类。
 */
function clusterByEmbedding(
  bookmarks: InboxBookmark[],
  threshold: number,
  minSize: number,
): InboxBookmark[][] {
  const withEmbedding = bookmarks.filter(
    (b) => b.embedding && b.embedding.length > 0,
  );
  if (withEmbedding.length === 0) return [];

  const clusters: Array<{
    center: number[];
    members: InboxBookmark[];
  }> = [];

  for (const bookmark of withEmbedding) {
    let bestCluster = -1;
    let bestSim = -1;

    for (let i = 0; i < clusters.length; i++) {
      const sim = cosineSimilarity(
        bookmark.embedding ?? [],
        clusters[i].center,
      );
      if (sim > bestSim) {
        bestSim = sim;
        bestCluster = i;
      }
    }

    if (bestSim >= threshold && bestCluster >= 0) {
      clusters[bestCluster].members.push(bookmark);
    } else {
      clusters.push({
        center: bookmark.embedding ?? [],
        members: [bookmark],
      });
    }
  }

  // 将没有 embedding 的书签视为散落
  // 过滤小聚类
  return clusters
    .filter((c) => c.members.length >= minSize)
    .map((c) => c.members);
}

/** 余弦相似度 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}
