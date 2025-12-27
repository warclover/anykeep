/**
 * 键盘导航帮助组件
 * Spec: md-reader-upgrade / REQ-9
 *
 * 显示可用的键盘快捷键列表
 */

"use client";

import { useMemo } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  KEYBOARD_SHORTCUTS_HELP,
  SHORTCUT_CATEGORY_LABELS,
  type ShortcutHelpItem,
} from "../../hooks/reader/use-keyboard-nav";

// ============================================
// 类型定义
// ============================================

export interface KeyboardNavHelpProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 子组件
// ============================================

/**
 * 快捷键标签
 */
function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.75rem] items-center justify-center",
        "rounded border px-1.5 py-0.5",
        "bg-muted/50 border-border",
        "font-mono text-xs font-medium",
        "shadow-sm",
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * 快捷键行
 */
function ShortcutRow({ shortcut }: { shortcut: ShortcutHelpItem }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, index) => (
          <span key={key} className="flex items-center gap-1">
            {index > 0 && (
              <span className="text-muted-foreground text-xs">/</span>
            )}
            <KeyBadge>{key}</KeyBadge>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * 快捷键分类组
 */
function ShortcutGroup({
  category,
  shortcuts,
}: {
  category: ShortcutHelpItem["category"];
  shortcuts: ShortcutHelpItem[];
}) {
  const label = SHORTCUT_CATEGORY_LABELS[category];

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium text-muted-foreground mb-2">
        {label}
      </h4>
      <div className="divide-y divide-border">
        {shortcuts.map((shortcut, index) => (
          <ShortcutRow key={index} shortcut={shortcut} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

/**
 * 键盘导航帮助对话框
 *
 * @example
 * ```tsx
 * const [isHelpOpen, setIsHelpOpen] = useState(false);
 *
 * <KeyboardNavHelp
 *   isOpen={isHelpOpen}
 *   onClose={() => setIsHelpOpen(false)}
 * />
 * ```
 */
export function KeyboardNavHelp({
  isOpen,
  onClose,
  className,
}: KeyboardNavHelpProps) {
  // 按分类分组快捷键
  const groupedShortcuts = useMemo(() => {
    const groups: Record<ShortcutHelpItem["category"], ShortcutHelpItem[]> = {
      navigation: [],
      mode: [],
      other: [],
    };

    for (const shortcut of KEYBOARD_SHORTCUTS_HELP) {
      groups[shortcut.category].push(shortcut);
    }

    return groups;
  }, []);

  // 分类顺序
  const categoryOrder: ShortcutHelpItem["category"][] = [
    "navigation",
    "mode",
    "other",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn("max-w-md", className)}
        aria-describedby="keyboard-shortcuts-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5" />
            键盘快捷键
          </DialogTitle>
          <DialogDescription id="keyboard-shortcuts-description">
            使用键盘快捷键快速控制阅读器
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {categoryOrder.map((category) => {
            const shortcuts = groupedShortcuts[category];
            if (shortcuts.length === 0) return null;

            return (
              <ShortcutGroup
                key={category}
                category={category}
                shortcuts={shortcuts}
              />
            );
          })}
        </div>

        {/* 底部提示 */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            按 <KeyBadge>Esc</KeyBadge> 或点击外部关闭
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
