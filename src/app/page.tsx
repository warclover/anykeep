/**
 * 根页面 - 重定向到首页或登录页
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 标记为动态路由，因为需要访问 cookies 和进行认证检查
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/home");
  } else {
    redirect("/login");
  }
}
