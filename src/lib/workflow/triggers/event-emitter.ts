/**
 * 事件发射器
 *
 * 在业务模块中调用此函数触发工作流事件
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { getEventTriggerManager } from "./event-trigger-manager";
import type { EventType, WorkflowEvent } from "./types";
import { logger } from "@/lib/logger";

/**
 * 发射工作流事件
 *
 * 在各业务模块中调用此函数触发事件
 */
export async function emitWorkflowEvent(
  type: EventType,
  userId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const event: WorkflowEvent = {
    type,
    userId,
    payload,
    timestamp: new Date(),
  };

  logger.debug(
    { type, userId, payloadKeys: Object.keys(payload) },
    "WorkflowEvent: Emitting event",
  );

  const manager = getEventTriggerManager();
  await manager.handleEvent(event);
}

// ============================================================
// 业务集成示例
// ============================================================

/**
 * 在书签导入完成后触发
 *
 * @example
 * ```typescript
 * // src/lib/browser-bookmark/import-service.ts
 * import { emitWorkflowEvent } from "@/lib/workflow/triggers/event-emitter";
 *
 * async function onImportComplete(userId: string, importResult: ImportResult) {
 *   // ... 导入逻辑
 *
 *   // 触发事件
 *   await emitWorkflowEvent("browser_bookmark_import_completed", userId, {
 *     totalImported: importResult.totalImported,
 *     foldersCreated: importResult.foldersCreated,
 *     isFirstImport: importResult.isFirstImport,
 *   });
 * }
 * ```
 */
export async function emitBrowserBookmarkImportCompleted(
  userId: string,
  data: {
    totalImported: number;
    foldersCreated: number;
    isFirstImport: boolean;
  },
): Promise<void> {
  await emitWorkflowEvent("browser_bookmark_import_completed", userId, data);
}

/**
 * 在书签创建后触发
 *
 * @example
 * ```typescript
 * // src/lib/bookmark/bookmark-service.ts
 * import { emitWorkflowEvent } from "@/lib/workflow/triggers/event-emitter";
 *
 * async function createBookmark(userId: string, bookmarkData: BookmarkData) {
 *   // ... 创建逻辑
 *
 *   await emitWorkflowEvent("bookmark_created", userId, {
 *     bookmarkId: newBookmark.id,
 *     title: newBookmark.title,
 *     url: newBookmark.url,
 *     platform: newBookmark.platform,
 *   });
 * }
 * ```
 */
export async function emitBookmarkCreated(
  userId: string,
  data: {
    bookmarkId: string;
    title: string;
    url: string;
    platform?: string;
  },
): Promise<void> {
  await emitWorkflowEvent("bookmark_created", userId, data);
}

/**
 * 在文件夹创建后触发
 */
export async function emitFolderCreated(
  userId: string,
  data: {
    folderId: number;
    name: string;
    parentId?: number;
  },
): Promise<void> {
  await emitWorkflowEvent("folder_created", userId, data);
}

/**
 * 在标签添加后触发
 */
export async function emitTagAdded(
  userId: string,
  data: {
    bookmarkId: string;
    tagName: string;
  },
): Promise<void> {
  await emitWorkflowEvent("tag_added", userId, data);
}
