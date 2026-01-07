/**
 * Knowledge Studio v2 - Component Exports
 * @module knowledge-studio/v2
 */

export {
  BlueprintSelectorV2,
  type BlueprintListItem,
  type BlueprintSelectorV2Props,
} from "./blueprint-selector";
export { BriefingWizard, type BriefingWizardProps } from "./briefing-wizard";
export { OutlineEditorV2, type OutlineEditorV2Props } from "./outline-editor";
export {
  StructuredOutputViewer,
  type StructuredOutputViewerProps,
  type OutputType,
} from "./structured-output-viewer";
export {
  GenerationEstimatePanel,
  type GenerationEstimatePanelProps,
} from "./generation-estimate-panel";
export {
  PlatformStyleSelector,
  type PlatformStyleSelectorProps,
} from "./platform-style-selector";
// Phase 2: 智能引导系统组件
export { ScenarioQuickEntry } from "./scenario-quick-entry";
export { BlueprintRecommendations } from "./blueprint-recommendations";
export { MaterialRecommendations } from "./material-recommendations";
// Phase 4: 草稿迭代与反馈驱动优化
export { FeedbackDialog } from "./feedback-dialog";
export { DraftVersionPanel } from "./draft-version-panel";
export { ContentDiffViewer } from "./content-diff-viewer"; // P1-5: 内容对比查看器
// Phase 6: 历史记录
export { HistoryPageClient } from "./history-page-client";
// P0-2: 导出功能
export { ExportResultDialog } from "./export-result-dialog";
// P1-1: 一稿多发
export { MultiPlatformDialog } from "./multi-platform-dialog";
