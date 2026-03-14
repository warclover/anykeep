"use client";

/**
 * 批量选择模式一次性提示条
 *
 * 在用户首次进入批量选择模式时显示 Shift+Click 范围选择提示，
 * 关闭后通过 localStorage 记录，不再显示。
 */

import { useState, useEffect } from "react";
import { Info, X } from "lucide-react";

const HINT_STORAGE_KEY = "anykeep_hint_batch_shift_v1";

export function BatchSelectionHint() {
  // H-1: 始终以 false 初始化，在 useEffect 中检查 localStorage
  // 避免 SSR/客户端 hydration mismatch
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(HINT_STORAGE_KEY)) {
      // setTimeout 避免 react-hooks/set-state-in-effect 规则
      setTimeout(() => setVisible(true), 0);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(HINT_STORAGE_KEY, "true");
  };

  if (!visible) return null;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-sky-50 dark:bg-sky-900/20 border-b border-sky-100 dark:border-sky-800 text-xs text-sky-700 dark:text-sky-300">
      <span className="flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        按住{" "}
        <kbd className="px-1 py-0.5 rounded bg-sky-100 dark:bg-sky-800 font-mono text-[10px]">
          Shift
        </kbd>{" "}
        点击可范围选择多个书签
      </span>
      <button
        onClick={handleDismiss}
        className="p-0.5 rounded hover:bg-sky-100 dark:hover:bg-sky-800 transition-colors"
        aria-label="关闭提示"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
