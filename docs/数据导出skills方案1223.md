# 数据导出 AI Skills 设计方案

> **版本**: 1.0.0
> **创建日期**: 2025-12-23
> **状态**: 待审核
> **基于**: AI Skills Phase 2 架构

---

## 一、功能概述

### 1.1 核心价值

将数据导出功能 Skills 化，使 AI 助手能够：

1. **理解自然语言导出意图**：用户说"导出我的收藏到 Excel"即可完成
2. **智能格式推荐**：根据使用场景推荐最合适的导出格式
3. **与智能列表联动**：导出智能列表的内容，无需手动筛选
4. **批量操作集成**：AI 可以先筛选再导出

### 1.2 设计原则

| 层级         | 职责                   | 特点                               |
| ------------ | ---------------------- | ---------------------------------- |
| **Skill 层** | AI 意图解析 + 格式推荐 | 调用 LLM，处理复杂自然语言（可选） |
| **Tool 层**  | 执行导出操作           | 快速、可靠、复用现有 ExportService |
| **现有服务** | ExportService          | 已实现，无需重写                   |

### 1.3 与智能列表 Skills 对比

| 对比维度       | 智能列表 Skills         | 导出 Skills                   |
| -------------- | ----------------------- | ----------------------------- |
| Skill 层必要性 | 高（自然语言→筛选规则） | 低（格式明确时直接调用 Tool） |
| Tool 数量      | 6 个                    | 4 个                          |
| 确认机制       | 删除需确认              | 导出需确认                    |
| 复用度         | 新建数据库表            | 复用 ExportService            |

---

## 二、架构设计

### 2.1 整体架构图

```
┌────────────────────────────────────────────────────────────────┐
│                    Export AI Skills 架构                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ExportSkill (AI 层) - 可选增强               │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │parse_intent │  │suggest_     │  │explain_     │      │  │
│  │  │解析导出意图  │  │format       │  │format       │      │  │
│  │  │             │  │推荐导出格式  │  │解释格式差异  │      │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │  │
│  │                                                           │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                │
│  ┌────────────────────────────▼──────────────────────────────┐  │
│  │                 Export Tools (数据层) - 核心               │  │
│  │                                                            │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │  │
│  │  │export_        │  │preview_       │  │list_export_   │  │  │
│  │  │bookmarks      │  │export         │  │formats        │  │  │
│  │  │执行导出       │  │预览导出       │  │列出可用格式   │  │  │
│  │  └───────────────┘  └───────────────┘  └───────────────┘  │  │
│  │                                                            │  │
│  │  ┌───────────────┐                                        │  │
│  │  │estimate_      │                                        │  │
│  │  │export_size    │                                        │  │
│  │  │估算文件大小   │                                        │  │
│  │  └───────────────┘                                        │  │
│  │                                                            │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                               │                                │
│  ┌────────────────────────────▼───────────────────────────────┐  │
│  │                 ExportService (现有服务层)                  │  │
│  │                                                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │
│  │  │CsvFormatter │  │Markdown-    │  │Obsidian-    │        │  │
│  │  │             │  │Formatter    │  │Formatter    │        │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │  │
│  │                                                             │  │
│  │  + JSON / HTML 格式支持                                     │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户: "导出微信文章到 Markdown"
           │
           ▼
┌──────────────────────┐
│   KnowledgeAgent     │
│   解析意图，选择工具  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  export_bookmarks    │  ← Tool 层
│  Tool                │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  ExportService       │  ← 现有服务层（复用）
│  .export()           │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  MarkdownFormatter   │  ← 格式化器
│  .formatAll()        │
└──────────┬───────────┘
           │
           ▼
     返回下载链接/内容
```

---

## 三、Tool 层详细设计

### 3.1 Tool 清单

| Tool 名称              | 类别   | 说明                    | 需要确认 |
| ---------------------- | ------ | ----------------------- | -------- |
| `export_bookmarks`     | action | 执行导出（核心）        | 是       |
| `preview_export`       | query  | 预览导出内容（前 3 条） | 否       |
| `list_export_formats`  | query  | 列出可用格式及说明      | 否       |
| `estimate_export_size` | query  | 估算导出文件大小        | 否       |

### 3.2 export_bookmarks Tool

