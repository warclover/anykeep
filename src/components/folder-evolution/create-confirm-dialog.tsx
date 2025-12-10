/**
 * V4.2 文件夹创建确认对话框
 * 用于 Level 2 半托管模式下，AI 建议创建新文件夹时的用户确认
 */

"use client";

import { useState } from "react";
import {
  FolderPlus,
  Loader2,
  Info,
  Sparkles,
  Clock,
  Edit2,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BookmarkPreview {
  id: number;
  title: string;
  url: string;
  confidence?: number;
}

interface CreateConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedName: string;
  bookmarks: BookmarkPreview[];
  confidence: number;
  reason?: string;
  onConfirm: (folderName: string) => Promise<void>;
  onReject?: () => void;
}

export function CreateConfirmDialog({
  open,
  onOpenChange,
  suggestedName,
  bookmarks,
  confidence,
  reason,
  onConfirm,
  onReject,
}: CreateConfirmDialogProps) {
  const [folderName, setFolderName] = useState(suggestedName);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 当对话框打开时重置状态
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setFolderName(suggestedName);
      setIsEditing(false);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(folderName);
      handleOpenChange(false);
    } catch (error) {
      console.error("Failed to create folder:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = () => {
    onReject?.();
    handleOpenChange(false);
  };

  // 获取置信度颜色
  const getConfidenceColor = (conf: number) => {
    if (conf >= 80) return "text-green-600 dark:text-green-400";
    if (conf >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
  };

  // 获取置信度背景
  const getConfidenceBg = (conf: number) => {
    if (conf >= 80) return "bg-green-100 dark:bg-green-900/30";
    if (conf >= 60) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-orange-100 dark:bg-orange-900/30";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                AI 建议创建新文件夹
                <Badge variant="secondary" className="text-xs">
                  Level 2
                </Badge>
              </DialogTitle>
              <DialogDescription>
                确认后将创建文件夹并移动相关书签
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 文件夹名称 */}
          <div className="space-y-2">
            <Label htmlFor="folder-name" className="flex items-center gap-2">
              文件夹名称
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  修改
                </Button>
              )}
            </Label>
            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  id="folder-name"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="输入文件夹名称"
                  className="flex-1"
                  autoFocus
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    if (!folderName.trim()) {
                      setFolderName(suggestedName);
                    }
                  }}
                >
                  完成
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <FolderPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium text-gray-900 dark:text-white">
                  {folderName}
                </span>
              </div>
            )}
          </div>

          {/* 置信度和原因 */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
                getConfidenceBg(confidence),
                getConfidenceColor(confidence),
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {confidence}%
            </div>
            <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
              {reason || "基于内容相似度和标签分析"}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                <p className="text-xs">
                  置信度表示 AI 对这个分类建议的确信程度。
                  高置信度意味着这些书签有很强的相关性。
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* 书签列表预览 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              将移动 {bookmarks.length} 个书签
              <Badge variant="outline" className="text-xs">
                预览
              </Badge>
            </Label>
            <ScrollArea className="h-[180px] border rounded-lg">
              <div className="p-2 space-y-1">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {bookmark.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {bookmark.url}
                      </p>
                    </div>
                    {bookmark.confidence && (
                      <span
                        className={cn(
                          "text-xs font-medium flex-shrink-0",
                          getConfidenceColor(bookmark.confidence),
                        )}
                      >
                        {bookmark.confidence}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* 撤销提示 */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              操作完成后可在 48 小时内撤销。撤销后书签将恢复到原位置。
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isLoading}
          >
            不需要
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !folderName.trim()}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <FolderPlus className="w-4 h-4 mr-2" />
                确认创建
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateConfirmDialog;
