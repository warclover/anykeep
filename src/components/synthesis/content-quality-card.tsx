/**
 * 内容质量评估卡片组件
 *
 * 在综述生成前评估内容质量，提供可视化评分和建议
 *
 * @version 1.0.0
 * @since 2026-01-01 [E2]
 */

"use client";

import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  FileText,
  Layers,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================================================
// 类型定义
// ============================================================================

interface ContentStats {
  totalCount: number;
  withSummary: number;
  avgSummaryLength: number;
  platforms: Record<string, number>;
}

interface QualityMetric {
  id: string;
  name: string;
  value: number;
  maxValue: number;
  score: number; // 0-100
  status: "good" | "warning" | "error";
  description: string;
  suggestion?: string;
}

interface QualityAssessment {
  overallScore: number; // 0-100
  status: "excellent" | "good" | "fair" | "poor";
  metrics: QualityMetric[];
  canGenerate: boolean;
  blockReason?: string;
}

interface ContentQualityCardProps {
  stats: ContentStats | null;
  excludedCount?: number;
  className?: string;
}

// ============================================================================
// 质量评估逻辑
// ============================================================================

/**
 * 质量阈值配置
 */
const QUALITY_THRESHOLDS = {
  // 书签数量
  minCount: 3, // 最少需要3篇
  goodCount: 10, // 10篇以上为优秀
  maxCount: 50, // 超过50篇可能影响质量

  // 摘要覆盖率
  minSummaryRate: 0.3, // 至少30%有摘要
  goodSummaryRate: 0.7, // 70%以上为优秀

  // 平均摘要长度
  minAvgLength: 50, // 至少50字
  goodAvgLength: 200, // 200字以上为优秀

  // 平台多样性
  minPlatforms: 1,
  goodPlatforms: 3,
};

/**
 * 计算质量评估
 */
