/**
 * 页面工具栏插槽
 * 渲染在 AppHeader 下方，显示页面注入的工具栏
 */

"use client";

import { usePageToolbar } from "@/contexts/page-toolbar-context";

export function PageToolbarSlot() {
  const pageToolbar = usePageToolbar();

  if (!pageToolbar?.toolbar) {
    return null;
  }

  return (
    <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {pageToolbar.toolbar}
    </div>
  );
}
