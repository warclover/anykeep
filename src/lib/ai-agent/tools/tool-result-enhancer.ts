/**
 * 工具结果增强器
 *
 * 增强工具执行结果，提供：
 * - 结果摘要和关键信息提取
 * - 错误分析和可操作的修复建议
 * - 下一步操作建议
 *
 * @version 1.1.0 - 修复 TypeScript 类型安全问题
 * @since 2025-12-26
 */

import type { ToolResult, ToolSuccessResult, ToolErrorResult } from "./types";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * 增强后的工具结果
 */
export interface EnhancedToolResult<T = unknown> {
  /** 原始结果 */
  original: ToolResult<T>;
  /** 结果摘要（简短描述） */
  summary: string;
  /** 关键信息提取 */
  keyInsights: string[];
  /** 下一步建议 */
  suggestedActions: SuggestedAction[];
  /** 错误分析（仅失败时） */
  errorAnalysis?: ErrorAnalysis;
}

/**
 * 建议的下一步操作
 */
export interface SuggestedAction {
  /** 操作描述 */
  description: string;
  /** 相关工具（如有） */
  relatedTool?: string;
  /** 操作优先级 */
  priority: "high" | "medium" | "low";
}

/**
 * 错误分析
 */
export interface ErrorAnalysis {
  /** 错误类型 */
  errorType: ErrorType;
  /** 可操作的错误说明 */
  actionableMessage: string;
  /** 可能的原因 */
  possibleCauses: string[];
  /** 修复建议 */
  fixSuggestions: string[];
  /** 是否可重试 */
  retryable: boolean;
}

/**
 * 错误类型
 */
export type ErrorType =
  | "validation" // 参数验证错误
  | "not_found" // 资源不存在
  | "unauthorized" // 权限不足
  | "duplicate" // 重复数据
  | "rate_limit" // 限流
  | "network" // 网络错误
  | "database" // 数据库错误
  | "timeout" // 超时
  | "unknown"; // 未知错误

// ============================================
// 类型守卫
// ============================================

/**
 * 检查是否为成功结果
 */
function isSuccessResult<T>(
  result: ToolResult<T>,
): result is ToolSuccessResult<T> {
  return result.success === true;
}

/**
 * 检查是否为错误结果
 */
function isErrorResult<T>(result: ToolResult<T>): result is ToolErrorResult {
  return result.success === false;
}

// ============================================
// 安全属性访问工具
// ============================================

/**
 * 安全获取对象属性
 */
function safeGet<R>(obj: unknown, key: string, defaultValue: R): R {
  if (obj && typeof obj === "object" && key in obj) {
    return (obj as Record<string, unknown>)[key] as R;
  }
  return defaultValue;
}

/**
 * 安全获取嵌套对象属性
 */
function safeGetNested<R>(obj: unknown, keys: string[], defaultValue: R): R {
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return defaultValue;
    }
  }
  return current as R;
}

/**
 * 安全获取数组
 */
function safeGetArray<T>(obj: unknown, key: string): T[] {
  const value = safeGet(obj, key, null);
  return Array.isArray(value) ? value : [];
}

// ============================================
// 错误分析配置
// ============================================

/**
 * 错误码到错误类型的映射
 */
const ERROR_CODE_TO_TYPE: Record<string, ErrorType> = {
  VALIDATION_ERROR: "validation",
  NOT_FOUND: "not_found",
  FOLDER_NOT_FOUND: "not_found",
  BOOKMARK_NOT_FOUND: "not_found",
  UNAUTHORIZED: "unauthorized",
  PERMISSION_DENIED: "unauthorized",
  DUPLICATE_URL: "duplicate",
  DUPLICATE_NAME: "duplicate",
  RATE_LIMIT: "rate_limit",
  TOO_MANY_REQUESTS: "rate_limit",
  NETWORK_ERROR: "network",
  DB_ERROR: "database",
  QUERY_ERROR: "database",
  TIMEOUT: "timeout",
  EXECUTION_ERROR: "unknown",
};

