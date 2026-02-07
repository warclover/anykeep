/**
 * 统一缓存失效工具
 *
 * 确保书签操作后，所有相关缓存都被正确失效
 * 解决跨页面数据不一致问题
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

import type { QueryClient } from "@tanstack/react-query";
import {
  bookmarkKeys,
  inboxKeys,
  folderBookmarkKeys,
} from "@/hooks/queries/keys";

/**
 * 使书签相关缓存失效
 *
 * 用于书签 CRUD 操作后，确保所有相关页面数据同步更新
 */
export function invalidateBookmarkCaches(queryClient: QueryClient) {
  // 书签列表和统计
  queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
  queryClient.invalidateQueries({ queryKey: bookmarkKeys.stats() });

  // 收件箱计数和列表
  queryClient.invalidateQueries({ queryKey: inboxKeys.counts() });
  queryClient.invalidateQueries({ queryKey: inboxKeys.items() });

  // 文件夹书签列表
  queryClient.invalidateQueries({ queryKey: folderBookmarkKeys.all });
}

/**
 * 使收件箱缓存失效（仅影响收件箱页面）
 */
export function invalidateInboxCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: inboxKeys.counts() });
  queryClient.invalidateQueries({ queryKey: inboxKeys.items() });
}
