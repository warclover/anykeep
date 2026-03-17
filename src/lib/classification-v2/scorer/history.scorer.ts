/**
 * HistoryScorer - 用户历史分类模式匹配
 *
 * 查询用户最近已分类书签的分类记录，
 * 按文件夹聚合匹配频率（标签交集 + 标题关键词重叠）。
 *
 * 迁移自旧系统 strategies/classic/history-matcher.ts
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  Scorer,
  Score,
  Signal,
  BookmarkContext,
  FolderContext,
  UserContext,
} from "../types";
import { CLASSIFICATION_CONFIG } from "../config";

/** 历史书签记录（内部） */
interface HistoryRecord {
  folderId: number;
  title: string;
  tags: string[];
}

/** 文件夹匹配聚合（内部） */
interface FolderMatchAgg {
  folderId: number;
  totalScore: number;
  matchCount: number;
  matchDetails: string[];
}

export class HistoryScorer implements Scorer {
  readonly name = "history";
  readonly tier = "fast" as const;
  readonly defaultWeight = CLASSIFICATION_CONFIG.scorerWeights.history;

  /** 冷启动用户跳过 */
  shouldRun(_bookmark: BookmarkContext, userCtx: UserContext): boolean {
    return userCtx.stage !== "cold_start";
  }

  async score(
    bookmark: BookmarkContext,
    candidates: FolderContext[],
    userCtx: UserContext,
  ): Promise<Map<number, Score>> {
    const results = new Map<number, Score>();
    const candidateIds = new Set(candidates.map((c) => c.id));

    // 1. 查询用户最近的已分类书签
    const history = await fetchRecentClassified(
      userCtx.userId,
      CLASSIFICATION_CONFIG.history.lookbackCount,
    );

    if (history.length === 0) return results;

    // 2. 逐条匹配，按文件夹聚合
    const folderAgg = new Map<number, FolderMatchAgg>();

    for (const record of history) {
      if (!candidateIds.has(record.folderId)) continue;

      const matchScore = computeMatchScore(bookmark, record);
      if (matchScore <= 0) continue;

      const agg = folderAgg.get(record.folderId) ?? {
        folderId: record.folderId,
        totalScore: 0,
        matchCount: 0,
        matchDetails: [],
      };

      agg.totalScore += matchScore;
      agg.matchCount += 1;
      if (agg.matchDetails.length < 3) {
        agg.matchDetails.push(truncate(record.title, 30));
      }
      folderAgg.set(record.folderId, agg);
    }

    // 3. 转换为分数
    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    const { minMatchCount } = CLASSIFICATION_CONFIG.history;

    for (const [folderId, agg] of folderAgg) {
      if (agg.matchCount < minMatchCount) continue;

      const folder = candidateMap.get(folderId);
      if (!folder) continue;

      // 基础分数 = 平均匹配分 * 频率修正
      const avgScore = agg.totalScore / agg.matchCount;
      const frequencyBonus = Math.min(agg.matchCount * 0.05, 0.2);
      const finalScore = Math.min(avgScore + frequencyBonus, 1.0);

      // 匹配次数 >= 3 时高置信度
      const confidence = agg.matchCount >= 3 ? 0.7 : 0.4;

      const signals: Signal[] = [
        {
          type: "history",
          detail: `与「${folder.name}」中 ${agg.matchCount} 条历史书签相似`,
          strength: finalScore,
        },
      ];

      results.set(folderId, {
        value: finalScore,
        confidence,
        reason: `历史模式匹配: ${agg.matchCount} 条相似记录在「${folder.name}」`,
        signals,
      });
    }

    return results;
  }
}

// ============================================================================
// 内部函数
// ============================================================================

/**
 * 获取用户最近已分类的书签
 */
async function fetchRecentClassified(
  userId: string,
  limit: number,
): Promise<HistoryRecord[]> {
  try {
    // 使用 service client 绕过 RLS（分类在异步上下文中执行，用户会话可能已失效）
    const supabase = await createServiceClient();

    type BookmarkRow = {
      folder_id: number;
      title: string;
      tags: string[] | null;
    };

    const { data: rawData, error } = await supabase
      .from("bookmarks")
      .select("folder_id, title, tags")
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .not("folder_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error({ error, userId }, "HistoryScorer: fetch failed");
      return [];
    }

    const data = (rawData ?? []) as unknown as BookmarkRow[];

    return data
      .filter((row) => row.folder_id != null)
      .map((row) => ({
        folderId: row.folder_id,
        title: (row.title ?? "").toLowerCase(),
        tags: (row.tags ?? []).map((t) => t.toLowerCase()),
      }));
  } catch (err) {
    logger.error({ err }, "HistoryScorer: fetch exception");
    return [];
  }
}

/**
 * 计算书签与历史记录的匹配分数
 *
 * 两个维度：
 * 1. 标签交集（主要信号）
 * 2. 标题关键词重叠（辅助信号）
 */
function computeMatchScore(
  bookmark: BookmarkContext,
  record: HistoryRecord,
): number {
  let score = 0;

  // 1. 标签交集
  if (bookmark.normalizedTags.length > 0 && record.tags.length > 0) {
    const bookmarkTags = new Set(bookmark.normalizedTags);
    const intersection = record.tags.filter((t) => bookmarkTags.has(t));

    if (intersection.length > 0) {
      // Jaccard 相似度
      const union = new Set([...bookmark.normalizedTags, ...record.tags]);
      const jaccard = intersection.length / union.size;
      score += jaccard * 0.7; // 标签权重 70%
    }
  }

  // 2. 标题关键词重叠
  const bookmarkWords = extractWords(bookmark.normalizedTitle);
  const recordWords = extractWords(record.title);

  if (bookmarkWords.length > 0 && recordWords.length > 0) {
    const bSet = new Set(bookmarkWords);
    const overlap = recordWords.filter((w) => bSet.has(w));

    if (overlap.length > 0) {
      const overlapRatio =
        overlap.length / Math.max(bookmarkWords.length, recordWords.length);
      score += overlapRatio * 0.3; // 标题权重 30%
    }
  }

  return Math.min(score, 1.0);
}

/** 提取有效词（>1字符，去停用词） */
function extractWords(text: string): string[] {
  return text
    .split(/[\s+\-_/&,，。、;；：:!！?？()（）[\]【】{}'"'""\s]+/)
    .filter((w) => w.length > 1);
}

/** 截断文本 */
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}