```typescript
// src/lib/ai-agent/tools/export/export-bookmarks.tool.ts

import { z } from "zod";
import type {
  Tool,
  ToolContext,
  ToolResult,
  PendingConfirmation,
} from "../types";
import { exportService } from "@/lib/export/services/export.service";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { generateConfirmationId, getConfirmationExpiryTime } from "../utils";
import type { ExportFormat, BookmarkWithFolder } from "@/lib/export/types";
import { EXPORT_FORMAT_CONFIG } from "@/lib/export/constants";

// ============================================
// 参数定义
// ============================================

const filterSchema = z.object({
  scope: z
    .enum(["all", "all_with_browser", "selected"])
    .optional()
    .describe(
      "导出范围：all-全部收藏（不含浏览器书签），all_with_browser-全部（含浏览器书签），selected-指定书签",
    ),
  folderIds: z.array(z.number()).optional().describe("指定文件夹 ID"),
  platforms: z
    .array(z.string())
    .optional()
    .describe("指定平台：WECHAT, BILIBILI, XIAOHONGSHU 等"),
  dateRange: z
    .object({
      start: z.string().describe("开始日期 ISO 格式"),
      end: z.string().describe("结束日期 ISO 格式"),
    })
    .optional()
    .describe("时间范围"),
  tags: z.array(z.string()).optional().describe("包含这些标签的书签"),
  isStarred: z.boolean().optional().describe("仅导出收藏的书签"),
});

const csvOptionsSchema = z.object({
  fields: z
    .array(z.string())
    .optional()
    .describe(
      "导出字段：title, url, folder, created_at, platform, ai_tags, user_tags, ai_summary, description, author, notes",
    ),
  includeHeader: z.boolean().optional().default(true),
});

const markdownOptionsSchema = z.object({
  includeFrontmatter: z.boolean().optional().default(false),
  includeAiSummary: z.boolean().optional().default(true),
  groupByFolder: z.boolean().optional().default(true),
});

const paramsSchema = z.object({
  format: z
    .enum(["csv", "markdown", "obsidian", "obsidian-zip", "json", "html"])
    .describe("导出格式"),
  filter: filterSchema.optional().describe("筛选条件（与 bookmarkIds 二选一）"),
  bookmarkIds: z
    .array(z.number())
    .optional()
    .describe("指定导出的书签 ID 列表（与 filter 二选一）"),
  options: z
    .object({
      csv: csvOptionsSchema.optional(),
      markdown: markdownOptionsSchema.optional(),
    })
    .optional()
    .describe("格式特定选项"),
});

type ExportBookmarksParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface ExportBookmarksResult {
  filename: string;
  format: ExportFormat;
  count: number;
  size: number;
  sizeFormatted: string;
  downloadUrl?: string;
  message: string;
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// Tool 实现
// ============================================

export const exportBookmarksTool: Tool<
  ExportBookmarksParams,
  ExportBookmarksResult
> = {
  definition: {
    name: "export_bookmarks",
    description: `导出用户的书签收藏到指定格式。

**支持的格式：**
- csv: 适合 Excel 分析，可自定义字段
- markdown: 适合笔记工具（Notion、Typora）
- obsidian: 带 Frontmatter 的 Markdown，支持双链
- obsidian-zip: 每条书签独立 .md 文件，打包成 ZIP
- json: 结构化数据备份
- html: 浏览器书签格式，可导入 Chrome/Edge/Firefox

**使用场景：**
- 用户说"导出我的收藏到 CSV" → format: "csv"
- 用户说"把微信文章导出成 Markdown" → format: "markdown", filter: { platforms: ["WECHAT"] }
- 用户说"导出最近一周的内容到 Obsidian" → format: "obsidian-zip", filter: { dateRange: 最近7天 }
- 用户说"导出这几个书签" + 提供 bookmarkIds → bookmarkIds: [1, 2, 3]

