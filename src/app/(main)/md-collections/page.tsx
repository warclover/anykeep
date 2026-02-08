/**
 * MD 收藏页面
 * P2-007: Markdown 内容收藏
 *
 * 性能优化 V2 (Streaming SSR + Permission-First):
 * 1. 使用 Suspense 实现流式 SSR，首屏立即返回骨架屏
 * 2. 权限检查前置：非 Pro 用户不执行 md_collections 查询
 * 3. 本地 JWT 验证，避免 getUser() 网络请求（~1500ms → ~5ms）
 *
 * V1.1.0: 使用统一权限检查函数，消除类型断言
 */

import type { Metadata } from "next";
import { Suspense, cache } from "react";

export const metadata: Metadata = {
  title: "Markdown 收藏 - AnyKeep",
  description: "管理和浏览 Markdown 文档收藏",
};
import { cookies } from "next/headers";
import { MdCollectionPageClient } from "./page-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { createClient } from "@/lib/supabase/server";
import { verifyJwtLocally, extractAccessToken } from "@/lib/auth/jwt-verifier";
import { checkMdCollectionAccess } from "@/features/md-collections/lib/permission-utils";
import { logger } from "@/lib/logger";
import MdCollectionsLoading from "./loading";
import type { MdCollection } from "@/features/md-collections";

// 动态渲染（用户特定数据）
export const dynamic = "force-dynamic";

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
 * 检查用户权限并预取数据（带请求级缓存）
 * 优化：权限检查前置，非 Pro 用户不执行 collections 查询
 */
const getPageData = cache(
  async (): Promise<{
    hasAccess: boolean;
    membershipType: string;
    initialData: MdCollection[];
    hasMore: boolean;
  }> => {
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

      const supabase = await createClient();

      // 2. 使用统一权限检查函数（消除 `as unknown as` 断言）
      const accessResult = await checkMdCollectionAccess(supabase, userId);
      const { hasAccess, membershipType } = accessResult;

      // 3. 非 Pro 用户直接返回，不执行 collections 查询
      if (!hasAccess) {
        return {
          hasAccess: false,
          membershipType,
          initialData: [],
          hasMore: false,
        };
      }

      // 4. Pro 用户才执行 collections 查询
      const { data: collections } = await supabase
        .from("md_collections")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(DEFAULT_LIMIT + 1);

      // 处理分页
      const items = collections || [];
      const hasMore = items.length > DEFAULT_LIMIT;
      const initialData = hasMore ? items.slice(0, DEFAULT_LIMIT) : items;

      return {
        hasAccess,
        membershipType,
        initialData: initialData as MdCollection[],
        hasMore,
      };
    } catch (error) {
      // 统一日志记录，避免静默失败
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          operation: "getPageData",
        },
        "Failed to fetch MD collections page data",
      );

      // 开发环境下抛出错误，便于调试
      if (process.env.NODE_ENV === "development") {
        throw error;
      }

      return {
        hasAccess: false,
        membershipType: "FREE",
        initialData: [],
        hasMore: false,
      };
    }
  },
);

/**
 * 异步数据加载组件
 * 被 Suspense 包裹，加载时显示骨架屏
 */
async function MdCollectionsPageWithData() {
  const { hasAccess, membershipType, initialData, hasMore } =
    await getPageData();

  return (
    <MdCollectionPageClient
      hasAccess={hasAccess}
      membershipType={membershipType}
      initialData={initialData}
      initialHasMore={hasMore}
    />
  );
}

/**
 * MD 收藏页面入口
 * 使用 Suspense 实现流式 SSR，首屏立即返回骨架屏
 */
export default function MdCollectionsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<MdCollectionsLoading />}>
        <MdCollectionsPageWithData />
      </Suspense>
    </ErrorBoundary>
  );
}
