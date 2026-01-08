/**
 * 悬浮快速添加按钮组件
 *
 * 在所有页面显示悬浮按钮，支持：
 * - 快速添加书签
 * - 键盘快捷键 Ctrl/Cmd + K
 * - 用户可配置显示/隐藏
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Link as LinkIcon, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

// ============================================
// 常量定义
// ============================================

const QUICK_ADD = {
  BUTTON_TITLE: "快速添加 (Ctrl+K)",
  DIALOG: {
    TITLE: "快速添加书签",
    DESCRIPTION: "输入 URL 快速添加到收藏",
    URL_LABEL: "网址",
    URL_PLACEHOLDER: "https://example.com",
    SUBMIT: "添加",
    SUBMITTING: "添加中...",
    SUCCESS: "书签添加成功",
    ERROR: "添加失败，请重试",
  },
};

// 不显示悬浮按钮的页面路径
const EXCLUDED_PATHS = ["/home", "/login", "/register", "/onboarding"];

// ============================================
// Hook: 快捷键监听
// ============================================

function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options?: { ctrlKey?: boolean; metaKey?: boolean },
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const ctrlOrMeta =
        (options?.ctrlKey && event.ctrlKey) ||
        (options?.metaKey && event.metaKey);

      if (ctrlOrMeta && event.key.toLowerCase() === key.toLowerCase()) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, callback, options]);
}

// ============================================
// 主组件
// ============================================

export function FloatingQuickAdd() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 检查是否应该显示按钮
  const shouldShow = !EXCLUDED_PATHS.some((path) => pathname === path);

  // 打开对话框
  const handleOpen = useCallback(() => {
    setOpen(true);
    setUrl("");
  }, []);

  // 监听 Ctrl/Cmd + K
  useKeyboardShortcut("k", handleOpen, { ctrlKey: true, metaKey: true });

  // 提交添加
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) return;

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      toast.error("请输入有效的网址");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        throw new Error("添加失败");
      }

      toast.success(QUICK_ADD.DIALOG.SUCCESS);
      setOpen(false);
      setUrl("");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          url: url.trim(),
        },
        "Failed to add bookmark via quick add",
      );
      toast.error(QUICK_ADD.DIALOG.ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 首页已有快速添加功能，不显示悬浮按钮
  if (!shouldShow) {
    return null;
  }

  return (
    <>
      {/* 悬浮按钮 */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          className={cn(
            "rounded-full shadow-lg hover:shadow-xl transition-all",
            "w-14 h-14",
            "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600",
          )}
          onClick={handleOpen}
          title={QUICK_ADD.BUTTON_TITLE}
          aria-label={QUICK_ADD.BUTTON_TITLE}
        >
          <Plus className="size-6" aria-hidden="true" />
        </Button>
      </div>

      {/* 快速添加对话框 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="size-5 text-pink-500" />
              {QUICK_ADD.DIALOG.TITLE}
            </DialogTitle>
            <DialogDescription>
              {QUICK_ADD.DIALOG.DESCRIPTION}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-add-url">
                {QUICK_ADD.DIALOG.URL_LABEL}
              </Label>
              <Input
                id="quick-add-url"
                type="url"
                placeholder={QUICK_ADD.DIALOG.URL_PLACEHOLDER}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={!url.trim() || isSubmitting}
                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {QUICK_ADD.DIALOG.SUBMITTING}
                  </>
                ) : (
                  QUICK_ADD.DIALOG.SUBMIT
                )}
              </Button>
            </div>
          </form>

          {/* 快捷键提示 */}
          <p className="text-xs text-center text-gray-400">
            提示：按{" "}
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
              Ctrl
            </kbd>{" "}
            +{" "}
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
              K
            </kbd>{" "}
            可随时打开此面板
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
