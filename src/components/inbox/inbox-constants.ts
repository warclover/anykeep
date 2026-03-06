/**
 * 收件箱页面 - 类型、常量、工具函数
 */

import type { InboxTabId } from "@/lib/constants/inbox-tabs";
import type { Bookmark } from "@/types/supabase";

// ==================== 类型定义 ====================

export type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

export interface FolderOption {
  id: number;
  name: string;
}

export interface InboxPageClientProps {
  initialBookmarks: BookmarkWithFolder[];
  availableFolders: FolderOption[];
  /** @deprecated 已弃用：客户端使用 useInboxItems hook 独立获取数据，不需要此参数 */
  inboxFolderId?: number | null;
  error?: string;
  initialTab?: InboxTabId;
}

// ==================== Tab 配置映射 ====================

export const TAB_LABELS: Record<
  InboxTabId,
  { title: string; description: string }
> = {
  uncategorized: {
    title: "待分类书签",
    description: "这些书签尚未分类到任何文件夹，请查看左侧的智能建议或手动整理",
  },
  unread: {
    title: "未读内容",
    description: "您尚未阅读过的书签，点击书签即可标记为已读",
  },
  "high-value": {
    title: "高价值书签",
    description: "AI 评估的高质量内容，值得深度阅读和学习",
  },
  broken: {
    title: "已失效链接",
    description: "这些链接已无法访问，建议删除或更新 URL",
  },
  recent: {
    title: "最近添加",
    description: "最近 7 天内添加的书签",
  },
};

// ==================== 工具函数 ====================

/**
 * 带重试的 fetch 请求
 * @param url 请求 URL
 * @param options fetch 选项
 * @param maxRetries 最大重试次数
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Network error");
    }
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
    }
  }
  throw lastError || new Error("Request failed after retries");
}

/**
 * 批量处理函数（控制并发）
 * @param items 待处理项
 * @param processor 处理函数
 * @param concurrency 并发数
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 3,
): Promise<Array<{ success: boolean; result?: R; error?: Error }>> {
  const results: Array<{ success: boolean; result?: R; error?: Error }> = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push({ success: true, result: result.value });
      } else {
        results.push({
          success: false,
          error:
            result.reason instanceof Error
              ? result.reason
              : new Error(String(result.reason)),
        });
      }
    }
  }
  return results;
}
