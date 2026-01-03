/**
 * MD 收藏详情页面
 * P2-007: Markdown 内容收藏 - 专业阅读视图
 */

import { unstable_noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MdCollectionDetailClient } from "./page-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
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
  } catch {
    return null;
  }
}

/**
 * 检查用户会员权限
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

    // 类型断言: 手动维护类型文件时需要此断言
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", user.id)
      .single() as unknown as { data: { membership_type: string | null } | null };

    return profile?.membership_type === "PRO";
  } catch {
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
