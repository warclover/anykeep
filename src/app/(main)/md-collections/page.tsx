/**
 * MD 收藏页面
 * P2-007: Markdown 内容收藏
 *
 * 性能优化：
 * 1. 本地 JWT 验证，避免 getUser() 网络请求（~1500ms → ~5ms）
 * 2. 并行预取数据，避免客户端瀑布流请求
 */

import { unstable_noStore } from "next/cache";
import { cookies } from "next/headers";
import { MdCollectionPageClient } from "./page-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { createClient } from "@/lib/supabase/server";
import { verifyJwtLocally, extractAccessToken } from "@/lib/auth/jwt-verifier";
import type { MdCollection } from "@/features/md-collections";

const DEFAULT_LIMIT = 20;

/**
 * 快速获取用户 ID（优先本地 JWT 验证）
 * 性能：本地验证 ~5ms vs 网络请求 ~1500ms
 */
async function getUserIdFast(): Promise<string | null> {
  const cookieStore = await cookies();

  // 尝试本地 JWT 验证（快速路径）
  const accessToken = extractAccessToken(cookieStore);
  if (accessToken) {
    const result = await verifyJwtLocally(accessToken);
    if (result.valid && result.userId) {
      return result.userId;
    }
  }

  // 回退到 Supabase 网络验证（慢速路径）
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * 检查用户权限并预取数据
 * 合并认证和数据获取，减少数据库往返
 */
async function getPageData(): Promise<{
  hasAccess: boolean;
  membershipType: string;
  initialData: MdCollection[];
  hasMore: boolean;
}> {
  try {
    // 1. 快速获取用户 ID（优先本地验证）
    const userId = await getUserIdFast();

    if (!userId) {
      return {
        hasAccess: false,
        membershipType: "FREE",
        initialData: [],
        hasMore: false,
      };
    }

    // 2. 并行获取 profile 和 collections（使用已验证的 userId）
    const supabase = await createClient();
    const [profileResult, collectionsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("membership_type")
        .eq("id", userId)
        .single(),
      supabase
        .from("md_collections")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(DEFAULT_LIMIT + 1),
    ]);

    const membershipType = profileResult.data?.membership_type || "FREE";
    const hasAccess = membershipType === "PRO";

    // 非 Pro 用户不需要数据
    if (!hasAccess) {
      return {
        hasAccess: false,
        membershipType,
        initialData: [],
        hasMore: false,
      };
    }

    // 处理分页
    const items = collectionsResult.data || [];
    const hasMore = items.length > DEFAULT_LIMIT;
    const initialData = hasMore ? items.slice(0, DEFAULT_LIMIT) : items;

    return {
      hasAccess,
      membershipType,
      initialData: initialData as MdCollection[],
      hasMore,
    };
  } catch {
    return {
      hasAccess: false,
      membershipType: "FREE",
      initialData: [],
      hasMore: false,
    };
  }
}

export default async function MdCollectionsPage() {
  // 禁用缓存（保持实时性）
  unstable_noStore();

  const { hasAccess, membershipType, initialData, hasMore } =
    await getPageData();

  return (
    <ErrorBoundary>
      <MdCollectionPageClient
        hasAccess={hasAccess}
        membershipType={membershipType}
        initialData={initialData}
        initialHasMore={hasMore}
      />
    </ErrorBoundary>
  );
}
