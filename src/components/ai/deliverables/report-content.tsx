/**
 * 报告内容渲染 - 智能选择报告组件
 *
 * 路由优先级：
 * 1. periodic_report skill → AIPeriodicReportContent
 * 2. insight_report skill → AIReportContent
 * 3. 检测周期报告结构 (stats + highlights + insights) → AIPeriodicReportContent
 * 4. 检测洞察报告结构 (activity + content + reportType) → AIReportContent
 * 5. 其他报告类型 → AIGenericReportContent (fallback)
 */

import { memo } from "react";
import { AIReportContent } from "../ai-report-content";
import { AIPeriodicReportContent } from "../ai-periodic-report-content";
import { AIGenericReportContent } from "../ai-generic-report-content";

export const ReportContent = memo(function ReportContent({
  content,
  metadata,
}: {
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  // 根据 skillId 或内容结构判断报告类型
  const skillId = metadata?.skillId as string | undefined;

  // 周期报告：periodic_report skill
  if (skillId === "periodic_report") {
    return <AIPeriodicReportContent content={content} />;
  }

  // 洞察报告：insight_report skill
  if (skillId === "insight_report") {
    return <AIReportContent content={content} />;
  }

  // 检测数据结构
  if (typeof content === "object" && content !== null) {
    const obj = content as Record<string, unknown>;

    // 周期报告结构: stats + highlights + insights
    if (
      typeof obj.stats === "object" &&
      Array.isArray(obj.highlights) &&
      Array.isArray(obj.insights)
    ) {
      return <AIPeriodicReportContent content={content} />;
    }

    // 洞察报告结构: activity + content + reportType
    if (
      typeof obj.activity === "object" &&
      typeof obj.content === "object" &&
      typeof obj.reportType === "string"
    ) {
      return <AIReportContent content={content} />;
    }
  }

  // 其他所有报告类型使用通用报告渲染器
  // 包括：batch_organize, duplicate_cleanup, smart_tagging,
  // quick_digest, reading_planner 等
  return <AIGenericReportContent content={content} />;
});
