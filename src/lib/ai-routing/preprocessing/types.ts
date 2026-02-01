/**
 * Preprocessing 模块类型导出
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

export type { UnifiedRequest, RequestContext } from "../types";

/**
 * 预处理结果
 */
export interface PreprocessResult {
  /** 预处理后的消息 */
  message: string;
  /** 原始消息 */
  originalMessage: string;
  /** 是否被修改 */
  modified: boolean;
  /** 解析出的书签 ID */
  selectedBookmarks?: number[];
  /** 解析出的文件夹 ID */
  folderId?: number;
  /** 最近消息历史 */
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  /** 预处理耗时（毫秒） */
  durationMs: number;
}
