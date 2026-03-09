/**
 * FolderContext 构建器
 *
 * 从数据库加载用户文件夹列表，构建为 FolderContext[]。
 * 包含画像信息、样本书签、关键词提取。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { createClient } from "@/lib/supabase/server";
import type { FolderContext } from "../types";
import { CHINESE_STOP_WORDS } from "../constants";

/**
 * 加载用户的所有文件夹上下文
 */
export async function buildFolderContexts(
  userId: string,
): Promise<FolderContext[]> {
  const supabase = await createClient();

  // 1. 获取文件夹列表
  const { data: folders, error: foldersError } = await supabase
    .from("folders")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("name");

  if (foldersError || !folders?.length) return [];

  const folderIds = folders.map((f) => f.id);

  // 2. 批量获取文件夹画像
  const { data: profiles } = await supabase
    .from("folder_profiles")
    .select(
      "folder_id, top_tags, sample_titles, bookmark_count, profile_embedding",
    )
    .eq("user_id", userId)
    .in("folder_id", folderIds);

  // 3. 批量获取文件夹名称向量（使用 type assertion 绕过 Supabase 生成类型限制）
  type NameEmbeddingRow = { folder_id: number; embedding: number[] };
  const { data: rawNameEmbeddings } = await supabase
    .from("folder_name_embedding" as "folders")
    .select("folder_id, embedding")
    .in("folder_id", folderIds);
  const nameEmbeddings = (rawNameEmbeddings ??
    []) as unknown as NameEmbeddingRow[];

  // 构建索引 Map
  const profileMap = new Map((profiles ?? []).map((p) => [p.folder_id, p]));
  const nameEmbeddingMap = new Map(
    nameEmbeddings.map((e) => [e.folder_id, e.embedding]),
  );

  // 4. 组装 FolderContext
  return folders.map((folder): FolderContext => {
    const profile = profileMap.get(folder.id);
    const topTags = (profile?.top_tags as string[]) ?? [];
    const sampleTitles = (profile?.sample_titles as string[]) ?? [];

    return {
      id: folder.id,
      name: folder.name,
      normalizedName: folder.name.toLowerCase().trim(),
      aliases: [], // 别名从 folder_profiles 的 JSON 字段提取（如果存在）
      coreTags: topTags.slice(0, 5),
      relatedTags: topTags.slice(5),
      sampleTitles: sampleTitles.slice(0, 5),
      keywords: extractKeywords(folder.name),
      bookmarkCount: profile?.bookmark_count ?? 0,
      nameEmbedding: nameEmbeddingMap.get(folder.id),
      profileEmbedding: profile?.profile_embedding as number[] | undefined,
    };
  });
}

/**
 * 从文件夹名称提取关键词
 *
 * 按分隔符分词，过滤停用词和单字词
 */
function extractKeywords(folderName: string): string[] {
  const tokens = folderName
    .split(/[+\s_\-/&]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1)
    .filter((t) => !CHINESE_STOP_WORDS.has(t));

  return [...new Set(tokens)];
}
