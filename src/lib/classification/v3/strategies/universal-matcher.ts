/**
 * V3.0 通用分类匹配器
 *
 * 用于冷启动场景：当用户没有足够的历史数据时，
 * 使用 30 个通用分类体系进行兜底匹配。
 *
 * 工作流程：
 * 1. 从书签标题、摘要、标签中提取关键词
 * 2. 与通用分类的同义词进行匹配
 * 3. 匹配到的分类映射到用户现有文件夹
 * 4. 如果没有匹配的文件夹，建议创建新文件夹
 */

import type {
  IMatcher,
  MatcherOptions,
} from "@/lib/classification/strategies/interfaces";
import type { MatchResult, MatcherContext } from "@/lib/classification/types";
import type { FolderProfileRepository } from "@/lib/classification/repositories";
import {
  matchCategoriesByKeyword,
  type UniversalCategory,
} from "../constants/universal-categories";
import { logger } from "@/lib/logger";
import { tokenize } from "@/lib/classification/utils/text-utils";

/**
 * 通用分类匹配器配置
 */
export interface UniversalMatcherConfig {
  /** 最小匹配分数阈值 (0-100) */
  minMatchScore: number;
  /** 最大返回结果数 */
  maxResults: number;
  /** 权重 */
  weight: number;
}

const DEFAULT_CONFIG: UniversalMatcherConfig = {
  minMatchScore: 50,
  maxResults: 3,
  weight: 0.2, // 默认权重 20%
};

/**
 * 通用分类匹配器
 * 实现 IMatcher 接口，可无缝集成到现有分类系统
 */
export class UniversalCategoryMatcher implements IMatcher {
  readonly name = "universal";
  readonly weight: number;

  private config: UniversalMatcherConfig;
  private folderProfileRepo: FolderProfileRepository;

  constructor(
    folderProfileRepo: FolderProfileRepository,
    options?: MatcherOptions,
  ) {
    this.folderProfileRepo = folderProfileRepo;
    this.config = {
      ...DEFAULT_CONFIG,
      weight: options?.weight ?? DEFAULT_CONFIG.weight,
    };
    this.weight = this.config.weight;
  }

