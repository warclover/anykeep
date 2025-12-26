/**
 * 附件内容预览模态框
 *
 * 支持预览书签摘要、文本内容、图片等
 *
 * @version 1.1.0
 * @since 2025-12-26
 * @updated 2025-12-26 - 使用 ContentPreview 共享组件
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import {
  X,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  FileType,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { type AttachmentItem } from "./types";
import { ContentPreview } from "./content-preview";

// =============================================================================
// 类型定义
// =============================================================================

export interface AttachmentPreviewModalProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 要预览的附件 */
  attachment: AttachmentItem | null;
}

// =============================================================================
// 常量
// =============================================================================

const PREVIEW_TEXT = {
  TITLE_BOOKMARK: "书签预览",
  TITLE_FILE: "文件预览",
  NO_CONTENT: "暂无内容",
  SOURCE: "来源",
  CONTENT_SUMMARY: "内容摘要",
  FILE_INFO: "文件信息",
  FILE_SIZE: "文件大小",
  FILE_TYPE: "文件类型",
  OPEN_LINK: "打开链接",
  CONTENT_TRUNCATED: "（内容已截断）",
  IMAGE_PREVIEW: "图片预览",
  IMAGE_LOADING: "图片加载中...",
  IMAGE_LOAD_ERROR: "图片加载失败",
} as const;

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 文件图标渲染组件
 */
function FileIconRenderer({
  mimeType,
  className,
}: {
  mimeType?: string;
  className?: string;
}) {
  if (mimeType?.startsWith("image/")) {
    return <ImageIcon className={className} />;
  }
  if (mimeType === "application/pdf") {
    return <FileType className={className} />;
  }
  return <FileText className={className} />;
}

// =============================================================================
// 子组件：书签预览
// =============================================================================

interface BookmarkPreviewProps {
  attachment: AttachmentItem;
}

function BookmarkPreview({ attachment }: BookmarkPreviewProps) {
  const handleOpenLink = useCallback(() => {
    if (attachment.url) {
      try {
        const url = new URL(attachment.url);
        // 只允许 http/https 协议，防止 javascript: 等危险协议
        if (url.protocol === "http:" || url.protocol === "https:") {
          window.open(attachment.url, "_blank", "noopener,noreferrer");
        } else {
          console.error("Blocked unsafe URL protocol:", url.protocol);
        }
      } catch (e) {
        console.error("Invalid URL:", e);
      }
    }
  }, [attachment.url]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 来源信息 - 移动端垂直布局 */}
      {attachment.url && (
        <div className="space-y-2">
          <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">
            {PREVIEW_TEXT.SOURCE}
          </h4>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs sm:text-sm text-foreground truncate flex-1 break-all">
              {attachment.url}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenLink}
              className="flex-shrink-0 w-full sm:w-auto"
            >
              <ExternalLink className="size-4 mr-1" />
              {PREVIEW_TEXT.OPEN_LINK}
            </Button>
          </div>
        </div>
      )}

      {/* 内容摘要 - 使用 ContentPreview 共享组件 */}
      <div className="space-y-2">
        <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">
          {PREVIEW_TEXT.CONTENT_SUMMARY}
        </h4>
        <ContentPreview
          content={attachment.content}
          truncated={attachment.truncated}
          emptyText={PREVIEW_TEXT.NO_CONTENT}
          truncatedText={PREVIEW_TEXT.CONTENT_TRUNCATED}
        />
      </div>
    </div>
  );
}

// =============================================================================
// 子组件：文件预览
// =============================================================================

interface FilePreviewProps {
  attachment: AttachmentItem;
}

