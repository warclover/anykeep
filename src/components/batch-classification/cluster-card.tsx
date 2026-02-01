/**
 * 簇卡片组件
 *
 * 显示单个聚类簇的信息和操作
 *
 * @module components/batch-classification/cluster-card
 * @version 1.0.0
 * @since 2026-02-01
 */

"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Edit2,
  FolderPlus,
  FolderSymlink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ClusterResult,
  ConflictType,
} from "@/lib/classification/services/batch-classification";

// ============================================
// Props
// ============================================

interface ClusterCardProps {
  cluster: ClusterResult;
  onAccept: (clusterId: string) => void;
  onReject: (clusterId: string) => void;
  onModify: (
    clusterId: string,
    targetFolderId?: number,
    customName?: string,
  ) => void;
  onViewDetails?: (clusterId: string) => void;
  className?: string;
}

// ============================================
// 常量
// ============================================

const CONFLICT_LABELS: Record<
  ConflictType,
  {
    label: string;
    variant: "default" | "destructive" | "outline" | "secondary";
  }
> = {
  none: { label: "", variant: "default" },
  path_mismatch: { label: "路径不匹配", variant: "destructive" },
  folder_rename: { label: "建议重命名", variant: "secondary" },
  ambiguous: { label: "模棱两可", variant: "outline" },
  merge_suggestion: { label: "建议合并", variant: "secondary" },
};

const MATCH_TYPE_LABELS: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  exact: { label: "精准匹配", icon: <FolderSymlink className="h-4 w-4" /> },
  fuzzy: { label: "模糊匹配", icon: <FolderSymlink className="h-4 w-4" /> },
  create_new: { label: "新建文件夹", icon: <FolderPlus className="h-4 w-4" /> },
};

// ============================================
// 组件
// ============================================

export function ClusterCard({
  cluster,
  onAccept,
  onReject,
  onModify,
  onViewDetails: _onViewDetails,
  className,
}: ClusterCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const matchInfo =
    MATCH_TYPE_LABELS[cluster.matchType] || MATCH_TYPE_LABELS.create_new;
  const conflictInfo = CONFLICT_LABELS[cluster.conflictType];
  const hasConflict = cluster.conflictType !== "none";

  return (
    <Card
      className={cn(
        "transition-all",
        cluster.status === "confirmed" && "border-green-500/50 bg-green-50/50",
        cluster.status === "rejected" &&
          "border-destructive/50 bg-destructive/5 opacity-60",
        hasConflict && cluster.status === "pending" && "border-amber-500/50",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {matchInfo.icon}
              <span>
                {cluster.suggestedName || `分类 ${cluster.index + 1}`}
              </span>
              {cluster.suggestedNameConfidence > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({Math.round(cluster.suggestedNameConfidence * 100)}%)
                </span>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span>{cluster.memberCount} 个书签</span>
              <span>·</span>
              <span>{matchInfo.label}</span>
              {cluster.suggestedFolderName && (
                <>
                  <span>·</span>
                  <span>→ {cluster.suggestedFolderName}</span>
                </>
              )}
            </CardDescription>
          </div>

          {/* 状态和冲突标签 */}
          <div className="flex items-center gap-2">
            {hasConflict && (
              <Badge
                variant={conflictInfo.variant}
                className="flex items-center gap-1"
              >
                <AlertTriangle className="h-3 w-3" />
                {conflictInfo.label}
              </Badge>
            )}
            {cluster.status === "confirmed" && (
              <Badge variant="default" className="bg-green-500">
                <Check className="h-3 w-3 mr-1" />
                已确认
              </Badge>
            )}
            {cluster.status === "rejected" && (
              <Badge variant="destructive">
                <X className="h-3 w-3 mr-1" />
                已拒绝
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardContent className="pb-3">
          {/* 代表性书签预览 */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">代表内容：</p>
            <ul className="space-y-1">
              {cluster.representatives.core.slice(0, 3).map((bookmark) => (
                <li
                  key={bookmark.id}
                  className="flex items-center gap-2 text-sm truncate"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span className="truncate">{bookmark.title}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 展开详情 */}
          <CollapsibleContent className="mt-4 space-y-4">
            {/* 边界内容 */}
            {cluster.representatives.edge.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">边界内容：</p>
                <ul className="space-y-1">
                  {cluster.representatives.edge.map((bookmark) => (
                    <li
                      key={bookmark.id}
                      className="flex items-center gap-2 text-sm truncate text-muted-foreground"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                      <span className="truncate">{bookmark.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 匹配详情 */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">匹配置信度:</span>
                  <span className="ml-2 font-medium">
                    {Math.round(cluster.matchConfidence * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">匹配类型:</span>
                  <span className="ml-2 font-medium">{matchInfo.label}</span>
                </div>
              </div>
            </div>

            {/* 冲突详情 */}
            {hasConflict && cluster.conflictDetails && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
                <div className="flex items-center gap-2 text-amber-800 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">冲突详情</span>
                </div>
                <p className="text-amber-700">
                  {JSON.stringify(cluster.conflictDetails)}
                </p>
              </div>
            )}
          </CollapsibleContent>
        </CardContent>

        <CardFooter className="flex items-center justify-between pt-0">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ChevronDown
                className={cn(
                  "h-4 w-4 mr-1 transition-transform",
                  isExpanded && "rotate-180",
                )}
              />
              {isExpanded ? "收起" : "展开详情"}
            </Button>
          </CollapsibleTrigger>

          {cluster.status === "pending" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReject(cluster.id)}
              >
                <X className="h-4 w-4 mr-1" />
                拒绝
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onModify(cluster.id)}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                修改
              </Button>
              <Button size="sm" onClick={() => onAccept(cluster.id)}>
                <Check className="h-4 w-4 mr-1" />
                接受
              </Button>
            </div>
          )}
        </CardFooter>
      </Collapsible>
    </Card>
  );
}
