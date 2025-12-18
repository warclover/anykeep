/**
 * UI Event Bus - Event Type Definitions
 * V4.2 UI 事件类型定义
 *
 * 用于替代 Window CustomEvent 的类型安全 UI 事件通信
 */

import type { ViewMode, LayoutMode, DialogType } from "@/components/home/types";
import type { BookmarkWithFolder } from "@/components/home/types";

// ============================================================================
// 视图模式事件
// ============================================================================

/** 视图模式变更事件 */
export interface ViewModeChangeEvent {
  mode: ViewMode;
}

/** 布局模式变更事件 */
export interface LayoutModeChangeEvent {
  mode: LayoutMode;
}

/** 翻转卡片模式变更事件 */
export interface FlipCardChangeEvent {
  enabled: boolean;
}

// ============================================================================
// 筛选事件
// ============================================================================

/** 平台筛选变更事件 */
export interface PlatformChangeEvent {
  platform: string;
  folder: string;
}

/** 用途标签筛选变更事件 */
export interface UsageTagFilterChangeEvent {
  usageTags: string[];
}

// ============================================================================
// 对话框事件
// ============================================================================

/** 打开对话框事件 */
export interface OpenDialogEvent {
  type: DialogType;
}

/** 关闭对话框事件 */
export interface CloseDialogEvent {
  type?: DialogType;
}

// ============================================================================
// 选择模式事件
// ============================================================================

/** 切换选择模式事件 */
export interface ToggleSelectionModeEvent {
  enabled: boolean;
}

// ============================================================================
// 书签事件
// ============================================================================

/** 书签创建事件 */
export interface BookmarkCreatedEvent {
  bookmark: BookmarkWithFolder;
}

/** 书签更新事件 */
export interface BookmarkUpdatedEvent {
  bookmarkId: number;
  changes: Partial<BookmarkWithFolder>;
}

/** 书签删除事件 */
export interface BookmarkDeletedEvent {
  bookmarkId: number;
}

// ============================================================================
// UI 事件类型映射
// ============================================================================

/** UI 事件类型映射 */
export interface UIEventTypes {
  // 视图模式
  "ui:view:mode:change": ViewModeChangeEvent;
  "ui:view:layout:change": LayoutModeChangeEvent;
  "ui:view:flipCard:change": FlipCardChangeEvent;

  // 筛选
  "ui:filter:platform:change": PlatformChangeEvent;
  "ui:filter:usageTags:change": UsageTagFilterChangeEvent;

  // 对话框
  "ui:dialog:open": OpenDialogEvent;
  "ui:dialog:close": CloseDialogEvent;

  // 选择模式
  "ui:selection:toggle": ToggleSelectionModeEvent;

  // 书签
  "ui:bookmark:created": BookmarkCreatedEvent;
  "ui:bookmark:updated": BookmarkUpdatedEvent;
  "ui:bookmark:deleted": BookmarkDeletedEvent;
}

/** UI 事件名称联合类型 */
export type UIEventName = keyof UIEventTypes;

/** 获取 UI 事件负载类型 */
export type UIEventPayload<K extends UIEventName> = UIEventTypes[K];

// ============================================================================
// 旧事件名称映射（用于迁移）
// ============================================================================

/**
 * 旧 Window Event 名称到新 UI Event 名称的映射
 * 用于渐进式迁移
 */
export const LEGACY_EVENT_MAP = {
  viewModeChange: "ui:view:mode:change",
  layoutModeChange: "ui:view:layout:change",
  flipCardChange: "ui:view:flipCard:change",
  platformChange: "ui:filter:platform:change",
  usageTagFilterChange: "ui:filter:usageTags:change",
  openDialog: "ui:dialog:open",
  toggleSelectionMode: "ui:selection:toggle",
  bookmarkCreated: "ui:bookmark:created",
} as const;

export type LegacyEventName = keyof typeof LEGACY_EVENT_MAP;