/**
 * 错误类型对应的分析模板
 */
const ERROR_ANALYSIS_TEMPLATES: Record<
  ErrorType,
  {
    possibleCauses: string[];
    fixSuggestions: string[];
    retryable: boolean;
  }
> = {
  validation: {
    possibleCauses: ["参数格式不正确", "参数值超出允许范围", "缺少必需参数"],
    fixSuggestions: [
      "检查参数格式是否正确",
      "确认参数值在允许范围内",
      "补充必需的参数",
    ],
    retryable: false,
  },
  not_found: {
    possibleCauses: [
      "指定的资源已被删除",
      "资源 ID 不正确",
      "资源不属于当前用户",
    ],
    fixSuggestions: [
      "确认资源 ID 是否正确",
      "尝试使用列表工具查找正确的资源",
      "检查资源是否已被删除",
    ],
    retryable: false,
  },
  unauthorized: {
    possibleCauses: ["资源不属于当前用户", "会话已过期", "权限不足"],
    fixSuggestions: [
      "确认操作的是自己的数据",
      "刷新页面重新登录",
      "检查权限设置",
    ],
    retryable: false,
  },
  duplicate: {
    possibleCauses: ["相同的 URL 已存在", "相同的名称已被使用"],
    fixSuggestions: [
      "使用搜索工具查找已存在的记录",
      "修改名称或 URL 后重试",
      "考虑更新现有记录而非创建新记录",
    ],
    retryable: false,
  },
  rate_limit: {
    possibleCauses: ["请求频率过高", "超出 API 配额"],
    fixSuggestions: ["等待几秒后重试", "减少请求频率", "分批处理大量数据"],
    retryable: true,
  },
  network: {
    possibleCauses: ["网络连接不稳定", "服务器暂时不可用"],
    fixSuggestions: ["检查网络连接", "稍后重试", "尝试刷新页面"],
    retryable: true,
  },
  database: {
    possibleCauses: ["数据库连接超时", "查询语句错误", "数据完整性约束"],
    fixSuggestions: ["稍后重试", "减少查询数据量", "检查数据是否符合要求"],
    retryable: true,
  },
  timeout: {
    possibleCauses: ["操作耗时过长", "数据量过大", "服务器繁忙"],
    fixSuggestions: ["减少处理的数据量", "分批处理", "稍后重试"],
    retryable: true,
  },
  unknown: {
    possibleCauses: ["未知的系统错误"],
    fixSuggestions: ["稍后重试", "如问题持续请联系支持"],
    retryable: true,
  },
};

// ============================================
// 工具摘要生成器（使用安全访问模式）
// ============================================

/**
 * 生成工具摘要
 */
