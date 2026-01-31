/**
 * AI 整理大师页面 - 重定向到整理中心
 *
 * @deprecated 整理大师功能已合并到整理中心 (2026-01-31)
 * @see /organize
 */

import { redirect } from "next/navigation";

export default function LibrarianPage() {
  redirect("/organize");
}
