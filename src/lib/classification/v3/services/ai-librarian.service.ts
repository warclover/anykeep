/**
 * V3.0 整理大师 (AI Librarian) 服务
 *
 * 核心功能：
 * 1. 重复文件夹检测 - 识别高度相似的文件夹，建议合并
 * 2. 空文件夹检测 - 识别无内容的文件夹
 * 3. 过大文件夹检测 - 识别内容过多的文件夹，建议拆分
 * 4. 命名规范检查 - 识别命名不规范的文件夹
 * 5. 缺失分类建议 - 根据待整理内容推断缺失的分类
 * 6. 健康评分 - 综合评估文件夹结构质量
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 文件夹基础信息
 */
interface Folder {
  id: number;
  name: string;
  bookmarkCount?: number;
}

/**
 * 重复文件夹检测结果
 */
interface DuplicateFolderGroup {
  folders: Folder[];
  similarity: number;
  suggestedMerge: string;
}

/**
 * 过大文件夹检测结果
 */
interface OversizedFolder {
  folder: Folder;
  bookmarkCount: number;
  suggestedSplits: string[];
}

/**
 * 命名问题文件夹
 */
interface PoorlyNamedFolder {
  folder: Folder;
  issue: "too_short" | "too_vague" | "contains_special" | "duplicate_style";
  suggestedName: string;
}

/**
 * 缺失分类建议
 */
interface MissingCategory {
  category: string;
  bookmarkCount: number;
  reason: string;
  sampleTitles: string[];
}

/**
 * 整理分析结果
 */
export interface LibrarianAnalysis {
  /** 重复文件夹 */
  duplicateFolders: DuplicateFolderGroup[];

  /** 空文件夹 */
  emptyFolders: Folder[];

  /** 过大文件夹（建议拆分） */
  oversizedFolders: OversizedFolder[];

  /** 命名不规范文件夹 */
  poorlyNamedFolders: PoorlyNamedFolder[];

  /** 缺失的关键分类 */
  missingCategories: MissingCategory[];

  /** 整体健康评分 (0-100) */
  healthScore: number;

  /** 分析时间 */
  analyzedAt: Date;

  /** 建议数量 */
  totalSuggestions: number;
}

/**
 * 整理大师配置
 */
interface LibrarianConfig {
  /** 重复检测相似度阈值 */
  duplicateSimilarityThreshold: number;

  /** 过大文件夹阈值 */
  oversizedThreshold: number;

  /** 最小文件夹名长度 */
  minFolderNameLength: number;

  /** 待整理中同类内容阈值（达到后建议创建） */
  missingCategoryThreshold: number;
}

const DEFAULT_CONFIG: LibrarianConfig = {
  duplicateSimilarityThreshold: 0.7,
  oversizedThreshold: 50,
  minFolderNameLength: 2,
  missingCategoryThreshold: 3,
};

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 整理大师服务
 */
