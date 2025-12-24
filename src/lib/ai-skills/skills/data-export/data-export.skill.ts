/**
 * DataExportSkill - 数据导出编排 Skill
 *
 * 支持多格式导出书签数据，包括：
 * - CSV、Markdown、JSON、HTML、Obsidian 格式
 * - 自定义字段选择
 * - 文件夹/标签筛选
 * - 导出进度报告
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { logger } from "@/lib/logger";
import type {
  DataExportInput,
  DataExportOutput,
  ExportedBookmark,
  ExportStats,
  ExportFormat,
  ExportField,
} from "./types";
import { DEFAULT_EXPORT_FIELDS, EXPORT_FORMAT_CONFIG } from "./types";

// ============================================
// Schema 定义
// ============================================

const DataExportInputSchema = z.object({
  format: z
    .enum(["csv", "markdown", "json", "html", "obsidian"])
    .default("markdown")
    .describe("导出格式"),
  scope: z
    .enum(["all", "folder", "tag", "search", "selected"])
    .default("all")
    .describe("导出范围"),
  fields: z
    .array(
      z.enum([
        "title",
        "url",
        "platform",
        "folder",
        "tags",
        "aiSummary",
        "aiTags",
        "rating",
        "note",
        "createdAt",
        "updatedAt",
      ]),
    )
    .optional()
    .describe("导出字段"),
  filter: z
    .object({
      folderId: z.number().optional(),
      tags: z.array(z.string()).optional(),
      keyword: z.string().optional(),
      bookmarkIds: z.array(z.number()).optional(),
      dateRange: z
        .object({
          start: z.string().optional(),
          end: z.string().optional(),
        })
        .optional(),
    })
    .optional()
    .describe("筛选条件"),
  options: z
    .object({
      includeAiContent: z.boolean().optional(),
      includeNotes: z.boolean().optional(),
      filenamePrefix: z.string().optional(),
      markdownHeadingLevel: z
        .union([z.literal(1), z.literal(2), z.literal(3)])
        .optional(),
    })
    .optional()
    .describe("导出选项"),
});

const DataExportOutputSchema = z.object({
  stats: z.object({
    totalExported: z.number(),
    byPlatform: z.record(z.string(), z.number()),
    byFolder: z.record(z.string(), z.number()),
    fileSize: z.number(),
    durationMs: z.number(),
  }),
  filename: z.string(),
  content: z.string(),
  mimeType: z.string(),
  isBase64: z.boolean(),
  summary: z.string(),
  suggestions: z.array(z.string()),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

const EXPORT_STEPS = [
  { id: "parse", name: "解析参数", description: "解析导出参数", weight: 10 },
  { id: "fetch", name: "获取数据", description: "获取书签数据", weight: 30 },
  { id: "format", name: "格式化", description: "格式化导出内容", weight: 40 },
  { id: "report", name: "生成报告", description: "生成导出报告", weight: 20 },
];

// ============================================
// DataExportSkill 实现
// ============================================

export class DataExportSkill extends OrchestrationSkill<
  DataExportInput,
  DataExportOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "data_export",
    name: "数据导出助手",
    description:
      "将您的书签收藏导出为多种格式，支持 CSV、Markdown、JSON、HTML 和 Obsidian 格式，可自定义导出字段和筛选条件。",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "multi-format-export",
      "field-selection",
      "filter-support",
      "batch-processing",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 30000,
    maxExecutionTimeMs: 120000,
    deliverableTypes: ["document"],
    outputFormats: ["markdown", "json", "html", "plain"],
    steps: EXPORT_STEPS,
  };

  readonly inputSchema = DataExportInputSchema;
  readonly outputSchema = DataExportOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<DataExportInput> {
    // 默认参数
    const input: DataExportInput = {
      format: "markdown",
      scope: "all",
    };

    // 解析格式
    if (/csv/i.test(message)) {
      input.format = "csv";
    } else if (/json/i.test(message)) {
      input.format = "json";
    } else if (/html|浏览器/i.test(message)) {
      input.format = "html";
    } else if (/obsidian|双链/i.test(message)) {
      input.format = "obsidian";
    }

    // 解析范围
    if (/全部|所有/i.test(message)) {
      input.scope = "all";
    } else if (/文件夹/i.test(message)) {
      input.scope = "folder";
    } else if (/标签/i.test(message)) {
      input.scope = "tag";
    }

    // 解析选项
    if (/ai|摘要|智能/i.test(message)) {
      input.options = { ...input.options, includeAiContent: true };
    }
    if (/笔记|备注/i.test(message)) {
      input.options = { ...input.options, includeNotes: true };
    }

    return input;
  }

  /**
   * 流式执行导出
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as DataExportInput;

    // 初始化进度
    this.initProgress(EXPORT_STEPS);

    try {
      // Step 1: 解析导出参数
      yield* this.reportProgress("解析参数", 5, "正在解析导出参数...");
      yield* this.emitText("📦 正在准备导出数据，请稍候...\n\n");

      const fields = input.fields || DEFAULT_EXPORT_FIELDS;
      const formatConfig = EXPORT_FORMAT_CONFIG[input.format];

      yield* this.reportProgress("解析参数", 10, "参数解析完成");
      yield* this.emitText(
        `导出格式: **${formatConfig.name}** (${formatConfig.extension})\n`,
      );

      // Step 2: 获取书签数据
      yield* this.reportProgress("获取数据", 15, "正在获取书签数据...");

      const bookmarks = await this.fetchBookmarks(input, context.userId);

      yield* this.reportProgress(
        "获取数据",
        40,
        `获取到 ${bookmarks.length} 条书签`,
      );
      yield* this.emitText(`找到 **${bookmarks.length}** 条书签。\n\n`);

      if (bookmarks.length === 0) {
        yield* this.emitText("没有找到符合条件的书签数据。");
        yield* this.emitDone(true, "没有需要导出的数据");
        return;
      }

      // Step 3: 格式化导出内容
      yield* this.reportProgress("格式化", 45, "正在格式化导出内容...");
      yield* this.emitText("🔄 正在将数据转换为目标格式...\n\n");

      const content = this.formatContent(
        bookmarks,
        input.format,
        fields,
        input.options,
      );

      yield* this.reportProgress("格式化", 80, "格式化完成");

      // Step 4: 生成导出报告
      yield* this.reportProgress("生成报告", 85, "正在生成导出报告...");

      const stats = this.calculateStats(
        bookmarks,
        content,
        Date.now() - startTime,
      );
      const filename = this.generateFilename(input, formatConfig.extension);
      const summary = this.generateSummary(stats, input.format);
      const suggestions = this.generateSuggestions(input, stats);

      yield* this.reportProgress("生成报告", 95, "报告生成完成");

      // 构建输出
      const output: DataExportOutput = {
        stats,
        filename,
        content,
        mimeType: formatConfig.mimeType,
        isBase64: false,
        summary,
        suggestions,
        generatedAt: new Date().toISOString(),
      };

      // 输出文本摘要
      yield* this.emitText(`## 📊 导出报告\n\n`);
      yield* this.emitText(`${summary}\n\n`);

      // 平台分布
      if (Object.keys(stats.byPlatform).length > 0) {
        yield* this.emitText(`### 平台分布\n\n`);
        for (const [platform, count] of Object.entries(stats.byPlatform)) {
          yield* this.emitText(`- **${platform}**: ${count} 条\n`);
        }
        yield* this.emitText("\n");
      }

      // 文件夹分布
      if (Object.keys(stats.byFolder).length > 0) {
        yield* this.emitText(`### 文件夹分布\n\n`);
        const sortedFolders = Object.entries(stats.byFolder)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        for (const [folder, count] of sortedFolders) {
          yield* this.emitText(`- **${folder}**: ${count} 条\n`);
        }
        if (Object.keys(stats.byFolder).length > 5) {
          yield* this.emitText(
            `- *还有 ${Object.keys(stats.byFolder).length - 5} 个文件夹...*\n`,
          );
        }
        yield* this.emitText("\n");
      }

      // 输出交付物
      const deliverable = this.createDeliverable(
        "document",
        `书签导出 - ${formatConfig.name}`,
        output,
        "json",
        {
          downloadable: true,
          shareable: false,
          metadata: {
            filename,
            fileSize: stats.fileSize,
            format: input.format,
            totalExported: stats.totalExported,
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
            action: "export",
            icon: "💡",
          })),
        );
      }

      yield* this.reportProgress("完成", 100, "导出完成");
      yield* this.emitDone(
        true,
        `成功导出 ${stats.totalExported} 条书签为 ${formatConfig.name} 格式`,
      );

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          format: input.format,
          totalExported: stats.totalExported,
          durationMs: Date.now() - startTime,
        },
        "DataExportSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "DataExportSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "数据导出失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "数据导出失败");
    }
  }

  /**
   * 获取书签数据
   */
  private async fetchBookmarks(
    input: DataExportInput,
    userId: string,
  ): Promise<ExportedBookmark[]> {
    const supabase = await createClient();

    let query = supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        url,
        platform,
        ai_summary,
        ai_tags,
        user_tags,
        rating,
        notes,
        created_at,
        updated_at,
        folder_id,
        folders(name)
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // 应用筛选条件
    if (input.filter) {
      if (input.filter.folderId) {
        query = query.eq("folder_id", input.filter.folderId);
      }
      if (input.filter.bookmarkIds?.length) {
        query = query.in("id", input.filter.bookmarkIds);
      }
      if (input.filter.dateRange?.start) {
        query = query.gte("created_at", input.filter.dateRange.start);
      }
      if (input.filter.dateRange?.end) {
        query = query.lte("created_at", input.filter.dateRange.end);
      }
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, "DataExportSkill: Failed to fetch bookmarks");
      throw new Error(`获取书签失败: ${error.message}`);
    }

    return (data || []).map((item) => {
      // 处理 folders 可能是数组或对象的情况
      const folder = Array.isArray(item.folders)
        ? item.folders[0]
        : item.folders;

      return {
        id: item.id,
        title: item.title,
        url: item.url,
        platform: item.platform,
        folderName: folder?.name || null,
        tags: (item.user_tags as string[]) || [],
        aiTags: (item.ai_tags as string[]) || [],
        aiSummary: item.ai_summary,
        rating: item.rating,
        note: item.notes,
        createdAt: item.created_at || new Date().toISOString(),
        updatedAt:
          item.updated_at || item.created_at || new Date().toISOString(),
      };
    });
  }

  /**
   * 格式化内容
   */
  private formatContent(
    bookmarks: ExportedBookmark[],
    format: ExportFormat,
    fields: ExportField[],
    options?: DataExportInput["options"],
  ): string {
    switch (format) {
      case "csv":
        return this.formatCsv(bookmarks, fields);
      case "markdown":
        return this.formatMarkdown(bookmarks, fields, options);
      case "json":
        return this.formatJson(bookmarks, fields);
      case "html":
        return this.formatHtml(bookmarks);
      case "obsidian":
        return this.formatObsidian(bookmarks, options);
      default:
        return this.formatJson(bookmarks, fields);
    }
  }

  /**
   * 格式化为 CSV
   */
  private formatCsv(
    bookmarks: ExportedBookmark[],
    fields: ExportField[],
  ): string {
    const fieldMap: Record<ExportField, (b: ExportedBookmark) => string> = {
      title: (b) => b.title,
      url: (b) => b.url,
      platform: (b) => b.platform,
      folder: (b) => b.folderName || "",
      tags: (b) => b.tags.join("; "),
      aiSummary: (b) => b.aiSummary || "",
      aiTags: (b) => b.aiTags.join("; "),
      rating: (b) => b.rating?.toString() || "",
      note: (b) => b.note || "",
      createdAt: (b) => b.createdAt,
      updatedAt: (b) => b.updatedAt,
    };

    const headers = fields.join(",");
    const rows = bookmarks.map((b) =>
      fields
        .map((f) => {
          const value = fieldMap[f](b);
          // CSV 转义
          if (
            value.includes(",") ||
            value.includes('"') ||
            value.includes("\n")
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(","),
    );

    return [headers, ...rows].join("\n");
  }

  /**
   * 格式化为 Markdown
   */
  private formatMarkdown(
    bookmarks: ExportedBookmark[],
    _fields: ExportField[],
    options?: DataExportInput["options"],
  ): string {
    const headingLevel = options?.markdownHeadingLevel || 2;
    const heading = "#".repeat(headingLevel);

    let content = `# 书签导出\n\n`;
    content += `导出时间: ${new Date().toLocaleString("zh-CN")}\n`;
    content += `总数量: ${bookmarks.length}\n\n---\n\n`;

    for (const bookmark of bookmarks) {
      content += `${heading} ${bookmark.title}\n\n`;
      content += `- **URL**: [${bookmark.url}](${bookmark.url})\n`;
      content += `- **平台**: ${bookmark.platform}\n`;
      if (bookmark.folderName) {
        content += `- **文件夹**: ${bookmark.folderName}\n`;
      }
      if (bookmark.tags.length > 0) {
        content += `- **标签**: ${bookmark.tags.map((t) => `\`${t}\``).join(" ")}\n`;
      }
      if (options?.includeAiContent && bookmark.aiSummary) {
        content += `\n> ${bookmark.aiSummary}\n`;
      }
      if (options?.includeNotes && bookmark.note) {
        content += `\n**笔记**: ${bookmark.note}\n`;
      }
      content += `\n---\n\n`;
    }

    return content;
  }

  /**
   * 格式化为 JSON
   */
  private formatJson(
    bookmarks: ExportedBookmark[],
    fields: ExportField[],
  ): string {
    const exportData = bookmarks.map((b) => {
      const item: Record<string, unknown> = {};
      for (const field of fields) {
        switch (field) {
          case "title":
            item.title = b.title;
            break;
          case "url":
            item.url = b.url;
            break;
          case "platform":
            item.platform = b.platform;
            break;
          case "folder":
            item.folder = b.folderName;
            break;
          case "tags":
            item.tags = b.tags;
            break;
          case "aiSummary":
            item.aiSummary = b.aiSummary;
            break;
          case "aiTags":
            item.aiTags = b.aiTags;
            break;
          case "rating":
            item.rating = b.rating;
            break;
          case "note":
            item.note = b.note;
            break;
          case "createdAt":
            item.createdAt = b.createdAt;
            break;
          case "updatedAt":
            item.updatedAt = b.updatedAt;
            break;
        }
      }
      return item;
    });

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalCount: bookmarks.length,
        bookmarks: exportData,
      },
      null,
      2,
    );
  }

  /**
   * 格式化为 HTML（浏览器书签格式）
   */
  private formatHtml(bookmarks: ExportedBookmark[]): string {
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>\n`;

    // 按文件夹分组
    const byFolder = new Map<string, ExportedBookmark[]>();
    for (const b of bookmarks) {
      const folder = b.folderName || "未分类";
      if (!byFolder.has(folder)) {
        byFolder.set(folder, []);
      }
      byFolder.get(folder)!.push(b);
    }

    for (const [folder, items] of byFolder) {
      html += `    <DT><H3>${this.escapeHtml(folder)}</H3>\n`;
      html += `    <DL><p>\n`;
      for (const item of items) {
        const timestamp = Math.floor(new Date(item.createdAt).getTime() / 1000);
        html += `        <DT><A HREF="${this.escapeHtml(item.url)}" ADD_DATE="${timestamp}">${this.escapeHtml(item.title)}</A>\n`;
      }
      html += `    </DL><p>\n`;
    }

    html += `</DL><p>\n`;
    return html;
  }

  /**
   * 格式化为 Obsidian 格式
   */
  private formatObsidian(
    bookmarks: ExportedBookmark[],
    options?: DataExportInput["options"],
  ): string {
    let content = `---
type: bookmark-export
exported: ${new Date().toISOString()}
count: ${bookmarks.length}
---

# 书签库导出

`;

    for (const bookmark of bookmarks) {
      content += `## [[${bookmark.title}]]\n\n`;
      content += `- 链接: ${bookmark.url}\n`;
      content += `- 平台: #${bookmark.platform.replace(/\s+/g, "-")}\n`;
      if (bookmark.folderName) {
        content += `- 文件夹: [[${bookmark.folderName}]]\n`;
      }
      if (bookmark.tags.length > 0) {
        content += `- 标签: ${bookmark.tags.map((t) => `#${t.replace(/\s+/g, "-")}`).join(" ")}\n`;
      }
      if (bookmark.aiSummary) {
        content += `\n> [!summary]\n> ${bookmark.aiSummary}\n`;
      }
      if (options?.includeNotes && bookmark.note) {
        content += `\n### 笔记\n${bookmark.note}\n`;
      }
      content += `\n---\n\n`;
    }

    return content;
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * 计算导出统计
   */
  private calculateStats(
    bookmarks: ExportedBookmark[],
    content: string,
    durationMs: number,
  ): ExportStats {
    const byPlatform: Record<string, number> = {};
    const byFolder: Record<string, number> = {};

    for (const b of bookmarks) {
      byPlatform[b.platform] = (byPlatform[b.platform] || 0) + 1;
      const folder = b.folderName || "未分类";
      byFolder[folder] = (byFolder[folder] || 0) + 1;
    }

    return {
      totalExported: bookmarks.length,
      byPlatform,
      byFolder,
      fileSize: new TextEncoder().encode(content).length,
      durationMs,
    };
  }

  /**
   * 生成文件名
   */
  private generateFilename(input: DataExportInput, extension: string): string {
    const prefix = input.options?.filenamePrefix || "anykeep-export";
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    return `${prefix}-${timestamp}${extension}`;
  }

  /**
   * 生成导出摘要
   */
  private generateSummary(stats: ExportStats, format: ExportFormat): string {
    const formatName = EXPORT_FORMAT_CONFIG[format].name;
    return `成功导出 **${stats.totalExported}** 条书签为 **${formatName}** 格式，文件大小 ${this.formatFileSize(stats.fileSize)}，耗时 ${stats.durationMs}ms`;
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * 生成后续建议
   */
  private generateSuggestions(
    input: DataExportInput,
    stats: ExportStats,
  ): string[] {
    const suggestions: string[] = [];

    if (input.format !== "html") {
      suggestions.push("导出为 HTML 格式可直接导入浏览器");
    }
    if (input.format !== "obsidian" && stats.totalExported > 50) {
      suggestions.push("使用 Obsidian 格式可以建立知识网络");
    }
    if (!input.options?.includeAiContent) {
      suggestions.push("添加 AI 摘要可以让导出内容更丰富");
    }
    if (stats.totalExported > 100) {
      suggestions.push("考虑按文件夹分批导出以便管理");
    }

    return suggestions;
  }

  /**
   * 非流式执行（兼容原子模式）
   */
  protected async executeInternal(
    input: DataExportInput,
    context: SkillContext,
  ): Promise<DataExportOutput> {
    // 创建编排上下文
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    // 收集结果
    let output: DataExportOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as DataExportOutput;
      }
    }

    if (!output) {
      throw new Error("数据导出失败");
    }

    return output;
  }
}

// ============================================
// 导出
// ============================================

export const dataExportSkill = new DataExportSkill();