function calculateQualityAssessment(
  stats: ContentStats,
  excludedCount: number,
): QualityAssessment {
  const effectiveCount = stats.totalCount - excludedCount;
  const summaryRate =
    effectiveCount > 0 ? stats.withSummary / effectiveCount : 0;
  const platformCount = Object.keys(stats.platforms).length;

  const metrics: QualityMetric[] = [];

  // 1. 书签数量评估
  let countScore = 0;
  let countStatus: QualityMetric["status"] = "error";
  let countSuggestion: string | undefined;

  if (effectiveCount < QUALITY_THRESHOLDS.minCount) {
    countScore = (effectiveCount / QUALITY_THRESHOLDS.minCount) * 30;
    countStatus = "error";
    countSuggestion = `至少需要 ${QUALITY_THRESHOLDS.minCount} 篇书签才能生成综述`;
  } else if (effectiveCount < QUALITY_THRESHOLDS.goodCount) {
    countScore = 30 + ((effectiveCount - 3) / 7) * 40;
    countStatus = "warning";
    countSuggestion = "建议选择更多书签以获得更全面的综述";
  } else if (effectiveCount <= QUALITY_THRESHOLDS.maxCount) {
    countScore = 70 + ((effectiveCount - 10) / 40) * 30;
    countStatus = "good";
  } else {
    countScore = 85;
    countStatus = "warning";
    countSuggestion = "书签数量较多，可能影响综述质量，建议精选内容";
  }

  metrics.push({
    id: "count",
    name: "内容数量",
    value: effectiveCount,
    maxValue: QUALITY_THRESHOLDS.maxCount,
    score: Math.min(100, Math.max(0, countScore)),
    status: countStatus,
    description: `${effectiveCount} 篇有效书签`,
    suggestion: countSuggestion,
  });

  // 2. 摘要覆盖率评估
  let summaryScore = 0;
  let summaryStatus: QualityMetric["status"] = "error";
  let summarySuggestion: string | undefined;

  if (summaryRate < QUALITY_THRESHOLDS.minSummaryRate) {
    summaryScore = (summaryRate / QUALITY_THRESHOLDS.minSummaryRate) * 40;
    summaryStatus = "error";
    summarySuggestion = "大部分书签缺少 AI 摘要，建议先生成摘要再综述";
  } else if (summaryRate < QUALITY_THRESHOLDS.goodSummaryRate) {
    summaryScore = 40 + ((summaryRate - 0.3) / 0.4) * 40;
    summaryStatus = "warning";
    summarySuggestion = "部分书签缺少摘要，可能影响综述质量";
  } else {
    summaryScore = 80 + ((summaryRate - 0.7) / 0.3) * 20;
    summaryStatus = "good";
  }

  metrics.push({
    id: "summary",
    name: "摘要覆盖",
    value: Math.round(summaryRate * 100),
    maxValue: 100,
    score: Math.min(100, Math.max(0, summaryScore)),
    status: summaryStatus,
    description: `${Math.round(summaryRate * 100)}% 有 AI 摘要`,
    suggestion: summarySuggestion,
  });

  // 3. 内容深度评估（平均摘要长度）
  let depthScore = 0;
  let depthStatus: QualityMetric["status"] = "warning";
  let depthSuggestion: string | undefined;

  if (stats.avgSummaryLength < QUALITY_THRESHOLDS.minAvgLength) {
    depthScore =
      (stats.avgSummaryLength / QUALITY_THRESHOLDS.minAvgLength) * 40;
    depthStatus = "error";
    depthSuggestion = "摘要内容较短，综述深度可能受限";
  } else if (stats.avgSummaryLength < QUALITY_THRESHOLDS.goodAvgLength) {
    depthScore = 40 + ((stats.avgSummaryLength - 50) / 150) * 40;
    depthStatus = "warning";
  } else {
    depthScore = 80 + Math.min(20, ((stats.avgSummaryLength - 200) / 200) * 20);
    depthStatus = "good";
  }

  metrics.push({
    id: "depth",
    name: "内容深度",
    value: Math.round(stats.avgSummaryLength),
    maxValue: 400,
    score: Math.min(100, Math.max(0, depthScore)),
    status: depthStatus,
    description: `平均 ${Math.round(stats.avgSummaryLength)} 字/篇`,
    suggestion: depthSuggestion,
  });

  // 4. 来源多样性评估
  let diversityScore = 0;
  let diversityStatus: QualityMetric["status"] = "warning";
  let diversitySuggestion: string | undefined;

  if (platformCount < QUALITY_THRESHOLDS.minPlatforms) {
    diversityScore = 30;
    diversityStatus = "warning";
    diversitySuggestion = "来源单一，建议添加不同平台的内容";
  } else if (platformCount < QUALITY_THRESHOLDS.goodPlatforms) {
    diversityScore = 30 + ((platformCount - 1) / 2) * 40;
    diversityStatus = "warning";
  } else {
    diversityScore = 70 + Math.min(30, (platformCount - 3) * 10);
    diversityStatus = "good";
  }

  metrics.push({
    id: "diversity",
    name: "来源多样性",
    value: platformCount,
    maxValue: 6,
    score: Math.min(100, Math.max(0, diversityScore)),
    status: diversityStatus,
    description: `${platformCount} 个平台`,
    suggestion: diversitySuggestion,
  });

  // 计算总分（加权平均）
  const weights = { count: 0.35, summary: 0.3, depth: 0.2, diversity: 0.15 };
  const overallScore = Math.round(
    metrics[0].score * weights.count +
      metrics[1].score * weights.summary +
      metrics[2].score * weights.depth +
      metrics[3].score * weights.diversity,
  );

  // 确定总体状态
  let status: QualityAssessment["status"];
  if (overallScore >= 80) {
    status = "excellent";
  } else if (overallScore >= 60) {
    status = "good";
  } else if (overallScore >= 40) {
    status = "fair";
  } else {
    status = "poor";
  }

  // 判断是否可以生成
  const canGenerate = effectiveCount >= QUALITY_THRESHOLDS.minCount;
  const blockReason = !canGenerate
    ? `至少需要 ${QUALITY_THRESHOLDS.minCount} 篇书签才能生成综述`
    : undefined;

  return {
    overallScore,
    status,
    metrics,
    canGenerate,
    blockReason,
  };
}

