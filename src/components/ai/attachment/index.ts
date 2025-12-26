/**
 * AI 附件系统模块导出
 *
 * @version 1.3.0
 * @since 2025-12-26
 * @updated 2025-12-26 - 添加错误边界组件
 */

// 类型导出
export * from "./types";

// 组件导出
export { AttachmentButton } from "./attachment-button";
export { AttachmentPopover } from "./attachment-popover";
export { AttachmentPanelContent } from "./attachment-panel-content";
export { AttachmentSearchInput } from "./attachment-search-input";
export { AttachmentIndicator } from "./attachment-indicator";
export { AttachmentPreviewModal } from "./attachment-preview-modal";
export { BookmarkSelectList } from "./bookmark-select-list";
export { FileUploadZone } from "./file-upload-zone";
export { ContentPreview, truncateContent } from "./content-preview";
export {
  AttachmentErrorBoundary,
  withAttachmentErrorBoundary,
} from "./attachment-error-boundary";

// 类型导出（组件 props）
export type { AttachmentButtonProps } from "./attachment-button";
export type { AttachmentPopoverProps } from "./attachment-popover";
export type { AttachmentPanelContentProps } from "./attachment-panel-content";
export type { AttachmentSearchInputProps } from "./attachment-search-input";
export type { AttachmentIndicatorProps } from "./attachment-indicator";
export type { AttachmentPreviewModalProps } from "./attachment-preview-modal";
export type { BookmarkSelectListProps } from "./bookmark-select-list";
export type { FileUploadZoneProps } from "./file-upload-zone";
export type { ContentPreviewProps } from "./content-preview";
export type {
  AttachmentErrorBoundaryProps,
  WithErrorBoundaryOptions,
} from "./attachment-error-boundary";
