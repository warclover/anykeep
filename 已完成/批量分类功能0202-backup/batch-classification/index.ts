/**
 * 批量分类组件模块入口
 *
 * @module components/batch-classification
 * @version 1.0.0
 * @since 2026-02-01
 */

// 进度指示器
export { ProgressIndicator } from "./progress-indicator";

// 簇卡片
export { ClusterCard } from "./cluster-card";

// 分类预览
export { ClassificationPreview } from "./classification-preview";

// 确认模式切换器
export {
  ConfirmationModeSwitcher,
  getSuggestedConfirmationMode,
} from "./confirmation-mode-switcher";

// 冲突高亮
export { ConflictHighlight, GlobalConflictSettings } from "./conflict-highlight";

// 撤销提示
export { UndoBanner } from "./undo-banner";
