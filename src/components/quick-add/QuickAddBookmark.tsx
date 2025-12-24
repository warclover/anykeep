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

// Inline components
import { QuickAddInput } from "./inline/QuickAddInput";
import { QuickAddPreview, QuickAddError } from "./inline/QuickAddPreview";
import { QuickAddSuccess } from "./inline/QuickAddSuccess";

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
      actions.setExtractedUrl(url);
      fetchMetadata(url);
    },
    [actions, fetchMetadata],
  );

  // Submit bookmark
  const handleSubmit = useCallback(async () => {
    if (!extractedUrl || isSubmitting) return;

    actions.setSubmitting(true);

    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: extractedUrl,
          title: metadata?.title,
          description: metadata?.description,
          folderId: folderId || undefined, // Fix: 避免发送 null 导致验证失败
          userTags: tags.length > 0 ? tags : undefined,
          notes: notes || undefined,
          coverUrl: metadata?.coverUrl || undefined, // Fix: 避免发送空字符串
          sourceName: metadata?.sourceName || undefined,
          author: metadata?.author || undefined,
          publishTime: metadata?.publishTime || undefined,
          wordCount: metadata?.wordCount || undefined,
          imageCount: metadata?.imageCount || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Fix: 正确解析错误消息
        const errorMessage =
          typeof errorData.error === "string"
            ? errorData.error
            : errorData.message || "创建失败";
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      // API 返回格式为 { success: true, data: bookmark }
      const newBookmark = responseData.data;

      // Show success state
      actions.showSuccess("已收藏！");

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

  // Handle success dismiss
  const handleSuccessDismiss = useCallback(() => {
    actions.reset();
  }, [actions]);

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

      case "success":
        return (
          <QuickAddSuccess
            message="已收藏！"
            folderName={folderId ? undefined : "待整理"}
            onDismiss={handleSuccessDismiss}
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
