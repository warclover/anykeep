/**
 * 数据导入页面 - 服务端入口
 * 整合浏览器书签导入、批量导入、文件导入功能
 */

import type { Metadata } from "next";
import { ImportPageClient } from "@/components/import/import-page-client";

export const metadata: Metadata = {
  title: "数据导入 - AnyKeep",
  description:
    "导入书签数据：支持浏览器书签、批量 URL、JSON/CSV 文件等多种方式",
};

export default function ImportPage() {
  return <ImportPageClient />;
}
