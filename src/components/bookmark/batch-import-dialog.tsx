/**
 * 批量导入收藏对话框
 * 支持导入 JSON 格式的书签数据
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle, XCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BOOKMARK } from "@/lib/constants/messages";

interface BatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ url: string; error: string }>;
}

export function BatchImportDialog({
  open,
  onOpenChange,
}: BatchImportDialogProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 验证文件类型
      if (!file.name.endsWith(".json")) {
        toast.error("请选择 JSON 格式的文件");
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("请先选择文件");
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      // 读取文件内容
      const fileContent = await selectedFile.text();
      let bookmarks: unknown[];

      try {
        bookmarks = JSON.parse(fileContent);
      } catch {
        toast.error(BOOKMARK.BATCH_IMPORT_FILE_ERROR);
        return;
      }

      // 验证数据格式
      if (!Array.isArray(bookmarks)) {
        toast.error(BOOKMARK.BATCH_IMPORT_FILE_ERROR);
        return;
      }

      if (bookmarks.length === 0) {
        toast.error(BOOKMARK.BATCH_IMPORT_EMPTY);
        return;
      }

      // 调用批量导入 API
      const res = await fetchWithAbort("/api/bookmarks/batch-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookmarks }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || BOOKMARK.BATCH_IMPORT_ERROR);
      }

      // 显示结果
      setImportResult(data.data);

      if (data.data.success > 0) {
        toast.success(
          `成功导入 ${data.data.success} 条书签${
            data.data.failed > 0 ? `，失败 ${data.data.failed} 条` : ""
          }`,
        );
        router.refresh();
      } else {
        toast.error("导入失败，请检查文件格式");
      }
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(
        error instanceof Error ? error.message : BOOKMARK.BATCH_IMPORT_ERROR,
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>批量导入书签</DialogTitle>
          <DialogDescription>
            支持 JSON 格式的书签数据。每条书签需包含 url 和 title 字段。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 文件格式说明 */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm">
            <p className="font-medium mb-2">JSON 文件格式示例：</p>
            <pre className="text-xs overflow-x-auto">
              {`[
  {
    "url": "https://example.com/article1",
    "title": "文章标题",
    "description": "文章描述（可选）",
    "folderId": 1（可选）,
    "userTags": ["标签1", "标签2"]（可选）,
    "notes": "备注（可选）"
  }
]`}
            </pre>
          </div>

          {/* 文件选择 */}
          <div className="space-y-2">
            <Label htmlFor="batch-import-file">选择文件</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isImporting}
                onClick={() =>
                  document.getElementById("batch-import-file")?.click()
                }
              >
                <FileText className="mr-2 size-4" />
                选择 JSON 文件
              </Button>
              {selectedFile && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFile.name}
                </span>
              )}
              <input
                id="batch-import-file"
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
                disabled={isImporting}
              />
            </div>
          </div>

          {/* 导入结果 */}
          {importResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="size-4 text-green-600" />
                <span>成功: {importResult.success} 条</span>
              </div>
              {importResult.failed > 0 && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="size-4 text-red-600" />
                    <span>失败: {importResult.failed} 条</span>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded border p-2 text-xs space-y-1">
                      {importResult.errors.map((error, index) => (
                        <div key={index} className="text-red-600">
                          {error.url}: {error.error}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isImporting}
            >
              {importResult ? "关闭" : "取消"}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImport}
                disabled={!selectedFile || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {BOOKMARK.BATCH_IMPORTING}
                  </>
                ) : (
                  <>
                    <Upload className="size-4 mr-2" />
                    开始导入
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
