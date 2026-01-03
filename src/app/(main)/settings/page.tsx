// 标记为动态路由
export const dynamic = "force-dynamic";

/**
 * 设置页面 - 服务端组件
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsPageClient } from "@/components/settings/settings-page-client";
import { mergeWithDefaults } from "@/types/user-settings";
import type { UserSettings } from "@/types/user-settings";

export default async function SettingsPage() {
  const supabase = await createClient();

  // 获取当前用户
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // 从数据库获取用户设置
  // 类型断言: 手动维护类型文件时需要此断言
  const { data: profile } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", user.id)
    .single() as unknown as { data: { settings: unknown } | null };

  // 合并默认值（处理旧版设置或新用户）
  const userSettings = mergeWithDefaults(
    profile?.settings as Partial<UserSettings> | null,
  );

  return <SettingsPageClient user={user} settings={userSettings} />;
}
