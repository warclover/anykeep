/**
 * Save to Note 功能 - 类型定义
 * @description AI 内容保存到笔记的类型系统
 */

/** 保存来源类型 */
export type SaveSourceType =
  | "ai_response" // AI 对话回复
  | "deliverable" // 交付物（报告、列表等）
  | "synthesis" // 主题合成
  | "report"; // 各类报告

/** 保存到笔记的请求载荷 */
export interface SaveToNotePayload {
  /** 要保存的内容（Markdown 格式） */
  content: string;
  /** 来源类型 */
  sourceType: SaveSourceType;
  /** 来源 ID（消息 ID、交付物 ID 等） */
  sourceId?: string;
  /** 来源对话 ID */
  sourceConversationId?: string;
  /** 自定义标题（可选，不提供则 AI 生成） */
  customTitle?: string;
  /** 跳过重复检测 */
  skipDuplicateCheck?: boolean;
}

/** 已保存笔记信息 */
export interface SavedNoteInfo {
  /** 笔记 ID */
  id: number;
  /** 笔记标题 */
  title: string;
  /** 查看 URL */
  viewUrl: string;
  /** 所在文件夹名称 */
  folderName: string;
}

/** 重复笔记信息 */
export interface DuplicateInfo {
  /** 已存在笔记的 ID */
  id: number;
  /** 已存在笔记的标题 */
  title: string;
  /** 保存时间 */
  savedAt: string;
}

/** 保存按钮状态 */
export type SaveButtonState =
  | "idle" // 空闲
  | "checking" // 检查重复中
  | "generating" // 生成标题中
  | "saving" // 保存中
  | "success" // 保存成功
  | "error"; // 保存失败

/** 保存结果 */
export interface SaveResult {
  /** 是否为重复内容 */
  isDuplicate: boolean;
  /** 笔记 ID（保存成功时） */
  noteId?: number;
  /** 笔记标题（保存成功时） */
  title?: string;
  /** 重复笔记信息（检测到重复时） */
  duplicateInfo?: DuplicateInfo;
}

/** 重复检测 API 响应 */
export interface CheckDuplicateResponse {
  isDuplicate: boolean;
  existingNote?: {
    id: number;
    title: string;
    created_at: string;
  };
}

/** 标题生成 API 响应 */
export interface GenerateTitleResponse {
  title: string;
}

/** 保存历史记录 */
export interface NoteSaveHistoryRecord {
  id: number;
  userId: string;
  noteId: number;
  sourceType: SaveSourceType;
  sourceId?: string;
  sourceConversationId?: string;
  contentHash?: string;
  generatedTitle?: string;
  isDuplicateSave: boolean;
  createdAt: string;
}
