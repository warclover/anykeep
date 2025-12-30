/**
 * 知识萃取创建页 - 服务端入口
 * 引导用户选择来源、深度模式并启动生成
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { Metadata } from "next";
import { SynthesisNewPageClient } from "@/components/synthesis/synthesis-new-page-client";

export const metadata: Metadata = {
  title: "创建知识萃取 - AnyKeep",
  description: "选择书签来源和萃取深度，从多个书签中提炼知识精华",
};

export default function SynthesisNewPage() {
  return <SynthesisNewPageClient />;
}
