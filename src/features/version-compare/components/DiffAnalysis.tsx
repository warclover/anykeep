/**
 * v3对比v4 - 差异分析组件
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { VersionDiff } from "../types";

interface DiffAnalysisProps {
  diffs: VersionDiff[];
}

export function DiffAnalysis({ diffs }: DiffAnalysisProps) {
  if (diffs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          差异分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {diffs.map((diff, index) => (
          <DiffCard key={index} diff={diff} />
        ))}
      </CardContent>
    </Card>
  );
}

function DiffCard({ diff }: { diff: VersionDiff }) {
  const isPositive = diff.confidenceDiff > 0;
  const isNeutral = diff.confidenceDiff === 0;

  return (
    <div className="p-4 rounded-lg border bg-muted/30">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline">{diff.from}</Badge>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <Badge variant="outline" className="border-primary text-primary">
          {diff.to}
        </Badge>
      </div>

      {/* 指标网格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {/* 文件夹一致性 */}
        <div className="text-center p-2 rounded bg-background">
          <div className="mb-1">
            {diff.sameFolder ? (
              <CheckCircle2 className="w-5 h-5 mx-auto text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 mx-auto text-yellow-500" />
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {diff.sameFolder ? "推荐一致" : "推荐不同"}
          </div>
        </div>

        {/* 置信度变化 */}
        <div className="text-center p-2 rounded bg-background">
          <div className="flex items-center justify-center gap-1">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : isNeutral ? (
              <Minus className="w-4 h-4 text-gray-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span
              className={`text-lg font-bold ${
                isPositive
                  ? "text-green-600"
                  : isNeutral
                    ? "text-gray-500"
                    : "text-red-600"
              }`}
            >
              {isPositive ? "+" : ""}
              {diff.confidenceDiff}%
            </span>
          </div>
          <div className="text-xs text-muted-foreground">置信度变化</div>
        </div>

        {/* 耗时变化 */}
        <div className="text-center p-2 rounded bg-background">
          <div
            className={`text-lg font-bold ${
              diff.timeDiff < 0
                ? "text-green-600"
                : diff.timeDiff > 0
                  ? "text-red-600"
                  : "text-gray-500"
            }`}
          >
            {diff.timeDiff > 0 ? "+" : ""}
            {diff.timeDiff}ms
          </div>
          <div className="text-xs text-muted-foreground">耗时变化</div>
        </div>

        {/* 分层变化 */}
        <div className="text-center p-2 rounded bg-background">
          <div className="text-lg font-bold">{diff.tierChange || "-"}</div>
          <div className="text-xs text-muted-foreground">分层变化</div>
        </div>
      </div>

      {/* 改进点 */}
      {diff.improvements.length > 0 && (
        <div className="pt-3 border-t">
          <div className="flex items-center gap-1 mb-2 text-sm font-medium">
            <Sparkles className="w-4 h-4 text-primary" />
            改进点
          </div>
          <div className="flex flex-wrap gap-1.5">
            {diff.improvements.map((improvement, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                ✓ {improvement}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
