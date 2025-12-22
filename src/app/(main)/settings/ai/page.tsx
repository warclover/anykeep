/**
 * AI 设置页面
 *
 * 集中管理 AI 相关设置，包括 Provider 状态、Skills 监控、使用统计
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

// 标记为动态路由
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AISettingsPageClient } from "./ai-settings-page-client";

export default async function AISettingsPage() {
  const supabase = await createClient();

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  return <AISettingsPageClient userId={user.id} />;
}
