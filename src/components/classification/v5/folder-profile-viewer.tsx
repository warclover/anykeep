/**
 * 智能分类 v5.0 - 文件夹画像查看器
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderIcon, RefreshCwIcon, AlertCircleIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface FolderProfileViewerProps {
  /** 文件夹 ID */
  folderId: number;
  /** 文件夹名称 */
  folderName: string;
  /** α 系数 (0-1) */
  alphaCoefficient: number;
  /** 书签数量 */
  bookmarkCount: number;
  /** 最后更新时间 */
  lastUpdatedAt: Date;
  /** 是否需要更新 */
  needsUpdate: boolean;
  /** 统计信息 */
  stats?: {
    avgClassificationScore?: number;
    totalClassifications?: number;
  };
  /** 更新回调 */
  onUpdate?: () => void;
  /** 是否正在更新 */
  isUpdating?: boolean;
}

export function FolderProfileViewer({
  folderId: _folderId,
  folderName,
  alphaCoefficient,
  bookmarkCount,
  lastUpdatedAt,
  needsUpdate,
  stats,
  onUpdate,
  isUpdating = false,
}: FolderProfileViewerProps) {
  // α 系数描述
  const getAlphaDescription = (alpha: number) => {
    if (alpha >= 0.6) return "行为主导";
    if (alpha >= 0.4) return "均衡";
    return "内容主导";
  };

  // α 系数颜色
  const getAlphaColor = (alpha: number) => {
    if (alpha >= 0.6) return "text-purple-600";
    if (alpha >= 0.4) return "text-blue-600";
    return "text-green-600";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FolderIcon className="h-5 w-5" />
            {folderName}
          </span>
          {needsUpdate && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircleIcon className="h-3 w-3 mr-1" />
              需要更新
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* α 系数 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">α 系数</span>
            <span
              className={`font-semibold ${getAlphaColor(alphaCoefficient)}`}
            >
              {alphaCoefficient.toFixed(2)} (
              {getAlphaDescription(alphaCoefficient)})
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-green-600 via-blue-600 to-purple-600"
              style={{ width: `${alphaCoefficient * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            α 系数决定内容向量和行为向量的权重比例
          </p>
        </div>

        {/* 书签数量 */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">书签数量</span>
          <span className="font-semibold">{bookmarkCount} 个</span>
        </div>

        {/* 统计信息 */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            {stats.avgClassificationScore !== undefined && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">平均准确率</p>
                <p className="font-semibold">
                  {Math.round(stats.avgClassificationScore * 100)}%
                </p>
              </div>
            )}
            {stats.totalClassifications !== undefined && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">分类次数</p>
                <p className="font-semibold">{stats.totalClassifications}</p>
              </div>
            )}
          </div>
        )}

        {/* 最后更新时间 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>最后更新</span>
          <span>
            {formatDistanceToNow(lastUpdatedAt, {
              addSuffix: true,
              locale: zhCN,
            })}
          </span>
        </div>

        {/* 更新按钮 */}
        {onUpdate && (
          <Button
            onClick={onUpdate}
            disabled={isUpdating}
            variant={needsUpdate ? "default" : "outline"}
            className="w-full"
          >
            <RefreshCwIcon
              className={`h-4 w-4 mr-2 ${isUpdating ? "animate-spin" : ""}`}
            />
            {isUpdating ? "更新中..." : needsUpdate ? "立即更新" : "刷新画像"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
