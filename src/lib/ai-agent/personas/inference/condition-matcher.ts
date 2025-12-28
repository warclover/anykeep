/**
 * 条件匹配器
 *
 * 实现各种条件类型的匹配逻辑
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type {
  InferenceCondition,
  TagMatchCondition,
  PlatformMatchCondition,
  ContentTypeMatchCondition,
  FolderMatchCondition,
  DomainMatchCondition,
  FrequencyCheckCondition,
  TimePatternCondition,
  CompositeCondition,
  UserBehaviorData,
} from "./types";

// =============================================================================
// 匹配结果类型
// =============================================================================

/**
 * 单条件匹配结果
 */
export interface ConditionMatchResult {
  matched: boolean;
  confidence: number; // 匹配置信度（0-1）
  description: string; // 匹配描述
  matchedItems?: string[]; // 匹配到的项目
}

// =============================================================================
// 条件匹配器
// =============================================================================

/**
 * 条件匹配器类
 */
export class ConditionMatcher {
  /**
   * 匹配单个条件
   */
  match(
    condition: InferenceCondition,
    behaviorData: UserBehaviorData,
  ): ConditionMatchResult {
    switch (condition.type) {
      case "tag_match":
        return this.matchTagCondition(condition, behaviorData);
      case "platform_match":
        return this.matchPlatformCondition(condition, behaviorData);
      case "content_type_match":
        return this.matchContentTypeCondition(condition, behaviorData);
      case "folder_match":
        return this.matchFolderCondition(condition, behaviorData);
      case "domain_match":
        return this.matchDomainCondition(condition, behaviorData);
      case "frequency_check":
        return this.matchFrequencyCondition(condition, behaviorData);
      case "time_pattern":
        return this.matchTimePatternCondition(condition, behaviorData);
      case "composite":
        return this.matchCompositeCondition(condition, behaviorData);
      default:
        return {
          matched: false,
          confidence: 0,
          description: `Unknown condition type: ${(condition as { type: string }).type}`,
        };
    }
  }

  /**
   * 匹配标签条件
   */
  private matchTagCondition(
    condition: TagMatchCondition,
    behaviorData: UserBehaviorData,
  ): ConditionMatchResult {
    const { patterns, operator, minMatchCount = 1 } = condition;
    const { tags } = behaviorData;

    const matchedTags: string[] = [];

    for (const tag of tags) {
      for (const pattern of patterns) {
        if (pattern.test(tag)) {
          matchedTags.push(tag);
          break;
        }
      }
    }

    const matched =
      operator === "all"
        ? matchedTags.length >= patterns.length
        : matchedTags.length >= minMatchCount;

    // 计算置信度：匹配数量 / 总模式数量
    const confidence = Math.min(
      1,
      matchedTags.length / Math.max(1, patterns.length),
    );

    return {
      matched,
      confidence: matched ? confidence * (condition.weight ?? 1) : 0,
      description: `Tags matched: ${matchedTags.length}/${patterns.length}`,
      matchedItems: matchedTags,
    };
  }

  /**
   * 匹配平台条件
   */
  private matchPlatformCondition(
    condition: PlatformMatchCondition,
    behaviorData: UserBehaviorData,
  ): ConditionMatchResult {
    const { platforms, operator, minRatio = 0 } = condition;
    const { platformCounts, platforms: userPlatforms } = behaviorData;

    const matchedPlatforms = userPlatforms.filter((p) =>
      platforms.some((target) => target.toLowerCase() === p.toLowerCase()),
    );

    // 计算匹配平台的收藏占比
    const totalCount = Object.values(platformCounts).reduce((a, b) => a + b, 0);
    const matchedCount = matchedPlatforms.reduce(
      (sum, p) => sum + (platformCounts[p] || 0),
      0,
    );
    const ratio = totalCount > 0 ? matchedCount / totalCount : 0;

    let matched = false;
    let description = "";

    switch (operator) {
      case "all":
        matched = matchedPlatforms.length === platforms.length;
        description = `All platforms matched: ${matchedPlatforms.length}/${platforms.length}`;
        break;
      case "any":
        matched = matchedPlatforms.length > 0;
        description = `Any platform matched: ${matchedPlatforms.length}`;
        break;
      case "primary":
        matched = ratio >= minRatio;
        description = `Primary platform ratio: ${(ratio * 100).toFixed(1)}% (min: ${minRatio * 100}%)`;
        break;
    }

    const confidence = matched
      ? Math.max(ratio, matchedPlatforms.length / platforms.length) *
        (condition.weight ?? 1)
      : 0;

    return {
      matched,
      confidence,
      description,
      matchedItems: matchedPlatforms,
    };
  }

