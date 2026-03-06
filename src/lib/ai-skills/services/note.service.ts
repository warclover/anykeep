/**
 * NoteService - AI 笔记服务
 *
 * 职责：
 * - 保存 AI 生成的内容（总结、萃取、复习笔记等）
 * - 管理笔记的 CRUD 操作
 * - 支持笔记搜索和关联
 *
 * @version 1.1.0
 * @since 2025-12-25
 *
 * 注意：ai_notes 表类型尚未生成，使用类型断言绕过检查
 * 运行 `npm run supabase:gen:types` 后可移除类型断言
 *
 * v1.1.0: 支持依赖注入 Supabase Client，服务器端 API 路由可传入 server client
 */

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  SaveNoteRequest,
  SaveNoteResponse,
} from "@/components/ai/phase4/types";

/**
 * Supabase Client 类型（兼容 server/client 两种 client）
 * 支持依赖注入，使服务在服务器端和客户端均可安全使用
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientLike = any;

// =============================================================================
// 类型定义
// =============================================================================

/**
 * ai_notes 表行类型（待生成后可删除）
 */
interface AINoteRow {
  id: string;
  user_id: string;
  source_type: string;
  title: string;
  content: string;
  content_format: string;
  related_bookmark_ids: number[];
  source_conversation_id: string | null;
  source_message_id: string | null;
  source_skill_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * 笔记来源类型
 */
export type NoteSourceType =
  | "ai_summary"
  | "ai_extraction"
  | "ai_review"
  | "ai_report"
  | "ai_response";

/**
 * 笔记内容格式
 */
export type NoteContentFormat = "markdown" | "html" | "plain" | "json";

/**
 * 笔记记录
 */
export interface NoteRecord {
  id: string;
  userId: string;
  sourceType: NoteSourceType;
  title: string;
  content: string;
  contentFormat: NoteContentFormat;
  relatedBookmarkIds: number[];
  sourceConversationId?: string;
  sourceMessageId?: string;
  sourceSkillId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 笔记列表查询参数
 */
export interface NoteListParams {
  sourceType?: NoteSourceType;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * 服务响应
 */
export interface NoteServiceResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取 ai_notes 表查询（绕过类型检查）
 *
 * 注意：运行 `npm run supabase:gen:types` 后可直接使用 supabase.from("ai_notes")
 */
function getNotesTable(supabase: SupabaseClientLike) {
  return supabase.from("ai_notes");
}

/**
 * 获取 Supabase client（优先使用注入的 client，回退到浏览器端 client）
 */
function resolveClient(injected?: SupabaseClientLike): SupabaseClientLike {
  return injected ?? createClient();
}

// =============================================================================
// NoteService 类
// =============================================================================

export class NoteService {
  /**
   * 保存笔记
   * @param request - 保存请求参数
   * @param supabaseClient - 可选的 Supabase client（服务器端调用时应传入 server client）
   */
  async saveNote(
    request: SaveNoteRequest,
    supabaseClient?: SupabaseClientLike,
  ): Promise<NoteServiceResponse<SaveNoteResponse>> {
    try {
      const supabase = resolveClient(supabaseClient);

      // 获取当前用户
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        logger.warn({ authError }, "NoteService: User not authenticated");
        return { success: false, error: "用户未登录" };
      }

      // 自动生成标题（如果未提供）
      const title = request.title || this.generateTitle(request.content);

      // 检测内容格式
      const contentFormat = this.detectContentFormat(request.content);

      // 插入笔记记录
      const { data, error } = await getNotesTable(supabase)
        .insert({
          user_id: user.id,
          source_type: request.sourceType,
          title,
          content: request.content,
          content_format: contentFormat,
          related_bookmark_ids: request.relatedBookmarkIds || [],
          source_conversation_id: request.sourceConversationId || null,
          source_message_id: request.sourceMessageId || null,
          source_skill_id: request.sourceSkillId || null,
          tags: request.tags || [],
        })
        .select("id, title, created_at")
        .single();

      if (error) {
        logger.error({ error }, "NoteService: Failed to save note");
        return { success: false, error: "保存笔记失败" };
      }

      logger.info(
        {
          noteId: data?.id,
          sourceType: request.sourceType,
          title,
        },
        "NoteService: Note saved",
      );

      return {
        success: true,
        data: {
          id: String(data?.id ?? ""),
          title: data?.title ?? title,
          createdAt: data?.created_at ?? new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "NoteService: Unexpected error",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 获取笔记详情
   */
  async getNote(
    noteId: string,
    supabaseClient?: SupabaseClientLike,
  ): Promise<NoteServiceResponse<NoteRecord>> {
    try {
      const supabase = resolveClient(supabaseClient);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      const { data, error } = await getNotesTable(supabase)
        .select("*")
        .eq("id", noteId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        logger.error({ error }, "NoteService: Failed to get note");
        return { success: false, error: "获取笔记失败" };
      }

      const record = this.mapToNoteRecord(data as AINoteRow);
      return { success: true, data: record };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "NoteService: Get note failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 获取笔记列表
   */
  async listNotes(
    params: NoteListParams = {},
    supabaseClient?: SupabaseClientLike,
  ): Promise<NoteServiceResponse<{ notes: NoteRecord[]; total: number }>> {
    try {
      const supabase = resolveClient(supabaseClient);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      let query = getNotesTable(supabase)
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // 按来源类型筛选
      if (params.sourceType) {
        query = query.eq("source_type", params.sourceType);
      }

      // 按标签筛选
      if (params.tags && params.tags.length > 0) {
        query = query.overlaps("tags", params.tags);
      }

      // 全文搜索
      if (params.search) {
        query = query.textSearch("search_vector", params.search, {
          config: "simple",
        });
      }

      // 分页
      const limit = params.limit || 20;
      const offset = params.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error({ error }, "NoteService: Failed to list notes");
        return { success: false, error: "获取笔记列表失败" };
      }

      const notes = ((data as AINoteRow[]) || []).map((item) =>
        this.mapToNoteRecord(item),
      );

      return {
        success: true,
        data: {
          notes,
          total: count || 0,
        },
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "NoteService: List notes failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 更新笔记
   */
  async updateNote(
    noteId: string,
    updates: {
      title?: string;
      content?: string;
      tags?: string[];
    },
    supabaseClient?: SupabaseClientLike,
  ): Promise<NoteServiceResponse> {
    try {
      const supabase = resolveClient(supabaseClient);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      const updateData: Record<string, unknown> = {};

      if (updates.title !== undefined) {
        updateData.title = updates.title;
      }

      if (updates.content !== undefined) {
        updateData.content = updates.content;
        updateData.content_format = this.detectContentFormat(updates.content);
      }

      if (updates.tags !== undefined) {
        updateData.tags = updates.tags;
      }

      if (Object.keys(updateData).length === 0) {
        return { success: false, error: "没有需要更新的内容" };
      }

      const { error } = await getNotesTable(supabase)
        .update(updateData)
        .eq("id", noteId)
        .eq("user_id", user.id);

      if (error) {
        logger.error({ error }, "NoteService: Failed to update note");
        return { success: false, error: "更新笔记失败" };
      }

      logger.info({ noteId }, "NoteService: Note updated");
      return { success: true };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "NoteService: Update note failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 删除笔记
   */
  async deleteNote(
    noteId: string,
    supabaseClient?: SupabaseClientLike,
  ): Promise<NoteServiceResponse> {
    try {
      const supabase = resolveClient(supabaseClient);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      const { error } = await getNotesTable(supabase)
        .delete()
        .eq("id", noteId)
        .eq("user_id", user.id);

      if (error) {
        logger.error({ error }, "NoteService: Failed to delete note");
        return { success: false, error: "删除笔记失败" };
      }

      logger.info({ noteId }, "NoteService: Note deleted");
      return { success: true };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "NoteService: Delete note failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 获取笔记的关联书签
   */
  async getRelatedBookmarks(
    noteId: string,
    supabaseClient?: SupabaseClientLike,
  ): Promise<
    NoteServiceResponse<
      Array<{ id: number; title: string; url: string | null }>
    >
  > {
    try {
      const supabase = resolveClient(supabaseClient);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      // 获取笔记
      const { data: note, error: noteError } = await getNotesTable(supabase)
        .select("related_bookmark_ids")
        .eq("id", noteId)
        .eq("user_id", user.id)
        .single();

      if (noteError || !note) {
        return { success: false, error: "笔记不存在" };
      }

      const bookmarkIds = note.related_bookmark_ids as number[] | undefined;

      if (!bookmarkIds || bookmarkIds.length === 0) {
        return { success: true, data: [] };
      }

      // 获取关联书签
      const { data: bookmarks, error: bookmarkError } = await supabase
        .from("bookmarks")
        .select("id, title, url")
        .eq("user_id", user.id)
        .in("id", bookmarkIds);

      if (bookmarkError) {
        logger.error(
          { bookmarkError },
          "NoteService: Failed to get related bookmarks",
        );
        return { success: false, error: "获取关联书签失败" };
      }

      return { success: true, data: bookmarks || [] };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "NoteService: Get related bookmarks failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 自动生成标题
   */
  private generateTitle(content: string): string {
    // 移除 Markdown 标记
    const text = content
      .replace(/^#+\s*/gm, "")
      .replace(/\*\*|__/g, "")
      .replace(/\*|_/g, "")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // 取第一行，最多 50 个字符
    const firstLine = text.split("\n")[0].trim();
    if (firstLine.length <= 50) {
      return firstLine || "AI 笔记";
    }
    return firstLine.slice(0, 47) + "...";
  }

  /**
   * 检测内容格式
   */
  private detectContentFormat(content: string): NoteContentFormat {
    // 检测 JSON
    try {
      JSON.parse(content);
      return "json";
    } catch {
      // 不是 JSON
    }

    // 检测 HTML
    if (/<[^>]+>/.test(content)) {
      return "html";
    }

    // 检测 Markdown
    if (
      /^#+\s|^\*\s|^-\s|^\d+\.\s|```|`[^`]+`|\[.+\]\(.+\)|\*\*.+\*\*/m.test(
        content,
      )
    ) {
      return "markdown";
    }

    return "plain";
  }

  /**
   * 映射数据库记录到 NoteRecord
   */
  private mapToNoteRecord(data: AINoteRow): NoteRecord {
    return {
      id: data.id,
      userId: data.user_id,
      sourceType: data.source_type as NoteSourceType,
      title: data.title,
      content: data.content,
      contentFormat: data.content_format as NoteContentFormat,
      relatedBookmarkIds: data.related_bookmark_ids || [],
      sourceConversationId: data.source_conversation_id ?? undefined,
      sourceMessageId: data.source_message_id ?? undefined,
      sourceSkillId: data.source_skill_id ?? undefined,
      tags: data.tags || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

// =============================================================================
// 工厂函数和默认实例
// =============================================================================

/**
 * 创建笔记服务实例
 */
export function createNoteService(): NoteService {
  return new NoteService();
}

/**
 * 默认笔记服务实例
 */
export const noteService = new NoteService();
