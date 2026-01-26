/**
 * 智能分类 v5.0 - Gardener 报告面板
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCircleIcon, InfoIcon } from "lucide-react";
import type {
  FolderIssue,
  FolderSuggestion,
  SynonymGroup,
  SynonymItem,
  NamingSuggestion,
  ThresholdAdjustment,
} from "@/lib/classification/v5/gardener/types";

/**
 * 类型守卫：判断是否为 SynonymItem 对象
 */
function isSynonymItem(syn: string | SynonymItem): syn is SynonymItem {
  return typeof syn === "object" && syn !== null && "folderId" in syn;
}

interface GardenerReportPanelProps {
  /** 阈值调整建议 */
  thresholdAdjustment: ThresholdAdjustment | null;
  /** 文件夹建议列表 */
  folderSuggestions: FolderSuggestion[];
  /** 同义词组列表 */
  synonymGroups: SynonymGroup[];
  /** 命名建议列表 */
  namingSuggestions: NamingSuggestion[];
  /** 生成时间 */
  generatedAt: Date;
}

export function GardenerReportPanel({
  thresholdAdjustment,
  folderSuggestions,
  synonymGroups,
  namingSuggestions,
  generatedAt,
}: GardenerReportPanelProps) {
  // 统计问题数量
  const criticalCount = folderSuggestions.filter(
    (s) => s.healthStatus === "critical",
  ).length;
  const warningCount = folderSuggestions.filter(
    (s) => s.healthStatus === "warning",
  ).length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Gardener 分析报告</span>
          <span className="text-sm font-normal text-muted-foreground">
            {new Date(generatedAt).toLocaleString("zh-CN")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 概览统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400 mb-1">
              严重问题
            </p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
              {criticalCount}
            </p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">
              警告
            </p>
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
              {warningCount}
            </p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
              同义词组
            </p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {synonymGroups.length}
            </p>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">
              命名建议
            </p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {namingSuggestions.length}
            </p>
          </div>
        </div>

        {/* 阈值调整建议 */}
        {thresholdAdjustment && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  阈值调整建议
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  {thresholdAdjustment.reason}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-blue-600 dark:text-blue-400">
                    当前: {thresholdAdjustment.currentThreshold.toFixed(2)}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400">→</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    建议: {thresholdAdjustment.suggestedThreshold.toFixed(2)}
                  </span>
                  <Badge variant="secondary" className="ml-auto">
                    置信度: {Math.round(thresholdAdjustment.confidence * 100)}%
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 详细报告标签页 */}
        <Tabs defaultValue="folders" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="folders">
              文件夹健康 ({folderSuggestions.length})
            </TabsTrigger>
            <TabsTrigger value="synonyms">
              同义词 ({synonymGroups.length})
            </TabsTrigger>
            <TabsTrigger value="naming">
              命名 ({namingSuggestions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="folders" className="space-y-3 mt-4">
            {folderSuggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-green-600" />
                <p>所有文件夹健康状态良好</p>
              </div>
            ) : (
              folderSuggestions.map((suggestion) => (
                <div
                  key={suggestion.folderId}
                  className="p-3 border rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{suggestion.folderName}</span>
                    <Badge
                      variant={
                        suggestion.healthStatus === "critical"
                          ? "destructive"
                          : suggestion.healthStatus === "warning"
                            ? "secondary"
                            : "default"
                      }
                    >
                      {suggestion.healthStatus === "critical"
                        ? "严重"
                        : suggestion.healthStatus === "warning"
                          ? "警告"
                          : "健康"}
                    </Badge>
                  </div>
                  {suggestion.issues.map(
                    (issue: FolderIssue, index: number) => (
                      <div
                        key={index}
                        className="text-sm text-muted-foreground pl-3 border-l-2"
                      >
                        <p className="font-medium">{issue.description}</p>
                        <p className="text-xs mt-1">
                          建议: {issue.suggestedAction}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="synonyms" className="space-y-3 mt-4">
            {synonymGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-green-600" />
                <p>未检测到同义词文件夹</p>
              </div>
            ) : (
              synonymGroups.map((group, index) => (
                <div key={index} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {group.primaryFolderName}
                    </span>
                    <Badge variant="secondary">
                      {Math.round(group.confidence * 100)}% 相似
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-1">相似文件夹:</p>
                    <ul className="list-disc list-inside pl-3">
                      {group.synonyms.map(
                        (syn: string | SynonymItem, synIndex: number) => {
                          if (isSynonymItem(syn)) {
                            return (
                              <li key={syn.folderId}>
                                {syn.folderName} (
                                {Math.round(syn.similarity * 100)}%)
                              </li>
                            );
                          }
                          return <li key={synIndex}>{syn}</li>;
                        },
                      )}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    建议:{" "}
                    {group.suggestedAction === "merge"
                      ? "合并"
                      : group.suggestedAction === "rename"
                        ? "重命名"
                        : "保持独立"}
                  </p>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="naming" className="space-y-3 mt-4">
            {namingSuggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-green-600" />
                <p>所有文件夹命名规范</p>
              </div>
            ) : (
              namingSuggestions.map((suggestion) => (
                <div
                  key={suggestion.folderId}
                  className="p-3 border rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground line-through">
                      {suggestion.currentName}
                    </span>
                    <Badge variant="secondary">
                      {Math.round(suggestion.confidence * 100)}%
                    </Badge>
                  </div>
                  <div className="font-medium text-green-600">
                    → {suggestion.suggestedName}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    原因: {suggestion.reason}
                  </p>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