**注意事项：**
- 这是一个导出操作，会生成文件
- 操作前会显示确认对话框
- 大量数据时会显示进度`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 3000,
  },

  async execute(
    params: ExportBookmarksParams,
    context: ToolContext,
  ): Promise<ToolResult<ExportBookmarksResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 构建查询获取书签
      let query = supabase
        .from("bookmarks")
        .select("*, folders(name)")
        .eq("user_id", context.userId);

      // 2. 应用筛选条件
      if (params.bookmarkIds?.length) {
        // 指定 ID 模式
        query = query.in("id", params.bookmarkIds);
      } else if (params.filter) {
        query = applyExportFilter(query, params.filter);
      } else {
        // 默认排除浏览器书签
        query = query.not(
          "platform",
          "in",
          '("CHROME","EDGE","FIREFOX","SAFARI")',
        );
      }

      // 3. 执行查询
      const { data: bookmarks, error, count } = await query;

      if (error) throw error;
      if (!bookmarks?.length) {
        return {
          success: false,
          error: "没有符合条件的书签可导出",
          errorCode: "NO_DATA",
        };
      }

      // 4. 估算文件大小
      const estimatedSize = estimateExportSize(bookmarks, params.format);

      // 5. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const formatLabel =
          EXPORT_FORMAT_CONFIG[params.format]?.label || params.format;

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "export_bookmarks",
          description: `导出 ${bookmarks.length} 条书签到 ${formatLabel}`,
          impactSummary: `将导出 ${bookmarks.length} 条书签，预估文件大小 ${formatBytes(estimatedSize)}`,
          affectedItems: bookmarks.slice(0, 5).map((b) => ({
            id: b.id,
            title: b.title || "无标题",
          })),
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "low", // 导出是只读操作，风险低
        };

        logger.info(
          {
            toolName: "export_bookmarks",
            userId: context.userId,
            format: params.format,
            bookmarkCount: bookmarks.length,
            confirmationId: confirmation.confirmationId,
          },
          "export_bookmarks: Confirmation required",
        );

        return {
          success: true,
          data: {
            filename: "",
            format: params.format,
            count: bookmarks.length,
            size: estimatedSize,
            sizeFormatted: formatBytes(estimatedSize),
            message: `待用户确认：导出 ${bookmarks.length} 条书签到 ${formatLabel}。界面上已显示确认对话框。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 6. 已确认，执行导出
      const result = await exportService.export(
        bookmarks as BookmarkWithFolder[],
        {
          format: params.format,
          options: params.options,
        },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || "导出失败",
          errorCode: result.errorCode,
        };
      }

      // 7. TODO: 实际部署时，将内容上传到临时存储并返回下载 URL
      // 这里简化处理，返回成功信息
      const downloadUrl = `/api/export/download/${result.filename}`;

      logger.info(
        {
          toolName: "export_bookmarks",
          userId: context.userId,
          format: params.format,
          bookmarkCount: result.count,
          fileSize: result.size,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "export_bookmarks: Success",
      );

      return {
        success: true,
        data: {
          filename: result.filename,
          format: params.format,
          count: result.count,
          size: result.size || 0,
          sizeFormatted: formatBytes(result.size || 0),
          downloadUrl,
          message: `已成功导出 ${result.count} 条书签到 ${EXPORT_FORMAT_CONFIG[params.format]?.label || params.format} 格式，文件大小 ${formatBytes(result.size || 0)}`,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: result.count,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "export_bookmarks",
          userId: context.userId,
          format: params.format,
          error: errorMessage,
        },
        "export_bookmarks: Failed",
      );

      return {
        success: false,
        error: `导出失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};

// ============================================
// 辅助函数
// ============================================

/**
 * 应用导出筛选条件
 */
function applyExportFilter(
  query: any,
  filter: z.infer<typeof filterSchema>,
): any {
  // 范围筛选
  if (filter.scope === "all") {
    query = query.not("platform", "in", '("CHROME","EDGE","FIREFOX","SAFARI")');
  }
  // all_with_browser 不需要额外筛选

  // 文件夹筛选
  if (filter.folderIds?.length) {
    query = query.in("folder_id", filter.folderIds);
  }

  // 平台筛选
  if (filter.platforms?.length) {
    query = query.in("platform", filter.platforms);
  }

  // 时间范围
  if (filter.dateRange) {
    query = query
      .gte("created_at", filter.dateRange.start)
      .lte("created_at", filter.dateRange.end);
  }

  // 标签筛选
  if (filter.tags?.length) {
    query = query.overlaps("ai_tags", filter.tags);
  }

  // 收藏筛选
  if (filter.isStarred !== undefined) {
    query = query.eq("is_starred", filter.isStarred);
  }

  return query;
}

/**
 * 估算导出文件大小
 */
function estimateExportSize(bookmarks: any[], format: ExportFormat): number {
  const avgBookmarkSize: Record<ExportFormat, number> = {
    csv: 200, // 每条约 200 字节
    markdown: 500, // 每条约 500 字节
    obsidian: 600, // 带 frontmatter
    "obsidian-zip": 700,
    json: 400,
    html: 150,
  };

  return bookmarks.length * (avgBookmarkSize[format] || 300);
}

/**
 * 格式化字节数
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
```

### 3.3 preview_export Tool

```typescript
// src/lib/ai-agent/tools/export/preview-export.tool.ts

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import {
  CsvFormatter,
  MarkdownFormatter,
  ObsidianFormatter,
} from "@/lib/export/formatters";
import type { ExportFormat, BookmarkWithFolder } from "@/lib/export/types";

const paramsSchema = z.object({
  format: z
    .enum(["csv", "markdown", "obsidian", "json", "html"])
    .describe("预览格式"),
  bookmarkIds: z.array(z.number()).optional().describe("指定预览的书签 ID"),
  previewCount: z
    .number()
    .min(1)
    .max(5)
    .default(3)
    .describe("预览数量，默认 3 条"),
});

type PreviewExportParams = z.infer<typeof paramsSchema>;

interface PreviewExportResult {
  format: ExportFormat;
  previewContent: string;
  bookmarkCount: number;
  message: string;
}

export const previewExportTool: Tool<PreviewExportParams, PreviewExportResult> =
  {
    definition: {
      name: "preview_export",
      description: `预览导出内容，返回格式化后的示例。

**使用场景：**
- 用户问"导出后是什么样的"
- 用户问"CSV 格式长什么样"
- 用户想先看看再决定导出`,
      parameters: paramsSchema,
      category: "query",
    },

    async execute(
      params: PreviewExportParams,
      context: ToolContext,
    ): Promise<ToolResult<PreviewExportResult>> {
      const startTime = performance.now();

      try {
        const supabase = await createClient();

        // 获取预览数据
        let query = supabase
          .from("bookmarks")
          .select("*, folders(name)")
          .eq("user_id", context.userId)
          .not("platform", "in", '("CHROME","EDGE","FIREFOX","SAFARI")')
          .order("created_at", { ascending: false })
          .limit(params.previewCount);

        if (params.bookmarkIds?.length) {
          query = supabase
            .from("bookmarks")
            .select("*, folders(name)")
            .eq("user_id", context.userId)
            .in("id", params.bookmarkIds)
            .limit(params.previewCount);
        }

        const { data: bookmarks, error } = await query;

        if (error) throw error;
        if (!bookmarks?.length) {
          return {
            success: false,
            error: "没有可预览的书签",
          };
        }

        // 生成预览内容
        let previewContent: string;

        switch (params.format) {
          case "csv":
            const csvFormatter = new CsvFormatter();
            previewContent = csvFormatter.generatePreview(
              bookmarks as BookmarkWithFolder[],
              params.previewCount,
            );
            break;
          case "markdown":
            const mdFormatter = new MarkdownFormatter();
            previewContent = mdFormatter.generatePreview(
              bookmarks as BookmarkWithFolder[],
              params.previewCount,
            );
            break;
          case "obsidian":
            const obsFormatter = new ObsidianFormatter();
            previewContent = obsFormatter.generatePreview(
              bookmarks as BookmarkWithFolder[],
              params.previewCount,
            );
            break;
          case "json":
            previewContent = JSON.stringify(
              bookmarks.slice(0, params.previewCount).map((b) => ({
                title: b.title,
                url: b.url,
                platform: b.platform,
                folder: b.folders?.name,
                aiTags: b.ai_tags,
                createdAt: b.created_at,
              })),
              null,
              2,
            );
            break;
          case "html":
            previewContent = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>AnyKeep Bookmarks</TITLE>
<H1>AnyKeep Bookmarks</H1>
<DL><p>
${bookmarks
  .slice(0, params.previewCount)
  .map((b) => `    <DT><A HREF="${b.url}">${b.title || "无标题"}</A>`)
  .join("\n")}
</DL><p>`;
            break;
          default:
            previewContent = "不支持的格式";
        }

        return {
          success: true,
          data: {
            format: params.format,
            previewContent,
            bookmarkCount: bookmarks.length,
            message: `以下是 ${params.format.toUpperCase()} 格式的预览（${bookmarks.length} 条）`,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "预览失败",
        };
      }
    },
  };
