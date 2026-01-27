/**
 * V3.0 自动创建评估器服务
 *
 * 增强自动创建文件夹的条件判断：
 * 1. 检查是否与现有文件夹名称相似（避免重复）
 * 2. 匹配通用分类，使用标准化命名
 * 3. 考虑用户文件夹总数限制
 * 4. 学习用户的文件夹命名习惯
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TypedSupabaseClient } from "@/types/supabase";
import {
  matchCategoriesByKeyword,
  type UniversalCategory,
} from "../../constants/universal-categories";
import { FEATURE_FLAGS } from "../../config/feature-flags";
import { FOLDER_LIMITS } from "@/lib/classification/constants/limits";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 评估结果
 */
export interface AutoCreateEvaluation {
  /** 是否应该自动创建 */
  shouldCreate: boolean;
  /** 是否应该显示建议 */
  shouldSuggest: boolean;
  /** 推荐的文件夹名称（可能经过标准化） */
  recommendedName: string;
  /** 拒绝原因（如果不应创建） */
  rejectReason?: string;
  /** 匹配到的通用分类 */
  matchedCategory?: UniversalCategory;
  /** 相似的现有文件夹（如果有） */
  similarFolder?: { id: number; name: string; similarity: number };
  /** 详细评估信息 */
  details: {
    originalName: string;
    totalFolders: number;
    todayCreated: number;
    nameSimilarity?: number;
    categoryMatch?: string;
  };
}

/**
 * 现有文件夹信息
 */
interface ExistingFolder {
  id: number;
  name: string;
}

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 自动创建评估器
 */