function generateToolSummary(toolName: string, data: unknown): string | null {
  switch (toolName) {
    // Query 类工具
    case "list_recent": {
      const bookmarks = safeGetArray(data, "bookmarks");
      const total = safeGet(data, "total", 0);
      if (bookmarks.length === 0) {
        return "暂无收藏记录";
      }
      return `找到 ${bookmarks.length} 条最近收藏（共 ${total} 条）`;
    }

    case "count_total": {
      const total = safeGet(data, "total", 0);
      return `共有 ${total} 条收藏`;
    }

    case "list_by_folder": {
      const bookmarks = safeGetArray(data, "bookmarks");
      const folderName = safeGet(data, "folderName", "该文件夹");
      if (bookmarks.length === 0) {
        return `${folderName}暂无书签`;
      }
      return `${folderName}有 ${bookmarks.length} 条书签`;
    }

    case "list_by_platform": {
      const bookmarks = safeGetArray(data, "bookmarks");
      const platform = safeGet(data, "platform", "该平台");
      if (bookmarks.length === 0) {
        return `暂无来自${platform}的收藏`;
      }
      return `来自${platform}的收藏有 ${bookmarks.length} 条`;
    }

    case "get_stats": {
      const totalBookmarks = safeGetNested(
        data,
        ["overview", "totalBookmarks"],
        0,
      );
      const totalFolders = safeGetNested(data, ["overview", "totalFolders"], 0);
      const totalTags = safeGetNested(data, ["overview", "totalTags"], 0);
      return `收藏统计：${totalBookmarks} 条书签，${totalFolders} 个文件夹，${totalTags} 个标签`;
    }

    case "count_by_folder": {
      const folderName = safeGet(data, "folderName", null);
      const count = safeGet(data, "count", 0);
      return `${folderName || "该文件夹"}有 ${count} 条书签`;
    }

    case "count_by_platform": {
      const platform = safeGet(data, "platform", "该平台");
      const count = safeGet(data, "count", 0);
      return `来自${platform}的收藏有 ${count} 条`;
    }

    // Folder 类工具
    case "list_folders": {
      const folders = Array.isArray(data)
        ? data
        : safeGetArray(data, "folders");
      if (folders.length === 0) {
        return "暂无文件夹";
      }
      const totalBookmarks = folders.reduce(
        (sum: number, f: unknown) => sum + safeGet(f, "bookmarkCount", 0),
        0,
      );
      return `共 ${folders.length} 个文件夹，包含 ${totalBookmarks} 条书签`;
    }

    case "create_folder": {
      const name = safeGet(data, "name", "未命名");
      return `已创建文件夹「${name}」`;
    }

    case "delete_folder": {
      const name = safeGet(data, "name", null);
      const movedCount = safeGet(data, "movedCount", 0);
      return `已删除文件夹${name ? `「${name}」` : ""}，${movedCount} 条书签已移至未分类`;
    }

    case "rename_folder": {
      const oldName = safeGet(data, "oldName", "");
      const newName = safeGet(data, "newName", "");
      return `已将文件夹「${oldName}」重命名为「${newName}」`;
    }

    case "merge_folders": {
      const targetName = safeGet(data, "targetName", "");
      const mergedCount = safeGet(data, "mergedCount", 0);
      return `已合并到「${targetName}」，共移动 ${mergedCount} 条书签`;
    }

    case "split_folder": {
      const newFolders = safeGetArray(data, "newFolders");
      return `已拆分为 ${newFolders.length} 个新文件夹`;
    }

    // Bookmark 类工具
    case "create_bookmark": {
      const title = safeGet(data, "title", "未命名");
      const platform = safeGet(data, "platform", null);
      const platformText = platform ? `（来自 ${platform}）` : "";
      return `已收藏「${title}」${platformText}`;
    }

    case "delete_bookmark": {
      const title = safeGet(data, "title", "");
      return `已删除书签「${title}」`;
    }

    case "update_bookmark": {
      const title = safeGet(data, "title", "");
      const updatedFields = safeGetArray<string>(data, "updatedFields");
      const fields =
        updatedFields.length > 0 ? updatedFields.join("、") : "信息";
      return `已更新「${title}」的${fields}`;
    }

    case "toggle_bookmark_read": {
      const title = safeGet(data, "title", "");
      const isRead = safeGet(data, "isRead", false);
      const status = isRead ? "已读" : "未读";
      return `已将「${title}」标记为${status}`;
    }

    case "toggle_bookmark_starred": {
      const title = safeGet(data, "title", "");
      const isStarred = safeGet(data, "isStarred", false);
      const status = isStarred ? "已加星标" : "已取消星标";
      return `「${title}」${status}`;
    }

    case "batch_delete_bookmarks": {
      const deletedCount = safeGet(data, "deletedCount", 0);
      return `已删除 ${deletedCount} 条书签`;
    }

    case "read_bookmark": {
      const title = safeGet(data, "title", "");
      return `书签详情：「${title}」`;
    }

    // Search 类工具
    case "search": {
      const results = safeGetArray(data, "results");
      const query = safeGet(data, "query", "");
      if (results.length === 0) {
        return `未找到与「${query}」相关的结果`;
      }
      return `找到 ${results.length} 条与「${query}」相关的结果`;
    }

    case "semantic_search": {
      const results = safeGetArray(data, "results");
      const query = safeGet(data, "query", "");
      if (results.length === 0) {
        return `未找到与「${query}」语义相关的内容`;
      }
      const avgSimilarity =
        results.reduce(
          (sum: number, r: unknown) => sum + safeGet(r, "similarity", 0),
          0,
        ) / results.length || 0;
      return `找到 ${results.length} 条相关结果（平均相似度 ${Math.round(avgSimilarity * 100)}%）`;
    }

    default:
      return null;
  }
}