```

### 3.4 list_export_formats Tool

```typescript
// src/lib/ai-agent/tools/export/list-export-formats.tool.ts

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { EXPORT_FORMAT_CONFIG } from "@/lib/export/constants";

const paramsSchema = z.object({});

interface FormatInfo {
  format: string;
  label: string;
  description: string;
  extension: string;
  bestFor: string;
}

interface ListExportFormatsResult {
  formats: FormatInfo[];
  recommendation: {
    forExcel: string;
    forObsidian: string;
    forNotion: string;
    forBackup: string;
    forBrowserImport: string;
  };
  message: string;
}

export const listExportFormatsTool: Tool<
  z.infer<typeof paramsSchema>,
  ListExportFormatsResult
> = {
  definition: {
    name: "list_export_formats",
    description: `列出所有可用的导出格式及其说明。

**使用场景：**
- 用户问"有哪些导出格式"
- 用户问"怎么导出到 Obsidian"
- 用户问"哪种格式适合备份"`,
    parameters: paramsSchema,
    category: "query",
  },

  async execute(): Promise<ToolResult<ListExportFormatsResult>> {
    const formats: FormatInfo[] = [
      {
        format: "csv",
        label: EXPORT_FORMAT_CONFIG.csv.label,
        description: EXPORT_FORMAT_CONFIG.csv.description,
        extension: "csv",
        bestFor: "Excel 分析、数据统计、批量处理",
      },
      {
        format: "markdown",
        label: EXPORT_FORMAT_CONFIG.markdown.label,
        description: EXPORT_FORMAT_CONFIG.markdown.description,
        extension: "md",
        bestFor: "Notion、Typora、简单笔记",
      },
      {
        format: "obsidian",
        label: EXPORT_FORMAT_CONFIG.obsidian.label,
        description: EXPORT_FORMAT_CONFIG.obsidian.description,
        extension: "md",
        bestFor: "Obsidian 单文件导入、带元数据",
      },
      {
        format: "obsidian-zip",
        label: EXPORT_FORMAT_CONFIG["obsidian-zip"].label,
        description: EXPORT_FORMAT_CONFIG["obsidian-zip"].description,
        extension: "zip",
        bestFor: "Obsidian 批量导入、双链引用",
      },
      {
        format: "json",
        label: EXPORT_FORMAT_CONFIG.json.label,
        description: EXPORT_FORMAT_CONFIG.json.description,
        extension: "json",
        bestFor: "数据备份、程序处理、API 集成",
      },
      {
        format: "html",
        label: EXPORT_FORMAT_CONFIG.html.label,
        description: EXPORT_FORMAT_CONFIG.html.description,
        extension: "html",
        bestFor: "Chrome/Edge/Firefox/Safari 书签导入",
      },
    ];

    return {
      success: true,
      data: {
        formats,
        recommendation: {
          forExcel: "csv",
          forObsidian: "obsidian-zip",
          forNotion: "markdown",
          forBackup: "json",
          forBrowserImport: "html",
        },
        message: `支持 ${formats.length} 种导出格式。Excel 用户推荐 CSV，Obsidian 用户推荐 obsidian-zip，备份推荐 JSON。`,
      },
    };
  },
};
```

### 3.5 导出 Tools 索引

```typescript
// src/lib/ai-agent/tools/export/index.ts

