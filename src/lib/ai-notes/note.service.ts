/**
 * NoteService - AI 笔记服务
 *
 * @deprecated 此模块未被任何代码引用，已由 `src/lib/ai-skills/services/note.service.ts` 替代。
 * 保留以防回退，后续版本可安全删除。
 *
 * 职责：
 * - 保存 AI 生成的内容（总结、萃取、复习笔记等）
 * - 管理笔记的 CRUD 操作
 * - 支持全文搜索
 *
 * @module ai-notes
 * @version 1.0.0
 * @since 2025-12-26
 */

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  AINote,
  CreateNoteParams,
  UpdateNoteParams,
  SearchNotesParams,
  NoteServiceResult,
  NoteSourceType,
} from "./types";

/**
 * AI 笔记服务
 */
export class NoteService {
  /**
   * 保存 AI 生成的内容为笔记
   */
  async saveNote(
    params: CreateNoteParams,
  ): Promise<NoteServiceResult<{ id: string }>> {
    try {
      const supabase = createClient();

      const title =
        params.title || this.generateTitle(params.content, params.sourceType);

      logger.info(
        {
          userId: params.userId,
          sourceType: params.sourceType,
          title,
        },
        "NoteService: Saving note",
      );

      const { data, error } = await supabase
        .from("ai_notes")
        .insert({
          user_id: params.userId,
          source_type: params.sourceType,
          title,
          content: params.content,
          content_format: params.contentFormat || "markdown",
          related_bookmark_ids: params.relatedBookmarkIds || [],
          source_conversation_id: params.sourceConversationId,
          source_message_id: params.sourceMessageId,
          source_skill_id: params.sourceSkillId,
          tags: params.tags || [],
        })
        .select("id")
        .single();

      if (error) {
        logger.error({ error }, "NoteService: Failed to save note");
        return { success: false, error: error.message };
      }

      logger.info({ noteId: data?.id }, "NoteService: Note saved successfully");

      return { success: true, data: { id: data?.id || "" } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error: message }, "NoteService: Exception saving note");
      return { success: false, error: message };
    }
  }

  /**
   * 获取笔记
   */
  async getNote(
    noteId: string,
    userId: string,
  ): Promise<NoteServiceResult<AINote>> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("ai_notes")
        .select("*")
        .eq("id", noteId)
        .eq("user_id", userId)
        .single();

      if (error) {
        logger.error({ error }, "NoteService: Failed to get note");
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: "笔记不存在" };
      }

      return { success: true, data: this.mapToNote(data) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error: message }, "NoteService: Exception getting note");
      return { success: false, error: message };
    }
  }

  /**
   * 获取用户笔记列表
   */
  async getUserNotes(
    userId: string,
    sourceType?: NoteSourceType,
    limit: number = 50,
  ): Promise<NoteServiceResult<AINote[]>> {
    try {
      const supabase = createClient();

      let query = supabase
        .from("ai_notes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (sourceType) {
        query = query.eq("source_type", sourceType);
      }

      const { data, error } = await query;

      if (error) {
        logger.error({ error }, "NoteService: Failed to get user notes");
        return { success: false, error: error.message };
      }

      const notes = (data || []).map(this.mapToNote);

      return { success: true, data: notes };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "NoteService: Exception getting user notes",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 搜索笔记（全文搜索）
   */
  async searchNotes(
    userId: string,
    params: SearchNotesParams,
  ): Promise<NoteServiceResult<AINote[]>> {
    try {
      const supabase = createClient();

      // 使用 PostgreSQL 全文搜索
      let query = supabase
        .from("ai_notes")
        .select("*")
        .eq("user_id", userId)
        .textSearch("search_vector", params.query)
        .order("created_at", { ascending: false })
        .limit(params.limit || 20);

      if (params.sourceType) {
        query = query.eq("source_type", params.sourceType);
      }

      const { data, error } = await query;

      if (error) {
        logger.error({ error }, "NoteService: Failed to search notes");
        return { success: false, error: error.message };
      }

      const notes = (data || []).map(this.mapToNote);

      return { success: true, data: notes };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "NoteService: Exception searching notes",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 更新笔记
   */
  async updateNote(
    noteId: string,
    userId: string,
    params: UpdateNoteParams,
  ): Promise<NoteServiceResult> {
    try {
      const supabase = createClient();

      const updateData: Record<string, unknown> = {};
      if (params.title !== undefined) updateData.title = params.title;
      if (params.content !== undefined) updateData.content = params.content;
      if (params.tags !== undefined) updateData.tags = params.tags;

      const { error } = await supabase
        .from("ai_notes")
        .update(updateData)
        .eq("id", noteId)
        .eq("user_id", userId);

      if (error) {
        logger.error({ error }, "NoteService: Failed to update note");
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error: message }, "NoteService: Exception updating note");
      return { success: false, error: message };
    }
  }

  /**
   * 删除笔记
   */
  async deleteNote(noteId: string, userId: string): Promise<NoteServiceResult> {
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("ai_notes")
        .delete()
        .eq("id", noteId)
        .eq("user_id", userId);

      if (error) {
        logger.error({ error }, "NoteService: Failed to delete note");
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error: message }, "NoteService: Exception deleting note");
      return { success: false, error: message };
    }
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 生成标题
   */
  private generateTitle(content: string, sourceType: NoteSourceType): string {
    const prefixes: Record<NoteSourceType, string> = {
      ai_summary: "📝 AI 总结",
      ai_extraction: "💡 知识萃取",
      ai_review: "📚 复习笔记",
      ai_report: "📊 分析报告",
      ai_response: "💬 AI 回复",
    };

    const firstLine = content
      .split("\n")[0]
      .replace(/^#+\s*/, "")
      .substring(0, 30);

    return `${prefixes[sourceType]} - ${firstLine}${firstLine.length >= 30 ? "..." : ""}`;
  }

  /**
   * 映射数据库记录到笔记对象
   */
  private mapToNote(row: Record<string, unknown>): AINote {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      sourceType: row.source_type as NoteSourceType,
      title: row.title as string,
      content: row.content as string,
      contentFormat: row.content_format as AINote["contentFormat"],
      relatedBookmarkIds: row.related_bookmark_ids as number[],
      sourceConversationId: row.source_conversation_id as string | undefined,
      sourceMessageId: row.source_message_id as string | undefined,
      sourceSkillId: row.source_skill_id as string | undefined,
      tags: row.tags as string[],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
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
export const noteService = createNoteService();
