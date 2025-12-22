// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 文件夹健康检查页面
 * 分析文件夹组织结构，提供合并/拆分建议
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FolderHealthPageClient } from "@/components/folder-health";

export default async function FolderHealthPage() {
  const supabase = await createClient();

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  return <FolderHealthPageClient />;
}
