/**
 * UserContext 构建器
 *
 * 加载用户的分类偏好：自定义规则、Scorer 权重、生命周期阶段。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { UserContext, UserRule, UserStage } from "../types";
import { CLASSIFICATION_CONFIG } from "../config";
import { loadUserWeights as loadFromWeightStore } from "../feedback/weight-store";

/**
 * 构建用户上下文
 */
export async function buildUserContext(userId: string): Promise<UserContext> {
  // 使用 service client 绕过 RLS（分类在异步上下文中执行，用户会话可能已失效）
  const supabase = await createServiceClient();

  // 并行加载：规则、权重、书签数、文件夹数
  const [rules, weights, bookmarkCount, folderCount] = await Promise.all([
    loadUserRules(supabase, userId),
    loadUserWeights(userId),
    loadBookmarkCount(supabase, userId),
    loadFolderCount(supabase, userId),
  ]);

  const stage = determineStage(bookmarkCount);

  return {
    userId,
    weights,
    rules,
    stage,
    folderCount,
  };
}

/**
 * 加载用户自定义分类规则
 */
async function loadUserRules(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
): Promise<UserRule[]> {
  // 使用 type assertion 绕过 Supabase 生成类型不完整的问题
  type RuleRow = {
    id: number;
    name: string | null;
    url_domains: string[];
    title_keywords: string[];
    tags: string[];
    folder_id: number;
    confidence: number;
    priority: number;
    enabled: boolean;
  };

  const { data: rawData } = await supabase
    .from("user_classification_rules" as "folders")
    .select(
      "id, name, url_domains, title_keywords, tags, folder_id, confidence, priority, enabled",
    )
    .eq("user_id", userId)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  const data = (rawData ?? []) as unknown as RuleRow[];
  if (data.length === 0) return [];

  // 获取文件夹名称
  const folderIds = [...new Set(data.map((r) => r.folder_id))];
  const { data: folders } = await supabase
    .from("folders")
    .select("id, name")
    .in("id", folderIds);

  const folderNameMap = new Map((folders ?? []).map((f) => [f.id, f.name]));

  return data.map(
    (rule): UserRule => ({
      id: rule.id,
      name: rule.name ?? undefined,
      urlDomains: rule.url_domains ?? [],
      titleKeywords: rule.title_keywords ?? [],
      tags: rule.tags ?? [],
      folderId: rule.folder_id,
      folderName:
        folderNameMap.get(rule.folder_id) ?? `folder_${rule.folder_id}`,
      confidence: rule.confidence ?? 0.9,
      priority: rule.priority ?? 0,
      enabled: rule.enabled ?? true,
    }),
  );
}

/**
 * 加载用户级 Scorer 权重覆盖
 *
 * 从 feedback/weight-store 读取用户自定义权重。
 * 不存在时返回默认权重。
 */
async function loadUserWeights(
  userId: string,
): Promise<Record<string, number>> {
  return loadFromWeightStore(userId);
}

/**
 * 加载用户书签总数
 */
async function loadBookmarkCount(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_deleted", false);

  return count ?? 0;
}

/**
 * 加载用户文件夹数
 */
async function loadFolderCount(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("folders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);

  return count ?? 0;
}

/**
 * 根据书签数量判断用户阶段
 */
function determineStage(bookmarkCount: number): UserStage {
  const { coldStartMax, growingMax } = CLASSIFICATION_CONFIG.userLifecycle;

  if (bookmarkCount <= coldStartMax) return "cold_start";
  if (bookmarkCount <= growingMax) return "growing";
  return "mature";
}
