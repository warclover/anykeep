/**
 * MD 收藏功能 - Components 模块入口
 * P2-007: Markdown 内容收藏
 */

// ============================================
// M4: 专业阅读视图
// ============================================
export { MdRenderer } from "./md-renderer";
export { MdReaderView } from "./md-reader-view";

// ============================================
// 待实现组件 (P2-007 后续阶段)
// ============================================

// P2-007-6: MD 列表页面 - 待实现
// export { MdCollectionPage } from './md-collection-page';

// P2-007-7: 拖拽上传区 - 待实现
// export { MdUploadZone } from './md-upload-zone';

// P2-007-8: 粘贴对话框 - 待实现
// export { MdPasteDialog } from './md-paste-dialog';

// ============================================
// 列表视图项
// ============================================
export { MdListItem } from "./md-list-item";
export type { MdListItemProps } from "./md-list-item";

// ============================================
// 卡片视图
// ============================================
export { MdCardItem } from "./md-card-item";

// ============================================
// 视图切换
// ============================================
export { MdViewToggle } from "./md-view-toggle";

// 空状态组件 - 待实现
// export { MdEmptyState } from './md-empty-state';

// ============================================
// 阅读器增强组件
// ============================================
export * from "./reader";
