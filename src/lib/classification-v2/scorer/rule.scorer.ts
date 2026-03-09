/**
 * RuleScorer - 用户自定义规则匹配
 *
 * 检查 URL 域名、标题关键词、标签匹配。
 * instant tier — 纯内存计算，<10ms。
 *
 * 迁移自旧系统 L0RuleMatcher Phase 1。
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
  UserContext,
} from "../types";
import { CLASSIFICATION_CONFIG } from "../config";

export class RuleScorer implements Scorer {
  readonly name = "rule";
  readonly tier = "instant" as const;
  readonly defaultWeight = CLASSIFICATION_CONFIG.scorerWeights.rule;

  /** 没有规则时跳过 */
  shouldRun(_bookmark: BookmarkContext, userCtx: UserContext): boolean {
    return userCtx.rules.length > 0;
  }

  async score(
    bookmark: BookmarkContext,
    _candidates: FolderContext[],
    userCtx: UserContext,
  ): Promise<Map<number, Score>> {
    const results = new Map<number, Score>();

    for (const rule of userCtx.rules) {
      if (!rule.enabled) continue;

      const signals: Signal[] = [];
      let matched = false;

      // 1. URL 域名匹配
      if (rule.urlDomains.length > 0 && bookmark.url) {
        const domain = extractDomain(bookmark.url);
        if (domain) {
          for (const pattern of rule.urlDomains) {
            if (domain.includes(pattern.toLowerCase())) {
              signals.push({
                type: "url_pattern",
                detail: `URL 域名匹配: ${pattern}`,
                strength: 1.0,
              });
              matched = true;
              break;
            }
          }
        }
      }

      // 2. 标题关键词匹配
      if (!matched && rule.titleKeywords.length > 0) {
        for (const keyword of rule.titleKeywords) {
          if (bookmark.normalizedTitle.includes(keyword.toLowerCase())) {
            signals.push({
              type: "keyword",
              detail: `标题关键词匹配: ${keyword}`,
              strength: 0.9,
            });
            matched = true;
            break;
          }
        }
      }

      // 3. 标签匹配
      if (!matched && rule.tags.length > 0) {
        const ruleTags = new Set(rule.tags.map((t) => t.toLowerCase()));
        for (const tag of bookmark.normalizedTags) {
          if (ruleTags.has(tag)) {
            signals.push({
              type: "tag_exact",
              detail: `标签规则匹配: ${tag}`,
              strength: 0.85,
            });
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        // 规则匹配成功：使用规则定义的置信度
        const existing = results.get(rule.folderId);
        const ruleScore = rule.confidence;

        if (!existing || ruleScore > existing.value) {
          results.set(rule.folderId, {
            value: ruleScore,
            confidence: ruleScore,
            reason: `规则「${rule.name ?? rule.folderId}」命中`,
            signals,
          });
        }
      }
    }

    return results;
  }
}

/**
 * 从 URL 提取域名
 */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
