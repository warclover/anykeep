/**
 * AuthorScorer - 作者/来源匹配
 *
 * 利用书签的作者/来源（公众号名、UP主等）与文件夹内历史作者分布的关联性。
 * instant tier — 纯内存匹配预加载的 topAuthors 数据，<1ms。
 *
 * 设计要点：
 * - 置信度基于作者在文件夹中的占比（ratio），而非简单有/无
 * - 最小样本量门槛（minCount=2），单篇不具统计意义
 * - 排名衰减：排名靠前的作者给更高基础分
 *
 * @version 1.0.0
 * @since 2026-03-11
 */

import type {
  Scorer,
  Score,
  Signal,
  BookmarkContext,
  FolderContext,
  UserContext,
} from "../types";
import { CLASSIFICATION_CONFIG } from "../config";

export class AuthorScorer implements Scorer {
  readonly name = "author";
  readonly tier = "instant" as const;
  readonly defaultWeight = CLASSIFICATION_CONFIG.scorerWeights.author;

  /** 无作者信息时跳过 */
  shouldRun(bookmark: BookmarkContext, _userCtx: UserContext): boolean {
    return !!bookmark.normalizedAuthorKey;
  }

  async score(
    bookmark: BookmarkContext,
    candidates: FolderContext[],
    _userCtx: UserContext,
  ): Promise<Map<number, Score>> {
    const results = new Map<number, Score>();
    const { minCount, highRatioThreshold, mediumRatioThreshold } =
      CLASSIFICATION_CONFIG.author;

    if (!bookmark.normalizedAuthorKey) return results;

    for (const folder of candidates) {
      if (!folder.topAuthors || folder.topAuthors.length === 0) continue;

      // 在 topAuthors 中查找匹配
      const matchIndex = folder.topAuthors.findIndex(
        (a) => a.name.toLowerCase().trim() === bookmark.normalizedAuthorKey,
      );

      if (matchIndex === -1) continue;

      const authorEntry = folder.topAuthors[matchIndex];

      // 最小样本量门槛：单篇不具统计意义
      if (authorEntry.count < minCount) continue;

      // 基础分 = 排名衰减（Top1=0.95, Top2=0.90, ...）
      const baseScore = Math.max(0.95 - matchIndex * 0.05, 0.5);

      // 置信度 = 基于占比
      const confidence =
        authorEntry.ratio >= highRatioThreshold
          ? 0.85
          : authorEntry.ratio >= mediumRatioThreshold
            ? 0.6
            : 0.35;

      // 最终分数 = baseScore × confidence，防止低占比作者触发 earlyExit
      const adjustedScore = baseScore * confidence;

      const signals: Signal[] = [
        {
          type: "author_match",
          detail: `来源「${authorEntry.name}」在「${folder.name}」中有 ${authorEntry.count} 篇 (${Math.round(authorEntry.ratio * 100)}%)`,
          strength: authorEntry.ratio,
        },
      ];

      results.set(folder.id, {
        value: adjustedScore,
        confidence,
        reason: `来源「${authorEntry.name}」在「${folder.name}」中有 ${authorEntry.count} 篇`,
        signals,
      });
    }

    return results;
  }
}