  /**
   * 匹配内容类型条件
   */
  private matchContentTypeCondition(
    condition: ContentTypeMatchCondition,
    behaviorData: UserBehaviorData,
  ): ConditionMatchResult {
    const { contentTypes, operator, minMatchCount = 1 } = condition;
    const { contentTypes: userContentTypes } = behaviorData;

    const matchedTypes = userContentTypes.filter((t) =>
      contentTypes.some((target) => target.toLowerCase() === t.toLowerCase()),
    );

    const matched =
      operator === "all"
        ? matchedTypes.length >= contentTypes.length
        : matchedTypes.length >= minMatchCount;

    const confidence = matched
      ? (matchedTypes.length / contentTypes.length) * (condition.weight ?? 1)
      : 0;

    return {
      matched,
      confidence,
      description: `Content types matched: ${matchedTypes.length}/${contentTypes.length}`,
      matchedItems: matchedTypes,
    };
  }

  /**
   * 匹配文件夹条件
   */
  private matchFolderCondition(
    condition: FolderMatchCondition,
    behaviorData: UserBehaviorData,
  ): ConditionMatchResult {
    const { patterns, operator } = condition;
    const { folders } = behaviorData;

    const matchedFolders: string[] = [];

    for (const folder of folders) {
      for (const pattern of patterns) {
        if (pattern.test(folder)) {
          matchedFolders.push(folder);
          break;
        }
      }
    }

    const matched =
      operator === "all"
        ? matchedFolders.length >= patterns.length
        : matchedFolders.length > 0;

    const confidence = matched
      ? (matchedFolders.length / Math.max(1, patterns.length)) *
        (condition.weight ?? 1)
      : 0;

    return {
      matched,
      confidence,
      description: `Folders matched: ${matchedFolders.length}/${patterns.length}`,
      matchedItems: matchedFolders,
    };
  }

  /**
   * 匹配域名条件
   */
  private matchDomainCondition(
    condition: DomainMatchCondition,
    behaviorData: UserBehaviorData,
  ): ConditionMatchResult {
    const { patterns, operator, minMatchCount = 1 } = condition;
    const { domains, domainCounts } = behaviorData;

    const matchedDomains: string[] = [];

    for (const domain of domains) {
      for (const pattern of patterns) {
        if (pattern.test(domain)) {
          matchedDomains.push(domain);
          break;
        }
      }
    }

    const matched =
      operator === "all"
        ? matchedDomains.length >= patterns.length
        : matchedDomains.length >= minMatchCount;

    // 计算匹配域名的权重（考虑使用频次）
    const totalCount = Object.values(domainCounts).reduce((a, b) => a + b, 0);
    const matchedCount = matchedDomains.reduce(
      (sum, d) => sum + (domainCounts[d] || 0),
      0,
    );
    const weightedRatio = totalCount > 0 ? matchedCount / totalCount : 0;

    const confidence = matched
      ? Math.max(matchedDomains.length / patterns.length, weightedRatio) *
        (condition.weight ?? 1)
      : 0;

    return {
      matched,
      confidence,
      description: `Domains matched: ${matchedDomains.length}/${patterns.length}`,
      matchedItems: matchedDomains,
    };
  }

  /**
   * 匹配频次条件
   */
  private matchFrequencyCondition(
    condition: FrequencyCheckCondition,
    behaviorData: UserBehaviorData,
  ): ConditionMatchResult {
    const { metric, operator, value, compareValue } = condition;
    const { activityMetrics } = behaviorData;

    let actualValue: number;

    switch (metric) {
      case "daily":
        actualValue = activityMetrics.avgDailyCount;
        break;
      case "weekly":
        actualValue = activityMetrics.recentWeekCount;
        break;
      case "monthly":
        actualValue = activityMetrics.recentMonthCount;
        break;
      case "total":
        actualValue = activityMetrics.totalBookmarks;
        break;
    }

    let matched = false;

    switch (operator) {
      case "equals":
        matched = actualValue === value;
        break;
      case "greater_than":
        matched = actualValue > value;
        break;
      case "less_than":
        matched = actualValue < value;
        break;
      case "between":
        matched =
          actualValue >= value && actualValue <= (compareValue ?? value);
        break;
      default:
        matched = false;
    }

    // 计算置信度：基于实际值与目标值的比例
    let confidence = 0;
    if (matched) {
      if (operator === "greater_than") {
        confidence = Math.min(1, actualValue / (value * 2));
      } else if (operator === "less_than") {
        confidence = Math.min(1, value / Math.max(1, actualValue));
      } else {
        confidence = 1;
      }
      confidence *= condition.weight ?? 1;
    }

    return {
      matched,
      confidence,
      description: `Frequency ${metric}: ${actualValue} ${operator} ${value}`,
    };
  }

