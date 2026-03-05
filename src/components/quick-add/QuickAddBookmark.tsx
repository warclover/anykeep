"use client";

/**
 * Quick Add Bookmark - Main Component
 *
 * The main controller component that manages the quick add bookmark flow.
 * Integrates input, preview, success, and drawer components.
 */

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import { clientLogger } from "@/lib/client-logger";

// Hooks
import {
  useQuickAddState,
  type BookmarkMetadata,
} from "./hooks/useQuickAddState";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { normalizeUrl } from "./hooks/useClipboardPaste";

// Inline components
import { QuickAddInput } from "./inline/QuickAddInput";
import { QuickAddPreview, QuickAddError } from "./inline/QuickAddPreview";

// Drawer (will be implemented later)
import { DetailDrawer } from "./drawer/DetailDrawer";

export interface QuickAddBookmarkProps {
  onBookmarkCreated?: (bookmark: unknown) => void;
  className?: string;
}

export function QuickAddBookmark({
  onBookmarkCreated,
  className,
}: QuickAddBookmarkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track last successfully processed URL to prevent auto-paste repeat
  const [lastProcessedUrl, setLastProcessedUrl] = useState<string | null>(null);
  // V4.2.21: Track submit error to prevent auto-retry infinite loop
  const [hasSubmitError, setHasSubmitError] = useState(false);

  // State management
  const { state, actions } = useQuickAddState();
  const {
    mode,
    drawerState,
    inputValue,
    extractedUrl,
    metadata,
    metadataError,
    folderId,
    tags,
    notes,
    isSubmitting,
  } = state;

  // Fetch metadata when URL is detected
  const fetchMetadata = useCallback(
    async (url: string) => {
      actions.startLoading();

      try {
        const response = await fetch(
          `/api/bookmarks/metadata?url=${encodeURIComponent(url)}`,
        );

        if (!response.ok) {
          throw new Error("无法获取网页信息");
        }

        const responseData = await response.json();
        // API 返回格式: { data: { title, description, ... } }
        const data = responseData.data || responseData;

        const bookmarkMetadata: BookmarkMetadata = {
          title: data.title || url,
          description: data.description,
          coverUrl: data.coverUrl,
          sourceName: data.sourceName,
          author: data.author,
          publishTime: data.publishTime,
          wordCount: data.wordCount,
          imageCount: data.imageCount,
          platform: data.platform,
          favicon: data.favicon,
        };

        actions.showPreview(bookmarkMetadata);
      } catch (error) {
        clientLogger.error({ error }, "Failed to fetch metadata");
        // Still show preview with URL as title
        actions.showPreview({
          title: url,
          platform: "DEFAULT",
        });
      }
    },
    [actions],
  );

  // Handle URL detected from input
  const handleUrlDetected = useCallback(
    (url: string) => {
      setHasSubmitError(false); // V4.2.21: 重置错误状态
      actions.setExtractedUrl(url);
      fetchMetadata(url);
    },
    [actions, fetchMetadata],
  );

  // Submit bookmark
  const handleSubmit = useCallback(async () => {
    if (!extractedUrl || isSubmitting) return;

    actions.setSubmitting(true);
    // V4.2.21: 重置错误状态
    setHasSubmitError(false);

    try {
      // 规范 URL：补全协议并 trim，避免服务端 bookmarkUrlSchema 校验 400
      const url = normalizeUrl(extractedUrl.trim());
      // 仅当 coverUrl 为合法 HTTP(S) 时提交，避免服务端校验 400
      const rawCover = metadata?.coverUrl;
      const coverUrl =
        typeof rawCover === "string" && rawCover.startsWith("http")
          ? rawCover
          : undefined;
      // 所有可选字段用 ?? undefined，避免 JSON 里出现 null 导致 Zod 校验失败
      const payload: Record<string, unknown> = {
        url,
        title: metadata?.title ?? undefined,
        description: metadata?.description ?? undefined,
        folderId: folderId || undefined,
        userTags: tags.length > 0 ? tags : undefined,
        notes: notes || undefined,
        sourceName: metadata?.sourceName ?? undefined,
        author: metadata?.author ?? undefined,
        publishTime: metadata?.publishTime ?? undefined,
        wordCount: metadata?.wordCount ?? undefined,
        imageCount: metadata?.imageCount ?? undefined,
      };
      if (coverUrl) payload.coverUrl = coverUrl;

      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // API 返回格式: { success: false, error: { code, message, details } }
        let errorMessage = "创建失败";
        const err = errorData?.error;
        if (err) {
          if (typeof err === "string") {
            errorMessage = err;
          } else if (typeof err.message === "string" && err.message) {
            errorMessage = err.message;
          } else if (Array.isArray(err.details) && err.details[0]?.message) {
            errorMessage = String(err.details[0].message);
          }
        }
        clientLogger.warn(
          { status: response.status, errorData, url: payload.url },
          "QuickAdd: create bookmark failed",
        );
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      // API 返回格式为 { success: true, data: bookmark }
      const newBookmark = responseData.data;

      // V4.3.0: 吸入动效已包含成功反馈（图标弹跳发光），跳过旧 success 态
      // 延迟 reset 让弹跳发光动画有时间展示（弹跳 700ms + 发光 1200ms）
      setTimeout(() => {
        actions.reset();
      }, 1200);

      // Mark URL as processed to prevent auto-paste repeat
      if (extractedUrl) {
        setLastProcessedUrl(extractedUrl);
      }

      // Trigger callback
      onBookmarkCreated?.(newBookmark);

      // Dispatch event for other components
      uiEventBus.emit(UIEvents.BOOKMARK_CREATED, { bookmark: newBookmark });

      // Close drawer if open
      if (drawerState === "open") {
        actions.closeDrawer();
      }
    } catch (error) {
      clientLogger.error({ error }, "Failed to create bookmark");
      toast.error(error instanceof Error ? error.message : "创建失败");
      // V4.2.21: 设置错误状态以阻止自动重试
      setHasSubmitError(true);
      actions.setSubmitting(false);
    }
  }, [
    extractedUrl,
    isSubmitting,
    metadata,
    folderId,
    tags,
    notes,
    actions,
    onBookmarkCreated,
    drawerState,
  ]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: mode === "preview" && drawerState === "closed",
    handlers: {
      onEnter: handleSubmit,
      onTab: actions.openDrawer,
      onEscape: actions.handleCancel,
      onCtrlEnter: () => {
        actions.openDrawer();
      },
    },
    targetRef: containerRef,
  });

  // Handle retry on error
  const handleRetry = useCallback(() => {
    if (extractedUrl) {
      fetchMetadata(extractedUrl);
    }
  }, [extractedUrl, fetchMetadata]);

  // Render based on mode
  const renderContent = () => {
    switch (mode) {
      case "idle":
      case "focused":
      case "loading":
        return (
          <QuickAddInput
            ref={inputRef}
            value={inputValue}
            onChange={actions.setInputValue}
            onFocus={actions.handleFocus}
            onBlur={actions.handleBlur}
            onUrlDetected={handleUrlDetected}
            mode={mode}
            lastProcessedUrl={lastProcessedUrl}
          />
        );

      case "preview":
        return metadata ? (
          <QuickAddPreview
            metadata={metadata}
            onSubmit={handleSubmit}
            onOpenDrawer={actions.openDrawer}
            onCancel={actions.handleCancel}
            isSubmitting={isSubmitting}
            autoSubmit={true}
            hasSubmitError={hasSubmitError}
          />
        ) : null;

      case "error":
        return (
          <QuickAddError
            error={metadataError || "发生错误"}
            onRetry={handleRetry}
            onCancel={actions.handleCancel}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        className={cn("quick-add-bookmark", "w-full", className)}
        data-mode={mode}
      >
        {renderContent()}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={drawerState === "open" || drawerState === "opening"}
        onClose={actions.closeDrawer}
        metadata={metadata}
        folderId={folderId}
        tags={tags}
        notes={notes}
        onFolderChange={actions.setFolderId}
        onTagsChange={actions.setTags}
        onNotesChange={actions.setNotes}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
