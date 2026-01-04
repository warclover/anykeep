/**
 * Knowledge Studio v2 - 蓝图工作流页面
 * @route /knowledge-studio/v2/[blueprintId]
 *
 * 工作流:
 * 1. 显示蓝图信息
 * 2. Briefing 向导 (可选)
 * 3. 大纲编辑器 (可选)
 * 4. 生成进度
 * 5. 结构化输出查看器
 */

import { Suspense } from "react";
import { BlueprintWorkflowClient } from "./blueprint-workflow-client";

interface PageProps {
  params: Promise<{
    blueprintId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { blueprintId } = await params;
  return {
    title: `${blueprintId} | 知识工坊 | AnyKeep`,
    description: "使用增强蓝图生成专业内容",
  };
}

export default async function BlueprintWorkflowPage({ params }: PageProps) {
  const { blueprintId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">加载中...</div>
        </div>
      }
    >
      <BlueprintWorkflowClient blueprintId={blueprintId} />
    </Suspense>
  );
}
