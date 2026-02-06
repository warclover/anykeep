/**
 * 分类日志页面
 * @description V4.3 L3 分类日志 - 历史记录时间轴
 * @version 1.0.0
 * @since 2025-12-12
 */

import { ActivityPageClient } from "@/components/activity/activity-page-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "分类日志 - AnyKeep",
  description: "查看历史操作记录和 AI 处理报告",
};

export default function ActivityPage() {
  return <ActivityPageClient />;
}