  /**
   * 匹配时间模式条件
   */
  private matchTimePatternCondition(
    condition: TimePatternCondition,
    behaviorData: UserBehaviorData,
  ): ConditionMatchResult {
    const { pattern, minRatio = 0.3 } = condition;
    const { timePatterns } = behaviorData;

    let ratio = 0;
    const totalHours = timePatterns.hourDistribution.reduce((a, b) => a + b, 0);
    const totalDays = timePatterns.weekdayDistribution.reduce(
      (a, b) => a + b,
      0,
    );

    switch (pattern) {
      case "morning": // 6-12
        ratio =
          totalHours > 0
            ? timePatterns.hourDistribution
                .slice(6, 12)
                .reduce((a, b) => a + b, 0) / totalHours
            : 0;
        break;
      case "afternoon": // 12-18
        ratio =
          totalHours > 0
            ? timePatterns.hourDistribution
                .slice(12, 18)
                .reduce((a, b) => a + b, 0) / totalHours
            : 0;
        break;
      case "evening": // 18-22
        ratio =
          totalHours > 0
            ? timePatterns.hourDistribution
                .slice(18, 22)
                .reduce((a, b) => a + b, 0) / totalHours
            : 0;
        break;
      case "night": // 22-6
        ratio =
          totalHours > 0
            ? (timePatterns.hourDistribution
                .slice(22, 24)
                .reduce((a, b) => a + b, 0) +
                timePatterns.hourDistribution
                  .slice(0, 6)
                  .reduce((a, b) => a + b, 0)) /
              totalHours
            : 0;
        break;
      case "weekday": // 周一至周五 (0-4)
        ratio =
          totalDays > 0
            ? timePatterns.weekdayDistribution
                .slice(0, 5)
                .reduce((a, b) => a + b, 0) / totalDays
            : 0;
        break;
      case "weekend": // 周六周日 (5-6)
        ratio =
          totalDays > 0
            ? timePatterns.weekdayDistribution
                .slice(5, 7)
                .reduce((a, b) => a + b, 0) / totalDays
            : 0;
        break;
    }

    const matched = ratio >= minRatio;
    const confidence = matched
      ? (ratio / minRatio) * (condition.weight ?? 1)
      : 0;

    return {
      matched,
      confidence: Math.min(1, confidence),
      description: `Time pattern ${pattern}: ${(ratio * 100).toFixed(1)}% (min: ${minRatio * 100}%)`,
    };
  }

  /**
   * 匹配组合条件
   */
  private matchCompositeCondition(
    condition: CompositeCondition,
    behaviorData: UserBehaviorData,
  ): ConditionMatchResult {
    const { logic, conditions } = condition;

    const results = conditions.map((c) => this.match(c, behaviorData));
    const matchedCount = results.filter((r) => r.matched).length;

    let matched = false;
    let confidence = 0;

    switch (logic) {
      case "and":
        matched = matchedCount === conditions.length;
        confidence = matched
          ? results.reduce((sum, r) => sum + r.confidence, 0) /
            conditions.length
          : 0;
        break;
      case "or":
        matched = matchedCount > 0;
        confidence = matched
          ? Math.max(...results.map((r) => r.confidence))
          : 0;
        break;
      case "not":
        matched = matchedCount === 0;
        confidence = matched ? 1 : 0;
        break;
    }

    confidence *= condition.weight ?? 1;

    return {
      matched,
      confidence,
      description: `Composite (${logic}): ${matchedCount}/${conditions.length} matched`,
      matchedItems: results
        .filter((r) => r.matched)
        .flatMap((r) => r.matchedItems || []),
    };
  }
}

/**
 * 默认条件匹配器实例
 */
export const conditionMatcher = new ConditionMatcher();
