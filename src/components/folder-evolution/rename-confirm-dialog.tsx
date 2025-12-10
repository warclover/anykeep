/**
 * V4.2 文件夹重命名确认对话框
 * 用于 Level 2 半托管模式下，AI 建议文件夹重命名时的用户确认
 */

"use client";

import { useState } from "react";
import {
  Edit3,
  Loader2,
  ArrowRight,
  Tag,
  FileText,
  Clock,
  Sparkles,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RenameConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  suggestedName: string;
  confidence: number;
  reason?: string;
  sampleTitles?: string[];
  commonTags?: string[];
  onConfirm: (newName: string) => Promise<void>;
  onReject?: () => void;
}

export function RenameConfirmDialog({
  open,
  onOpenChange,
  currentName,
  suggestedName,
  confidence,
  reason,
  sampleTitles = [],
  commonTags = [],
  onConfirm,
  onReject,
}: RenameConfirmDialogProps) {
  const [newName, setNewName] = useState(suggestedName);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 当对话框打开时重置状态
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setNewName(suggestedName);
      setIsEditing(false);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    if (!newName.trim() || newName === currentName) return;

    setIsLoading(true);
    try {
      await onConfirm(newName);
      handleOpenChange(false);
    } catch (error) {
      console.error("Failed to rename folder:", error);
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

  const getConfidenceBg = (conf: number) => {
    if (conf >= 80) return "bg-green-100 dark:bg-green-900/30";
    if (conf >= 60) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-orange-100 dark:bg-orange-900/30";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                AI 建议重命名文件夹
                <Badge variant="secondary" className="text-xs">
                  Level 2
                </Badge>
              </DialogTitle>
              <DialogDescription>
                根据文件夹内容分析，建议使用更准确的名称
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 名称变更预览 */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                当前名称
              </p>
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {currentName}
              </p>
            </div>

            <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                建议名称
              </p>
              {isEditing ? (
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8"
                  autoFocus
                  onBlur={() => {
                    setIsEditing(false);
                    if (!newName.trim()) setNewName(suggestedName);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setIsEditing(false);
                  }}
                />
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="font-medium text-blue-600 dark:text-blue-400 truncate hover:underline text-left w-full"
                >
                  {newName}
                </button>
              )}
            </div>
          </div>

          {/* 置信度和原因 */}
          <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium flex-shrink-0",
                getConfidenceBg(confidence),
                getConfidenceColor(confidence),
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {confidence}%
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">
              {reason || "基于文件夹内容分析生成的建议"}
            </p>
          </div>

          {/* 常见标签 */}
          {commonTags.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4" />
                内容关键词
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {commonTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 示例书签 */}
          {sampleTitles.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4" />
                示例内容
              </Label>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                {sampleTitles.map((title, index) => (
                  <p key={index} className="truncate">
                    • {title}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* 撤销提示 */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              重命名后可在 48 小时内撤销，恢复为原名称。
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isLoading}
              >
                保持原名
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">不进行重命名，保留当前名称</p>
            </TooltipContent>
          </Tooltip>

          <Button
            onClick={handleConfirm}
            disabled={isLoading || !newName.trim() || newName === currentName}
            className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                重命名中...
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 mr-2" />
                确认重命名
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RenameConfirmDialog;
