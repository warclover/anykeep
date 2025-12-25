/**
 * Phase 4: 上下文面板组件
 *
 * 功能：
 * - 上下文项管理 Hook（支持持久化存储）
 * - 上下文指示器（简洁版）
 * - 上下文面板（完整版）
 *
 * @version 1.2.0
 * @since 2025-12-25
 */

"use client";

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, X, Plus } from "lucide-react";
import type { ContextItem } from "./types";

// =============================================================================
// 常量定义
// =============================================================================

/** localStorage 存储键前缀 */
const STORAGE_KEY_PREFIX = "anykeep_context_";

/** 存储数据过期时间（24 小时） */
const STORAGE_EXPIRY_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 上下文引用格式（用于 API 请求）
 */
export interface ContextReferences {
  bookmarkIds?: number[];
  folderIds?: number[];
  tagNames?: string[];
  previousOutputId?: string;
}

/**
 * 持久化存储数据格式
 */
interface PersistedContextData {
  items: ContextItem[];
  expanded: boolean;
  timestamp: number;
}

/**
 * useContextItems 配置选项
 */
export interface UseContextItemsOptions {
  /** 存储键（用于隔离不同会话，默认 "default"） */
  storageKey?: string;
  /** 是否启用持久化存储（默认 true） */
  persist?: boolean;
  /** 初始项（仅在无持久化数据时使用） */
  initialItems?: ContextItem[];
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 从 localStorage 读取持久化数据
 */
function loadFromStorage(key: string): PersistedContextData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (!raw) return null;

    const data: PersistedContextData = JSON.parse(raw);

    // 检查是否过期
    if (Date.now() - data.timestamp > STORAGE_EXPIRY_MS) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * 保存数据到 localStorage
 */
function saveToStorage(
  key: string,
  items: ContextItem[],
  expanded: boolean,
): void {
  if (typeof window === "undefined") return;

  try {
    const data: PersistedContextData = {
      items,
      expanded,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, JSON.stringify(data));
  } catch {
    // 存储失败（如配额超限），静默忽略
  }
}

/**
 * 清除 localStorage 数据
 */
function clearStorage(key: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
  } catch {
    // 静默忽略
  }
}

// =============================================================================
// Hook: 上下文项管理
// =============================================================================

/**
 * 上下文项管理 Hook
 *
 * 功能：
 * - 上下文项 CRUD 操作
 * - localStorage 持久化存储
 * - 会话隔离（通过 storageKey）
 * - 自动过期清理（24 小时）
 *
 * @param options 配置选项
 */
export function useContextItems(options: UseContextItemsOptions = {}) {
  const { storageKey = "default", persist = true, initialItems = [] } = options;

  // 状态
  const [items, setItems] = useState<ContextItem[]>(initialItems);
  const [expanded, setExpanded] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // 防止初始化时触发保存
  const isInitialMount = useRef(true);

  // 从 localStorage 恢复数据（仅客户端）
  useEffect(() => {
    if (!persist) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 水合模式需要同步设置状态
      setIsHydrated(true);
      return;
    }

    const persisted = loadFromStorage(storageKey);
    if (persisted) {
      setItems(persisted.items);
      setExpanded(persisted.expanded);
    }

    setIsHydrated(true);
  }, [storageKey, persist]);

  // 保存到 localStorage（数据变化时）
  useEffect(() => {
    // 跳过初始挂载和未水合状态
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!persist || !isHydrated) return;

    saveToStorage(storageKey, items, expanded);
  }, [items, expanded, storageKey, persist, isHydrated]);

  // 添加上下文项
  const addItem = useCallback((item: ContextItem) => {
    setItems((prev) => {
      // 避免重复
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
  }, []);

  // 批量添加上下文项
  const addItems = useCallback((newItems: ContextItem[]) => {
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const uniqueNewItems = newItems.filter(
        (item) => !existingIds.has(item.id),
      );
      if (uniqueNewItems.length === 0) return prev;
      return [...prev, ...uniqueNewItems];
    });
  }, []);

  // 移除上下文项
  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // 清空所有上下文项
  const clearItems = useCallback(() => {
    setItems([]);
    setExpanded(false);
    if (persist) {
      clearStorage(storageKey);
    }
  }, [persist, storageKey]);

  /**
   * 将 ContextItem[] 转换为 API 请求格式
   */
  const getContextReferences = useCallback((): ContextReferences => {
    const refs: ContextReferences = {};

    const bookmarkIds: number[] = [];
    const folderIds: number[] = [];
    const tagNames: string[] = [];

    for (const item of items) {
      if (item.type === "bookmark" && item.metadata?.id) {
        bookmarkIds.push(item.metadata.id as number);
      } else if (item.type === "folder" && item.metadata?.id) {
        folderIds.push(item.metadata.id as number);
      } else if (item.type === "tag") {
        tagNames.push(item.title);
      } else if (item.type === "previous_output" && item.metadata?.messageId) {
        refs.previousOutputId = item.metadata.messageId as string;
      }
    }

    if (bookmarkIds.length > 0) refs.bookmarkIds = bookmarkIds;
    if (folderIds.length > 0) refs.folderIds = folderIds;
    if (tagNames.length > 0) refs.tagNames = tagNames;

    return refs;
  }, [items]);

  const hasItems = items.length > 0;

  return {
    items,
    addItem,
    addItems,
    removeItem,
    clearItems,
    setItems,
    hasItems,
    expanded,
    setExpanded,
    getContextReferences,
    /** 是否已从 localStorage 恢复数据 */
    isHydrated,
  };
}

