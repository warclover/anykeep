/**
 * 合成报告领域类型定义
 * @module types/domain/synthesis
 * @description 统一的合成报告相关类型定义
 */

// ============================================================================
// 报告建议类型
// ============================================================================

/**
 * 所有支持的报告建议类型
 */
export const REPORT_SUGGESTION_TYPES = [
  "split",
  "merge",
  "rename",
  "archive",
  "create",
  "cleanup",
] as const;

/**
 * 报告建议类型（联合类型）
 */
export type ReportSuggestionType = (typeof REPORT_SUGGESTION_TYPES)[number];

/**
 * UI 组件支持的建议类型子集
 * 用于组件只处理部分类型的场景
 */
export type UISupportedSuggestionType = Extract<
  ReportSuggestionType,
  "split" | "merge" | "rename" | "cleanup"
>;

/**
 * 建议优先级
 */
export type SuggestionPriority = "high" | "medium" | "low";

/**
 * 建议状态
 */
export type SuggestionStatus = "pending" | "accepted" | "rejected";

// ============================================================================
// 完整的报告建议接口（用于 API/存储）
// ============================================================================

/**
 * 完整的报告建议类型
 *
 * 这是项目中唯一的 ReportSuggestion 定义，用于 API 和数据存储。
 */
export interface ReportSuggestion {
  /** 建议 ID */
  id: string;

  /** 建议类型 */
  type: ReportSuggestionType;

  /** 建议描述 */
  description?: string;

  /** 目标文件夹 ID */
  folderId?: number;

  /** 目标文件夹名称 */
  folderName?: string;

  /** 合并目标文件夹 ID */
  targetFolderId?: number;

  /** 重命名后的新名称 */
  newName?: string;

  /** 建议原因 */
  reason: string;

  /** 置信度 (0-1) */
  confidence: number;

  /** 影响的书签数量 */
  affectedBookmarks?: number;

  /** 建议状态 */
  status: SuggestionStatus;
}

// ============================================================================
// UI 组件使用的简化建议类型
// ============================================================================

/**
 * UI 组件使用的简化建议类型
 *
 * 用于 report-suggestions-list 等组件的显示
 */
export interface UISuggestion {
  /** 建议类型（可选，兼容历史数据） */
  type?: UISupportedSuggestionType;

  /** 建议描述 */
  description?: string;

  /** 目标文件夹列表 */
  targetFolders?: Array<{ id: number; name: string }>;

  /** 优先级 */
  priority?: SuggestionPriority;
}

// ============================================================================
// 类型转换器
// ============================================================================

/**
 * 将完整的 ReportSuggestion 转换为 UI 显示用的 UISuggestion
 */
export function toUISuggestion(suggestion: ReportSuggestion): UISuggestion {
  // 过滤不支持的类型
  const supportedTypes: UISupportedSuggestionType[] = [
    "split",
    "merge",
    "rename",
    "cleanup",
  ];
  const type = supportedTypes.includes(
    suggestion.type as UISupportedSuggestionType,
  )
    ? (suggestion.type as UISupportedSuggestionType)
    : undefined;

  // 计算优先级
  let priority: SuggestionPriority = "medium";
  if (suggestion.confidence >= 0.8) priority = "high";
  else if (suggestion.confidence < 0.5) priority = "low";

  return {
    type,
    description: suggestion.description || suggestion.reason,
    targetFolders:
      suggestion.folderId && suggestion.folderName
        ? [{ id: suggestion.folderId, name: suggestion.folderName }]
        : undefined,
    priority,
  };
}

/**
 * 批量转换为 UI 建议
 */
export function toUISuggestionList(
  suggestions: ReportSuggestion[],
): UISuggestion[] {
  return suggestions.map(toUISuggestion);
}

/**
 * 类型守卫：检查是否为支持的 UI 建议类型
 */
export function isUISupportedType(
  type: string | undefined,
): type is UISupportedSuggestionType {
  return (
    type !== undefined && ["split", "merge", "rename", "cleanup"].includes(type)
  );
}
