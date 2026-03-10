/**
 * 智能分类 v5.0 - Shadow Sorting 类型定义
 */

/**
 * 影子分拣书签
 */
export interface ShadowBookmark {
  id: number;
  title: string;
  url: string;
  shadowFolderId: number;
  shadowFolderName: string;
  shadowConfidence: number;
  shadowSuggestedAt: string;
  currentFolderId: number | null;
  currentFolderName: string | null;
}

/**
 * 影子分拣统计
 */
export interface ShadowSortingStats {
  totalPending: number;
  avgConfidence: number;
  oldestSuggestion: string | null;
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
  bookmarkId: number;
  success: boolean;
  errorMessage?: string | null;
}
