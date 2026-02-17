/**
 * Knowledge Studio v2 - 蓝图工作流页面（已弃用，重定向到主页）
 * @route /knowledge-studio/v2/[blueprintId]
 *
 * v2.0.0 简化：统一到单页流程
 */

import { redirect } from "next/navigation";

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

  // v2.0.0: 重定向到单页流程，通过 query 参数预选蓝图
  redirect(`/knowledge-studio/v2?blueprint=${encodeURIComponent(blueprintId)}`);
}
