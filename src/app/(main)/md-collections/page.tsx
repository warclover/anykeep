/**
 * MD 收藏页面
 * P2-007: Markdown 内容收藏
 */

import { unstable_noStore } from "next/cache";
import { MdCollectionPageClient } from "./page-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { createClient } from "@/lib/supabase/server";
// redirect 保留用于未来登录跳转逻辑
import { redirect as _redirect } from "next/navigation";

/**
 * 检查用户会员类型
 */
async function checkUserAccess(): Promise<{
  hasAccess: boolean;
  membershipType: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { hasAccess: false, membershipType: "FREE" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", user.id)
      .single();

    const membershipType = profile?.membership_type || "FREE";
    const hasAccess = membershipType === "PRO";

    return { hasAccess, membershipType };
  } catch {
    return { hasAccess: false, membershipType: "FREE" };
  }
}

export default async function MdCollectionsPage() {
  // 禁用缓存
  unstable_noStore();

  const { hasAccess, membershipType } = await checkUserAccess();

  return (
    <ErrorBoundary>
      <MdCollectionPageClient
        hasAccess={hasAccess}
        membershipType={membershipType}
      />
    </ErrorBoundary>
  );
}
