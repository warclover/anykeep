/**
 * 附件内容预览模态框
 *
 * 支持预览书签摘要、文本内容、图片等
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { useCallback, useMemo } from "react";
import {
  X,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  FileType,
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
      window.open(attachment.url, "_blank", "noopener,noreferrer");
    }
  }, [attachment.url]);

  return (
    <div className="space-y-4">
      {/* 来源信息 */}
      {attachment.url && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            {PREVIEW_TEXT.SOURCE}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground truncate flex-1">
              {attachment.url}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenLink}
              className="flex-shrink-0"
            >
              <ExternalLink className="size-4 mr-1" />
              {PREVIEW_TEXT.OPEN_LINK}
            </Button>
          </div>
        </div>
      )}

      {/* 内容摘要 */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">
          {PREVIEW_TEXT.CONTENT_SUMMARY}
        </h4>
        <div className="rounded-lg bg-muted/50 p-4">
          {attachment.content ? (
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {attachment.content}
              {attachment.truncated && (
                <span className="text-muted-foreground">
                  {PREVIEW_TEXT.CONTENT_TRUNCATED}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {PREVIEW_TEXT.NO_CONTENT}
            </p>
          )}
        </div>
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

  // 对于图片，尝试从 content 中提取 base64
  const imageUrl = useMemo(() => {
    if (isImage && attachment.content) {
      // content 格式: [图片: xxx]\n{base64}
      const match = attachment.content.match(/^(\[图片: [^\]]+\])\n([\s\S]+)$/);
      if (match && match[2]) {
        return match[2]; // base64 data URL
      }
    }
    return null;
  }, [isImage, attachment.content]);

  return (
    <div className="space-y-4">
      {/* 文件信息 */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">
          {PREVIEW_TEXT.FILE_INFO}
        </h4>
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
          <FileIconRenderer
            mimeType={attachment.mimeType}
            className="size-8 text-muted-foreground"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{attachment.title}</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {attachment.size && (
                <span>
                  {PREVIEW_TEXT.FILE_SIZE}: {formatFileSize(attachment.size)}
                </span>
              )}
              {attachment.mimeType && (
                <span>
                  {PREVIEW_TEXT.FILE_TYPE}: {attachment.mimeType}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 图片预览 */}
      {isImage && imageUrl && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">预览</h4>
          <div className="rounded-lg overflow-hidden bg-muted/50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={attachment.title}
              className="max-w-full max-h-[300px] object-contain mx-auto rounded"
            />
          </div>
        </div>
      )}

      {/* 文本内容预览 */}
      {!isImage && attachment.content && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            {PREVIEW_TEXT.CONTENT_SUMMARY}
          </h4>
          <div className="rounded-lg bg-muted/50 p-4">
            <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
              {attachment.content}
              {attachment.truncated && (
                <span className="text-muted-foreground">
                  {PREVIEW_TEXT.CONTENT_TRUNCATED}
                </span>
              )}
            </pre>
          </div>
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
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
          {/* 附件标题 */}
          <p
            className={cn(
              "text-base font-medium text-foreground mt-1",
              isBookmark ? "text-pink-600" : "text-blue-600",
            )}
          >
            {attachment.title}
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="px-6 py-4">
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
