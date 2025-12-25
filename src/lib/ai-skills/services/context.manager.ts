/**
 * ContextManager - AI 上下文管理器
 *
 * 职责：
 * - 管理 AI 对话的上下文引用（书签、文件夹、标签等）
 * - 解析和验证上下文引用
 * - 提供上下文数据给 AI 处理
 * - 从会话记忆获取前次输出
 *
 * @version 1.1.0
 * @since 2025-12-25
 */

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { sessionMemory } from "@/lib/ai-memory/session-memory";
import type {
  ContextItem,
  ContextItemType,
  ContextItemData,
  BookmarkContextData,
  FolderContextData,
  TagContextData,
  SearchResultsContextData,
  PreviousOutputContextData,
} from "@/components/ai/phase4/types";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 上下文引用（用于 API 请求）
 */
export interface ContextReferences {
  bookmarkIds?: number[];
  folderIds?: number[];
  tagNames?: string[];
  previousOutputId?: string;
  searchQuery?: string;
}

/**
 * 解析后的上下文数据
 */
export interface ResolvedContext {
  items: ContextItem[];
  bookmarks: BookmarkContextData[];
  folders: FolderContextData[];
  tags: TagContextData[];
  previousOutput?: PreviousOutputContextData;
  searchResults?: SearchResultsContextData;
}

/**
 * 上下文摘要（用于 AI prompt）
 */
export interface ContextSummary {
  hasContext: boolean;
  bookmarkCount: number;
  folderCount: number;
  tagCount: number;
  hasPreviousOutput: boolean;
  hasSearchResults: boolean;
  description: string;
}

/**
 * 服务响应
 */
export interface ContextServiceResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// ContextManager 类
// =============================================================================

