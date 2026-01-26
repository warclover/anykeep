/**
 * 智能分类 v5.0 - 同义词组卡片
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderIcon, MergeIcon, Edit3Icon } from "lucide-react";
import type {
  SynonymGroup,
  SynonymItem,
} from "@/lib/classification/v5/gardener/types";

/**
 * 类型守卫：判断是否为 SynonymItem 对象
 */
function isSynonymItem(syn: string | SynonymItem): syn is SynonymItem {
  return typeof syn === "object" && syn !== null && "folderId" in syn;
}

interface SynonymGroupCardProps {
  /** 同义词组 */
  group: SynonymGroup;
  /** 合并回调 */
  onMerge?: () => void;
  /** 重命名回调 */
  onRename?: () => void;
  /** 忽略回调 */
  onIgnore?: () => void;
}

export function SynonymGroupCard({
  group,
  onMerge,
  onRename,
  onIgnore,
}: SynonymGroupCardProps) {
  // 建议操作文本
  const getActionText = (action: "merge" | "rename" | "keep_separate") => {
    switch (action) {
      case "merge":
        return "建议合并";
      case "rename":
        return "建议重命名";
      case "keep_separate":
        return "保持独立";
    }
  };

  // 建议操作颜色
  const getActionColor = (action: "merge" | "rename" | "keep_separate") => {
    switch (action) {
      case "merge":
        return "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300";
      case "rename":
        return "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300";
      case "keep_separate":
        return "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FolderIcon className="h-5 w-5" />
            {group.primaryFolderName}
          </span>
          <Badge variant="secondary">
            {Math.round(group.confidence * 100)}% 相似
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 同义词列表 */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            检测到 {group.synonyms.length} 个相似文件夹
          </p>
          <div className="space-y-2">
            {group.synonyms.map(
              (synonym: string | SynonymItem, index: number) => {
                if (isSynonymItem(synonym)) {
                  return (
                    <div
                      key={synonym.folderId}
                      className="flex items-center justify-between p-2 bg-muted rounded-lg"
                    >
                      <span className="text-sm">{synonym.folderName}</span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(synonym.similarity * 100)}%
                      </Badge>
                    </div>
                  );
                }
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <span className="text-sm">{synonym}</span>
                  </div>
                );
              },
            )}
          </div>
        </div>

        {/* 建议操作 */}
        <div
          className={`p-3 rounded-lg border ${getActionColor(group.suggestedAction)}`}
        >
          <p className="text-sm font-medium mb-1">
            {getActionText(group.suggestedAction)}
          </p>
          <p className="text-xs">
            {group.suggestedAction === "merge" &&
              "这些文件夹内容高度相似，建议合并以简化管理"}
            {group.suggestedAction === "rename" &&
              "这些文件夹名称相似但内容有差异，建议重命名以区分"}
            {group.suggestedAction === "keep_separate" &&
              "虽然名称相似，但建议保持独立以维持现有结构"}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {group.suggestedAction === "merge" && onMerge && (
            <Button onClick={onMerge} size="sm" className="flex-1">
              <MergeIcon className="h-4 w-4 mr-2" />
              合并文件夹
            </Button>
          )}
          {group.suggestedAction === "rename" && onRename && (
            <Button
              onClick={onRename}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              <Edit3Icon className="h-4 w-4 mr-2" />
              重命名
            </Button>
          )}
          {onIgnore && (
            <Button onClick={onIgnore} size="sm" variant="ghost">
              忽略
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
