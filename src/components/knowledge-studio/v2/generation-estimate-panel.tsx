/**
 * Generation Estimate Panel - 生成预估面板
 * @module knowledge-studio/v2
 *
 * Phase 2.1: 在生成前显示预估信息面板
 */

"use client";

import { useMemo } from "react";
import { Clock, FileText, Sparkles, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { BlueprintOutline } from "@/lib/knowledge-studio/blueprint/types";
import type { LengthMode } from "@/lib/knowledge-studio/v2/constants";
import {
  getGenerationEstimate,
  formatWordsDisplay,
} from "@/lib/knowledge-studio/v2/time-estimator";

// ============================================================
// Types
// ============================================================

export interface GenerationEstimatePanelProps {
  /** 大纲数据 */
  outline: BlueprintOutline;
  /** 目标长度模式 */
  targetLength: LengthMode;
  /** 素材数量 */
  materialCount: number;
  /** 类名 */
  className?: string;
}

// ============================================================
// Component
// ============================================================

export function GenerationEstimatePanel({
  outline,
  targetLength,
  materialCount,
  className,
}: GenerationEstimatePanelProps) {
  const estimate = useMemo(
    () => getGenerationEstimate(outline, targetLength, materialCount),
    [outline, targetLength, materialCount],
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          生成预估
        </CardTitle>
        <CardDescription>生成前的预估信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 统计信息 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">素材：</span>
            <span className="font-medium">{estimate.materialCount} 篇</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="font-normal">
              {estimate.lengthModeLabel}
            </Badge>
            <span className="text-muted-foreground">
              ({formatWordsDisplay(estimate.words)})
            </span>
          </div>
        </div>

        {/* 章节信息 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">大纲章节：</span>
          <span className="font-medium">{estimate.sectionCount} 个</span>
        </div>

        {/* 时间预估 */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">预计时间：</span>
          <span className="font-medium">{estimate.time.display}</span>
        </div>

        {/* 提示信息 */}
        <Alert
          variant="default"
          className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20"
        >
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            生成过程中请勿关闭页面
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export default GenerationEstimatePanel;