// ============================================
// 关键信息提取器
// ============================================

/**
 * 提取关键信息
 */
function extractToolInsights(toolName: string, data: unknown): string[] {
  switch (toolName) {
    case "list_recent": {
      const insights: string[] = [];
      const bookmarks = safeGetArray(data, "bookmarks");

      if (bookmarks.length > 0) {
        // 平台分布
        const platforms = new Set(
          bookmarks
            .map((b: unknown) => safeGet(b, "platform", null))
            .filter(Boolean),
        );
        if (platforms.size > 0) {
          insights.push(
            `涉及平台：${Array.from(platforms).slice(0, 3).join("、")}`,
          );
        }

        // 标签统计
        const allTags = bookmarks.flatMap((b: unknown) =>
          safeGetArray(b, "tags"),
        );
        const uniqueTags = new Set(allTags);
        if (uniqueTags.size > 0) {
          insights.push(`包含 ${uniqueTags.size} 个不同标签`);
        }
      }

      return insights;
    }

    case "get_stats": {
      const insights: string[] = [];

      const last7Days = safeGetNested(data, ["trends", "last7Days"], null);
      const last30Days = safeGetNested(data, ["trends", "last30Days"], null);

      if (last7Days !== null) {
        insights.push(`最近7天新增 ${last7Days} 条`);
      }
      if (last30Days !== null) {
        insights.push(`最近30天新增 ${last30Days} 条`);
      }

      const topTags = safeGetArray(data, "topTags");
      if (topTags.length > 0) {
        const topTag = topTags[0];
        const tagName = safeGet(topTag, "name", "");
        const tagCount = safeGet(topTag, "count", 0);
        insights.push(`最常用标签：${tagName}（${tagCount} 次）`);
      }

      return insights;
    }

    default:
      return [];
  }
}

// ============================================
// 下一步建议生成器
// ============================================

/**
 * 生成下一步建议
 */
function generateToolActions(
  toolName: string,
  data: unknown,
): SuggestedAction[] {
  switch (toolName) {
    case "list_recent": {
      const bookmarks = safeGetArray(data, "bookmarks");

      if (bookmarks.length === 0) {
        return [
          {
            description: "添加第一条收藏",
            relatedTool: "create_bookmark",
            priority: "high",
          },
        ];
      }
      return [
        {
          description: "搜索特定内容",
          relatedTool: "semantic_search",
          priority: "medium",
        },
        {
          description: "查看详细统计",
          relatedTool: "get_stats",
          priority: "low",
        },
      ];
    }

    case "get_stats": {
      const actions: SuggestedAction[] = [];
      const totalBookmarks = safeGetNested(
        data,
        ["overview", "totalBookmarks"],
        0,
      );

      if (totalBookmarks > 50) {
        actions.push({
          description: "整理未分类书签",
          relatedTool: "auto_classify_inbox",
          priority: "medium",
        });
      }

      actions.push({
        description: "导出收藏数据",
        relatedTool: "export_bookmarks",
        priority: "low",
      });

      return actions;
    }

    case "list_folders": {
      const folders = Array.isArray(data)
        ? data
        : safeGetArray(data, "folders");

      if (folders.length === 0) {
        return [
          {
            description: "创建第一个文件夹",
            relatedTool: "create_folder",
            priority: "high",
          },
        ];
      }
      return [
        {
          description: "查看文件夹内容",
          relatedTool: "get_folder_bookmarks",
          priority: "medium",
        },
      ];
    }

    case "create_folder":
      return [
        {
          description: "向文件夹添加书签",
          relatedTool: "move_bookmark",
          priority: "medium",
        },
      ];

    case "search": {
      const results = safeGetArray(data, "results");

      if (results.length === 0) {
        return [
          {
            description: "尝试语义搜索",
            relatedTool: "semantic_search",
            priority: "high",
          },
          {
            description: "浏览最近收藏",
            relatedTool: "list_recent",
            priority: "medium",
          },
        ];
      }
      return [];
    }

    case "semantic_search": {
      const results = safeGetArray(data, "results");

      if (results.length === 0) {
        return [
          {
            description: "尝试关键词搜索",
            relatedTool: "search",
            priority: "high",
          },
        ];
      }
      return [];
    }

    default:
      return [];
  }
}