// ============================================================================
// 组件实现
// ============================================================================

/**
 * 状态配置
 */
const STATUS_CONFIG = {
  excellent: {
    label: "优秀",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: CheckCircle2,
  },
  good: {
    label: "良好",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: CheckCircle2,
  },
  fair: {
    label: "一般",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: AlertTriangle,
  },
  poor: {
    label: "较差",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: XCircle,
  },
};

const METRIC_ICONS = {
  count: FileText,
  summary: TrendingUp,
  depth: Layers,
  diversity: Layers,
};

/**
 * 内容质量评估卡片
 */
export function ContentQualityCard({
  stats,
  excludedCount = 0,
  className,
}: ContentQualityCardProps) {
  if (!stats) {
    return null;
  }

  const assessment = calculateQualityAssessment(stats, excludedCount);
  const statusConfig = STATUS_CONFIG[assessment.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Card
      className={cn(
        "border-2",
        statusConfig.borderColor,
        statusConfig.bgColor,
        className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <StatusIcon className={cn("h-5 w-5", statusConfig.color)} />
            内容质量评估
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-sm font-semibold",
              statusConfig.color,
              statusConfig.borderColor,
            )}
          >
            {assessment.overallScore} 分 · {statusConfig.label}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 阻止生成提示 */}
        {!assessment.canGenerate && assessment.blockReason && (
          <div className="flex items-start gap-2 p-3 bg-red-100 border border-red-300 rounded-lg">
            <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-medium">无法生成综述</p>
              <p>{assessment.blockReason}</p>
            </div>
          </div>
        )}

        {/* 质量指标 */}
        <div className="grid grid-cols-2 gap-3">
          {assessment.metrics.map((metric) => {
            const MetricIcon =
              METRIC_ICONS[metric.id as keyof typeof METRIC_ICONS] || Info;
            return (
              <TooltipProvider key={metric.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "p-3 rounded-lg border bg-white/50 cursor-help transition-colors",
                        metric.status === "good" && "border-green-200",
                        metric.status === "warning" && "border-amber-200",
                        metric.status === "error" && "border-red-200",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MetricIcon
                          className={cn(
                            "h-4 w-4",
                            metric.status === "good" && "text-green-600",
                            metric.status === "warning" && "text-amber-600",
                            metric.status === "error" && "text-red-600",
                          )}
                        />
                        <span className="text-xs font-medium text-muted-foreground">
                          {metric.name}
                        </span>
                      </div>
                      <p className="text-sm font-semibold">
                        {metric.description}
                      </p>
                      <Progress
                        value={metric.score}
                        className={cn(
                          "h-1.5 mt-2",
                          metric.status === "good" && "[&>div]:bg-green-500",
                          metric.status === "warning" && "[&>div]:bg-amber-500",
                          metric.status === "error" && "[&>div]:bg-red-500",
                        )}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium mb-1">{metric.name}</p>
                    <p className="text-xs text-muted-foreground">
                      评分：{Math.round(metric.score)} / 100
                    </p>
                    {metric.suggestion && (
                      <p className="text-xs text-amber-600 mt-1">
                        💡 {metric.suggestion}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* 改进建议 */}
        {assessment.canGenerate && assessment.status !== "excellent" && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">提升建议</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {assessment.metrics
                  .filter((m) => m.suggestion)
                  .slice(0, 2)
                  .map((m) => (
                    <li key={m.id}>{m.suggestion}</li>
                  ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 导出质量评估函数供外部使用
 */
export { calculateQualityAssessment };
export type { ContentStats, QualityAssessment };
