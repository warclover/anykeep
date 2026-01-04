/**
 * Knowledge Studio Components
 * @module components/knowledge-studio
 */

export { BlueprintSelector } from "./blueprint-selector";
export { GenerationProgress } from "./generation-progress";
export { MaterialSelector } from "./material-selector";
export { ChatEditPanel } from "./chat-edit-panel";
export { ReportEditor } from "./report-editor";
export { CitationCard } from "./citation-card";
export { BriefingDialog } from "./briefing-dialog";
export type { BriefingDialogProps } from "./briefing-dialog";
export { EnhancedBlueprintSelector } from "./enhanced-blueprint-selector";
export type { EnhancedBlueprintSelectorProps } from "./enhanced-blueprint-selector";

// Outline Editor (Story 2.2)
export { OutlineTreeItem } from "./outline-tree-item";
export type { OutlineTreeItemProps } from "./outline-tree-item";
export { OutlineEditor } from "./outline-editor";
export type { OutlineEditorProps } from "./outline-editor";

// Outline Confirmation (Story 2.3)
export { OutlineConfirmationPanel } from "./outline-confirmation-panel";
export type { OutlineConfirmationPanelProps } from "./outline-confirmation-panel";

// Outline Version History (Story 2.5)
export { OutlineVersionHistory } from "./outline-version-history";
export type { OutlineVersionHistoryProps } from "./outline-version-history";

// Quota UI Components (Story 8.3)
export {
  BlueprintQuotaBar,
  BlueprintQuotaExhaustedDialog,
  BlueprintQuotaWarning,
  CreditCostBadge,
} from "./quota";
export type {
  BlueprintQuotaBarProps,
  BlueprintQuotaExhaustedDialogProps,
  BlueprintQuotaWarningProps,
  CreditCostBadgeProps,
} from "./quota";