  /**
   * 执行匹配
   */
  async match(context: MatcherContext): Promise<MatchResult[]> {
    try {
      // 1. 提取关键词
      const keywords = this.extractKeywords(context);

      if (keywords.length === 0) {
        return [];
      }

      // 2. 匹配通用分类
      const matchedCategories = this.matchCategories(keywords);

      if (matchedCategories.length === 0) {
        return [];
      }

      // 3. 获取用户文件夹
      const userFolders = await this.folderProfileRepo.findByUserId(
        context.userId,
      );

      // 4. 将通用分类映射到用户文件夹
      const results = this.mapToUserFolders(matchedCategories, userFolders);

      logger.debug(
        {
          action: "universal_matcher_result",
          keywords: keywords.slice(0, 5),
          matchedCategories: matchedCategories
            .slice(0, 3)
            .map((m) => m.category.name),
          resultCount: results.length,
        },
        "Universal Matcher: Completed",
      );

      return results.slice(0, this.config.maxResults);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          action: "universal_matcher_error",
        },
        "Universal Matcher: Failed",
      );
      return [];
    }
  }

  /**
   * 检查是否可用
   * 通用分类匹配器始终可用
   */
  async isAvailable(_context: MatcherContext): Promise<boolean> {
    return true;
  }

  /**
   * 从上下文中提取关键词
   */
  private extractKeywords(context: MatcherContext): string[] {
    const keywords = new Set<string>();

    // 从标签中提取
    for (const tag of context.tags) {
      keywords.add(tag.toLowerCase());
    }

    // 从标题中提取（简单分词）
    const titleWords = tokenize(context.title);
    for (const word of titleWords) {
      if (word.length >= 2) {
        keywords.add(word.toLowerCase());
      }
    }

    // 从摘要中提取关键词
    if (context.summary) {
      const summaryWords = tokenize(context.summary);
      for (const word of summaryWords) {
        if (word.length >= 2) {
          keywords.add(word.toLowerCase());
        }
      }
    }

    return Array.from(keywords);
  }

  // tokenize() 已移至 ../../utils/text-utils.ts

  /**
   * 匹配通用分类
   */
  private matchCategories(
    keywords: string[],
  ): Array<{ category: UniversalCategory; score: number }> {
    const categoryScores = new Map<
      string,
      { category: UniversalCategory; score: number; matchCount: number }
    >();

    for (const keyword of keywords) {
      const matches = matchCategoriesByKeyword(keyword);

      for (const match of matches) {
        const existing = categoryScores.get(match.category.id);
        if (existing) {
          // 累加分数，增加匹配计数
          existing.score = Math.min(100, existing.score + match.score * 0.3);
          existing.matchCount += 1;
        } else {
          categoryScores.set(match.category.id, {
            category: match.category,
            score: match.score,
            matchCount: 1,
          });
        }
      }
    }

    // 按分数排序
    return Array.from(categoryScores.values())
      .filter((item) => item.score >= this.config.minMatchScore)
      .sort((a, b) => b.score - a.score)
      .map((item) => ({
        category: item.category,
        score: item.score,
      }));
  }

  /**
   * 将通用分类映射到用户文件夹
   */
  private mapToUserFolders(
    matchedCategories: Array<{ category: UniversalCategory; score: number }>,
    userFolders: Array<{
      folderId: number;
      folderName?: string;
      topTags: string[];
    }>,
  ): MatchResult[] {
    const results: MatchResult[] = [];

    for (const { category, score } of matchedCategories) {
      // 尝试找到匹配的用户文件夹
      const matchedFolder = this.findMatchingFolder(category, userFolders);

      if (matchedFolder) {
        results.push({
          folderId: matchedFolder.folderId,
          folderName: matchedFolder.folderName || category.suggestedFolderName,
          score,
          confidence: score,
          reason: `内容主题与「${category.name}」相关`,
          metadata: {
            universalCategoryId: category.id,
            universalCategoryName: category.name,
            matchType: "existing_folder",
          },
        });
      } else {
        // 没有匹配的文件夹，建议创建
        results.push({
          folderId: -1, // 特殊标记：建议创建新文件夹
          folderName: category.suggestedFolderName,
          score: score * 0.9, // 稍微降低分数
          confidence: score * 0.9,
          reason: `建议创建「${category.suggestedFolderName}」文件夹`,
          metadata: {
            universalCategoryId: category.id,
            universalCategoryName: category.name,
            matchType: "suggest_new",
            suggestedIcon: category.icon,
          },
        });
      }
    }

    return results;
  }

  /**
   * 查找与通用分类匹配的用户文件夹
   */
  private findMatchingFolder(
    category: UniversalCategory,
    userFolders: Array<{
      folderId: number;
      folderName?: string;
      topTags: string[];
    }>,
  ): { folderId: number; folderName?: string } | null {
    const categoryNameLower = category.name.toLowerCase();
    const suggestedNameLower = category.suggestedFolderName.toLowerCase();
    const synonymsLower = category.synonyms.map((s) => s.toLowerCase());

    for (const folder of userFolders) {
      const folderNameLower = (folder.folderName || "").toLowerCase();

      // 检查文件夹名称是否包含分类名称
      if (
        folderNameLower.includes(categoryNameLower) ||
        categoryNameLower.includes(folderNameLower) ||
        folderNameLower.includes(suggestedNameLower) ||
        suggestedNameLower.includes(folderNameLower)
      ) {
        return folder;
      }

      // 检查是否匹配同义词
      if (synonymsLower.some((syn) => folderNameLower.includes(syn))) {
        return folder;
      }

      // 检查文件夹标签是否与分类相关
      const folderTagsLower = folder.topTags.map((t) => t.toLowerCase());
      const hasTagMatch = synonymsLower.some((syn) =>
        folderTagsLower.some((tag) => tag.includes(syn) || syn.includes(tag)),
      );

      if (hasTagMatch) {
        return folder;
      }
    }

    return null;
  }
}
