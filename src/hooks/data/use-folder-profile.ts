"use client";

/**
 * 文件夹画像 Hook
 *
 * 获取和管理文件夹的 AI 画像数据
 * 包括：标签分布、内容统计、AI 理解等
 *
 * @version 2.0.0 - 迁移到 TanStack Query，支持跨组件缓存共享
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";
import { folderProfileKeys } from "@/hooks/queries/keys";

/**
 * 文件夹画像数据
 */
export interface FolderProfile {
  id: number;
  folderId: number;
  folderName: string;
  userId: string;

  /** 书签数量 */
  bookmarkCount: number;

  /** 最近书签时间 */
  lastBookmarkAt: Date | null;

  /** Top 标签 */
  topTags: string[];

  /** 示例标题 */
  sampleTitles: string[];

  /** 内部相似度 */
  internalSimilarity: number | null;

  /** 数据来源 */
  source: "user_created" | "ai_auto_created" | "computed" | null;

  /** 画像计算时间 */
  computedAt: Date;

  /** 更新时间 */
  updatedAt: Date;

  /** 通用分类（如果是 AI 创建的） */
  universalCategory?: string;
}

// ============================================
// Fetcher
// ============================================

function deserializeProfile(raw: Record<string, unknown>): FolderProfile {
  return {
    ...(raw as unknown as FolderProfile),
    lastBookmarkAt: raw.lastBookmarkAt
      ? new Date(raw.lastBookmarkAt as string)
      : null,
    computedAt: new Date(raw.computedAt as string),
    updatedAt: new Date(raw.updatedAt as string),
  };
}

async function fetchFolderProfile(
  folderId: number,
): Promise<FolderProfile | null> {
  const response = await fetch(
    `${API_CLASSIFICATION.foldersProfiles}?folderId=${folderId}`,
  );

  if (!response.ok) {
    throw new Error("获取画像失败");
  }

  const result = await response.json();

  if (result.success && result.data) {
    return deserializeProfile(result.data as Record<string, unknown>);
  }

  return null;
}

async function fetchAllFolderProfiles(): Promise<FolderProfile[]> {
  const response = await fetch(API_CLASSIFICATION.foldersProfiles);

  if (!response.ok) {
    throw new Error("获取画像列表失败");
  }

  const result = await response.json();

  if (result.success && Array.isArray(result.data)) {
    return (result.data as Record<string, unknown>[]).map(deserializeProfile);
  }

  return [];
}

// ============================================
// Hooks
// ============================================

interface UseFolderProfileReturn {
  profile: FolderProfile | null;
  isLoading: boolean;
  error: string | null;
  /** 刷新画像 */
  refresh: () => Promise<void>;
  /** 重新计算画像 */
  recompute: () => Promise<void>;
}

/**
 * 文件夹画像 Hook
 *
 * V2.0: 使用 TanStack Query，多个组件共享同一缓存条目，避免重复请求
 */
export function useFolderProfile(
  folderId: number | null,
): UseFolderProfileReturn {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: folderId ? folderProfileKeys.byFolderId(folderId) : ["noop"],
    queryFn: () => fetchFolderProfile(folderId!),
    enabled: !!folderId,
    staleTime: 5 * 60 * 1000,
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const recompute = useCallback(async () => {
    if (!folderId) return;

    const response = await fetch(API_CLASSIFICATION.foldersProfiles, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });

    if (!response.ok) {
      throw new Error("重新计算画像失败");
    }

    // 使缓存失效，触发重新获取
    await queryClient.invalidateQueries({
      queryKey: folderProfileKeys.byFolderId(folderId),
    });
  }, [folderId, queryClient]);

  return {
    profile: data ?? null,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "获取画像失败"
      : null,
    refresh,
    recompute,
  };
}

/**
 * 批量获取多个文件夹的画像
 *
 * V2.0: 使用 TanStack Query list 缓存，客户端按 folderIds 过滤
 */
export function useFolderProfiles(folderIds: number[]): {
  profiles: Map<number, FolderProfile>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: folderProfileKeys.list(),
    queryFn: fetchAllFolderProfiles,
    enabled: folderIds.length > 0,
    staleTime: 5 * 60 * 1000,
    select: (allProfiles) => {
      const profileMap = new Map<number, FolderProfile>();
      for (const profile of allProfiles) {
        if (folderIds.includes(profile.folderId)) {
          profileMap.set(profile.folderId, profile);
        }
      }
      return profileMap;
    },
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    profiles: data ?? new Map(),
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "获取画像列表失败"
      : null,
    refresh,
  };
}

export default useFolderProfile;
