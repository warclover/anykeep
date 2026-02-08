/**
 * AI 整理大师页面 - 重定向到整理中心
 *
 * @deprecated 整理大师功能已合并到整理中心 (2026-01-31)
 * @see /organize
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "整理大师 - AnyKeep",
  description: "智能整理和优化你的收藏内容",
};

export default function LibrarianPage() {
  redirect("/organize");
}
