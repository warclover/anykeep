"use client";

/**
 * 智能分类调试工具 - 结果对比组件
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Folder,
  Clock,
  Target,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import type { CompareResponse, VersionResult, ComparisonDiff } from "../types";

interface ResultsCompareProps {
  result: CompareResponse | null;
}

export function ResultsCompare({ result }: ResultsCompareProps) {
  if (!result) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            输入书签信息并点击「执行对比分析」查看结果
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!result.success) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-6">
          <div className="flex items-center gap-3 text-destructive">
            <XCircle className="w-5 h-5" />
            <div>
              <div className="font-medium">对比执行失败</div>
              <div className="text-sm">{result.error}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 版本对比 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VersionResultCard
          title="V3 结果"
          result={result.v3Result}
          variant="secondary"
        />
        <VersionResultCard
          title="V4 结果"
          result={result.v4Result}
          variant="primary"
        />
      </div>

      {/* 差异分析 */}
      <ComparisonCard comparison={result.comparison} />

      {/* 配置摘要 */}
      <ConfigSummaryCard configSummary={result.configSummary} />
    </div>
  );
}

/**
 * 单版本结果卡片
 */
function VersionResultCard({
  title,
  result,
  variant,
}: {
  title: string;
  result: VersionResult;
  variant: "primary" | "secondary";
}) {
  const tierColors: Record<string, string> = {
    T1: "bg-green-500/10 text-green-600 border-green-500/20",
    T2: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    T3: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  return (
    <Card className={variant === "primary" ? "border-primary/50" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{title}</span>
          <Badge className={tierColors[result.tier] || ""}>{result.tier}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 推荐文件夹 */}
        <div className="flex items-start gap-3">
          <Folder className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <div className="font-medium">{result.folderName}</div>
            <div className="text-sm text-muted-foreground">
              {result.action === "inbox"
                ? "保留在待整理"
                : result.action === "suggest_new"
                  ? "建议创建新文件夹"
                  : "分类到现有文件夹"}
            </div>
          </div>
        </div>

        {/* 置信度 */}
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm">置信度</span>
              <span className="font-medium">{result.confidence}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  result.confidence >= 80
                    ? "bg-green-500"
                    : result.confidence >= 60
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${result.confidence}%` }}
              />
            </div>
          </div>
        </div>

        {/* 耗时 */}
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm">
            耗时：<span className="font-medium">{result.executionTime}ms</span>
          </span>
        </div>

        {/* V4 扩展信息 */}
        {result.v4Details && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground space-y-1">
              {result.v4Details.scenarioWeight && (
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  场景权重：{result.v4Details.scenarioWeight.toFixed(2)}x
                </div>
              )}
              {result.v4Details.correctionApplied && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  纠错缓存命中
                </div>
              )}
            </div>
          </div>
        )}

        {/* 推理过程 */}
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {result.reasoning}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 差异分析卡片
 */
function ComparisonCard({ comparison }: { comparison: ComparisonDiff }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          差异分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 文件夹一致性 */}
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl mb-1">
              {comparison.sameFolder ? (
                <CheckCircle2 className="w-6 h-6 mx-auto text-green-500" />
              ) : (
                <XCircle className="w-6 h-6 mx-auto text-yellow-500" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {comparison.sameFolder ? "推荐一致" : "推荐不同"}
            </div>
          </div>

          {/* 置信度差异 */}
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div
              className={`text-xl font-bold ${
                comparison.confidenceDiff > 0
                  ? "text-green-500"
                  : comparison.confidenceDiff < 0
                    ? "text-red-500"
                    : ""
              }`}
            >
              {comparison.confidenceDiff > 0 ? "+" : ""}
              {comparison.confidenceDiff.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">置信度变化</div>
          </div>

          {/* 耗时差异 */}
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-xl font-bold">
              {comparison.timeDiff > 0 ? "+" : ""}
              {comparison.timeDiff}ms
            </div>
            <div className="text-xs text-muted-foreground">耗时变化</div>
          </div>

          {/* 分层变化 */}
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-xl font-bold">
              {comparison.tierDiff || "-"}
            </div>
            <div className="text-xs text-muted-foreground">分层变化</div>
          </div>
        </div>

        {/* V4 改进点 */}
        {comparison.v4Improvements.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              V4 改进点
            </div>
            <div className="flex flex-wrap gap-2">
              {comparison.v4Improvements.map((improvement, index) => (
                <Badge key={index} variant="secondary">
                  {improvement}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 配置摘要卡片
 */
function ConfigSummaryCard({
  configSummary,
}: {
  configSummary: CompareResponse["configSummary"];
}) {
  return (
    <Card className="bg-muted/30">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">场景：</span>
            <Badge variant="outline">{configSummary.scenario}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">预设：</span>
            <Badge variant="outline">{configSummary.preset}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">V4 特性：</span>
            <span className="text-xs">
              {configSummary.v4Features.length > 0
                ? configSummary.v4Features.join(", ")
                : "无"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
