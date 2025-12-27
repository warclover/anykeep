/**
 * MD 阅读器高亮 Context Provider
 * Spec: md-reader-upgrade / REQ-10
 *
 * 功能：
 * - 创建 Context 和 Provider
 * - 整合 useHighlights Hook
 * - 管理工具栏显示状态
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useHighlights } from "../../hooks/reader/use-highlights";
import type {
  HighlightContextValue,
  HighlightToolbarPosition,
  UseHighlightsOptions,
} from "../../types/reader";

// ============================================
// Context 创建
// ============================================

const HighlightContext = createContext<HighlightContextValue | null>(null);

// ============================================
// Props 类型
// ============================================

export interface HighlightProviderProps extends UseHighlightsOptions {
  children: ReactNode;
}

// ============================================
// Provider 实现
// ============================================

/**
 * 高亮 Context Provider
 *
 * 为子组件提供高亮状态和操作方法。
 *
 * @example
 * ```tsx
 * function ReaderPage({ collectionId }) {
 *   const contentRef = useRef<HTMLDivElement>(null);
 *
 *   return (
 *     <HighlightProvider
 *       collectionId={collectionId}
 *       contentRef={contentRef}
 *     >
 *       <div ref={contentRef}>
 *         <MdRenderer content={content} />
 *       </div>
 *       <HighlightToolbarContainer />
 *     </HighlightProvider>
 *   );
 * }
 * ```
 */
export function HighlightProvider({
  collectionId,
  contentRef,
  children,
}: HighlightProviderProps) {
  // 使用 useHighlights Hook
  const highlightsResult = useHighlights({ collectionId, contentRef });

  // 工具栏位置状态（从 hook 获取并扩展）
  const [toolbarPosition, setToolbarPosition] =
    useState<HighlightToolbarPosition | null>(null);

  // 当前编辑的高亮 ID
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(
    null,
  );

  // 同步 hook 内部的工具栏位置到 context
  // 当有新选区时，更新工具栏位置
  const internalToolbarPosition = (
    highlightsResult as unknown as {
      _toolbarPosition: HighlightToolbarPosition | null;
    }
  )._toolbarPosition;

  // 合并工具栏位置（优先使用编辑模式的位置，否则使用选区位置）
  const effectiveToolbarPosition = editingHighlightId
    ? toolbarPosition
    : internalToolbarPosition;

  /**
   * 设置编辑高亮
   */
  const setEditingHighlight = useCallback(
    (id: string | null, position?: HighlightToolbarPosition | null) => {
      setEditingHighlightId(id);
      if (position !== undefined) {
        setToolbarPosition(position);
      }
    },
    [],
  );

  /**
   * 清除选择（扩展版本，同时清除编辑状态）
   */
  const clearSelectionExtended = useCallback(() => {
    highlightsResult.clearSelection();
    setEditingHighlightId(null);
    setToolbarPosition(null);
  }, [highlightsResult]);

  // ============================================
  // Context Value
  // ============================================

  const contextValue = useMemo<HighlightContextValue>(
    () => ({
      // 来自 useHighlights
      highlights: highlightsResult.highlights,
      isLoading: highlightsResult.isLoading,
      createHighlight: highlightsResult.createHighlight,
      updateHighlight: highlightsResult.updateHighlight,
      deleteHighlight: highlightsResult.deleteHighlight,
      selectedRange: highlightsResult.selectedRange,
      clearSelection: clearSelectionExtended,

      // Context 扩展
      toolbarPosition: effectiveToolbarPosition,
      setToolbarPosition,
      editingHighlightId,
      setEditingHighlight,
    }),
    [
      highlightsResult.highlights,
      highlightsResult.isLoading,
      highlightsResult.createHighlight,
      highlightsResult.updateHighlight,
      highlightsResult.deleteHighlight,
      highlightsResult.selectedRange,
      clearSelectionExtended,
      effectiveToolbarPosition,
      editingHighlightId,
      setEditingHighlight,
    ],
  );

  return (
    <HighlightContext.Provider value={contextValue}>
      {children}
    </HighlightContext.Provider>
  );
}

// ============================================
// Hook: useHighlightContext
// ============================================

/**
 * 获取高亮 Context
 *
 * @throws 如果在 HighlightProvider 外部使用会抛出错误
 *
 * @example
 * ```tsx
 * function HighlightToolbarContainer() {
 *   const {
 *     toolbarPosition,
 *     selectedRange,
 *     createHighlight,
 *     clearSelection,
 *   } = useHighlightContext();
 *
 *   if (!toolbarPosition || !selectedRange) {
 *     return null;
 *   }
 *
 *   return (
 *     <HighlightToolbar
 *       position={toolbarPosition}
 *       onColorSelect={(color) => {
 *         createHighlight(selectedRange, color);
 *       }}
 *       onClose={clearSelection}
 *     />
 *   );
 * }
 * ```
 */
export function useHighlightContext(): HighlightContextValue {
  const context = useContext(HighlightContext);

  if (!context) {
    throw new Error(
      "useHighlightContext must be used within a HighlightProvider",
    );
  }

  return context;
}

// ============================================
// 导出
// ============================================

export default HighlightProvider;