function FilePreview({ attachment }: FilePreviewProps) {
  const isImage = attachment.mimeType?.startsWith("image/");

  // 图片加载状态
  const [imageLoadState, setImageLoadState] = useState<
    "loading" | "loaded" | "error"
  >("loading");

  // 对于图片，尝试从 content 中提取 base64
  const imageUrl = useMemo(() => {
    if (isImage && attachment.content) {
      // content 格式: [图片: xxx]\n{base64}
      const match = attachment.content.match(/^(\[图片: [^\]]+\])\n([\s\S]+)$/);
      if (match?.[2]) {
        const dataUrl = match[2].trim();
        // 严格验证 data URL 格式，防止 XSS 攻击
        // 只允许 image/png, image/jpeg, image/jpg, image/gif, image/webp
        if (
          /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(
            dataUrl,
          )
        ) {
          return dataUrl;
        }
        console.error("Blocked invalid image data URL format");
      }
    }
    return null;
  }, [isImage, attachment.content]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 文件信息 - 响应式布局 */}
      <div className="space-y-2">
        <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">
          {PREVIEW_TEXT.FILE_INFO}
        </h4>
        <div className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3 rounded-lg bg-muted/50">
          <FileIconRenderer
            mimeType={attachment.mimeType}
            className="size-6 sm:size-8 text-muted-foreground flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium truncate">
              {attachment.title}
            </p>
            {/* 移动端垂直布局文件信息 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-xs text-muted-foreground">
              {attachment.size && (
                <span>
                  {PREVIEW_TEXT.FILE_SIZE}: {formatFileSize(attachment.size)}
                </span>
              )}
              {attachment.mimeType && (
                <span className="truncate">
                  {PREVIEW_TEXT.FILE_TYPE}: {attachment.mimeType}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 图片预览 - 移动端适配高度 */}
      {isImage && imageUrl && (
        <div className="space-y-2">
          <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">
            {PREVIEW_TEXT.IMAGE_PREVIEW}
          </h4>
          <div className="rounded-lg overflow-hidden bg-muted/50 p-1 sm:p-2 relative min-h-[80px] sm:min-h-[100px]">
            {/* 加载状态 */}
            {imageLoadState === "loading" && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-muted/50"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2
                    className="size-4 sm:size-5 animate-spin"
                    aria-hidden="true"
                  />
                  <span className="text-xs sm:text-sm">
                    {PREVIEW_TEXT.IMAGE_LOADING}
                  </span>
                </div>
              </div>
            )}

            {/* 错误状态 */}
            {imageLoadState === "error" && (
              <div
                className="flex items-center justify-center h-[80px] sm:h-[100px] text-muted-foreground"
                role="alert"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle
                    className="size-4 sm:size-5"
                    aria-hidden="true"
                  />
                  <span className="text-xs sm:text-sm">
                    {PREVIEW_TEXT.IMAGE_LOAD_ERROR}
                  </span>
                </div>
              </div>
            )}

            {/* 图片 - 移动端限制最大高度 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`${attachment.title} 的预览图片`}
              className={cn(
                "max-w-full max-h-[200px] sm:max-h-[300px] object-contain mx-auto rounded",
                imageLoadState !== "loaded" && "invisible h-0",
              )}
              onLoad={() => setImageLoadState("loaded")}
              onError={() => setImageLoadState("error")}
            />
          </div>
        </div>
      )}

      {/* 文本内容预览 - 使用 ContentPreview 共享组件 */}
      {!isImage && attachment.content && (
        <div className="space-y-2">
          <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">
            {PREVIEW_TEXT.CONTENT_SUMMARY}
          </h4>
          <ContentPreview
            content={attachment.content}
            truncated={attachment.truncated}
            emptyText={PREVIEW_TEXT.NO_CONTENT}
            truncatedText={PREVIEW_TEXT.CONTENT_TRUNCATED}
            monospace
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// 主组件
// =============================================================================

export function AttachmentPreviewModal({
  open,
  onOpenChange,
  attachment,
}: AttachmentPreviewModalProps) {
  if (!attachment) {
    return null;
  }

  const isBookmark = attachment.type === "bookmark";
  const title = isBookmark
    ? PREVIEW_TEXT.TITLE_BOOKMARK
    : PREVIEW_TEXT.TITLE_FILE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 响应式宽度：移动端全宽，桌面端最大 2xl */}
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] p-0 gap-0">
        {/* Header - 移动端减少内边距 */}
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm sm:text-base">{title}</DialogTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
          {/* 附件标题 - 移动端支持换行 */}
          <p
            className={cn(
              "text-xs sm:text-sm font-medium text-foreground mt-1 break-words",
              isBookmark ? "text-pink-600" : "text-blue-600",
            )}
          >
            {attachment.title}
          </p>
        </DialogHeader>

        {/* 内容区域 - 移动端增加高度 */}
        <ScrollArea className="flex-1 max-h-[65vh] sm:max-h-[60vh]">
          <div className="px-4 sm:px-6 py-3 sm:py-4">
            {isBookmark ? (
              <BookmarkPreview attachment={attachment} />
            ) : (
              <FilePreview attachment={attachment} />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default AttachmentPreviewModal;