// ============================================
// ToolResultEnhancer 类
// ============================================

/**
 * 工具结果增强器
 */
export class ToolResultEnhancer {
  /**
   * 增强工具执行结果
   */
  enhance<T>(toolName: string, result: ToolResult<T>): EnhancedToolResult<T> {
    const startTime = performance.now();

    try {
      if (isSuccessResult(result)) {
        return this.enhanceSuccess(toolName, result);
      } else if (isErrorResult(result)) {
        return this.enhanceError(toolName, result);
      } else {
        // 兜底处理
        return {
          original: result,
          summary: `${toolName} 执行完成`,
          keyInsights: [],
          suggestedActions: [],
        };
      }
    } finally {
      logger.debug(
        {
          toolName,
          success: result.success,
          enhancementTimeMs: Math.round(performance.now() - startTime),
        },
        "ToolResultEnhancer: enhanced",
      );
    }
  }

  /**
   * 增强成功结果
   */
  private enhanceSuccess<T>(
    toolName: string,
    result: ToolSuccessResult<T>,
  ): EnhancedToolResult<T> {
    const summary = this.generateSummary(toolName, result.data);
    const keyInsights = this.extractInsights(toolName, result.data);
    const suggestedActions = this.generateActions(toolName, result.data);

    return {
      original: result,
      summary,
      keyInsights,
      suggestedActions,
    };
  }

  /**
   * 增强错误结果
   */
  private enhanceError<T>(
    toolName: string,
    result: ToolErrorResult,
  ): EnhancedToolResult<T> {
    const errorAnalysis = this.analyzeError(result.error, result.errorCode);

    return {
      original: result as ToolResult<T>,
      summary: `操作失败：${errorAnalysis.actionableMessage}`,
      keyInsights: errorAnalysis.possibleCauses,
      suggestedActions: errorAnalysis.fixSuggestions.map((fix) => ({
        description: fix,
        priority: "high" as const,
      })),
      errorAnalysis,
    };
  }

  /**
   * 生成结果摘要
   */
  private generateSummary<T>(toolName: string, data: T): string {
    try {
      const summary = generateToolSummary(toolName, data);
      if (summary) {
        return summary;
      }
    } catch (e) {
      logger.warn(
        { toolName, error: e },
        "ToolResultEnhancer: summary generation failed",
      );
    }

    // 默认摘要
    return this.generateDefaultSummary(toolName, data);
  }

  /**
   * 生成默认摘要
   */
  private generateDefaultSummary<T>(toolName: string, data: T): string {
    // 尝试从数据中提取有意义的信息
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;

      // 检查常见的结果字段
      if (Array.isArray(obj)) {
        return `返回 ${obj.length} 条结果`;
      }
      if ("count" in obj && typeof obj.count === "number") {
        return `统计结果：${obj.count} 条`;
      }
      if ("total" in obj && typeof obj.total === "number") {
        return `统计结果：${obj.total} 条`;
      }
      if ("message" in obj && typeof obj.message === "string") {
        return obj.message;
      }
      if ("id" in obj) {
        return `操作成功（ID: ${obj.id}）`;
      }
    }