// =============================================================================
// Props 类型
// =============================================================================

export interface ContextIndicatorProps {
  items: ContextItem[];
  onExpand: () => void;
  onClear: () => void;
  className?: string;
}

/**
 * ContextPanel Props - 兼容 ai-panel-content-enhanced.tsx 调用
 */
export interface ContextPanelProps {
  items: ContextItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onAddMore?: () => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  className?: string;
}

// =============================================================================
// 组件
// =============================================================================

/**
 * 上下文指示器（简洁版）
 *
 * 显示当前上下文项数量，点击展开完整面板
 */
export const ContextIndicator = memo(function ContextIndicator({
  items,
  onExpand,
  onClear,
  className,
}: ContextIndicatorProps) {
  if (items.length === 0) return null;

  return (
    <div className={`flex items-center gap-1 text-xs ${className ?? ""}`}>
      <button
        type="button"
        onClick={onExpand}
        className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
      >
        <span>📎 {items.length} 项上下文</span>
        <ChevronRight className="size-3" />
      </button>
      <button
        type="button"
        onClick={onClear}
        className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        title="清除上下文"
      >
        <X className="size-3" />
      </button>
    </div>
  );
});

/**
 * 上下文面板（完整版）
 *
 * TODO: Phase 4 实现
 * - 上下文项列表
 * - 拖拽排序
 * - 项目详情预览
 */
export const ContextPanel = memo(function ContextPanel({
  items,
  onRemove,
  onClear,
  onAddMore,
  expanded,
  onExpandedChange,
  className,
}: ContextPanelProps) {
  if (items.length === 0) return null;

  return (
    <div className={`border rounded-lg bg-white shadow-sm ${className ?? ""}`}>
      {/* 面板头部 */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => onExpandedChange(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="size-4 text-gray-500" />
          ) : (
            <ChevronRight className="size-4 text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-700">
            上下文引用 ({items.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onAddMore && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddMore();
              }}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="添加更多"
            >
              <Plus className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="清除全部"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t p-2 max-h-48 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-4">
              暂无上下文引用
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm flex-shrink-0">
                      {item.type === "bookmark" && "🔖"}
                      {item.type === "folder" && "📁"}
                      {item.type === "tag" && "🏷️"}
                      {item.type === "selection" && "✏️"}
                      {item.type === "conversation" && "💬"}
                      {item.type === "search_results" && "🔍"}
                      {item.type === "previous_output" && "📄"}
                    </span>
                    <span className="text-sm text-gray-700 truncate">
                      {item.title}
                    </span>
                    {item.description && (
                      <span className="text-xs text-gray-400 truncate">
                        {item.description}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex-shrink-0"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ContextPanel;
