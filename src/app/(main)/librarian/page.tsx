/**
 * AI 整理大师页面
 * 路由: /librarian
 *
 * @description 智能分析书签和文件夹，发现优化机会
 * - 重复文件夹检测
 * - 空文件夹清理
 * - 超大文件夹拆分建议
 * - 命名规范检查
 * - 缺失分类识别
 */

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LibrarianPageClient } from "@/components/librarian";

export default async function LibrarianPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  return <LibrarianPageClient />;
}
