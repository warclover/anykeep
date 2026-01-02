/**
 * Feature Flags 面板组件
 *
 * 展示当前启用的功能开关状态
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

"use client";

import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface FeatureFlags {
  queryRewrite: boolean;
  rerank: boolean;
  vectorCache: boolean;
  parentChildChunking: boolean;
  rrfFusion: boolean;
  smartFilterExtraction: boolean;
}

interface FeatureFlagsPanelProps {
  flags: FeatureFlags | null;
  loading?: boolean;
}

const FLAG_LABELS: Record<keyof FeatureFlags, string> = {
  queryRewrite: "查询改写",
  rerank: "重排序",
  vectorCache: "向量缓存",
  parentChildChunking: "父子分块",
  rrfFusion: "RRF 融合",
  smartFilterExtraction: "智能过滤器提取",
};

const FLAG_DESCRIPTIONS: Record<keyof FeatureFlags, string> = {
  queryRewrite: "使用 LLM 优化用户查询，提升检索质量",
  rerank: "对搜索结果进行语义重排序",
  vectorCache: "缓存向量嵌入，减少 API 调用",
  parentChildChunking: "使用父子分块策略提升上下文完整性",
  rrfFusion: "融合多路召回结果",
  smartFilterExtraction: "从自然语言提取结构化过滤条件",
};

export function FeatureFlagsPanel({
  flags,
  loading = false,
}: FeatureFlagsPanelProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const flagEntries = flags
    ? (Object.entries(flags) as [keyof FeatureFlags, boolean][])
    : [];

  const enabledCount = flagEntries.filter(([, enabled]) => enabled).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">功能开关</CardTitle>
        <Badge variant="secondary">
          {enabledCount}/{flagEntries.length} 启用
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {flagEntries.map(([key, enabled]) => (
            <div
              key={key}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg transition-colors",
                enabled
                  ? "bg-green-50 dark:bg-green-900/20"
                  : "bg-gray-50 dark:bg-gray-800/50",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {FLAG_LABELS[key]}
                  </span>
                  {enabled ? (
                    <Check className="size-3.5 text-green-500" />
                  ) : (
                    <X className="size-3.5 text-gray-400" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {FLAG_DESCRIPTIONS[key]}
                </p>
              </div>
              <Badge
                variant={enabled ? "default" : "outline"}
                className={cn(
                  "shrink-0 ml-2",
                  enabled
                    ? "bg-green-500 hover:bg-green-500"
                    : "text-gray-400 border-gray-300",
                )}
              >
                {enabled ? "启用" : "禁用"}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