export class AILibrarianService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any>;
  private config: LibrarianConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<LibrarianConfig>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.supabase = supabase as SupabaseClient<any>;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行全库分析
   */
  async analyze(userId: string): Promise<LibrarianAnalysis> {
    logger.info({ userId }, "AILibrarianService: Starting analysis");

    try {
      // 1. 获取用户的所有文件夹及统计
      const folders = await this.getUserFolders(userId);

      // 2. 获取待整理中的书签
      const inboxBookmarks = await this.getInboxBookmarks(userId);

      // 3. 并行执行各项分析
      const [duplicates, empty, oversized, poorlyNamed, missing] =
        await Promise.all([
          this.detectDuplicateFolders(folders),
          this.detectEmptyFolders(folders),
          this.detectOversizedFolders(folders),
          this.detectPoorlyNamedFolders(folders),
          this.detectMissingCategories(inboxBookmarks, folders),
        ]);

      // 4. 计算健康评分
      const healthScore = this.calculateHealthScore({
        duplicates,
        empty,
        oversized,
        poorlyNamed,
        missing,
        totalFolders: folders.length,
      });

      const totalSuggestions =
        duplicates.length +
        empty.length +
        oversized.length +
        poorlyNamed.length +
        missing.length;

      const analysis: LibrarianAnalysis = {
        duplicateFolders: duplicates,
        emptyFolders: empty,
        oversizedFolders: oversized,
        poorlyNamedFolders: poorlyNamed,
        missingCategories: missing,
        healthScore,
        analyzedAt: new Date(),
        totalSuggestions,
      };

      // 5. 保存分析历史
      await this.saveAnalysisHistory(userId, analysis);

      logger.info(
        {
          userId,
          healthScore,
          totalSuggestions,
          duplicateCount: duplicates.length,
          emptyCount: empty.length,
          oversizedCount: oversized.length,
          poorlyNamedCount: poorlyNamed.length,
          missingCount: missing.length,
        },
        "AILibrarianService: Analysis completed",
      );

      return analysis;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
        },
        "AILibrarianService: Analysis failed",
      );
      throw error;
    }
  }

  /**
   * 获取用户的所有文件夹（含书签数量）
   * 优化：使用 Promise.all 并行查询书签数量，避免 N+1 问题
   */
  private async getUserFolders(userId: string): Promise<Folder[]> {
    const { data, error } = await this.supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .eq("is_system", false)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to fetch folders: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 并行获取所有文件夹的书签数量
    const countPromises = data.map((folder) =>
      this.supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", folder.id)
        .is("deleted_at", null)
        .then(({ count }) => ({
          id: folder.id,
          name: folder.name,
          bookmarkCount: count || 0,
        })),
    );

    return Promise.all(countPromises);
  }

  /**
   * 获取待整理中的书签
   * 注意：universal_category_id 字段已弃用，改用 ai_tags 进行分类推断
   */
  private async getInboxBookmarks(userId: string): Promise<
    Array<{
      id: number;
      title: string;
      ai_tags: string[];
    }>
  > {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id, title, ai_tags")
      .eq("user_id", userId)
      .is("folder_id", null)
      .is("deleted_at", null)
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch inbox bookmarks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 检测重复/高度相似的文件夹
   */
  private async detectDuplicateFolders(
    folders: Folder[],
  ): Promise<DuplicateFolderGroup[]> {
    const duplicates: DuplicateFolderGroup[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < folders.length; i++) {
      if (processed.has(folders[i].id)) continue;

      const similar: Folder[] = [folders[i]];

      for (let j = i + 1; j < folders.length; j++) {
        if (processed.has(folders[j].id)) continue;

        // 计算名称相似度
        const similarity = this.calculateStringSimilarity(
          folders[i].name.toLowerCase(),
          folders[j].name.toLowerCase(),
        );

        if (similarity >= this.config.duplicateSimilarityThreshold) {
          similar.push(folders[j]);
          processed.add(folders[j].id);
        }
      }

      if (similar.length > 1) {
        processed.add(folders[i].id);
        duplicates.push({
          folders: similar,
          similarity: this.config.duplicateSimilarityThreshold,
          suggestedMerge: this.suggestMergedName(similar),
        });
      }
    }

    return duplicates;
  }

  /**
   * 检测空文件夹
   */
  private async detectEmptyFolders(folders: Folder[]): Promise<Folder[]> {
    return folders.filter((f) => (f.bookmarkCount || 0) === 0);
  }

  /**
   * 检测过大的文件夹
   */
  private async detectOversizedFolders(
    folders: Folder[],
  ): Promise<OversizedFolder[]> {
    const oversized: OversizedFolder[] = [];

    for (const folder of folders) {
      if ((folder.bookmarkCount || 0) > this.config.oversizedThreshold) {
        oversized.push({
          folder,
          bookmarkCount: folder.bookmarkCount || 0,
          suggestedSplits: this.suggestSplits(folder.name),
        });
      }
    }

    return oversized;
  }

  /**
   * 检测命名不规范的文件夹
   */
  private async detectPoorlyNamedFolders(
    folders: Folder[],
  ): Promise<PoorlyNamedFolder[]> {
    const issues: PoorlyNamedFolder[] = [];

    for (const folder of folders) {
      const name = folder.name.trim();

      // 名称太短
      if (name.length < this.config.minFolderNameLength) {
        issues.push({
          folder,
          issue: "too_short",
          suggestedName: this.suggestBetterName(name, "too_short"),
        });
        continue;
      }

      // 名称太模糊
      const vaguePatterns = [
        /^其他/,
        /^杂项/,
        /^临时/,
        /^新建/,
        /^未命名/,
        /^folder/i,
        /^new/i,
        /^temp/i,
        /^misc/i,
      ];
      if (vaguePatterns.some((p) => p.test(name))) {
        issues.push({
          folder,
          issue: "too_vague",
          suggestedName: this.suggestBetterName(name, "too_vague"),
        });
        continue;
      }

      // 包含特殊字符
      if (/[<>:"/\\|?*]/.test(name)) {
        issues.push({
          folder,
          issue: "contains_special",
          suggestedName: name.replace(/[<>:"/\\|?*]/g, ""),
        });
      }
    }

    return issues;
  }

  /**
   * 检测缺失的分类
   * 使用 ai_tags 聚合分析，推断可能缺失的分类
   */
  private async detectMissingCategories(
    inboxBookmarks: Array<{
      id: number;
      title: string;
      ai_tags: string[];
    }>,
    folders: Folder[],
  ): Promise<MissingCategory[]> {
    if (inboxBookmarks.length === 0) {
      return [];
    }

    // 按 ai_tags 聚合统计
    const tagGroups = new Map<string, { count: number; titles: string[] }>();

    for (const bookmark of inboxBookmarks) {
      const tags = bookmark.ai_tags || [];
      for (const tag of tags) {
        const normalizedTag = tag.toLowerCase().trim();
        if (!normalizedTag) continue;

        const existing = tagGroups.get(normalizedTag);
        if (existing) {
          existing.count++;
          if (existing.titles.length < 3) {
            existing.titles.push(bookmark.title);
          }
        } else {
          tagGroups.set(normalizedTag, {
            count: 1,
            titles: [bookmark.title],
          });
        }
      }
    }

    // 筛选超过阈值的标签作为潜在分类
    const missing: MissingCategory[] = [];
    const existingFolderNames = new Set(
      folders.map((f) => f.name.toLowerCase()),
    );

    for (const [tag, data] of tagGroups) {
      if (data.count >= this.config.missingCategoryThreshold) {
        // 尝试从标签获取更好的显示名称
        const categoryName = this.getCategoryDisplayName(tag) || tag;

        // 检查是否已有类似文件夹
        if (!existingFolderNames.has(categoryName.toLowerCase())) {
          missing.push({
            category: categoryName,
            bookmarkCount: data.count,
            reason: `待整理中有 ${data.count} 条「${categoryName}」相关内容`,
            sampleTitles: data.titles,
          });
        }
      }
    }

    return missing
      .sort((a, b) => b.bookmarkCount - a.bookmarkCount)
      .slice(0, 5);
  }

  /**
   * 计算健康评分
   */
  private calculateHealthScore(params: {
    duplicates: DuplicateFolderGroup[];
    empty: Folder[];
    oversized: OversizedFolder[];
    poorlyNamed: PoorlyNamedFolder[];
    missing: MissingCategory[];
    totalFolders: number;
  }): number {
    const { duplicates, empty, oversized, poorlyNamed, missing, totalFolders } =
      params;

    if (totalFolders === 0) {
      return 100; // 没有文件夹视为健康
    }

    let score = 100;

    // 重复文件夹扣分（每组 -10）
    score -= duplicates.length * 10;

    // 空文件夹扣分（每个 -5）
    score -= empty.length * 5;

    // 过大文件夹扣分（每个 -8）
    score -= oversized.length * 8;

    // 命名问题扣分（每个 -3）
    score -= poorlyNamed.length * 3;

    // 缺失分类扣分（每个 -5）
    score -= missing.length * 5;

    // 确保在 0-100 范围内
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * 保存分析历史
   */
  private async saveAnalysisHistory(
    userId: string,
    analysis: LibrarianAnalysis,
  ): Promise<void> {
    try {
      await this.supabase.from("librarian_analysis_history").insert({
        user_id: userId,
        health_score: analysis.healthScore,
        duplicate_count: analysis.duplicateFolders.length,
        empty_count: analysis.emptyFolders.length,
        missing_count: analysis.missingCategories.length,
        analysis_data: {
          duplicateFolders: analysis.duplicateFolders,
          emptyFolders: analysis.emptyFolders,
          oversizedFolders: analysis.oversizedFolders,
          poorlyNamedFolders: analysis.poorlyNamedFolders,
          missingCategories: analysis.missingCategories,
        },
      });
    } catch (error) {
      // 保存历史失败不应阻断主流程
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to save librarian analysis history",
      );
    }
  }

  /**
   * 计算字符串相似度（Levenshtein 距离）
   */
  private calculateStringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // 包含关系检测
    if (a.includes(b) || b.includes(a)) {
      return 0.85;
    }

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return 1 - distance / maxLength;
  }

  /**
   * 建议合并后的名称
   */
  private suggestMergedName(folders: Folder[]): string {
    // 选择最长的名称作为合并后的名称
    return folders.reduce((longest, current) =>
      current.name.length > longest.name.length ? current : longest,
    ).name;
  }

  /**
   * 建议拆分方式
   */
  private suggestSplits(folderName: string): string[] {
    // 根据文件夹名称建议拆分
    const commonSplits: Record<string, string[]> = {
      技术: ["前端开发", "后端开发", "移动开发"],
      学习: ["在线课程", "书籍笔记", "教程资源"],
      工作: ["项目资料", "工具推荐", "效率技巧"],
      生活: ["美食推荐", "旅行攻略", "生活技巧"],
    };

    for (const [keyword, splits] of Object.entries(commonSplits)) {
      if (folderName.includes(keyword)) {
        return splits;
      }
    }

    return [
      `${folderName} - 重要`,
      `${folderName} - 一般`,
      `${folderName} - 存档`,
    ];
  }

  /**
   * 建议更好的名称
   */
  private suggestBetterName(
    name: string,
    issue: "too_short" | "too_vague",
  ): string {
    if (issue === "too_short") {
      return `${name}收藏`;
    }

    const replacements: Record<string, string> = {
      其他: "综合收藏",
      杂项: "综合资料",
      临时: "待整理",
      新建: "新收藏",
      未命名: "待命名收藏",
    };

    for (const [pattern, replacement] of Object.entries(replacements)) {
      if (name.includes(pattern)) {
        return replacement;
      }
    }

    return `${name} - 待整理`;
  }

  /**
   * 获取分类显示名称
   */
  private getCategoryDisplayName(categoryId: string): string {
    const categoryNames: Record<string, string> = {
      "tech/frontend": "前端开发",
      "tech/backend": "后端开发",
      "tech/mobile": "移动开发",
      "tech/ai": "AI/机器学习",
      "tech/data": "数据工程",
      "tech/devops": "运维/云原生",
      "tech/security": "信息安全",
      "design/ui": "UI/UX 设计",
      "design/creative": "创意设计",
      "business/startup": "创业创新",
      "business/invest": "投资理财",
      "business/marketing": "营销增长",
      "business/management": "企业管理",
      "career/growth": "职业成长",
      "career/skills": "软技能",
      "career/freelance": "自由职业",
      "tools/productivity": "效率方法",
      "tools/dev": "开发工具",
      "tools/ai-tools": "AI工具",
    };

    return (
      categoryNames[categoryId] || categoryId.split("/").pop() || categoryId
    );
  }

  /**
   * 获取最近的分析历史
   */
  async getRecentAnalysis(userId: string): Promise<LibrarianAnalysis | null> {
    const { data, error } = await this.supabase
      .from("librarian_analysis_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    const analysisData = data.analysis_data as Record<string, unknown>;

    return {
      duplicateFolders:
        (analysisData.duplicateFolders as DuplicateFolderGroup[]) || [],
      emptyFolders: (analysisData.emptyFolders as Folder[]) || [],
      oversizedFolders:
        (analysisData.oversizedFolders as OversizedFolder[]) || [],
      poorlyNamedFolders:
        (analysisData.poorlyNamedFolders as PoorlyNamedFolder[]) || [],
      missingCategories:
        (analysisData.missingCategories as MissingCategory[]) || [],
      healthScore: data.health_score,
      analyzedAt: new Date(data.created_at),
      totalSuggestions:
        data.duplicate_count + data.empty_count + data.missing_count,
    };
  }
}

/**
 * 创建整理大师服务
 */
export function createAILibrarianService(
  supabase: SupabaseClient<Database>,
  config?: Partial<LibrarianConfig>,
): AILibrarianService {
  return new AILibrarianService(supabase, config);
}
