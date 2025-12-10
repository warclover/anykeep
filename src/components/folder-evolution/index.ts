/**
 * Folder Evolution Components (V4.2)
 * AI 文件夹进化系统组件
 */

// Phase 1: 操作历史组件
export { OperationHistoryList } from "./operation-history-list";
export { OperationHistoryItem } from "./operation-history-item";
export { OperationDetailDialog } from "./operation-detail-dialog";
export { UndoConfirmDialog } from "./undo-confirm-dialog";

// Phase 2: 文件夹创建确认
export { CreateConfirmDialog } from "./create-confirm-dialog";

// Phase 3: 文件夹重命名
export { RenameConfirmDialog } from "./rename-confirm-dialog";

// Phase 4: 分拆/合并建议
export { SplitSuggestionCard } from "./split-suggestion-card";
export type { SplitSuggestion, SplitOption } from "./split-suggestion-card";

export { MergeSuggestionCard } from "./merge-suggestion-card";
export type { MergeSuggestion } from "./merge-suggestion-card";

// Phase 5: AI 设置和报告
export { AIFolderSettingsCard } from "./ai-folder-settings-card";
export type { AIFolderSettings } from "./ai-folder-settings-card";

export { MonthlyReportCard } from "./monthly-report-card";
export type { MonthlyReport } from "./monthly-report-card";

export { ReportPageClient } from "./report-page-client";
export { ReportChangesList } from "./report-changes-list";
export type { FolderChanges } from "./report-changes-list";
export { ReportSuggestionsList } from "./report-suggestions-list";
export type { ReportSuggestion } from "./report-suggestions-list";

// Phase 6: 成本监控
export { LLMUsageCard } from "./llm-usage-card";
export type { LLMUsageStats } from "./llm-usage-card";
