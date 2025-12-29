/**
 * 综述生成引导页 - 服务端入口
 * 引导用户选择来源、深度模式并启动生成
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { Metadata } from "next";
import { SynthesisNewPageClient } from "@/components/synthesis/synthesis-new-page-client";

export const metadata: Metadata = {
  title: "创建综述 - AnyKeep",
  description: "选择书签来源和综述深度，开始生成主题综述",
};

export default function SynthesisNewPage() {
  return <SynthesisNewPageClient />;
}
