/**
 * AiTagScorer - AI 标签匹配评分
 *
 * 5 层策略匹配书签标签与文件夹名称/核心标签：
 * 1. 精确匹配（标准化后完全相同）→ 0.98
 * 2. 别名匹配 → 0.95
 * 3. 部分匹配（子串关系）→ 0.60
 * 4. 核心标签匹配 → 0.87-0.92
 * 5. 相关标签匹配 → 0.85
 *
 * instant tier — 纯内存计算，<10ms。
 *
 * 迁移自旧系统 L0RuleMatcher Phase 0 + AiTagMatcher。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import type {
  Scorer,
  Score,
  Signal,
  BookmarkContext,
  FolderContext,
} from "../types";
import { CLASSIFICATION_CONFIG } from "../config";

const TAG_CONF = CLASSIFICATION_CONFIG.aiTag;

export class AiTagScorer implements Scorer {
  readonly name = "aiTag";
  readonly tier = "instant" as const;
  readonly defaultWeight = CLASSIFICATION_CONFIG.scorerWeights.aiTag;

  /** 没有标签时跳过 */
  shouldRun(bookmark: BookmarkContext): boolean {
    return bookmark.tags.length > 0;
  }

  async score(
    bookmark: BookmarkContext,
    candidates: FolderContext[],
  ): Promise<Map<number, Score>> {
    const results = new Map<number, Score>();

    for (const folder of candidates) {
      const matchResult = matchFolder(bookmark, folder);
      if (matchResult) {
        results.set(folder.id, matchResult);
      }
    }

    return results;
  }
}

/**
 * 尝试匹配书签标签与单个文件夹，返回最佳匹配
 */
function matchFolder(
  bookmark: BookmarkContext,
  folder: FolderContext,
): Score | null {
  // 策略 1: 精确匹配
  const exactMatch = tryExactMatch(bookmark, folder);
  if (exactMatch) return exactMatch;

  // 策略 2: 别名匹配
  const aliasMatch = tryAliasMatch(bookmark, folder);
  if (aliasMatch) return aliasMatch;

  // 策略 3: 部分匹配
  const partialMatch = tryPartialMatch(bookmark, folder);
  if (partialMatch) return partialMatch;

  // 策略 4: 核心标签匹配
  const coreMatch = tryCoreTagMatch(bookmark, folder);
  if (coreMatch) return coreMatch;

  // 策略 5: 相关标签匹配
  const relatedMatch = tryRelatedTagMatch(bookmark, folder);
  if (relatedMatch) return relatedMatch;

  return null;
}

// ---- 策略 1: 精确匹配 ----
function tryExactMatch(
  bookmark: BookmarkContext,
  folder: FolderContext,
): Score | null {
  for (const tag of bookmark.normalizedTags) {
    if (tag === folder.normalizedName) {
      return buildScore(
        TAG_CONF.exactMatch,
        `标签「${tag}」精确匹配文件夹「${folder.name}」`,
        { type: "tag_exact", detail: tag, strength: TAG_CONF.exactMatch },
      );
    }
  }
  return null;
}

// ---- 策略 2: 别名匹配 ----
function tryAliasMatch(
  bookmark: BookmarkContext,
  folder: FolderContext,
): Score | null {
  if (folder.aliases.length === 0) return null;

  const normalizedAliases = folder.aliases.map((a) => a.toLowerCase().trim());

  for (const tag of bookmark.normalizedTags) {
    for (const alias of normalizedAliases) {
      if (tag === alias) {
        return buildScore(TAG_CONF.aliasMatch, `标签「${tag}」匹配文件夹别名`, {
          type: "tag_alias",
          detail: `${tag} → ${alias}`,
          strength: TAG_CONF.aliasMatch,
        });
      }
    }
  }
  return null;
}

// ---- 策略 3: 部分匹配 ----
function tryPartialMatch(
  bookmark: BookmarkContext,
  folder: FolderContext,
): Score | null {
  for (const tag of bookmark.normalizedTags) {
    if (tag.length < TAG_CONF.minTagLength) continue;
    if (folder.normalizedName.length < TAG_CONF.minTagLength) continue;

    const shorter = Math.min(tag.length, folder.normalizedName.length);
    const longer = Math.max(tag.length, folder.normalizedName.length);
    const ratio = shorter / longer;

    if (ratio < TAG_CONF.minLengthRatio) continue;

    if (
      tag.includes(folder.normalizedName) ||
      folder.normalizedName.includes(tag)
    ) {
      return buildScore(
        TAG_CONF.partialMatch,
        `标签「${tag}」部分匹配文件夹「${folder.name}」`,
        {
          type: "tag_partial",
          detail: `${tag} ⊃ ${folder.normalizedName}`,
          strength: TAG_CONF.partialMatch,
        },
      );
    }
  }
  return null;
}

// ---- 策略 4: 核心标签匹配 ----
function tryCoreTagMatch(
  bookmark: BookmarkContext,
  folder: FolderContext,
): Score | null {
  if (folder.coreTags.length === 0) return null;

  const normalizedCoreTags = new Set(
    folder.coreTags.map((t) => t.toLowerCase().trim()),
  );

  const matchedTags: string[] = [];
  for (const tag of bookmark.normalizedTags) {
    if (normalizedCoreTags.has(tag)) {
      matchedTags.push(tag);
    }
  }

  if (matchedTags.length === 0) return null;

  const confidence =
    matchedTags.length >= 2 ? TAG_CONF.coreTagMatch : TAG_CONF.coreTagSingle;

  return buildScore(
    confidence,
    `${matchedTags.length} 个核心标签命中: ${matchedTags.join("、")}`,
    { type: "tag_core", detail: matchedTags.join(", "), strength: confidence },
  );
}

// ---- 策略 5: 相关标签匹配 ----
function tryRelatedTagMatch(
  bookmark: BookmarkContext,
  folder: FolderContext,
): Score | null {
  if (folder.relatedTags.length === 0) return null;

  const normalizedRelated = new Set(
    folder.relatedTags.map((t) => t.toLowerCase().trim()),
  );

  let matchCount = 0;
  for (const tag of bookmark.normalizedTags) {
    if (normalizedRelated.has(tag)) matchCount++;
  }

  if (matchCount < 3) return null;

  return buildScore(TAG_CONF.relatedTagMatch, `${matchCount} 个相关标签命中`, {
    type: "tag_related",
    detail: `${matchCount} related tags`,
    strength: TAG_CONF.relatedTagMatch,
  });
}

// ---- 辅助 ----
function buildScore(value: number, reason: string, signal: Signal): Score {
  return {
    value,
    confidence: value,
    reason,
    signals: [signal],
  };
}
