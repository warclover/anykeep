/**
 * 整理中心页面
 *
 * 提供统一的收藏整理入口，支持一键智能整理和多种快捷操作
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import type { Metadata } from "next";
import { OrganizePageClient } from "@/components/organize/organize-page-client";

export const metadata: Metadata = {
  title: "整理中心 - AnyKeep",
  description: "AI 帮你智能整理收藏，保持知识库整洁有序",
};

export default function OrganizePage() {
  return <OrganizePageClient />;
}