export class AutoCreateEvaluatorService {
  private supabase: TypedSupabaseClient;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 评估是否应该自动创建文件夹
   */
  async evaluate(
    userId: string,
    proposedName: string,
    confidence: number,
    bookmarkTags?: string[],
  ): Promise<AutoCreateEvaluation> {
    // 0. 黑名单过滤：直接拒绝系统性命名
    const BLACKLIST = [
      "内容分类与标签管理",
      "内容分类",
      "标签管理",
      "待整理",
      "未分类",
      "新建文件夹",
      "New Folder",
      "我的收藏",
      "书签",
    ];

    if (
      BLACKLIST.some(
        (badName) =>
          proposedName.includes(badName) || badName.includes(proposedName),
      )
    ) {
      // 如果名字在黑名单中，尝试使用第一个有意义的标签或标题截断作为替代
      let fallbackName = proposedName;
      if (bookmarkTags && bookmarkTags.length > 0) {
        const meaningfulTag = bookmarkTags.find(
          (t) =>
            t.length >= 2 &&
            t.length <= 10 &&
            !BLACKLIST.some((b) => t.includes(b)),
        );
        if (meaningfulTag) {
          fallbackName = meaningfulTag;
        }
      }

      // 如果还没找到合适的，就用通用分类匹配
      if (
        fallbackName === proposedName ||
        BLACKLIST.some((b) => fallbackName.includes(b))
      ) {
        const matches = matchCategoriesByKeyword(fallbackName);
        if (matches.length > 0) {
          fallbackName = matches[0].category.suggestedFolderName;
        } else {
          // 最后的兜底：置信度设为0，强制拒绝
          return this.buildResult({
            shouldCreate: false,
            shouldSuggest: false,
            recommendedName: proposedName,
            rejectReason: `触发命名黑名单且无可用替代: "${proposedName}"`,
            details: {
              originalName: proposedName,
              totalFolders: -1,
              todayCreated: -1,
            },
          });
        }
      }

      // 使用替代名称继续评估（但降低一点置信度，以防万一）
      proposedName = fallbackName;
      confidence = Math.max(0, confidence - 10);
    }

    if (!FEATURE_FLAGS.enableAutoCreateEnhanced) {
      // 如果增强模式未启用，使用简单逻辑
      return this.simpleEvaluation(proposedName, confidence);
    }

    try {
      // 1. 获取用户现有文件夹
      const existingFolders = await this.getUserFolders(userId);

      // 2. 检查文件夹数量限制
      if (existingFolders.length >= FOLDER_LIMITS.MAX_FOLDERS) {
        return this.buildResult({
          shouldCreate: false,
          shouldSuggest: false,
          recommendedName: proposedName,
          rejectReason: `文件夹数量已达上限 (${FOLDER_LIMITS.MAX_FOLDERS})`,
          details: {
            originalName: proposedName,
            totalFolders: existingFolders.length,
            todayCreated: 0,
          },
        });
      }

      // 3. 检查今日创建数量
      const todayCreated = await this.getTodayCreatedCount(userId);
      if (todayCreated >= FOLDER_LIMITS.MAX_AUTO_CREATE_PER_DAY) {
        return this.buildResult({
          shouldCreate: false,
          shouldSuggest: true, // 转为建议
          recommendedName: proposedName,
          rejectReason: `今日已创建 ${todayCreated} 个文件夹`,
          details: {
            originalName: proposedName,
            totalFolders: existingFolders.length,
            todayCreated,
          },
        });
      }

      // 4. 检查名称相似度（避免重复）
      const similarFolder = this.findSimilarFolder(
        proposedName,
        existingFolders,
      );
      if (similarFolder && similarFolder.similarity >= 0.8) {
        return this.buildResult({
          shouldCreate: false,
          shouldSuggest: false,
          recommendedName: proposedName,
          rejectReason: `与现有文件夹「${similarFolder.name}」相似`,
          similarFolder,
          details: {
            originalName: proposedName,
            totalFolders: existingFolders.length,
            todayCreated,
            nameSimilarity: similarFolder.similarity,
          },
        });
      }

      // 5. 尝试匹配通用分类，获取标准化名称
      let recommendedName = proposedName;
      let matchedCategory: UniversalCategory | undefined;

      // 使用书签标签和提议名称进行匹配
      const keywords = [proposedName, ...(bookmarkTags || [])];

      for (const keyword of keywords) {
        const matches = matchCategoriesByKeyword(keyword);
        if (matches.length > 0) {
          const category = matches[0].category;
          matchedCategory = category;
          // 检查用户是否已有此分类的文件夹
          const existingCategoryFolder = existingFolders.find(
            (f) =>
              f.name === category.suggestedFolderName ||
              this.calculateSimilarity(f.name, category.name) >= 0.7,
          );

          if (existingCategoryFolder) {
            // 已有此分类文件夹，不需要创建
            return this.buildResult({
              shouldCreate: false,
              shouldSuggest: false,
              recommendedName: existingCategoryFolder.name,
              rejectReason: `已有「${existingCategoryFolder.name}」文件夹`,
              matchedCategory: category,
              similarFolder: {
                id: existingCategoryFolder.id,
                name: existingCategoryFolder.name,
                similarity: 1,
              },
              details: {
                originalName: proposedName,
                totalFolders: existingFolders.length,
                todayCreated,
                categoryMatch: category.id,
              },
            });
          }

          // 使用通用分类的建议名称
          recommendedName = category.suggestedFolderName;
          break;
        }
      }

      // 6. 根据置信度决定操作
      const highThreshold = FEATURE_FLAGS.highConfidenceThreshold;
      const mediumThreshold = FEATURE_FLAGS.mediumConfidenceThreshold;

      if (confidence >= highThreshold) {
        return this.buildResult({
          shouldCreate: true,
          shouldSuggest: false,
          recommendedName,
          matchedCategory,
          details: {
            originalName: proposedName,
            totalFolders: existingFolders.length,
            todayCreated,
            categoryMatch: matchedCategory?.id,
          },
        });
      }

      if (confidence >= mediumThreshold) {
        return this.buildResult({
          shouldCreate: false,
          shouldSuggest: true,
          recommendedName,
          matchedCategory,
          details: {
            originalName: proposedName,
            totalFolders: existingFolders.length,
            todayCreated,
            categoryMatch: matchedCategory?.id,
          },
        });
      }

      // 低置信度，不创建也不建议
      return this.buildResult({
        shouldCreate: false,
        shouldSuggest: false,
        recommendedName,
        rejectReason: `置信度 ${confidence}% 低于阈值`,
        matchedCategory,
        details: {
          originalName: proposedName,
          totalFolders: existingFolders.length,
          todayCreated,
          categoryMatch: matchedCategory?.id,
        },
      });
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "AutoCreateEvaluator: Evaluation failed",
      );

      // 出错时回退到简单评估
      return this.simpleEvaluation(proposedName, confidence);
    }
  }

  /**
   * 简单评估（未启用增强模式时使用）
   */
  private simpleEvaluation(
    proposedName: string,
    confidence: number,
  ): AutoCreateEvaluation {
    const highThreshold = FEATURE_FLAGS.highConfidenceThreshold;
    const mediumThreshold = FEATURE_FLAGS.mediumConfidenceThreshold;

    return {
      shouldCreate: confidence >= highThreshold,
      shouldSuggest:
        confidence >= mediumThreshold && confidence < highThreshold,
      recommendedName: proposedName,
      details: {
        originalName: proposedName,
        totalFolders: -1, // 未知
        todayCreated: -1, // 未知
      },
    };
  }

  /**
   * 获取用户的文件夹列表
   */
  private async getUserFolders(userId: string): Promise<ExistingFolder[]> {
    const { data, error } = await this.supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_system", false);

    if (error) {
      throw new Error(`获取文件夹列表失败: ${error.message}`);
    }

    return (data || []) as ExistingFolder[];
  }

  /**
   * 获取今日已创建的文件夹数量
   */
  private async getTodayCreatedCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];

    const { count, error } = await this.supabase
      .from("folders")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", `${today}T00:00:00Z`)
      .lt("created_at", `${today}T23:59:59Z`);

    if (error) {
      throw new Error(`获取今日创建数量失败: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * 查找相似的现有文件夹
   */
  private findSimilarFolder(
    proposedName: string,
    existingFolders: ExistingFolder[],
  ): { id: number; name: string; similarity: number } | undefined {
    let bestMatch: { id: number; name: string; similarity: number } | undefined;
    let maxSimilarity = 0;

    for (const folder of existingFolders) {
      const similarity = this.calculateSimilarity(proposedName, folder.name);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestMatch = { id: folder.id, name: folder.name, similarity };
      }
    }

    return bestMatch;
  }

  /**
   * 计算两个字符串的相似度
   * 使用多种算法综合评估，对中文和英文都有较好的效果
   *
   * @returns 0-1 之间的相似度分数
   */
  private calculateSimilarity(a: string, b: string): number {
    const strA = a.toLowerCase().trim();
    const strB = b.toLowerCase().trim();

    if (strA === strB) return 1;
    if (!strA || !strB) return 0;

    // 1. 字符级 Jaccard 相似度
    const charJaccard = this.jaccardSimilarity(
      new Set(strA.split("")),
      new Set(strB.split("")),
    );

    // 2. 双字符组（2-gram）相似度，对中文效果更好
    const bigramA = this.getNGrams(strA, 2);
    const bigramB = this.getNGrams(strB, 2);
    const bigramJaccard = this.jaccardSimilarity(bigramA, bigramB);

    // 3. 归一化编辑距离相似度
    const editDistSim = this.normalizedLevenshteinSimilarity(strA, strB);

    // 4. 前缀/包含关系加成
    let prefixBonus = 0;
    if (strA.startsWith(strB) || strB.startsWith(strA)) {
      prefixBonus = 0.15;
    } else if (strA.includes(strB) || strB.includes(strA)) {
      prefixBonus = 0.1;
    }

    // 综合评分：2-gram 权重最高（对中文友好），编辑距离次之
    const combinedScore =
      bigramJaccard * 0.4 + editDistSim * 0.35 + charJaccard * 0.25;

    return Math.min(1, combinedScore + prefixBonus);
  }

  /**
   * Jaccard 相似度计算
   */
  private jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }

  /**
   * 获取 n-gram 集合
   */
  private getNGrams(str: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    for (let i = 0; i <= str.length - n; i++) {
      ngrams.add(str.slice(i, i + n));
    }
    return ngrams;
  }

  /**
   * 归一化 Levenshtein 相似度
   * 使用优化的空间复杂度 O(min(m,n))
   */
  private normalizedLevenshteinSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;

    const distance = this.levenshteinDistance(a, b);
    return 1 - distance / maxLen;
  }

  /**
   * Levenshtein 编辑距离（空间优化版）
   */
  private levenshteinDistance(a: string, b: string): number {
    // 确保 a 是较短的字符串以优化空间
    if (a.length > b.length) {
      [a, b] = [b, a];
    }

    const m = a.length;
    const n = b.length;

    // 只需要两行空间
    let prevRow = Array.from({ length: m + 1 }, (_, i) => i);
    let currRow = new Array(m + 1);

    for (let j = 1; j <= n; j++) {
      currRow[0] = j;
      for (let i = 1; i <= m; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        currRow[i] = Math.min(
          prevRow[i] + 1, // 删除
          currRow[i - 1] + 1, // 插入
          prevRow[i - 1] + cost, // 替换
        );
      }
      [prevRow, currRow] = [currRow, prevRow];
    }

    return prevRow[m];
  }

  /**
   * 构建结果对象
   */
  private buildResult(
    partial: Partial<AutoCreateEvaluation> & {
      shouldCreate: boolean;
      shouldSuggest: boolean;
      recommendedName: string;
      details: AutoCreateEvaluation["details"];
    },
  ): AutoCreateEvaluation {
    return {
      shouldCreate: partial.shouldCreate,
      shouldSuggest: partial.shouldSuggest,
      recommendedName: partial.recommendedName,
      rejectReason: partial.rejectReason,
      matchedCategory: partial.matchedCategory,
      similarFolder: partial.similarFolder,
      details: partial.details,
    };
  }
}

/**
 * 推荐的文件夹名称生成器
 * 基于书签标签和通用分类生成合适的文件夹名
 */
export function generateFolderName(
  bookmarkTags: string[],
  bookmarkTitle: string,
): string {
  // 优先使用匹配的通用分类名称
  for (const tag of bookmarkTags) {
    const matches = matchCategoriesByKeyword(tag);
    if (matches.length > 0) {
      return matches[0].category.suggestedFolderName;
    }
  }

  // 从标题中提取关键词匹配
  const titleWords = bookmarkTitle.split(/\s+/).slice(0, 3);
  for (const word of titleWords) {
    const matches = matchCategoriesByKeyword(word);
    if (matches.length > 0) {
      return matches[0].category.suggestedFolderName;
    }
  }

  // 如果没有匹配，使用第一个有意义的标签
  const meaningfulTag = bookmarkTags.find(
    (tag) => tag.length >= 2 && tag.length <= 10,
  );
  if (meaningfulTag) {
    return meaningfulTag;
  }

  // 最后回退：从标题截取
  return bookmarkTitle.substring(0, 10).trim() || "新文件夹";
}
