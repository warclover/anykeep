/**
 * Generating Card 组件
 *
 * 生成中状态卡片
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { memo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { SynthesisProgress } from "../synthesis-progress";

interface GeneratingCardProps {
  reportId: string;
  depthMode?: "quick" | "standard" | "academic";
  sourceCount?: number;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * 生成中状态卡片
 */
export const GeneratingCard = memo(function GeneratingCard({
  reportId,
  depthMode,
  sourceCount,
  onComplete,
  onCancel,
}: GeneratingCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>正在生成综述</CardTitle>
        <CardDescription>AI 正在分析您的收藏内容，请稍候...</CardDescription>
      </CardHeader>
      <CardContent>
        <SynthesisProgress
          reportId={reportId}
          depthMode={depthMode}
          sourceCount={sourceCount}
          onComplete={onComplete}
          onCancel={onCancel}
        />
      </CardContent>
    </Card>
  );
});
