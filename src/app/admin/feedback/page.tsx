/**
 * 管理后台反馈列表页面 - Server Component
 *
 * 服务端预加载初始数据，客户端处理交互逻辑
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminFeedbackListClient } from "@/components/admin/admin-feedback-list-client";
import type { UserFeedback } from "@/types/user-feedback";

export const dynamic = "force-dynamic";

async function getAdminFeedbacks(): Promise<UserFeedback[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect("/login");
    }

    // TODO: 添加管理员权限检查
    // const isAdmin = await checkAdminRole(user.id);
    // if (!isAdmin) redirect("/");

    const { data, error } = await supabase
      .from("user_feedbacks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed to fetch admin feedbacks:", error);
      return [];
    }

    return (data as UserFeedback[]) || [];
  } catch (error) {
    console.error("Failed to fetch admin feedbacks:", error);
    return [];
  }
}

export default async function AdminFeedbackListPage() {
  const feedbacks = await getAdminFeedbacks();

  return <AdminFeedbackListClient initialFeedbacks={feedbacks} />;
}
