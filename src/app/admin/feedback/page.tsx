/**
 * 管理后台反馈列表页面 - Server Component
 *
 * 服务端预加载初始数据，客户端处理交互逻辑
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminFeedbackListClient } from "@/components/admin/admin-feedback-list-client";
import { isAdminUser } from "@/lib/auth/admin-check";
import { logger } from "@/lib/logger";
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

    // 权限检查 - 验证是否为管理员
    if (!isAdminUser(user.email)) {
      logger.warn(
        { userId: user.id, email: user.email },
        "[AdminFeedbackPage] 非管理员访问尝试",
      );
      redirect("/");
    }

    const { data, error } = await supabase
      .from("user_feedbacks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      logger.error({ error }, "[AdminFeedbackPage] Failed to fetch feedbacks");
      return [];
    }

    return (data as UserFeedback[]) || [];
  } catch (error) {
    logger.error({ error }, "[AdminFeedbackPage] Failed to fetch feedbacks");
    return [];
  }
}

export default async function AdminFeedbackListPage() {
  const feedbacks = await getAdminFeedbacks();

  return <AdminFeedbackListClient initialFeedbacks={feedbacks} />;
}
