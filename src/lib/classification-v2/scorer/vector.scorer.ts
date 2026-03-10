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
import { searchSimilarFolderProfiles } from "../infra/vector-search";

// ============================================================================
// Scorer 内部常量
// ============================================================================

/** 每次额外匹配带来的分数增益 */
const MATCH_BONUS_PER_HIT = 0.05;
/** 匹配数量增益上限 */
const MATCH_BONUS_CAP = 0.15;
/** 高置信度：多条匹配时 */
const CONFIDENCE_HIGH = 0.8;
/** 低置信度：少量匹配时 */
const CONFIDENCE_LOW = 0.5;

// 关键词增强权重
/** 标题包含文件夹名时的增益 */
const KEYWORD_BOOST_TITLE_MATCH = 0.3;
/** 标签与文件夹名精确匹配的增益 */
const KEYWORD_BOOST_TAG_EXACT = 0.4;
/** 标签与文件夹名部分匹配的增益 */
const KEYWORD_BOOST_TAG_PARTIAL = 0.2;
/** 文件夹关键词与标签交集时每个匹配的增益 */
const KEYWORD_BOOST_PER_KW_HIT = 0.15;
/** 关键词交集最大计数 */
const KEYWORD_HIT_CAP = 3;
/** 关键词增强总上限 */
const KEYWORD_BOOST_MAX = 0.5;

/** 文件夹聚合结果（内部） */
interface FolderAggregation {
  folderId: number;
  totalSimilarity: number;
  matchCount: number;
  topSimilarity: number;
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

    // 1. 向量搜索（搜索相似的文件夹画像）
    const similar = await searchSimilarFolderProfiles(
      userCtx.userId,
      bookmark.embedding,
      {
        limit: CLASSIFICATION_CONFIG.vector.searchLimit,
        threshold: CLASSIFICATION_CONFIG.vector.similarityThreshold,
      },
    );

    if (similar.length === 0) return results;

    // 2. 按文件夹聚合
    const folderAgg = new Map<number, FolderAggregation>();

    for (const item of similar) {
      if (!candidateIds.has(item.folderId)) continue;

      const agg = folderAgg.get(item.folderId) ?? {
        folderId: item.folderId,
        totalSimilarity: 0,
        matchCount: 0,
        topSimilarity: 0,
      };

      agg.totalSimilarity += item.similarity;
      agg.matchCount += 1;
      agg.topSimilarity = Math.max(agg.topSimilarity, item.similarity);

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
      const matchBonus = Math.min(
        agg.matchCount * MATCH_BONUS_PER_HIT,
        MATCH_BONUS_CAP,
      );
      baseScore = Math.min(baseScore + matchBonus, 1.0);

      // 4. 关键词增强
      const keywordBoost = computeKeywordBoost(bookmark, folder);
      const finalScore = Math.min(baseScore + keywordBoost, 1.0);

      // 5. 置信度：匹配数 >= 3 则高置信度
      const confidence =
        agg.matchCount >=
        CLASSIFICATION_CONFIG.vector.minMatchesForHighConfidence
          ? CONFIDENCE_HIGH
          : CONFIDENCE_LOW;

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
    boost += KEYWORD_BOOST_TITLE_MATCH;
  }

  // 标签与文件夹名精确匹配
  for (const tag of bookmark.normalizedTags) {
    if (tag === folder.normalizedName) {
      boost += KEYWORD_BOOST_TAG_EXACT;
      break; // 只加一次
    }
    if (
      tag.includes(folder.normalizedName) ||
      folder.normalizedName.includes(tag)
    ) {
      boost += KEYWORD_BOOST_TAG_PARTIAL;
      break;
    }
  }

  // 文件夹关键词与书签标签的交集
  if (folder.keywords.length > 0 && bookmark.normalizedTags.length > 0) {
    const folderKws = new Set(folder.keywords.map((k) => k.toLowerCase()));
    const matched = bookmark.normalizedTags.filter((t) => folderKws.has(t));
    if (matched.length > 0) {
      boost +=
        KEYWORD_BOOST_PER_KW_HIT * Math.min(matched.length, KEYWORD_HIT_CAP);
    }
  }

  return Math.min(boost, KEYWORD_BOOST_MAX);
}