    return `${toolName} 执行成功`;
  }

  /**
   * 提取关键信息
   */
  private extractInsights<T>(toolName: string, data: T): string[] {
    try {
      return extractToolInsights(toolName, data);
    } catch (e) {
      logger.warn(
        { toolName, error: e },
        "ToolResultEnhancer: insight extraction failed",
      );
    }

    return [];
  }

  /**
   * 生成下一步建议
   */
  private generateActions<T>(toolName: string, data: T): SuggestedAction[] {
    try {
      return generateToolActions(toolName, data);
    } catch (e) {
      logger.warn(
        { toolName, error: e },
        "ToolResultEnhancer: action generation failed",
      );
    }

    return [];
  }

  /**
   * 分析错误
   */
  private analyzeError(error?: string, errorCode?: string): ErrorAnalysis {
    // 确定错误类型
    const errorType = this.determineErrorType(error, errorCode);

    // 获取模板
    const template = ERROR_ANALYSIS_TEMPLATES[errorType];

    // 生成可操作的错误消息
    const actionableMessage = this.generateActionableMessage(
      error,
      errorCode,
      errorType,
    );

    return {
      errorType,
      actionableMessage,
      possibleCauses: template.possibleCauses,
      fixSuggestions: template.fixSuggestions,
      retryable: template.retryable,
    };
  }

  /**
   * 确定错误类型
   */
  private determineErrorType(error?: string, errorCode?: string): ErrorType {
    // 优先使用错误码
    if (errorCode && ERROR_CODE_TO_TYPE[errorCode]) {
      return ERROR_CODE_TO_TYPE[errorCode];
    }

    // 从错误消息推断
    if (error) {
      const lowerError = error.toLowerCase();

      if (lowerError.includes("not found") || lowerError.includes("不存在")) {
        return "not_found";
      }
      if (
        lowerError.includes("unauthorized") ||
        lowerError.includes("permission") ||
        lowerError.includes("权限")
      ) {
        return "unauthorized";
      }
      if (
        lowerError.includes("duplicate") ||
        lowerError.includes("已存在") ||
        lowerError.includes("重复")
      ) {
        return "duplicate";
      }
      if (
        lowerError.includes("rate limit") ||
        lowerError.includes("too many") ||
        lowerError.includes("频繁")
      ) {
        return "rate_limit";
      }
      if (
        lowerError.includes("network") ||
        lowerError.includes("connection") ||
        lowerError.includes("网络")
      ) {
        return "network";
      }
      if (lowerError.includes("timeout") || lowerError.includes("超时")) {
        return "timeout";
      }
      if (
        lowerError.includes("validation") ||
        lowerError.includes("invalid") ||
        lowerError.includes("参数")
      ) {
        return "validation";
      }
    }

    return "unknown";
  }

  /**
   * 生成可操作的错误消息
   */
  private generateActionableMessage(
    _error?: string,
    _errorCode?: string,
    errorType?: ErrorType,
  ): string {
    // 根据错误类型生成友好消息
    const typeMessages: Record<ErrorType, string> = {
      validation: "参数格式不正确，请检查输入",
      not_found: "找不到指定的资源，可能已被删除",
      unauthorized: "没有权限执行此操作",
      duplicate: "数据已存在，无法重复创建",
      rate_limit: "请求过于频繁，请稍后重试",
      network: "网络连接出现问题，请检查网络",
      database: "数据操作失败，请稍后重试",
      timeout: "操作超时，请尝试减少数据量",
      unknown: "操作失败，请稍后重试",
    };

    return typeMessages[errorType || "unknown"];
  }
}

// ============================================
// 单例导出
// ============================================

/**
 * 全局工具结果增强器实例
 */
export const toolResultEnhancer = new ToolResultEnhancer();

/**
 * 增强工具结果的便捷函数
 */
export function enhanceToolResult<T>(
  toolName: string,
  result: ToolResult<T>,
): EnhancedToolResult<T> {
  return toolResultEnhancer.enhance(toolName, result);
}
