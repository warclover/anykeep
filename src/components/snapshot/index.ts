/**
 * Snapshot Components Module (V4.2.1)
 * 快照组件模块入口
 *
 * 导出所有快照相关组件供外部使用
 */

// 基础组件
export { SnapshotButton } from "./snapshot-button";
export type { SnapshotButtonProps } from "./snapshot-button";

export { SnapshotStatus } from "./snapshot-status";
export type { SnapshotStatusProps } from "./snapshot-status";

export { SnapshotViewer } from "./snapshot-viewer";
export type { SnapshotViewerProps, SnapshotContent } from "./snapshot-viewer";

export { SnapshotQuotaBar } from "./snapshot-quota-bar";
export type { SnapshotQuotaBarProps } from "./snapshot-quota-bar";

export { SnapshotQuotaSection } from "./snapshot-quota-section";

export { SnapshotMenuItem } from "./snapshot-menu-item";
export type {
  SnapshotMenuItemProps,
  SnapshotStatusValue,
} from "./snapshot-menu-item";

// 复合组件
export { SnapshotSection } from "./snapshot-section";
export type { SnapshotSectionProps, SnapshotInfo } from "./snapshot-section";

// 懒加载组件（推荐在页面中使用）
export {
  SnapshotButtonLazy,
  SnapshotSectionLazy,
  SnapshotQuotaBarLazy,
  SnapshotQuotaSectionLazy,
  useSnapshotFeature,
} from "./snapshot-lazy";
