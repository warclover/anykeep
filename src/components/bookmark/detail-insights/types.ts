/**
 * 详情页洞察卡片共享类型
 *
 * @version 1.0.0
 * @since 2026-03-17
 */

// ============================================================================
// 分类理由
// ============================================================================

/** 分类理由 API 响应（GET /api/classification/{bookmarkId}/reason） */
export interface ClassificationReason {
  bookmarkId: number;
  title: string;
  currentFolder: {
    id: number | null;
    name: string;
    isSystem: boolean;
  } | null;
  classificationStatus: "classified" | "inbox" | "uncategorized" | "pending";
  confidence: number | null;
  reason: string;
  matchSource: {
    type: "embedding" | "source" | "tag" | "rule" | "manual" | "unknown";
    label: string;
    description: string;
  };
  decisionDetails: {
    isAutoClassified: boolean;
    wasManuallyAdjusted: boolean;
    classifiedAt: string | null;
    lastAdjustedAt: string | null;
  };
  alternatives: Array<{
    folderId: number;
    folderName: string;
    confidence: number;
    reason: string;
  }>;
  factors: Array<{
    name: string;
    value: string;
    impact: "positive" | "negative" | "neutral";
    description: string;
  }>;
}

// ============================================================================
// 快速对比
// ============================================================================

/** 高相似度书签项（从 RelatedBookmarks 数据中提取） */
export interface HighSimilarityItem {
  bookmarkId: number;
  title: string;
  url: string;
  similarityScore: number;
  platform: string | null;
}

// ============================================================================
// 综述入口
// ============================================================================

/** 综述资格信息 */
export interface SynthesisEligibility {
  /** 是否满足条件 */
  eligible: boolean;
  /** 触发来源类型 */
  sourceType: "folder" | "tag";
  /** 来源标识（文件夹 ID 或标签名） */
  sourceId: string;
  /** 来源名称（文件夹名或标签名） */
  sourceName: string;
  /** 符合条件的书签数量 */
  count: number;
}

// ============================================================================
// 容器 Props
// ============================================================================

/** DetailInsightsLazy / DetailInsightsContainer 共享 Props */
export interface DetailInsightsProps {
  bookmarkId: number;
  folderId: number | null;
  folderName: string | null;
  userTags: string[] | null;
  aiTags: string[] | null;
  /** bookmark.classification_result 原始值（用于触发条件判断） */
  classificationResult: unknown | null;
}
