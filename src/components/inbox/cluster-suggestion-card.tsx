/**
 * V4.2 聚类建议卡片组件
 * 展示智能分拣服务产生的新文件夹建议
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Check,
  X,
  ChevronDown,
  FolderPlus,
  Sparkles,
  Edit2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";

interface ClusterSuggestion {
  id: number;
  suggestedFolderName: string;
  bookmarkIds: number[];
  sampleTitles: string[];
  confidence: number;
  reason: string | null;
  createdAt: string;
}

interface ClusterSuggestionCardProps {
  /** 建议数据 */
  suggestion: ClusterSuggestion;
  /** 确认成功回调 */
  onConfirmed?: (folderId: number, folderName: string) => void;
  /** 拒绝成功回调 */
  onRejected?: () => void;
}

export function ClusterSuggestionCard({
  suggestion,
  onConfirmed,
  onRejected,
}: ClusterSuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [customName, setCustomName] = useState(suggestion.suggestedFolderName);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const isProcessing = isConfirming || isRejecting;

  // 确认建议（使用统一的 inbox API）
  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const response = await fetch(API_CLASSIFICATION.inbox, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId: suggestion.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "确认建议失败");
      }

      const folderName = customName || suggestion.suggestedFolderName;
      toast.success(
        `已创建「${folderName}」并归类 ${suggestion.bookmarkIds.length} 个书签`,
      );
      onConfirmed?.(suggestion.id, folderName);
    } catch (error) {
      const message = error instanceof Error ? error.message : "确认建议失败";
      toast.error(message);
    } finally {
      setIsConfirming(false);
    }
  };

  // 拒绝建议（使用统一的 inbox API）
  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const response = await fetch(API_CLASSIFICATION.inbox, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId: suggestion.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "拒绝建议失败");
      }

      toast.success("已忽略此建议");
      onRejected?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "拒绝建议失败";
      toast.error(message);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10",
        isProcessing && "opacity-50 pointer-events-none",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-medium">
                  AI 发现新分类
                </CardTitle>
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                >
                  聚类建议
                </Badge>
              </div>
              <CardDescription className="text-sm">
                {suggestion.bookmarkIds.length}{" "}
                个书签内容相似，建议创建新文件夹归类
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={suggestion.confidence >= 70 ? "default" : "secondary"}
            className="shrink-0"
          >
            置信度: {suggestion.confidence}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 文件夹名称编辑 */}
        <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
          <FolderPlus className="h-5 w-5 text-emerald-500 shrink-0" />
          {isEditing ? (
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditing(false);
                if (e.key === "Escape") {
                  setCustomName(suggestion.suggestedFolderName);
                  setIsEditing(false);
                }
              }}
              className="h-8 flex-1"
              autoFocus
            />
          ) : (
            <span className="flex-1 font-medium">{customName}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>

        {/* AI 推理原因 */}
        {suggestion.reason && (
          <p className="text-sm text-muted-foreground italic">
            💡 {suggestion.reason}
          </p>
        )}

        {/* 示例书签 */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 -ml-2">
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  expanded && "rotate-180",
                )}
              />
              查看 {suggestion.sampleTitles.length} 个书签示例
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <ul className="space-y-1 pl-2 border-l-2 border-emerald-200 dark:border-emerald-800">
              {suggestion.sampleTitles.map((title, index) => (
                <li
                  key={index}
                  className="text-sm text-muted-foreground truncate pl-2"
                >
                  📄 {title}
                </li>
              ))}
              {suggestion.bookmarkIds.length >
                suggestion.sampleTitles.length && (
                <li className="text-sm text-muted-foreground pl-2">
                  ...还有{" "}
                  {suggestion.bookmarkIds.length -
                    suggestion.sampleTitles.length}{" "}
                  个
                </li>
              )}
            </ul>
          </CollapsibleContent>
        </Collapsible>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReject}
            disabled={isProcessing}
            className="gap-1"
          >
            {isRejecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            忽略
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={isProcessing || !customName.trim()}
            className="gap-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {isConfirming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            创建并归类
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ClusterSuggestionCard;
