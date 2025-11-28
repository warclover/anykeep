"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, Loader2, X, Files } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SUPPORTED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/browser-bookmark";

/** 单文件上传模式 */
interface SingleFileProps {
  multiple?: false;
  onFileSelect: (file: File, content: string) => void;
  onFilesSelect?: never;
}

/** 多文件上传模式 */
interface MultiFileProps {
  multiple: true;
  onFileSelect?: never;
  onFilesSelect: (files: Array<{ file: File; content: string }>) => void;
}

type FileUploaderProps = {
  onError: (message: string) => void;
  accept?: string;
  disabled?: boolean;
  /** 已选择的文件列表（用于显示） */
  selectedFiles?: File[];
  /** 移除文件回调 */
  onRemoveFile?: (index: number) => void;
  /** 最大文件数量（多文件模式） */
  maxFiles?: number;
} & (SingleFileProps | MultiFileProps);

export function FileUploader(props: FileUploaderProps) {
  const {
    onError,
    accept = ".html,.htm",
    disabled = false,
    selectedFiles = [],
    onRemoveFile,
    maxFiles = 10,
  } = props;

  const multiple = props.multiple === true;
  const onFileSelect = !multiple ? props.onFileSelect : undefined;
  const onFilesSelect = multiple ? props.onFilesSelect : undefined;

  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateFile = useCallback((file: File): string | null => {
    // 检查文件类型
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_FILE_TYPES.includes(ext)) {
      return `不支持的文件格式，请上传 ${SUPPORTED_FILE_TYPES.join(" 或 ")} 文件`;
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return `文件过大，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    return null;
  }, []);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // 多文件模式检查数量限制
      if (multiple && fileArray.length > maxFiles) {
        onError(`最多支持同时上传 ${maxFiles} 个文件`);
        return;
      }

      // 验证所有文件
      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          onError(`${file.name}: ${error}`);
          return;
        }
      }

      setIsLoading(true);
      try {
        if (multiple && onFilesSelect) {
          // 多文件模式：并行读取所有文件
          const results = await Promise.all(
            fileArray.map(async (file) => ({
              file,
              content: await file.text(),
            })),
          );
          onFilesSelect(results);
        } else if (onFileSelect && fileArray.length > 0) {
          // 单文件模式：只处理第一个文件
          const content = await fileArray[0].text();
          onFileSelect(fileArray[0], content);
        }
      } catch {
        onError("读取文件失败，请重试");
      } finally {
        setIsLoading(false);
      }
    },
    [multiple, maxFiles, validateFile, onFileSelect, onFilesSelect, onError],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [disabled, processFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
      // 重置 input 以允许选择相同文件
      e.target.value = "";
    },
    [processFiles],
  );

  return (
    <div className="space-y-3">
      {/* 拖放区域 */}
      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          isDragging && "border-primary bg-primary/5",
          disabled && "cursor-not-allowed opacity-50",
          !isDragging &&
            !disabled &&
            "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">正在读取文件...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-muted p-3">
                {multiple ? (
                  <Files className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {multiple
                    ? "拖放 HTML 文件到此处（支持多选）"
                    : "拖放 HTML 文件到此处，或点击选择"}
                </p>
                <p className="text-xs text-muted-foreground">
                  支持 Chrome、Edge 导出的书签文件
                </p>
              </div>
            </div>

            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  document.getElementById("bookmark-file-input")?.click()
                }
              >
                <FileText className="mr-2 h-4 w-4" />
                选择文件
              </Button>
            </div>

            <input
              id="bookmark-file-input"
              type="file"
              accept={accept}
              multiple={multiple}
              className="hidden"
              onChange={handleFileSelect}
              disabled={disabled}
            />
          </>
        )}
      </div>

      {/* 已选文件列表（多文件模式） */}
      {multiple && selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            已选择 {selectedFiles.length} 个文件
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <Badge
                key={`${file.name}-${index}`}
                variant="secondary"
                className="flex items-center gap-1 pr-1"
              >
                <FileText className="h-3 w-3" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                {onRemoveFile && (
                  <button
                    type="button"
                    className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5"
                    onClick={() => onRemoveFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
