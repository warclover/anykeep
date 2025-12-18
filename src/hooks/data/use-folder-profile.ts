/**
 * 文件夹画像 Hook
 *
 * 获取和管理文件夹的 AI 画像数据
 * 包括：标签分布、内容统计、AI 理解等
 */

import { useState, useEffect, useCallback } from "react";

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

/**
 * 画像加载状态
 */
interface UseFolderProfileState {
  profile: FolderProfile | null;
  isLoading: boolean;
  error: string | null;
}

interface UseFolderProfileReturn extends UseFolderProfileState {
  /** 刷新画像 */
  refresh: () => Promise<void>;
  /** 重新计算画像 */
  recompute: () => Promise<void>;
}

/**
 * 文件夹画像 Hook
 */
export function useFolderProfile(
  folderId: number | null,
): UseFolderProfileReturn {
  const [state, setState] = useState<UseFolderProfileState>({
    profile: null,
    isLoading: false,
    error: null,
  });

  /**
   * 获取文件夹画像
   */
  const fetchProfile = useCallback(async () => {
    if (!folderId) {
      setState({ profile: null, isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(
        `/api/classification/folders/profiles?folderId=${folderId}`,
      );

      if (!response.ok) {
        throw new Error("获取画像失败");
      }

      const result = await response.json();

      if (result.success && result.data) {
        setState({
          profile: {
            ...result.data,
            lastBookmarkAt: result.data.lastBookmarkAt
              ? new Date(result.data.lastBookmarkAt)
              : null,
            computedAt: new Date(result.data.computedAt),
            updatedAt: new Date(result.data.updatedAt),
          },
          isLoading: false,
          error: null,
        });
      } else {
        setState({
          profile: null,
          isLoading: false,
          error: null, // 没有画像不是错误
        });
      }
    } catch (error) {
      setState({
        profile: null,
        isLoading: false,
        error: error instanceof Error ? error.message : "获取画像失败",
      });
    }
  }, [folderId]);

  /**
   * 重新计算画像
   */
  const recompute = useCallback(async () => {
    if (!folderId) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch("/api/classification/folders/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });

      if (!response.ok) {
        throw new Error("重新计算画像失败");
      }

      // 重新获取画像
      await fetchProfile();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "重新计算画像失败",
      }));
    }
  }, [folderId, fetchProfile]);

  // 初始加载
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    ...state,
    refresh: fetchProfile,
    recompute,
  };
}

/**
 * 批量获取多个文件夹的画像
 */
export function useFolderProfiles(folderIds: number[]): {
  profiles: Map<number, FolderProfile>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [profiles, setProfiles] = useState<Map<number, FolderProfile>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    if (folderIds.length === 0) {
      setProfiles(new Map());
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/classification/folders/profiles");

      if (!response.ok) {
        throw new Error("获取画像列表失败");
      }

      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        const profileMap = new Map<number, FolderProfile>();
        for (const profile of result.data) {
          if (folderIds.includes(profile.folderId)) {
            profileMap.set(profile.folderId, {
              ...profile,
              lastBookmarkAt: profile.lastBookmarkAt
                ? new Date(profile.lastBookmarkAt)
                : null,
              computedAt: new Date(profile.computedAt),
              updatedAt: new Date(profile.updatedAt),
            });
          }
        }
        setProfiles(profileMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取画像列表失败");
    } finally {
      setIsLoading(false);
    }
  }, [folderIds]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return {
    profiles,
    isLoading,
    error,
    refresh: fetchProfiles,
  };
}

export default useFolderProfile;
