/**
 * 综述详情页 - 服务端入口
 * 展示单个综述的完整四维结构化输出
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { Metadata } from "next";
import { SynthesisDetailPageClient } from "@/components/synthesis/synthesis-detail-page-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;

  return {
    title: `综述详情 - AnyKeep`,
    description: `查看综述报告 ${id} 的完整内容`,
  };
}

export default async function SynthesisDetailPage({ params }: PageProps) {
  const { id } = await params;

  return <SynthesisDetailPageClient reportId={id} />;
}
