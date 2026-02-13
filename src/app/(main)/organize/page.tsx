/**
 * 整理中心页面
 *
 * V3.0 统一整理入口 - 整合收件箱功能
 * 提供统一���收藏整理入口，支持一键智能整理和多种快捷操作
 *
 * @version 3.0.0
 * @since 2026-01-10
 * @updated 2026-02-13
 */

import type { Metadata } from "next";
import { OrganizePageClient } from "@/components/organize/organize-page-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserIdWithFallback } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "整理 - AnyKeep",
  description: "AI 帮你智能整理收藏，保持知识库整洁有序",
};

// 确保每次请求都获取最新数据
export const dynamic = "force-dynamic";

interface FolderOption {
  id: number;
  name: string;
}

async function getFolders(): Promise<FolderOption[]> {
  try {
    const userId = await getAuthenticatedUserIdWithFallback();
    if (!userId) {
      return [];
    }

    const supabase = await createClient();

    // 获取用户的所有文件夹（用于整理建议）
    const { data: folders, error } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .neq("system_type", "INBOX")
      .is("deleted_at", null)
      .order("name");

    if (error) {
      console.error("Failed to fetch folders:", error.message);
      return [];
    }

    return (folders as FolderOption[]) || [];
  } catch (error) {
    console.error("Failed to fetch folders:", error);
    return [];
  }
}

export default async function OrganizePage() {
  const folders = await getFolders();

  return (
    <ErrorBoundary>
      <OrganizePageClient availableFolders={folders} />
    </ErrorBoundary>
  );
}
