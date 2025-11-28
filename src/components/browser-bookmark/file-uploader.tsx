"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SUPPORTED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/browser-bookmark";

interface FileUploaderProps {
  onFileSelect: (file: File, content: string) => void;
  onError: (message: string) => void;
  accept?: string;
  disabled?: boolean;
}

export function FileUploader({
  onFileSelect,
  onError,
  accept = ".html,.htm",
  disabled = false,
}: FileUploaderProps) {
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

  const processFile = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      if (error) {
        onError(error);
        return;
      }

      setIsLoading(true);
      try {
        const content = await file.text();
        onFileSelect(file, content);
      } catch {
        onError("读取文件失败，请重试");
      } finally {
        setIsLoading(false);
      }
    },
    [validateFile, onFileSelect, onError],
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
        processFile(files[0]);
      }
    },
    [disabled, processFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
      // 重置 input 以允许选择相同文件
      e.target.value = "";
    },
    [processFile],
  );

  return (
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
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                拖放 HTML 文件到此处，或点击选择
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
            className="hidden"
            onChange={handleFileSelect}
            disabled={disabled}
          />
        </>
      )}
    </div>
  );
}