export class ContextManager {
  /**
   * 解析上下文引用
   *
   * 将上下文引用 ID 解析为完整的上下文数据
   */
  async resolveContext(
    references: ContextReferences,
  ): Promise<ContextServiceResponse<ResolvedContext>> {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      const result: ResolvedContext = {
        items: [],
        bookmarks: [],
        folders: [],
        tags: [],
      };

      // 并行解析各类上下文
      const [bookmarksResult, foldersResult, tagsResult] = await Promise.all([
        this.resolveBookmarks(supabase, user.id, references.bookmarkIds),
        this.resolveFolders(supabase, user.id, references.folderIds),
        this.resolveTags(supabase, user.id, references.tagNames),
      ]);

      if (bookmarksResult.success && bookmarksResult.data) {
        result.bookmarks = bookmarksResult.data;
        result.items.push(
          ...bookmarksResult.data.map((b) =>
            this.createContextItem("bookmark", b),
          ),
        );
      }

      if (foldersResult.success && foldersResult.data) {
        result.folders = foldersResult.data;
        result.items.push(
          ...foldersResult.data.map((f) => this.createContextItem("folder", f)),
        );
      }

      if (tagsResult.success && tagsResult.data) {
        result.tags = tagsResult.data;
        result.items.push(
          ...tagsResult.data.map((t) => this.createContextItem("tag", t)),
        );
      }

      // 解析搜索结果（如果有搜索查询）
      if (references.searchQuery) {
        const searchResult = await this.resolveSearchResults(
          supabase,
          user.id,
          references.searchQuery,
        );
        if (searchResult.success && searchResult.data) {
          result.searchResults = searchResult.data;
          result.items.push(
            this.createContextItem("search_results", searchResult.data),
          );
        }
      }

      // 解析前次输出（如果有）
      if (references.previousOutputId) {
        const prevResult = await this.resolvePreviousOutput(
          references.previousOutputId,
        );
        if (prevResult.success && prevResult.data) {
          result.previousOutput = prevResult.data;
          result.items.push(
            this.createContextItem("previous_output", prevResult.data),
          );
        }
      }

      logger.info(
        {
          bookmarkCount: result.bookmarks.length,
          folderCount: result.folders.length,
          tagCount: result.tags.length,
          hasSearch: !!result.searchResults,
          hasPrevious: !!result.previousOutput,
        },
        "ContextManager: Context resolved",
      );

      return { success: true, data: result };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "ContextManager: Resolve context failed",
      );
      return { success: false, error: "解析上下文失败" };
    }
  }

  /**
   * 生成上下文摘要（用于 AI prompt）
   */
  generateSummary(context: ResolvedContext): ContextSummary {
    const parts: string[] = [];

    if (context.bookmarks.length > 0) {
      parts.push(`${context.bookmarks.length} 个书签`);
    }

    if (context.folders.length > 0) {
      const folderNames = context.folders.map((f) => f.name).join("、");
      parts.push(`文件夹: ${folderNames}`);
    }

    if (context.tags.length > 0) {
      const tagNames = context.tags.map((t) => `#${t.name}`).join(" ");
      parts.push(`标签: ${tagNames}`);
    }

    if (context.searchResults) {
      parts.push(`搜索"${context.searchResults.query}"的结果`);
    }

    if (context.previousOutput) {
      parts.push("上一轮对话的回答");
    }

    return {
      hasContext: context.items.length > 0,
      bookmarkCount: context.bookmarks.length,
      folderCount: context.folders.length,
      tagCount: context.tags.length,
      hasPreviousOutput: !!context.previousOutput,
      hasSearchResults: !!context.searchResults,
      description:
        parts.length > 0 ? `用户引用了: ${parts.join(", ")}` : "无特定上下文",
    };
  }

  /**
   * 生成用于 AI 的上下文文本
   */
  generateContextText(context: ResolvedContext): string {
    const sections: string[] = [];

    // 书签上下文
    if (context.bookmarks.length > 0) {
      const bookmarkList = context.bookmarks
        .map((b) => {
          let text = `- ${b.title}`;
          if (b.url) text += ` (${b.url})`;
          if (b.summary) text += `\n  摘要: ${b.summary}`;
          return text;
        })
        .join("\n");
      sections.push(`## 引用的书签\n${bookmarkList}`);
    }

    // 文件夹上下文
    if (context.folders.length > 0) {
      const folderList = context.folders
        .map((f) => `- ${f.name} (${f.bookmarkCount} 个书签)`)
        .join("\n");
      sections.push(`## 引用的文件夹\n${folderList}`);
    }

    // 标签上下文
    if (context.tags.length > 0) {
      const tagList = context.tags
        .map(
          (t) =>
            `- #${t.name}${t.bookmarkCount ? ` (${t.bookmarkCount} 个书签)` : ""}`,
        )
        .join("\n");
      sections.push(`## 引用的标签\n${tagList}`);
    }

    // 搜索结果上下文
    if (context.searchResults) {
      const resultList = context.searchResults.results
        .slice(0, 5) // 限制数量
        .map((r) => `- ${r.title}`)
        .join("\n");
      sections.push(
        `## 搜索"${context.searchResults.query}"的结果\n${resultList}`,
      );
    }

    // 前次输出上下文
    if (context.previousOutput) {
      sections.push(
        `## 上一轮回答\n${context.previousOutput.content.slice(0, 500)}...`,
      );
    }

    return sections.join("\n\n");
  }

  /**
   * 验证上下文引用是否有效
   */
  async validateReferences(
    references: ContextReferences,
  ): Promise<ContextServiceResponse<{ valid: boolean; errors: string[] }>> {
    const errors: string[] = [];

    if (references.bookmarkIds && references.bookmarkIds.length > 100) {
      errors.push("书签引用数量不能超过 100 个");
    }

    if (references.folderIds && references.folderIds.length > 10) {
      errors.push("文件夹引用数量不能超过 10 个");
    }

    if (references.tagNames && references.tagNames.length > 20) {
      errors.push("标签引用数量不能超过 20 个");
    }

    return {
      success: true,
      data: {
        valid: errors.length === 0,
        errors,
      },
    };
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 解析书签引用
   */
  private async resolveBookmarks(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    bookmarkIds?: number[],
  ): Promise<ContextServiceResponse<BookmarkContextData[]>> {
    if (!bookmarkIds || bookmarkIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, ai_summary, platform, created_at")
      .eq("user_id", userId)
      .in("id", bookmarkIds);

    if (error) {
      logger.error({ error }, "ContextManager: Failed to resolve bookmarks");
      return { success: false, error: "获取书签失败" };
    }

    const bookmarks: BookmarkContextData[] = (data || []).map((b) => ({
      type: "bookmark",
      id: b.id,
      title: b.title,
      url: b.url,
      summary: b.ai_summary ?? undefined,
      platform: b.platform,
      createdAt: b.created_at ? new Date(b.created_at) : undefined,
    }));

    return { success: true, data: bookmarks };
  }

  /**
   * 解析文件夹引用
   */
  private async resolveFolders(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    folderIds?: number[],
  ): Promise<ContextServiceResponse<FolderContextData[]>> {
    if (!folderIds || folderIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .in("id", folderIds);

    if (error) {
      logger.error({ error }, "ContextManager: Failed to resolve folders");
      return { success: false, error: "获取文件夹失败" };
    }

    // 获取每个文件夹的书签数量
    const folders: FolderContextData[] = await Promise.all(
      (data || []).map(async (f) => {
        const { count } = await supabase
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("folder_id", f.id);

        return {
          type: "folder" as const,
          id: f.id,
          name: f.name,
          bookmarkCount: count || 0,
        };
      }),
    );

    return { success: true, data: folders };
  }

  /**
   * 解析标签引用
   */
  private async resolveTags(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    tagNames?: string[],
  ): Promise<ContextServiceResponse<TagContextData[]>> {
    if (!tagNames || tagNames.length === 0) {
      return { success: true, data: [] };
    }

    // 获取每个标签的书签数量
    const tags: TagContextData[] = await Promise.all(
      tagNames.map(async (name) => {
        const { count } = await supabase
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .contains("tags", [name]);

        return {
          type: "tag" as const,
          name,
          bookmarkCount: count || 0,
        };
      }),
    );

    return { success: true, data: tags };
  }

  /**
   * 解析搜索结果
   */
  private async resolveSearchResults(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    query: string,
  ): Promise<ContextServiceResponse<SearchResultsContextData>> {
    const { data, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, ai_summary, platform, created_at")
      .eq("user_id", userId)
      .or(`title.ilike.%${query}%,ai_summary.ilike.%${query}%`)
      .limit(10);

    if (error) {
      logger.error(
        { error },
        "ContextManager: Failed to resolve search results",
      );
      return { success: false, error: "搜索失败" };
    }

    const results: BookmarkContextData[] = (data || []).map((b) => ({
      type: "bookmark",
      id: b.id,
      title: b.title,
      url: b.url,
      summary: b.ai_summary ?? undefined,
      platform: b.platform,
      createdAt: b.created_at ? new Date(b.created_at) : undefined,
    }));

    return {
      success: true,
      data: {
        type: "search_results",
        query,
        results,
      },
    };
  }

  /**
   * 解析前次输出
   *
   * 支持两种模式：
   * 1. conversationId 模式：从会话记忆获取最近输出
   * 2. messageId 模式：搜索会话历史中的特定消息
   *
   * @param identifier - 会话 ID 或消息 ID
   */
  private async resolvePreviousOutput(
    identifier: string,
  ): Promise<ContextServiceResponse<PreviousOutputContextData>> {
    try {
      // 方式 1：尝试作为 conversationId 获取最近输出
      const lastOutput = sessionMemory.getLastOutput(identifier);

      if (lastOutput) {
        const content = lastOutput.fullContent || lastOutput.summary;
        const preview =
          content.length > 100 ? content.slice(0, 97) + "..." : content;

        logger.debug(
          {
            conversationId: identifier,
            outputType: lastOutput.type,
            hasFullContent: !!lastOutput.fullContent,
          },
          "ContextManager: Resolved previous output from session memory",
        );

        return {
          success: true,
          data: {
            type: "previous_output",
            messageId: lastOutput.sourceMessageId || identifier,
            preview,
            content,
          },
        };
      }

      // 方式 2：尝试作为 messageId 搜索所有会话
      const allSessionIds = sessionMemory.getAllSessionIds();

      for (const sessionId of allSessionIds) {
        const messages = sessionMemory.getRecentMessages(sessionId);
        const targetMessage = messages.find(
          (m) => m.id === identifier && m.role === "assistant",
        );

        if (targetMessage) {
          const preview =
            targetMessage.content.length > 100
              ? targetMessage.content.slice(0, 97) + "..."
              : targetMessage.content;

          logger.debug(
            {
              messageId: identifier,
              sessionId,
            },
            "ContextManager: Resolved previous output from message history",
          );

          return {
            success: true,
            data: {
              type: "previous_output",
              messageId: identifier,
              preview,
              content: targetMessage.content,
            },
          };
        }
      }

      // 未找到匹配的输出
      logger.warn({ identifier }, "ContextManager: Previous output not found");

      return {
        success: false,
        error: "未找到指定的前次输出",
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "ContextManager: Resolve previous output failed",
      );
      return {
        success: false,
        error: "解析前次输出失败",
      };
    }
  }

  /**
   * 创建上下文项
   *
   * 将上下文数据转换为 ContextItem（匹配 phase4/types.ts）
   */
  private createContextItem(
    type: ContextItemType,
    data: ContextItemData,
  ): ContextItem {
    // 根据类型生成标题和描述
    const { title, description } = this.getContextItemDisplay(type, data);

    return {
      id: `ctx_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type,
      title,
      description,
      metadata: {
        ...data,
        addedAt: new Date().toISOString(),
        addedBy: "user",
      },
    };
  }

  /**
   * 获取上下文项的显示信息
   */
  private getContextItemDisplay(
    type: ContextItemType,
    data: ContextItemData,
  ): { title: string; description?: string } {
    switch (type) {
      case "bookmark": {
        const bookmarkData = data as BookmarkContextData;
        return {
          title: bookmarkData.title,
          description: bookmarkData.summary ?? bookmarkData.url,
        };
      }
      case "folder": {
        const folderData = data as FolderContextData;
        return {
          title: folderData.name,
          description: `${folderData.bookmarkCount} 个书签`,
        };
      }
      case "tag": {
        const tagData = data as TagContextData;
        return {
          title: tagData.name,
          description: tagData.bookmarkCount
            ? `${tagData.bookmarkCount} 个书签`
            : undefined,
        };
      }
      case "search_results": {
        const searchData = data as SearchResultsContextData;
        return {
          title: `搜索: ${searchData.query}`,
          description: `${searchData.results.length} 个结果`,
        };
      }
      case "previous_output": {
        const outputData = data as PreviousOutputContextData;
        return {
          title: "前次输出",
          description: outputData.preview,
        };
      }
      default:
        return { title: "未知上下文" };
    }
  }
}

// =============================================================================
// 工厂函数和默认实例
// =============================================================================

/**
 * 创建上下文管理器实例
 */
export function createContextManager(): ContextManager {
  return new ContextManager();
}

/**
 * 默认上下文管理器实例
 */
export const contextManager = new ContextManager();
