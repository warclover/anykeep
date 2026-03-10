/**
 * FAB 悬浮操作菜单组件
 *
 * 统一的悬浮操作按钮，整合快速收藏和反馈建议功能
 * - 点击主按钮展开/收起子菜单
 * - 支持 Ctrl/Cmd + K 快捷键直接打开收藏
 * - 子按钮带文字标签，stagger 动画弹出
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Link as LinkIcon,
  MessageSquarePlus,
  Loader2,
} from "lucide-react";
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
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useClipboardPaste } from "@/components/quick-add/hooks/useClipboardPaste";
import { FABItem } from "./fab-item";
import { FAB_EXCLUDED_PATHS, FAB_LABELS, FAB_STYLES } from "./fab-constants";
import { API_BOOKMARKS } from "@/lib/constants/api-paths";

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
// Hook: 点击外部关闭
// ============================================

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    // 延迟添加监听器，避免触发展开的那次点击
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
    };
  }, [ref, handler, enabled]);
}

// ============================================
// 主组件
// ============================================

export function FloatingActionMenu() {
  const pathname = usePathname();
  const { open: openFeedback } = useFeedback();

  // 菜单展开状态
  const [isExpanded, setIsExpanded] = useState(false);

  // 快速收藏对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 提交逻辑（提取为独立函数以便自动调用）
  const submitBookmark = useCallback(async (targetUrl: string) => {
    const trimmedUrl = targetUrl.trim();
    if (!trimmedUrl) return;

    // 验证 URL 格式
    try {
      new URL(trimmedUrl);
    } catch {
      toast.error(FAB_LABELS.QUICK_ADD.INVALID_URL);
      return;
    }

    // 1. 开启 Loading 状态，提供视觉反馈
    setIsSubmitting(true);

    // 2. 等待请求完成（最少展示 300ms 加载态，防止对话框闪烁）
    const MIN_DISPLAY_MS = 300;

    try {
      const [response] = await Promise.all([
        fetch(API_BOOKMARKS.legacyList, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmedUrl }),
        }),
        new Promise((resolve) => setTimeout(resolve, MIN_DISPLAY_MS)),
      ]);

      // 3. 请求完成后关闭对话框
      setDialogOpen(false);
      setUrl("");

      if (!response.ok) {
        throw new Error("添加失败");
      }

      toast.success(FAB_LABELS.QUICK_ADD.SUCCESS);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          url: trimmedUrl,
        },
        "Failed to add bookmark via quick add",
      );
      toast.error(FAB_LABELS.QUICK_ADD.ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // 剪贴板自动读取标记（每次打开对话框只读取一次）
  const hasAutoReadRef = useRef(false);

  // 容器 ref（用于点击外部关闭）
  const containerRef = { current: null as HTMLDivElement | null };

  // 剪贴板监测 hook
  const { readClipboard, extractUrlFromText } = useClipboardPaste({
    onUrlExtracted: (extractedUrl) => {
      // 自动填充提取到的 URL
      setUrl(extractedUrl);
      // 自动提交
      submitBookmark(extractedUrl);
    },
  });

  // 检查是否应该显示
  const shouldShow = !FAB_EXCLUDED_PATHS.some((path) => pathname === path);

  // 切换菜单展开
  const toggleMenu = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // 关闭菜单
  const closeMenu = useCallback(() => {
    setIsExpanded(false);
  }, []);

  // 打开快速收藏对话框
  const handleOpenQuickAdd = useCallback(() => {
    setDialogOpen(true);
    setUrl("");
    hasAutoReadRef.current = false; // 重置自动读取标记
    closeMenu();
  }, [closeMenu]);

  // 打开反馈
  const handleOpenFeedback = useCallback(() => {
    openFeedback();
    closeMenu();
  }, [openFeedback, closeMenu]);

  // 监听 Ctrl/Cmd + K（直接打开收藏，不展开菜单）
  useKeyboardShortcut("k", handleOpenQuickAdd, {
    ctrlKey: true,
    metaKey: true,
  });

  // 点击外部关闭菜单
  useClickOutside(containerRef, closeMenu, isExpanded);

  // 输入框聚焦时自动读取剪贴板
  const handleInputFocus = useCallback(async () => {
    // 每次打开对话框只自动读取一次
    if (!hasAutoReadRef.current && !url) {
      hasAutoReadRef.current = true;
      await readClipboard();
    }
  }, [readClipboard, url]);

  // 手动粘贴时提取 URL
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData("text");
      const extractedUrl = extractUrlFromText(pastedText);

      if (extractedUrl) {
        e.preventDefault();
        setUrl(extractedUrl);
        // 手动粘贴也���动提交，保持体验一致
        submitBookmark(extractedUrl);
      }
    },
    [extractUrlFromText, submitBookmark],
  );

  // 提交添加书签
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitBookmark(url);
  };

  // 不在排除路径中才显示
  if (!shouldShow) {
    return null;
  }

  return (
    <>
      {/* FAB 容器 */}
      <div
        ref={(el) => {
          containerRef.current = el;
        }}
        className="fixed bottom-6 right-6 z-50"
      >
        {/* 子按钮：反馈建议（索引1，最上方） */}
        <FABItem
          icon={MessageSquarePlus}
          label={FAB_LABELS.FEEDBACK.LABEL}
          onClick={handleOpenFeedback}
          visible={isExpanded}
          index={1}
        />

        {/* 子按钮：快速收藏（索引0，靠近主按钮） */}
        <FABItem
          icon={LinkIcon}
          label={FAB_LABELS.QUICK_ADD.LABEL}
          onClick={handleOpenQuickAdd}
          visible={isExpanded}
          index={0}
        />

        {/* 主按钮 */}
        <Button
          size="lg"
          className={cn(
            "rounded-full shadow-lg hover:shadow-xl transition-all",
            FAB_STYLES.MAIN_SIZE,
            "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600",
          )}
          onClick={toggleMenu}
          aria-label={
            isExpanded
              ? FAB_LABELS.MAIN_BUTTON.ARIA_COLLAPSE
              : FAB_LABELS.MAIN_BUTTON.ARIA_EXPAND
          }
          aria-expanded={isExpanded}
        >
          <Plus
            className={cn(
              "size-6 transition-transform duration-200",
              isExpanded && "rotate-45",
            )}
            aria-hidden="true"
          />
        </Button>
      </div>

      {/* 快速添加对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="size-5 text-pink-500" />
              {FAB_LABELS.QUICK_ADD.DIALOG_TITLE}
            </DialogTitle>
            <DialogDescription>
              {FAB_LABELS.QUICK_ADD.DIALOG_DESCRIPTION}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-add-url">
                {FAB_LABELS.QUICK_ADD.URL_LABEL}
              </Label>
              <Input
                id="quick-add-url"
                type="url"
                placeholder={FAB_LABELS.QUICK_ADD.URL_PLACEHOLDER}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onFocus={handleInputFocus}
                onPaste={handlePaste}
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
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
                    {FAB_LABELS.QUICK_ADD.SUBMITTING}
                  </>
                ) : (
                  FAB_LABELS.QUICK_ADD.SUBMIT
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
