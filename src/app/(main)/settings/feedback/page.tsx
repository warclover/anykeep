/**
 * 用户反馈列表页面 - Server Component
 *
 * 服务端预加载初始数据，客户端处理交互逻辑
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FeedbackListClient } from "@/components/settings/feedback-list-client";
import type { UserFeedback } from "@/types/user-feedback";
import { clientLogger } from "@/lib/client-logger";

export const dynamic = "force-dynamic";

async function getFeedbacks(): Promise<UserFeedback[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect("/login");
    }

    const { data, error } = await supabase
      .from("user_feedbacks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      clientLogger.error({ error }, "Failed to fetch feedbacks:");
      return [];
    }

    return (data as UserFeedback[]) || [];
  } catch (error) {
    clientLogger.error({ error }, "Failed to fetch feedbacks:");
    return [];
  }
}

export default async function FeedbackListPage() {
  const feedbacks = await getFeedbacks();

  return <FeedbackListClient initialFeedbacks={feedbacks} />;
}