/**
 * 导出相关 Tools
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import type { Tool } from "../types";
import { exportBookmarksTool } from "./export-bookmarks.tool";
import { previewExportTool } from "./preview-export.tool";
import { listExportFormatsTool } from "./list-export-formats.tool";

/**
 * 导出 Tools 集合
 */
export const exportTools: Tool[] = [
  exportBookmarksTool,
  previewExportTool,
  listExportFormatsTool,
];

export { exportBookmarksTool, previewExportTool, listExportFormatsTool };
```

---

## 四、集成到现有 AI Skills 系统

### 4.1 修改 tools/index.ts

```typescript
// src/lib/ai-agent/tools/index.ts (修改)

// ... 现有导入 ...

// ✅ 新增：导出 Tools
export * from "./export";

import { toolRegistry } from "./tool-registry";
import { queryTools } from "./query";
import { readTools } from "./read";
import { searchTools } from "./search";
import { actionTools } from "./action";
import { smartListTools } from "./smart-list";
import { exportTools } from "./export"; // ✅ 新增

/**
 * 注册所有默认 Tools
 */
export function registerDefaultTools(): void {
  toolRegistry.registerAll(queryTools);
  toolRegistry.registerAll(readTools);
  toolRegistry.registerAll(searchTools);
  toolRegistry.registerAll(actionTools);
  toolRegistry.registerAll(smartListTools);
  toolRegistry.registerAll(exportTools); // ✅ 新增
}
```

### 4.2 更新系统提示词

```typescript
// src/lib/ai-agent/core/knowledge-agent.ts (更新 DEFAULT_SYSTEM_PROMPT)

