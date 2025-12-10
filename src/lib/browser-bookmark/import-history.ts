/**
 * 导入历史记录服务
 * 提供记录和查询导入历史的功能
 */

import type {
  ImportHistory,
  ImportSource,
  ImportErrorDetail,
  ImportHistoryOptions,
} from "@/types/supabase";

// ============================================
// 类型定义
// ============================================

/** 创建历史记录的参数 */
export interface CreateImportHistoryParams {
  importSource: ImportSource;
  importBatchId: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  foldersCreated?: number;
  durationMs?: number;
  errorDetails?: ImportErrorDetail[];
  options?: ImportHistoryOptions;
}

/** 查询历史记录的参数 */
export interface GetImportHistoryParams {
  limit?: number;
  offset?: number;
  source?: ImportSource;
}

/** 查询结果 */
export interface ImportHistoryResult {
  history: ImportHistory[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================
// 浏览器来源映射
// ============================================

/** 将 BrowserSource 映射到 ImportSource */
export function browserSourceToImportSource(
  browserSource: string,
): ImportSource {
  const mapping: Record<string, ImportSource> = {
    chrome: "browser_chrome",
    edge: "browser_edge",
    firefox: "browser_firefox",
    safari: "browser_safari",
    browser_chrome: "browser_chrome",
    browser_edge: "browser_edge",
    browser_firefox: "browser_firefox",
    browser_safari: "browser_safari",
  };

  return mapping[browserSource.toLowerCase()] || "manual";
}

/** 获取导入来源的显示名称 */
export function getImportSourceDisplayName(source: ImportSource): string {
  const names: Partial<Record<ImportSource, string>> = {
    browser_chrome: "Chrome 浏览器",
    browser_edge: "Edge 浏览器",
    browser_firefox: "Firefox 浏览器",
    browser_safari: "Safari 浏览器",
    api: "API 导入",
    share_sheet: "分享导入",
    manual: "手动导入",
  };

  return names[source] || source;
}

// ============================================
// API 调用函数
// ============================================

/**
 * 创建导入历史记录
 */
export async function createImportHistory(
  params: CreateImportHistoryParams,
): Promise<ImportHistory> {
  const response = await fetch("/api/browser-bookmark/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      import_source: params.importSource,
      import_batch_id: params.importBatchId,
      total_count: params.totalCount,
      success_count: params.successCount,
      failed_count: params.failedCount,
      skipped_count: params.skippedCount,
      folders_created: params.foldersCreated ?? 0,
      duration_ms: params.durationMs ?? null,
      error_details: params.errorDetails ?? null,
      options: params.options ?? null,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "创建导入历史记录失败");
  }

  const result = await response.json();
  return result.data.history;
}

/**
 * 获取导入历史记录列表
 */
export async function getImportHistory(
  params: GetImportHistoryParams = {},
): Promise<ImportHistoryResult> {
  const searchParams = new URLSearchParams();

  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.offset) {
    searchParams.set("offset", String(params.offset));
  }
  if (params.source) {
    searchParams.set("source", params.source);
  }

  const url = `/api/browser-bookmark/history?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "获取导入历史记录失败");
  }

  const result = await response.json();
  return result.data;
}

/**
 * 删除导入历史记录
 */
export async function deleteImportHistory(
  id?: number,
  batchId?: string,
): Promise<void> {
  const searchParams = new URLSearchParams();

  if (id) {
    searchParams.set("id", String(id));
  } else if (batchId) {
    searchParams.set("batch_id", batchId);
  } else {
    throw new Error("需要提供 id 或 batchId");
  }

  const url = `/api/browser-bookmark/history?${searchParams.toString()}`;
  const response = await fetch(url, { method: "DELETE" });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "删除导入历史记录失败");
  }
}

// ============================================
// 统计函数
// ============================================

/**
 * 计算导入成功率
 */
export function calculateSuccessRate(history: ImportHistory): number {
  if (history.total_count === 0) return 0;
  return Math.round((history.success_count / history.total_count) * 100);
}

/**
 * 格式化导入耗时
 */
export function formatDuration(durationMs: number | null): string {
  if (!durationMs) return "-";

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) {
    return `${seconds}秒`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
}

/**
 * 汇总多条历史记录的统计
 */
export function summarizeHistory(history: ImportHistory[]): {
  totalImports: number;
  totalBookmarks: number;
  totalSuccess: number;
  totalFailed: number;
  totalSkipped: number;
  averageSuccessRate: number;
} {
  const stats = history.reduce(
    (acc, h) => ({
      totalImports: acc.totalImports + 1,
      totalBookmarks: acc.totalBookmarks + h.total_count,
      totalSuccess: acc.totalSuccess + h.success_count,
      totalFailed: acc.totalFailed + h.failed_count,
      totalSkipped: acc.totalSkipped + h.skipped_count,
    }),
    {
      totalImports: 0,
      totalBookmarks: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalSkipped: 0,
    },
  );

  return {
    ...stats,
    averageSuccessRate:
      stats.totalBookmarks > 0
        ? Math.round((stats.totalSuccess / stats.totalBookmarks) * 100)
        : 0,
  };
}
