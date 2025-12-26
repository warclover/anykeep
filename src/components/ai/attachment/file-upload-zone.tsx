/**
 * 文件上传区组件
 *
 * 支持拖拽和点击上传文件
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ATTACHMENT_LIMITS,
  ATTACHMENT_TEXT,
  FILE_TYPE_NAMES,
  type AttachmentItem,
} from "./types";

// =============================================================================
// 类型定义
// =============================================================================

export interface FileUploadZoneProps {
  /** 已上传的文件附件 */
  files: AttachmentItem[];
  /** 添加文件回调 */
  onFilesAdd: (files: File[]) => void;
  /** 移除文件回调 */
  onFileRemove: (id: string) => void;
  /** 剩余可上传数量 */
  remainingSlots: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否正在处理 */
  isProcessing?: boolean;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 工具函数
// =============================================================================

/** 验证文件 */
function validateFile(file: File): string | null {
  // 检查文件大小
  if (file.size > ATTACHMENT_LIMITS.MAX_FILE_SIZE) {
    return ATTACHMENT_TEXT.ERROR_FILE_TOO_LARGE;
  }

  // 检查文件类型
  const isValidType = ATTACHMENT_LIMITS.ACCEPTED_MIME_TYPES.includes(
    file.type as (typeof ATTACHMENT_LIMITS.ACCEPTED_MIME_TYPES)[number],
  );

  if (!isValidType) {
    // 也检查扩展名（某些浏览器可能不设置 MIME 类型）
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const isValidExtension = ATTACHMENT_LIMITS.ACCEPTED_TYPES.includes(
      extension as (typeof ATTACHMENT_LIMITS.ACCEPTED_TYPES)[number],
    );

    if (!isValidExtension) {
      return ATTACHMENT_TEXT.ERROR_FILE_TYPE;
    }
  }

  return null;
}

/** 获取文件图标 */
function getFileIcon(mimeType?: string) {
  if (mimeType?.startsWith("image/")) {
    return <ImageIcon className="size-4 text-green-500" />;
  }
  return <FileText className="size-4 text-blue-500" />;
}

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// 已上传文件项组件
// =============================================================================

interface UploadedFileItemProps {
  file: AttachmentItem;
  onRemove: () => void;
}

function UploadedFileItem({ file, onRemove }: UploadedFileItemProps) {
  const typeName = file.mimeType ? FILE_TYPE_NAMES[file.mimeType] : "文件";

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
        "bg-gray-50 border border-gray-200",
      )}
    >
      {getFileIcon(file.mimeType)}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium truncate" title={file.title}>
          {file.title}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {typeName} · {file.size ? formatFileSize(file.size) : "未知大小"}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive transition-colors"
        aria-label={`删除 ${file.title}`}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// =============================================================================
// 主组件
// =============================================================================

export function FileUploadZone({
  files,
  onFilesAdd,
  onFileRemove,
  remainingSlots,
  disabled = false,
  isProcessing = false,
  className,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpload = remainingSlots > 0 && !disabled;

  // 处理文件选择
  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      setError(null);
      const validFiles: File[] = [];

      // 验证每个文件
      for (let i = 0; i < Math.min(fileList.length, remainingSlots); i++) {
        const file = fileList[i];
        const validationError = validateFile(file);

        if (validationError) {
          setError(validationError);
          continue;
        }

        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        onFilesAdd(validFiles);
      }

      // 清空 input 以允许重复上传同一文件
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [remainingSlots, onFilesAdd],
  );

  // 点击上传
  const handleClick = useCallback(() => {
    if (canUpload && inputRef.current) {
      inputRef.current.click();
    }
  }, [canUpload]);

  // 拖拽事件
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (canUpload) {
        setIsDragging(true);
      }
    },
    [canUpload],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (canUpload) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [canUpload, handleFiles],
  );

  // 文件输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles],
  );

  return (
    <div className={cn("space-y-3", className)}>
      {/* 已上传文件列表 */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <UploadedFileItem
              key={file.id}
              file={file}
              onRemove={() => onFileRemove(file.id)}
            />
          ))}
        </div>
      )}

      {/* 上传区域 */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-4 transition-all",
          "flex flex-col items-center justify-center gap-1.5",
          canUpload && [
            "cursor-pointer",
            "border-gray-200 hover:border-pink-300",
            "bg-gray-50/50 hover:bg-pink-50/30",
          ],
          isDragging && "border-pink-400 bg-pink-50/50",
          !canUpload && "cursor-not-allowed opacity-50 bg-gray-100",
        )}
      >
        {/* 隐藏的文件输入 */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ATTACHMENT_LIMITS.ACCEPTED_TYPES.join(",")}
          onChange={handleInputChange}
          className="hidden"
          disabled={!canUpload}
        />

        {/* 图标和文本 */}
        {isProcessing ? (
          <>
            <Loader2 className="size-6 text-pink-400 animate-spin" />
            <p className="text-[10px] text-muted-foreground">处理中...</p>
          </>
        ) : (
          <>
            <Upload
              className={cn(
                "size-6",
                canUpload ? "text-gray-400" : "text-gray-300",
              )}
            />
            <div className="text-center">
              <p
                className={cn(
                  "text-[10px] font-medium",
                  canUpload ? "text-gray-600" : "text-gray-400",
                )}
              >
                {ATTACHMENT_TEXT.FILE_UPLOAD_HINT}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {ATTACHMENT_TEXT.FILE_FORMAT_HINT}
              </p>
            </div>
          </>
        )}
      </div>

      {/* 错误提示 */}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

export default FileUploadZone;