const DEFAULT_SYSTEM_PROMPT = `你是 AnyKeep 的 AI 知识助手，帮助用户管理收藏的内容。

## 工作方式

用户说什么，你就做什么。直接行动，少说废话。

## 可用工具

### 列表类
- list_recent(limit?) → 获取最近收藏，默认 10 条
- list_by_folder(folder_id, limit?) → 获取某文件夹的收藏
- list_by_platform(platform, limit?) → 获取某平台的收藏

### 统计类
- count_total() → 统计收藏总数
- count_by_folder(folder_id) → 统计某文件夹数量
- count_by_platform(platform) → 统计某平台数量
- get_stats() → 详细统计

### 搜索类
- search_bookmarks(query, limit?) → 搜索收藏内容

### 阅读类
- read_bookmark(bookmark_id) → 读取单个书签详情

### 智能列表类
- list_smart_lists(includePresets?, includeCounts?) → 获取智能列表
- get_smart_list_items(smartListId, limit?, offset?) → 获取列表内容
- get_smart_list_count(smartListId) → 获取列表计数

### 批量操作类
- batch_tags(bookmark_ids, tags, action) → 批量添加/移除标签
- move_bookmarks(bookmark_ids, folder_id) → 批量移动

### ⭐ 导出类（新增）
- export_bookmarks(format, filter?, bookmarkIds?, options?) → 导出书签
- preview_export(format, bookmarkIds?, previewCount?) → 预览导出内容
- list_export_formats() → 列出可用格式

## 导出快捷指令

| 用户说的话 | 对应操作 |
|----------|---------|
| 导出到 CSV / 导出到 Excel | export_bookmarks(format: "csv") |
| 导出微信文章 | export_bookmarks(format: "markdown", filter: { platforms: ["WECHAT"] }) |
| 导出到 Obsidian | export_bookmarks(format: "obsidian-zip") |
| 导出最近一周的 | export_bookmarks(filter: { dateRange: 最近7天 }) |
| 有哪些导出格式 | list_export_formats() |
| 导出后长什么样 | preview_export(format) |
| 导出这几个书签 | export_bookmarks(bookmarkIds: [...]) |

## 格式推荐

| 场景 | 推荐格式 |
|------|---------|
| Excel 分析 | csv |
| Obsidian 导入 | obsidian-zip |
| Notion 导入 | markdown |
| 数据备份 | json |
| 浏览器导入 | html |

## 使用示例

用户: "导出我的微信收藏到 Markdown"
→ 调用 export_bookmarks(format: "markdown", filter: { platforms: ["WECHAT"] })
→ 显示确认对话框
→ 用户确认后执行
→ 回复: "已导出 45 条微信文章到 Markdown 格式"

用户: "有哪些导出格式"
→ 调用 list_export_formats()
→ 回复格式列表和推荐

用户: "帮我把技术文章导出到 Obsidian"
→ 调用 export_bookmarks(format: "obsidian-zip", filter: { tags: ["技术", "编程", "开发"] })
`;
```

---

## 五、前端页面集成

### 5.1 集成点概览

| 集成点   | 文件                     | 功能                     |
| -------- | ------------------------ | ------------------------ |
| AI 面板  | `ai-assistant-panel.tsx` | 显示导出确认和结果       |
| AI 消息  | `ai-message.tsx`         | 渲染导出结果（下载链接） |
| 导出页面 | `export/page.tsx`        | 添加 AI 助手入口         |
| 首页     | `home-page-client.tsx`   | 批量选择后 AI 导出       |

### 5.2 AI 消息组件增强

```typescript
// src/components/ai/ai-message.tsx (增强)

