/**
 * MD 收藏详情页面
 * P2-007: Markdown 内容收藏 - 专业阅读视图
 *
 * V1.1.0: 使用统一权限检查函数，消除类型断言
 */

import { unstable_noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MdCollectionDetailClient } from "./page-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { checkMdCollectionAccess } from "@/features/md-collections/lib/permission-utils";
import { logger } from "@/lib/logger";
import type { MdCollection } from "@/features/md-collections";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * 获取 MD 收藏详情
 */
async function getMdCollection(id: number): Promise<MdCollection | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from("md_collections")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return null;
    }

    return data as MdCollection;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), id },
      "Failed to get MD collection",
    );
    return null;
  }
}

/**
 * 检查用户会员权限
 * V1.1.0: 使用统一权限检查函数
 */
async function checkUserAccess(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    // 使用统一权限检查函数（消除 `as unknown as` 断言）
    const result = await checkMdCollectionAccess(supabase, user.id);
    return result.hasAccess;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to check user access",
    );
    return false;
  }
}

export default async function MdCollectionDetailPage({ params }: PageProps) {
  // 禁用缓存
  unstable_noStore();

  // 解析参数
  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id, 10);

  // 验证 ID
  if (isNaN(id) || id <= 0) {
    notFound();
  }

  // 检查权限
  const hasAccess = await checkUserAccess();
  if (!hasAccess) {
    redirect("/md-collections");
  }

  // 获取数据
  const collection = await getMdCollection(id);
  if (!collection) {
    notFound();
  }

  return (
    <ErrorBoundary>
      <MdCollectionDetailClient collection={collection} />
    </ErrorBoundary>
  );
}
