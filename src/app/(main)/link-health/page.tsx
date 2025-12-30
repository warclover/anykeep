/**
 * 链接检测页面 - 服务端入口
 * 检测收藏链接的可访问性，发现失效链接
 */

import type { Metadata } from "next";
import { LinkHealthPageClient } from "@/components/link-health/link-health-page-client";

export const metadata: Metadata = {
  title: "链接检测 - AnyKeep",
  description: "检测收藏链接的可访问性，发现失效链接并提供修复建议",
};

export default function LinkHealthPage() {
  return <LinkHealthPageClient />;
}
