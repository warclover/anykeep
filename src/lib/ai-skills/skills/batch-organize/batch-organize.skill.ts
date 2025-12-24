/**
 * BatchOrganizeSkill - 批量整理编排 Skill
 *
 * 功能：
 * - 智能分类：根据内容推荐文件夹
 * - 智能打标：根据内容推荐标签
 * - 清理重复：查找并合并重复书签
 * - 归档旧内容：归档长期未访问的书签
 * - 验证链接：检查书签链接有效性
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { SkillExecutionError } from "../../core/base-skill";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  BATCH_ORGANIZE_CONFIG,
  SKILL_ERROR_CODES,
  URL_VALIDATION_CONFIG,
} from "../../config";
import type {
  BatchOrganizeInput,
  BatchOrganizeOutput,
  OrganizeAction,
  OrganizeStats,
  CategorizeSuggestion,
  TagSuggestion,
  DuplicateGroup,
  ArchiveCandidate,
  UrlValidationResult,
} from "./types";
import { ORGANIZE_ACTION_CONFIG, DEFAULT_ORGANIZE_CONFIG } from "./types";

// ============================================
// Schema 定义
// ============================================

const BatchOrganizeInputSchema = z.object({
  actions: z
    .array(
      z.enum([
        "auto-categorize",
        "auto-tag",
        "clean-duplicates",
        "archive-old",
        "validate-urls",
      ]),
    )
    .min(1)
    .describe("整理操作"),
  scope: z
    .enum(["all", "uncategorized", "untagged", "selected"])
    .default("uncategorized")
    .describe("整理范围"),
  requireConfirmation: z.boolean().default(true).describe("是否需要确认"),
  autoExecute: z.boolean().default(false).describe("自动执行"),
  filter: z
    .object({
      folderId: z.number().optional(),
      platforms: z.array(z.string()).optional(),
      bookmarkIds: z
        .array(z.number())
        .max(BATCH_ORGANIZE_CONFIG.MAX_BOOKMARK_IDS)
        .optional(),
      olderThanDays: z.number().optional(),
    })
    .optional()
    .describe("筛选条件"),
});

// 统计数据 Schema
const OrganizeStatsSchema = z.object({
  totalProcessed: z.number(),
  categorizeSuggestions: z.number(),
  tagSuggestions: z.number(),
  duplicatesFound: z.number(),
  archiveCandidates: z.number(),
  invalidUrls: z.number(),
  actionsExecuted: z.number(),
});

// 分类建议 Schema
const CategorizeSuggestionSchema = z.object({
  bookmarkId: z.number(),
  bookmarkTitle: z.string(),
  currentFolder: z.string().nullable(),
  suggestedFolder: z.string(),
  suggestedFolderId: z.number().optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

// 标签建议 Schema
const TagSuggestionSchema = z.object({
  bookmarkId: z.number(),
  bookmarkTitle: z.string(),
  currentTags: z.array(z.string()),
  suggestedTags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

// 重复书签组 Schema
const DuplicateGroupSchema = z.object({
  normalizedUrl: z.string(),
  bookmarks: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      createdAt: z.string(),
      folderId: z.number().nullable(),
    }),
  ),
  keepBookmarkId: z.number(),
});

// 归档候选 Schema
const ArchiveCandidateSchema = z.object({
  bookmarkId: z.number(),
  bookmarkTitle: z.string(),
  daysSinceCreated: z.number(),
  neverAccessed: z.boolean(),
  reason: z.string(),
});

// URL 验证结果 Schema
const UrlValidationResultSchema = z.object({
  bookmarkId: z.number(),
  bookmarkTitle: z.string(),
  url: z.string(),
  isValid: z.boolean(),
  statusCode: z.number().optional(),
  error: z.string().optional(),
});

const BatchOrganizeOutputSchema = z.object({
  stats: OrganizeStatsSchema,
  categorizeSuggestions: z.array(CategorizeSuggestionSchema),
  tagSuggestions: z.array(TagSuggestionSchema),
  duplicateGroups: z.array(DuplicateGroupSchema),
  archiveCandidates: z.array(ArchiveCandidateSchema),
  urlValidations: z.array(UrlValidationResultSchema),
  summary: z.string(),
  suggestions: z.array(z.string()),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

const ORGANIZE_STEPS = [
  { id: "collect", name: "收集数据", description: "收集书签数据", weight: 15 },
  { id: "analyze", name: "分析内容", description: "分析书签内容", weight: 25 },
  {
    id: "categorize",
    name: "智能分类",
    description: "生成分类建议",
    weight: 20,
  },
  { id: "tag", name: "智能打标", description: "生成标签建议", weight: 20 },
  { id: "clean", name: "整理清理", description: "查找重复和归档", weight: 15 },
  { id: "report", name: "生成报告", description: "生成整理报告", weight: 5 },
];

// ============================================
// BatchOrganizeSkill 实现
// ============================================

export class BatchOrganizeSkill extends OrchestrationSkill<
  BatchOrganizeInput,
  BatchOrganizeOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "batch_organize",
    name: "智能整理助手",
    description:
      "智能整理您的收藏书签，包括自动分类、智能打标、清理重复、归档旧内容等功能，让您的知识库保持整洁有序。",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "auto-categorize",
      "auto-tag",
      "duplicate-detection",
      "archive-management",
      "url-validation",
    ],
    requiresConfirmation: true,
    estimatedDurationMs: 30000,
    maxExecutionTimeMs: 120000,
    deliverableTypes: ["report", "list"],
    outputFormats: ["markdown", "json"],
    steps: ORGANIZE_STEPS,
  };

  readonly inputSchema = BatchOrganizeInputSchema;
  readonly outputSchema = BatchOrganizeOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<BatchOrganizeInput> {
    const actions: OrganizeAction[] = [];

    // 解析操作类型
    if (/整理|分类|归类/.test(message)) {
      actions.push("auto-categorize");
    }
    if (/打标|标签|加标签/.test(message)) {
      actions.push("auto-tag");
    }
    if (/重复|去重|清理重复/.test(message)) {
      actions.push("clean-duplicates");
    }
    if (/归档|旧.*内容|清理.*旧/.test(message)) {
      actions.push("archive-old");
    }
    if (/验证|检查.*链接|失效/.test(message)) {
      actions.push("validate-urls");
    }

    // 默认操作
    if (actions.length === 0) {
      actions.push("auto-categorize", "auto-tag");
    }

    // 解析范围
    let scope: BatchOrganizeInput["scope"] = "uncategorized";
    if (/全部|所有/.test(message)) {
      scope = "all";
    } else if (/未分类/.test(message)) {
      scope = "uncategorized";
    } else if (/未打标|没.*标签/.test(message)) {
      scope = "untagged";
    }

    return {
      actions,
      scope,
      requireConfirmation: DEFAULT_ORGANIZE_CONFIG.requireConfirmation,
      autoExecute: DEFAULT_ORGANIZE_CONFIG.autoExecute,
    };
  }

  /**
   * 流式执行整理
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as BatchOrganizeInput;

    // 初始化进度
    this.initProgress(ORGANIZE_STEPS);

    try {
      // 构建操作列表描述
      const actionNames = input.actions
        .map((a) => ORGANIZE_ACTION_CONFIG[a].name)
        .join("、");

      yield* this.reportProgress("收集数据", 5, "正在收集书签数据...");
      yield* this.emitText(
        `🔧 正在执行智能整理（${actionNames}），请稍候...\n\n`,
      );

      // Step 1: 收集数据
      const bookmarks = await this.fetchBookmarks(context.userId, input);
      const folders = await this.fetchFolders(context.userId);

      yield* this.reportProgress(
        "收集数据",
        15,
        `收集到 ${bookmarks.length} 条书签`,
      );
      yield* this.emitText(`📚 共收集到 **${bookmarks.length}** 条书签。\n\n`);

      if (bookmarks.length === 0) {
        yield* this.emitText("没有找到需要整理的书签。");
        yield* this.emitDone(true, "没有需要整理的书签");
        return;
      }

      // 初始化结果
      const categorizeSuggestions: CategorizeSuggestion[] = [];
      const tagSuggestions: TagSuggestion[] = [];
      const duplicateGroups: DuplicateGroup[] = [];
      const archiveCandidates: ArchiveCandidate[] = [];
      const urlValidations: UrlValidationResult[] = [];

      // Step 2: 分析内容
      yield* this.reportProgress("分析内容", 20, "正在分析书签内容...");

      // Step 3: 智能分类
      if (input.actions.includes("auto-categorize")) {
        yield* this.reportProgress("智能分类", 30, "正在生成分类建议...");
        yield* this.emitText(`### 📁 智能分类建议\n\n`);

        const suggestions = this.generateCategorizeSuggestions(
          bookmarks,
          folders,
        );
        categorizeSuggestions.push(...suggestions);

        if (suggestions.length > 0) {
          for (const s of suggestions.slice(0, 5)) {
            yield* this.emitText(
              `- **${s.bookmarkTitle}** → ${s.suggestedFolder}（${(s.confidence * 100).toFixed(0)}%）\n`,
            );
          }
          if (suggestions.length > 5) {
            yield* this.emitText(
              `- *...还有 ${suggestions.length - 5} 条建议*\n`,
            );
          }
        } else {
          yield* this.emitText(`*暂无分类建议*\n`);
        }
        yield* this.emitText(`\n`);

        yield* this.reportProgress(
          "智能分类",
          45,
          `生成 ${suggestions.length} 条分类建议`,
        );
      }

      // Step 4: 智能打标
      if (input.actions.includes("auto-tag")) {
        yield* this.reportProgress("智能打标", 50, "正在生成标签建议...");
        yield* this.emitText(`### 🏷️ 智能标签建议\n\n`);

        const suggestions = this.generateTagSuggestions(bookmarks);
        tagSuggestions.push(...suggestions);

        if (suggestions.length > 0) {
          for (const s of suggestions.slice(0, 5)) {
            yield* this.emitText(
              `- **${s.bookmarkTitle}** → ${s.suggestedTags.map((t) => `\`${t}\``).join(" ")}\n`,
            );
          }
          if (suggestions.length > 5) {
            yield* this.emitText(
              `- *...还有 ${suggestions.length - 5} 条建议*\n`,
            );
          }
        } else {
          yield* this.emitText(`*暂无标签建议*\n`);
        }
        yield* this.emitText(`\n`);

        yield* this.reportProgress(
          "智能打标",
          65,
          `生成 ${suggestions.length} 条标签建议`,
        );
      }

      // Step 5: 清理和归档
      yield* this.reportProgress("整理清理", 70, "正在检查重复和归档...");

      // 清理重复
      if (input.actions.includes("clean-duplicates")) {
        yield* this.emitText(`### 🔄 重复书签检测\n\n`);

        const groups = this.findDuplicates(bookmarks);
        duplicateGroups.push(...groups);

        if (groups.length > 0) {
          yield* this.emitText(`发现 **${groups.length}** 组重复书签：\n\n`);
          for (const g of groups.slice(0, 3)) {
            yield* this.emitText(
              `- ${g.bookmarks[0].title}（${g.bookmarks.length} 个重复）\n`,
            );
          }
          if (groups.length > 3) {
            yield* this.emitText(`- *...还有 ${groups.length - 3} 组*\n`);
          }
        } else {
          yield* this.emitText(`*未发现重复书签* ✅\n`);
        }
        yield* this.emitText(`\n`);
      }

      // 归档旧内容
      if (input.actions.includes("archive-old")) {
        yield* this.emitText(`### 📦 归档候选\n\n`);

        const candidates = this.findArchiveCandidates(
          bookmarks,
          input.filter?.olderThanDays ||
            BATCH_ORGANIZE_CONFIG.DEFAULT_ARCHIVE_DAYS,
        );
        archiveCandidates.push(...candidates);

        if (candidates.length > 0) {
          yield* this.emitText(
            `发现 **${candidates.length}** 条可归档书签：\n\n`,
          );
          for (const c of candidates.slice(0, 5)) {
            yield* this.emitText(
              `- ${c.bookmarkTitle}（${c.daysSinceCreated} 天前）\n`,
            );
          }
          if (candidates.length > 5) {
            yield* this.emitText(`- *...还有 ${candidates.length - 5} 条*\n`);
          }
        } else {
          yield* this.emitText(`*暂无需要归档的书签*\n`);
        }
        yield* this.emitText(`\n`);
      }

      yield* this.reportProgress("整理清理", 85, "整理检查完成");

      // Step 6: 生成报告
      yield* this.reportProgress("生成报告", 90, "正在生成整理报告...");

      const stats: OrganizeStats = {
        totalProcessed: bookmarks.length,
        categorizeSuggestions: categorizeSuggestions.length,
        tagSuggestions: tagSuggestions.length,
        duplicatesFound: duplicateGroups.length,
        archiveCandidates: archiveCandidates.length,
        invalidUrls: urlValidations.filter((v) => !v.isValid).length,
        actionsExecuted: 0,
      };

      const summary = this.generateSummary(stats, input.actions);
      const suggestions = this.generateOrganizeSuggestions(stats);

      // 构建输出
      const output: BatchOrganizeOutput = {
        stats,
        categorizeSuggestions,
        tagSuggestions,
        duplicateGroups,
        archiveCandidates,
        urlValidations,
        summary,
        suggestions,
        generatedAt: new Date().toISOString(),
      };

      // 输出摘要
      yield* this.emitText(`## 📊 整理报告摘要\n\n`);
      yield* this.emitText(`${summary}\n\n`);

      // 输出统计
      yield* this.emitText(`### 统计数据\n\n`);
      yield* this.emitText(`- 处理书签数: **${stats.totalProcessed}**\n`);
      if (stats.categorizeSuggestions > 0) {
        yield* this.emitText(
          `- 分类建议数: **${stats.categorizeSuggestions}**\n`,
        );
      }
      if (stats.tagSuggestions > 0) {
        yield* this.emitText(`- 标签建议数: **${stats.tagSuggestions}**\n`);
      }
      if (stats.duplicatesFound > 0) {
        yield* this.emitText(`- 重复书签组: **${stats.duplicatesFound}**\n`);
      }
      if (stats.archiveCandidates > 0) {
        yield* this.emitText(`- 归档候选数: **${stats.archiveCandidates}**\n`);
      }
      yield* this.emitText(`\n`);

      // 输出交付物
      const deliverable = this.createDeliverable(
        "report",
        "智能整理报告",
        output,
        "markdown",
        {
          downloadable: true,
          shareable: false,
          metadata: {
            actions: input.actions,
            ...stats,
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      if (suggestions.length > 0) {
        yield* this.emitSuggestions(
          suggestions.map((s, i) => ({
            text: s,
            label: `建议 ${i + 1}`,
            action: "organize",
            icon: "💡",
          })),
        );
      }

      yield* this.reportProgress("完成", 100, "整理完成");
      yield* this.emitDone(true, summary);

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          actions: input.actions,
          ...stats,
          durationMs: Date.now() - startTime,
        },
        "BatchOrganizeSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "BatchOrganizeSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "整理失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "整理失败");
    }
  }

  /**
   * 获取书签数据
   */
  private async fetchBookmarks(
    userId: string,
    input: BatchOrganizeInput,
  ): Promise<BookmarkRow[]> {
    // 安全检查：验证书签 ID 数量
    if (
      input.filter?.bookmarkIds &&
      input.filter.bookmarkIds.length > BATCH_ORGANIZE_CONFIG.MAX_BOOKMARK_IDS
    ) {
      throw new SkillExecutionError(
        `单次最多处理 ${BATCH_ORGANIZE_CONFIG.MAX_BOOKMARK_IDS} 条书签，当前请求 ${input.filter.bookmarkIds.length} 条`,
        SKILL_ERROR_CODES.INPUT_TOO_LARGE,
      );
    }

    const supabase = await createClient();

    let query = supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        url,
        platform,
        ai_tags,
        user_tags,
        ai_summary,
        folder_id,
        created_at,
        folders(name)
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // 根据范围筛选
    switch (input.scope) {
      case "uncategorized":
        query = query.is("folder_id", null);
        break;
      case "untagged":
        query = query.or("user_tags.is.null,user_tags.eq.{}");
        break;
      case "selected":
        if (input.filter?.bookmarkIds?.length) {
          query = query.in("id", input.filter.bookmarkIds);
        }
        break;
    }

    // 应用筛选条件
    if (input.filter?.folderId) {
      query = query.eq("folder_id", input.filter.folderId);
    }
    if (input.filter?.platforms?.length) {
      query = query.in("platform", input.filter.platforms);
    }

    const { data, error } = await query.limit(
      BATCH_ORGANIZE_CONFIG.MAX_BOOKMARKS_LIMIT,
    );

    if (error) {
      logger.error({ error }, "BatchOrganizeSkill: Failed to fetch bookmarks");
      throw new Error(`获取书签失败: ${error.message}`);
    }

    return (data || []) as BookmarkRow[];
  }

  /**
   * 获取用户文件夹
   */
  private async fetchFolders(
    userId: string,
  ): Promise<Array<{ id: number; name: string }>> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .is("is_archived", false);

    if (error) {
      logger.error({ error }, "BatchOrganizeSkill: Failed to fetch folders");
      return [];
    }

    return data || [];
  }

  /**
   * 生成分类建议
   */
  private generateCategorizeSuggestions(
    bookmarks: BookmarkRow[],
    folders: Array<{ id: number; name: string }>,
  ): CategorizeSuggestion[] {
    const suggestions: CategorizeSuggestion[] = [];

    // 只处理未分类的书签
    const uncategorized = bookmarks.filter((b) => !b.folder_id);

    for (const bookmark of uncategorized) {
      const suggestion = this.suggestFolder(bookmark, folders);
      if (suggestion) {
        suggestions.push({
          bookmarkId: bookmark.id,
          bookmarkTitle: bookmark.title,
          currentFolder: null,
          ...suggestion,
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 推荐文件夹
   */
  private suggestFolder(
    bookmark: BookmarkRow,
    folders: Array<{ id: number; name: string }>,
  ): {
    suggestedFolder: string;
    suggestedFolderId?: number;
    confidence: number;
    reason: string;
  } | null {
    if (folders.length === 0) {
      return null;
    }

    // 基于平台推荐
    const platformFolderMap: Record<string, string[]> = {
      wechat: ["微信", "公众号", "阅读"],
      bilibili: ["视频", "B站", "娱乐"],
      zhihu: ["知乎", "问答", "学习"],
      github: ["开发", "技术", "代码"],
      twitter: ["社交", "资讯"],
      xiaohongshu: ["小红书", "生活"],
    };

    const platformKeywords = platformFolderMap[bookmark.platform] || [];

    // 基于标签推荐
    const allTags = [
      ...(bookmark.ai_tags || []),
      ...(bookmark.user_tags || []),
    ];

    // 匹配文件夹
    let bestMatch: (typeof folders)[0] | null = null;
    let bestScore = 0;

    for (const folder of folders) {
      let score = 0;
      const folderNameLower = folder.name.toLowerCase();

      // 平台关键词匹配
      for (const keyword of platformKeywords) {
        if (folderNameLower.includes(keyword.toLowerCase())) {
          score += 0.5;
        }
      }

      // 标签匹配
      for (const tag of allTags) {
        if (folderNameLower.includes(tag.toLowerCase())) {
          score += 0.3;
        }
      }

      // 标题关键词匹配
      const titleWords = bookmark.title.split(/\s+/);
      for (const word of titleWords) {
        if (word.length > 2 && folderNameLower.includes(word.toLowerCase())) {
          score += 0.2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = folder;
      }
    }

    if (bestMatch && bestScore > 0.2) {
      return {
        suggestedFolder: bestMatch.name,
        suggestedFolderId: bestMatch.id,
        confidence: Math.min(0.95, bestScore),
        reason: `基于平台(${bookmark.platform})和内容特征匹配`,
      };
    }

    return null;
  }

  /**
   * 生成标签建议
   */
  private generateTagSuggestions(bookmarks: BookmarkRow[]): TagSuggestion[] {
    const suggestions: TagSuggestion[] = [];

    // 只处理标签较少的书签
    const needTags = bookmarks.filter(
      (b) => (b.user_tags?.length || 0) < 2 && (b.ai_tags?.length || 0) > 0,
    );

    for (const bookmark of needTags) {
      const aiTags = bookmark.ai_tags || [];
      const userTags = bookmark.user_tags || [];

      // 推荐未添加的 AI 标签
      const suggestedTags = aiTags
        .filter((t) => !userTags.includes(t))
        .slice(0, 3);

      if (suggestedTags.length > 0) {
        suggestions.push({
          bookmarkId: bookmark.id,
          bookmarkTitle: bookmark.title,
          currentTags: userTags,
          suggestedTags,
          confidence: 0.8,
        });
      }
    }

    return suggestions;
  }

  /**
   * 查找重复书签
   */
  private findDuplicates(bookmarks: BookmarkRow[]): DuplicateGroup[] {
    const urlMap = new Map<string, BookmarkRow[]>();

    // 按 URL 分组
    for (const bookmark of bookmarks) {
      const normalizedUrl = this.normalizeUrl(bookmark.url);
      const existing = urlMap.get(normalizedUrl) || [];
      existing.push(bookmark);
      urlMap.set(normalizedUrl, existing);
    }

    // 找出重复组
    const duplicateGroups: DuplicateGroup[] = [];

    for (const [normalizedUrl, items] of urlMap) {
      if (items.length > 1) {
        // 按创建时间排序，推荐保留最早的
        items.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );

        duplicateGroups.push({
          normalizedUrl,
          bookmarks: items.map((b) => ({
            id: b.id,
            title: b.title,
            createdAt: b.created_at,
            folderId: b.folder_id,
          })),
          keepBookmarkId: items[0].id,
        });
      }
    }

    return duplicateGroups;
  }

  /**
   * 规范化 URL
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // 安全检查：仅允许 http/https 协议
      if (
        !URL_VALIDATION_CONFIG.ALLOWED_PROTOCOLS.includes(
          parsed.protocol as "http:" | "https:",
        )
      ) {
        logger.warn(
          { url, protocol: parsed.protocol },
          "Invalid protocol in URL",
        );
        return url.toLowerCase();
      }

      // 移除协议、www、尾部斜杠、hash
      return (
        parsed.host.replace(/^www\./, "") + parsed.pathname.replace(/\/$/, "")
      );
    } catch (error) {
      logger.debug(
        { url, error: error instanceof Error ? error.message : String(error) },
        "Failed to parse URL",
      );
      return url.toLowerCase();
    }
  }

  /**
   * 查找归档候选
   */
  private findArchiveCandidates(
    bookmarks: BookmarkRow[],
    olderThanDays: number,
  ): ArchiveCandidate[] {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const threshold = now - olderThanDays * dayMs;

    const candidates: ArchiveCandidate[] = [];

    for (const bookmark of bookmarks) {
      const createdAt = new Date(bookmark.created_at).getTime();
      const daysSinceCreated = Math.floor((now - createdAt) / dayMs);

      if (createdAt < threshold) {
        candidates.push({
          bookmarkId: bookmark.id,
          bookmarkTitle: bookmark.title,
          daysSinceCreated,
          neverAccessed: true, // 假设未被访问
          reason: `创建于 ${daysSinceCreated} 天前，超过 ${olderThanDays} 天阈值`,
        });
      }
    }

    return candidates.sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    stats: OrganizeStats,
    _actions: OrganizeAction[],
  ): string {
    const parts: string[] = [];

    parts.push(`处理了 **${stats.totalProcessed}** 条书签`);

    if (stats.categorizeSuggestions > 0) {
      parts.push(`生成 **${stats.categorizeSuggestions}** 条分类建议`);
    }
    if (stats.tagSuggestions > 0) {
      parts.push(`生成 **${stats.tagSuggestions}** 条标签建议`);
    }
    if (stats.duplicatesFound > 0) {
      parts.push(`发现 **${stats.duplicatesFound}** 组重复书签`);
    }
    if (stats.archiveCandidates > 0) {
      parts.push(`发现 **${stats.archiveCandidates}** 条可归档内容`);
    }

    return parts.join("，") + "。";
  }

  /**
   * 生成整理建议
   */
  private generateOrganizeSuggestions(stats: OrganizeStats): string[] {
    const suggestions: string[] = [];

    if (stats.categorizeSuggestions > 10) {
      suggestions.push("建议分批处理分类建议，每次处理 10-20 条以便仔细审核");
    }

    if (stats.duplicatesFound > 0) {
      suggestions.push("建议审核重复书签，保留最完整的版本");
    }

    if (stats.archiveCandidates > 20) {
      suggestions.push("旧书签较多，可以考虑创建「归档」文件夹统一管理");
    }

    if (suggestions.length === 0) {
      suggestions.push("您的书签整理状态良好，继续保持！");
    }

    return suggestions;
  }

  /**
   * 非流式执行
   */
  protected async executeInternal(
    input: BatchOrganizeInput,
    context: SkillContext,
  ): Promise<BatchOrganizeOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: BatchOrganizeOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as BatchOrganizeOutput;
      }
    }

    if (!output) {
      throw new Error("整理失败");
    }

    return output;
  }
}

// ============================================
// 辅助类型
// ============================================

interface BookmarkRow {
  id: number;
  title: string;
  url: string;
  platform: string;
  ai_tags: string[] | null;
  user_tags: string[] | null;
  ai_summary: string | null;
  folder_id: number | null;
  created_at: string;
  folders?: Array<{ name: string }> | { name: string } | null;
}

// ============================================
// 导出
// ============================================

export const batchOrganizeSkill = new BatchOrganizeSkill();
