/**
 * VectorScorer - 向量相似度评分
 *
 * 通过 pgvector 搜索最相似的已分类书签，
 * 按文件夹聚合相似度，并应用关键词增强。
 *
 * 迁移自旧系统：
 * - strategies/classic/vector-matcher.ts
 * - strategies/modern/shared/hybrid-retriever.ts
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import type {
  Scorer,
  Score,
  BookmarkContext,
  FolderContext,
  UserContext,
} from "../types";
import { CLASSIFICATION_CONFIG } from "../config";
import { searchSimilarBookmarks } from "../infra/vector-search";

/** 文件夹聚合结果（内部） */
interface FolderAggregation {
  folderId: number;
  totalSimilarity: number;
  matchCount: number;
  topSimilarity: number;
  matchedTitles: string[];
}

export class VectorScorer implements Scorer {
  readonly name = "vector";
  readonly tier = "fast" as const;
  readonly defaultWeight = CLASSIFICATION_CONFIG.scorerWeights.vector;

  async score(
    bookmark: BookmarkContext,
    candidates: FolderContext[],
    userCtx: UserContext,
  ): Promise<Map<number, Score>> {
    const results = new Map<number, Score>();
    const candidateIds = new Set(candidates.map((c) => c.id));

    // 1. 向量搜索
    const similar = await searchSimilarBookmarks(
      userCtx.userId,
      bookmark.embedding,
      {
        limit: CLASSIFICATION_CONFIG.vector.searchLimit,
        threshold: CLASSIFICATION_CONFIG.vector.similarityThreshold,
        excludeBookmarkId: bookmark.bookmarkId,
      },
    );

    if (similar.length === 0) return results;

    // 2. 按文件夹聚合
    const folderAgg = new Map<number, FolderAggregation>();

    for (const item of similar) {
      if (item.folderId === null) continue;
      if (!candidateIds.has(item.folderId)) continue;

      const agg = folderAgg.get(item.folderId) ?? {
        folderId: item.folderId,
        totalSimilarity: 0,
        matchCount: 0,
        topSimilarity: 0,
        matchedTitles: [],
      };

      agg.totalSimilarity += item.similarity;
      agg.matchCount += 1;
      agg.topSimilarity = Math.max(agg.topSimilarity, item.similarity);
      if (agg.matchedTitles.length < 3) {
        agg.matchedTitles.push(item.bookmarkTitle);
      }

      folderAgg.set(item.folderId, agg);
    }

    // 3. 计算每个文件夹的分数
    const candidateMap = new Map(candidates.map((c) => [c.id, c]));

    for (const [folderId, agg] of folderAgg) {
      const folder = candidateMap.get(folderId);
      if (!folder) continue;

      // 基础分数 = 平均相似度
      let baseScore = agg.totalSimilarity / agg.matchCount;

      // 匹配数量越多，置信度越高
      const matchBonus = Math.min(agg.matchCount * 0.05, 0.15);
      baseScore = Math.min(baseScore + matchBonus, 1.0);

      // 4. 关键词增强
      const keywordBoost = computeKeywordBoost(bookmark, folder);
      const finalScore = Math.min(baseScore + keywordBoost, 1.0);

      // 5. 置信度：匹配数 >= 3 则高置信度
      const confidence =
        agg.matchCount >=
        CLASSIFICATION_CONFIG.vector.minMatchesForHighConfidence
          ? 0.8
          : 0.5;

      const reasons: string[] = [];
      reasons.push(
        `与「${folder.name}」中 ${agg.matchCount} 个书签相似（最高 ${(agg.topSimilarity * 100).toFixed(0)}%）`,
      );
      if (keywordBoost > 0) {
        reasons.push(`关键词匹配增强 +${(keywordBoost * 100).toFixed(0)}%`);
      }

      results.set(folderId, {
        value: finalScore,
        confidence,
        reason: reasons.join("；"),
        signals: [
          {
            type: "vector_sim",
            detail: `Top similarity: ${agg.topSimilarity.toFixed(3)}, matches: ${agg.matchCount}`,
            strength: agg.topSimilarity,
          },
          ...(keywordBoost > 0
            ? [
                {
                  type: "keyword" as const,
                  detail: `Keyword boost: ${keywordBoost.toFixed(3)}`,
                  strength: keywordBoost,
                },
              ]
            : []),
        ],
      });
    }

    return results;
  }
}

/**
 * 关键词增强：标题/标签与文件夹名/关键词的匹配
 */
function computeKeywordBoost(
  bookmark: BookmarkContext,
  folder: FolderContext,
): number {
  let boost = 0;

  // 标题包含文件夹名
  if (bookmark.normalizedTitle.includes(folder.normalizedName)) {
    boost += 0.3;
  }

  // 标签与文件夹名精确匹配
  for (const tag of bookmark.normalizedTags) {
    if (tag === folder.normalizedName) {
      boost += 0.4;
      break; // 只加一次
    }
    if (
      tag.includes(folder.normalizedName) ||
      folder.normalizedName.includes(tag)
    ) {
      boost += 0.2;
      break;
    }
  }

  // 文件夹关键词与书签标签的交集
  if (folder.keywords.length > 0 && bookmark.normalizedTags.length > 0) {
    const folderKws = new Set(folder.keywords.map((k) => k.toLowerCase()));
    const matched = bookmark.normalizedTags.filter((t) => folderKws.has(t));
    if (matched.length > 0) {
      boost += 0.15 * Math.min(matched.length, 3);
    }
  }

  return Math.min(boost, 0.5); // 上限 50%
}
