/**
 * AI 笔记服务类型定义
 *
 * @module ai-notes
 * @version 1.0.0
 * @since 2025-12-26
 */

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
 * 内容格式
 */
export type ContentFormat = "markdown" | "html" | "plain" | "json";

/**
 * AI 笔记
 */
export interface AINote {
  id: string;
  userId: string;
  sourceType: NoteSourceType;
  title: string;
  content: string;
  contentFormat: ContentFormat;
  relatedBookmarkIds: number[];
  sourceConversationId?: string;
  sourceMessageId?: string;
  sourceSkillId?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建笔记参数
 */
export interface CreateNoteParams {
  userId: string;
  sourceType: NoteSourceType;
  title?: string;
  content: string;
  contentFormat?: ContentFormat;
  relatedBookmarkIds?: number[];
  sourceConversationId?: string;
  sourceMessageId?: string;
  sourceSkillId?: string;
  tags?: string[];
}

/**
 * 更新笔记参数
 */
export interface UpdateNoteParams {
  title?: string;
  content?: string;
  tags?: string[];
}

/**
 * 搜索笔记参数
 */
export interface SearchNotesParams {
  query: string;
  sourceType?: NoteSourceType;
  limit?: number;
}

/**
 * 服务结果
 */
export interface NoteServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
