/**
 * Keyboard Shortcuts Hook
 *
 * Handles keyboard shortcuts for the quick add component.
 * - Enter: Quick submit
 * - Tab: Open detail drawer
 * - Escape: Cancel/Reset
 * - Ctrl+Enter: Open drawer and submit
 */

import { useCallback, useEffect } from "react";

export interface KeyboardShortcutHandlers {
  onEnter?: () => void;
  onTab?: () => void;
  onEscape?: () => void;
  onCtrlEnter?: () => void;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  handlers: KeyboardShortcutHandlers;
  targetRef?: React.RefObject<HTMLElement | null>;
}

export function useKeyboardShortcuts({
  enabled = true,
  handlers,
  targetRef,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check if event target is within our component
      if (
        targetRef?.current &&
        !targetRef.current.contains(event.target as Node)
      ) {
        return;
      }

      const { key, ctrlKey, metaKey } = event;

      switch (key) {
        case "Enter":
          if (ctrlKey || metaKey) {
            // Ctrl+Enter or Cmd+Enter
            event.preventDefault();
            handlers.onCtrlEnter?.();
          } else if (!event.shiftKey) {
            // Enter (not in textarea with shift)
            const target = event.target as HTMLElement;
            const isTextarea = target.tagName === "TEXTAREA";

            if (!isTextarea) {
              event.preventDefault();
              handlers.onEnter?.();
            }
          }
          break;

        case "Tab":
          // Only handle Tab if not shift-tab (backwards navigation)
          if (!event.shiftKey) {
            event.preventDefault();
            handlers.onTab?.();
          }
          break;

        case "Escape":
          event.preventDefault();
          handlers.onEscape?.();
          break;

        default:
          break;
      }
    },
    [enabled, handlers, targetRef],
  );

  useEffect(() => {
    const target = targetRef?.current || document;
    target.addEventListener("keydown", handleKeyDown as EventListener);

    return () => {
      target.removeEventListener("keydown", handleKeyDown as EventListener);
    };
  }, [handleKeyDown, targetRef]);

  return { handleKeyDown };
}

/**
 * Get keyboard shortcut display text based on OS
 */
export function getShortcutDisplayText(shortcut: string): string {
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac");

  const replacements: Record<string, string> = {
    Ctrl: isMac ? "⌘" : "Ctrl",
    Alt: isMac ? "⌥" : "Alt",
    Shift: "⇧",
    Enter: "↵",
    Tab: "⇥",
    Escape: "Esc",
  };

  let result = shortcut;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(key, value);
  }

  return result;
}

/**
 * Keyboard shortcut hints for display
 */
export const KEYBOARD_SHORTCUTS = {
  quickSave: {
    key: "Enter",
    display: "↵",
    description: "快速收藏",
  },
  openDrawer: {
    key: "Tab",
    display: "⇥",
    description: "更多选项",
  },
  cancel: {
    key: "Escape",
    display: "Esc",
    description: "取消",
  },
  saveWithOptions: {
    key: "Ctrl+Enter",
    display: "Ctrl+↵",
    description: "保存并关闭",
  },
} as const;