import { Download, FileText, FileSpreadsheet, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";

// 在 AIMessage 组件中添加导出结果渲染

function ExportResultCard({ result }: { result: ExportBookmarksResult }) {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    csv: FileSpreadsheet,
    markdown: FileText,
    obsidian: FileText,
    "obsidian-zip": FileArchive,
    json: FileJson,
    html: FileCode,
  };

  const Icon = iconMap[result.format] || FileText;

  return (
    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mt-2">
      <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{result.filename}</p>
        <p className="text-xs text-muted-foreground">
          {result.count} 条书签 · {result.sizeFormatted}
        </p>
      </div>
      {result.downloadUrl && (
        <Button size="sm" asChild>
          <a href={result.downloadUrl} download>
            <Download className="size-4 mr-1" />
            下载
          </a>
        </Button>
      )}
    </div>
  );
}

// 在消息渲染中检测导出结果
{message.toolCalls?.map((toolCall) => {
  if (toolCall.toolName === "export_bookmarks" && toolCall.result?.success) {
    return (
      <ExportResultCard
        key={toolCall.id}
        result={toolCall.result.data}
      />
    );
  }
  // ... 其他工具调用渲染
})}
```

### 5.3 导出页面 AI 入口

```typescript
// src/app/(main)/export/page.tsx (增强)

import { AIAssistantButton } from "@/components/ai";

export default function ExportPage() {
  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">数据导出</h1>
          <p className="text-muted-foreground">导出你的收藏到多种格式</p>
        </div>

        {/* ✅ 新增 AI 助手入口 */}
        <AIAssistantButton
          userId={userId}
          variant="outline"
          size="default"
        />
      </div>

      {/* 现有导出界面 */}
      <ExportPageClient />

      {/* ✅ AI 快捷导出提示 */}
      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          💡 提示：你可以用 AI 助手快速导出，比如说 &ldquo;导出微信文章到 Obsidian&rdquo;
        </p>
      </div>
    </div>
  );
}
```

### 5.4 首页批量操作集成

```typescript
// src/components/home/home-batch-toolbar.tsx (增强)

import { Download } from "lucide-react";

// 在批量操作工具栏添加 AI 导出选项
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm">
      <Download className="size-4 mr-1" />
      导出
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => openExportDialog("csv")}>
      导出为 CSV
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => openExportDialog("markdown")}>
      导出为 Markdown
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    {/* ✅ 新增 AI 导出入口 */}
    <DropdownMenuItem onClick={() => {
      setAiPanelOpen(true);
      // 预填充消息
      setAiInitialMessage(`导出这 ${selectedIds.length} 个书签`);
    }}>
      <Sparkles className="size-4 mr-2" />
      AI 智能导出
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 5.5 AI 助手快捷操作

```typescript
// src/components/ai/ai-quick-actions.tsx (增强)

// 新增导出相关快捷操作
const EXPORT_QUICK_ACTIONS = [
  {
    id: "export-csv",
    label: "导出到 Excel",
    icon: FileSpreadsheet,
    prompt: "导出我的收藏到 CSV 格式",
  },
  {
    id: "export-obsidian",
    label: "导出到 Obsidian",
    icon: FileText,
    prompt: "导出收藏到 Obsidian ZIP 格式",
  },
  {
    id: "export-recent",
    label: "导出最近收藏",
    icon: Clock,
    prompt: "导出最近一周的收藏到 Markdown",
  },
  {
    id: "list-formats",
    label: "查看导出格式",
    icon: HelpCircle,
    prompt: "有哪些导出格式？各自适合什么场景？",
  },
];
```

---

## 六、API 路由（可选）

如果需要支持大文件下载，可添加专用 API 路由：

```typescript
// src/app/api/export/download/[filename]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } },
) {
  const supabase = await createClient();

  // 验证用户权限
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 从临时存储获取文件
  // TODO: 实现文件存储和检索逻辑

  return new NextResponse(fileContent, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${params.filename}"`,
    },
  });
}
```

---

## 七、使用场景示例

### 7.1 简单导出

```
用户: 导出我的收藏到 Excel
AI: [调用 export_bookmarks(format: "csv")]
    [显示确认对话框：导出 234 条书签到 CSV]
用户: [点击确认]
AI: ✅ 已导出 234 条书签到 CSV 格式，文件大小 45 KB
    [下载按钮]
