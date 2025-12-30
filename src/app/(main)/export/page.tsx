/**
 * 内容导出页面 - 服务端入口
 * 提供完整的数据导出功能
 */

import type { Metadata } from "next";
import { ExportPageClient } from "@/components/export/export-page-client";

export const metadata: Metadata = {
  title: "内容导出 - AnyKeep",
  description: "导出书签数据：支持 CSV、Markdown、Obsidian、JSON 等多种格式",
};

export default function ExportPage() {
  return <ExportPageClient />;
}
