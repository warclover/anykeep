/**
 * 来源选择器类型定义
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

import type { SynthesisSourceType } from "@/lib/synthesis";

/**
 * 预览书签类型
 */
export interface PreviewBookmark {
  id: number;
  title: string;
  url: string;
  platform: string | null;
  ai_summary: string | null;
  created_at: string;
  folder_id: number | null;
  folder_name: string | null;
}

/**
 * 内容统计
 */
export interface ContentStats {
  totalCount: number;
  withSummary: number;
  avgSummaryLength: number;
  platforms: Record<string, number>;
}

/**
 * 预览 API 响应
 */
export interface PreviewResponse {
  bookmarks: PreviewBookmark[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  contentStats: ContentStats;
}

/**
 * 来源选择结果
 */
export interface SourceSelection {
  sourceType: SynthesisSourceType;
  sourceId: string | null;
  sourceName: string;
  bookmarkIds: number[];
  excludedIds: number[];
  contentStats: ContentStats | null;
}

/**
 * 选择器组件 Props
 */
export interface SourceSelectorProps {
  onSelect: (selection: SourceSelection) => void;
  onCancel: () => void;
  disabled?: boolean;
}

/**
 * 文件夹选择器 Props
 */
export interface FolderPickerProps extends SourceSelectorProps {
  initialFolderId?: string;
}

/**
 * 标签选择器 Props
 */
export interface TagPickerProps extends SourceSelectorProps {
  initialTag?: string;
}

/**
 * 手动选择器 Props
 */
export interface ManualSelectorProps extends SourceSelectorProps {
  initialBookmarkIds?: number[];
}