```

### 7.2 带筛选导出

```
用户: 把微信文章导出成 Markdown
AI: [调用 export_bookmarks(format: "markdown", filter: { platforms: ["WECHAT"] })]
    [显示确认对话框：导出 89 条微信文章]
用户: [点击确认]
AI: ✅ 已导出 89 条微信文章到 Markdown 格式
```

### 7.3 查询格式

```
用户: 有哪些导出格式？
AI: [调用 list_export_formats()]
    支持以下 6 种导出格式：

    | 格式 | 适用场景 |
    |------|----------|
    | CSV | Excel 分析、数据统计 |
    | Markdown | Notion、Typora 笔记 |
    | Obsidian | 带元数据的 Markdown |
    | Obsidian ZIP | 每条书签独立文件 |
    | JSON | 数据备份、程序处理 |
    | HTML | 浏览器书签导入 |

    推荐：Excel 用 CSV，Obsidian 用 obsidian-zip
```

### 7.4 预览格式

````
用户: 导出后长什么样？
AI: [调用 preview_export(format: "markdown")]
    以下是 Markdown 格式的预览：

    ```markdown
    ## 深入理解 React Hooks

    - 来源：微信公众号
    - 时间：2024-01-15
    - 标签：React, 前端, 技术

    > AI 摘要：本文详细介绍了 React Hooks 的使用方法...
    ```
````

---

## 八、实施计划

### 8.1 阶段划分

| 阶段        | 内容                                          | 工时 | 优先级 |
| ----------- | --------------------------------------------- | ---- | ------ |
| **Phase 1** | 创建 export Tools 目录结构                    | 0.5h | P0     |
| **Phase 2** | 实现 `export_bookmarks` Tool                  | 2h   | P0     |
| **Phase 3** | 实现 `preview_export` / `list_export_formats` | 1.5h | P0     |
| **Phase 4** | 注册到 `registerDefaultTools`                 | 0.5h | P0     |
| **Phase 5** | 更新系统提示词                                | 0.5h | P0     |
| **Phase 6** | AI 消息组件增强（下载链接）                   | 1h   | P1     |
| **Phase 7** | 导出页面 AI 入口                              | 0.5h | P1     |
| **Phase 8** | 首页批量操作集成                              | 1h   | P2     |
| **Phase 9** | 端到端测试                                    | 1.5h | P0     |

**总计**: ~9 小时

### 8.2 文件清单

```
新增文件：
src/lib/ai-agent/tools/export/
├── index.ts                      # 导出
├── export-bookmarks.tool.ts      # 核心导出 Tool
├── preview-export.tool.ts        # 预览 Tool
└── list-export-formats.tool.ts   # 格式列表 Tool

修改文件：
├── src/lib/ai-agent/tools/index.ts           # 注册 exportTools
├── src/lib/ai-agent/core/knowledge-agent.ts  # 更新系统提示词
├── src/components/ai/ai-message.tsx          # 渲染导出结果
├── src/app/(main)/export/page.tsx            # AI 入口（可选）
└── src/components/home/home-batch-toolbar.tsx # AI 导出（可选）
```

---

## 九、成功标准

### 9.1 功能验收

- [ ] "导出到 CSV" → 正确调用 export_bookmarks(format: "csv")
- [ ] "导出微信文章" → 正确识别平台筛选
- [ ] "有哪些导出格式" → 返回格式列表
- [ ] "导出后长什么样" → 返回格式预览
- [ ] 导出操作显示确认对话框
- [ ] 确认后正确执行导出并返回下载链接

### 9.2 性能指标

| 指标               | 目标    |
| ------------------ | ------- |
| 格式列表查询       | < 100ms |
| 预览生成           | < 500ms |
| 导出执行（1000条） | < 5s    |
| 确认对话框显示     | < 200ms |

---

## 十、风险与缓解

| 风险            | 影响 | 缓解措施                           |
| --------------- | ---- | ---------------------------------- |
| 大文件内存溢出  | 高   | 使用流式处理，限制单次导出数量     |
| AI 误解导出意图 | 中   | 明确的系统提示词，确认机制         |
| 下载链接过期    | 低   | 设置合理过期时间，支持重新生成     |
| 格式化错误      | 低   | 复用现有 ExportService，已充分测试 |

---

**文档版本**: 1.0.0
**创建日期**: 2025-12-23
**状态**: 待审核
**作者**: BMad Master
