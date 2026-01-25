/**
 * 客户端标签预匹配 Hook
 *
 * 提供客户端标签预匹配功能，减少后端计算
 *
 * @module @/hooks/domain/classification/use-tag-pre-match
 * @version 1.0.0
 * @since 2026-01-23
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/hooks/data/use-user";
import { createClient } from "@/lib/supabase/client";
import {
  TagPreMatcher,
  type CachedFolder,
  type PreMatchResult,
} from "@/lib/classification/client/tag-pre-matcher";
import {
  FolderCacheSyncService,
  type SyncResult,
} from "@/lib/classification/client/folder-cache-sync";

/**
 * Hook 配置
 */
export interface UseTagPreMatchOptions {
  /** 是否自动同步文件夹 */
  autoSync?: boolean;
  /** 自动同步间隔（毫秒） */
  autoSyncIntervalMs?: number;
  /** 缓存过期时间（毫秒） */
  cacheTtlMs?: number;
  /** 是否启用 IndexedDB 持久化 */
  enablePersistence?: boolean;
}

/**
 * Hook 返回值
 */
export interface UseTagPreMatchReturn {
  /** 执行预匹配 */
  preMatch: (tags: string[]) => PreMatchResult;
  /** 批量预匹配 */
  preMatchBatch: (
    items: Array<{ id: string; tags: string[] }>,
  ) => Map<string, PreMatchResult>;
  /** 手动同步文件夹 */
  syncFolders: () => Promise<SyncResult>;
  /** 缓存的文件夹列表 */
  folders: CachedFolder[];
  /** 是否正在同步 */
  isSyncing: boolean;
  /** 缓存是否有效 */
  isCacheValid: boolean;
  /** 缓存年龄（毫秒） */
  cacheAge: number | null;
  /** 最后同步结果 */
  lastSyncResult: SyncResult | null;
  /** 清除缓存 */
  clearCache: () => Promise<void>;
}

/**
 * 客户端标签预匹配 Hook
 */
export function useTagPreMatch(
  options: UseTagPreMatchOptions = {},
): UseTagPreMatchReturn {
  const {
    autoSync = true,
    autoSyncIntervalMs = 2 * 60 * 1000,
    cacheTtlMs = 5 * 60 * 1000,
    enablePersistence = true,
  } = options;

  const { user } = useUser();
  const userId = user?.id;

  const [folders, setFolders] = useState<CachedFolder[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCacheValid, setIsCacheValid] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // 服务实例
  const matcherRef = useRef<TagPreMatcher | null>(null);
  const cacheSyncRef = useRef<FolderCacheSyncService | null>(null);

  // 初始化服务
  useEffect(() => {
    matcherRef.current = new TagPreMatcher();
    cacheSyncRef.current = new FolderCacheSyncService({
      cacheTtlMs,
      autoSyncIntervalMs,
      enablePersistence,
    });

    // 初始化 IndexedDB
    cacheSyncRef.current.initialize().catch(console.error);

    return () => {
      cacheSyncRef.current?.destroy();
    };
  }, [cacheTtlMs, autoSyncIntervalMs, enablePersistence]);

  // 从服务器获取文件夹数据
  const fetchFoldersFromServer = useCallback(async (): Promise<
    CachedFolder[]
  > => {
    if (!userId) return [];

    const supabase = createClient();

    const { data, error } = await supabase
      .from("folder_tag_profiles")
      .select(
        `
        folder_id,
        core_tags,
        folders!inner(id, name)
      `,
      )
      .eq("user_id", userId);

    if (error) {
      console.error("[useTagPreMatch] 获取文件夹失败:", error);
      return [];
    }

    const matcher = matcherRef.current;
    if (!matcher) return [];

    return (data || []).map((row) => {
      const folderData = Array.isArray((row as Record<string, unknown>).folders)
        ? (
            (row as Record<string, unknown>).folders as Array<{ name: string }>
          )[0]
        : (row as Record<string, unknown>).folders;
      const name = (folderData as { name: string })?.name || "";
      const normalizedName = matcher.normalize(name);

      return {
        id: ((row as Record<string, unknown>).folder_id as number).toString(),
        name,
        normalizedName,
        aliases: [] as string[],
        coreTags: (
          ((row as Record<string, unknown>).core_tags as string[]) || []
        ).map((t) => matcher.normalize(t)),
      };
    });
  }, [userId]);

  // 同步文件夹
  const syncFolders = useCallback(async (): Promise<SyncResult> => {
    if (!userId || !cacheSyncRef.current) {
      return {
        success: false,
        folderCount: 0,
        isIncremental: false,
        latencyMs: 0,
        error: "用户未登录或服务未初始化",
      };
    }

    setIsSyncing(true);

    try {
      const result = await cacheSyncRef.current.syncFromServer(
        userId,
        fetchFoldersFromServer,
      );

      if (result.success) {
        const cachedFolders = await cacheSyncRef.current.getFolders(userId);
        setFolders(cachedFolders);
        setIsCacheValid(cacheSyncRef.current.isCacheValid(userId));
        setCacheAge(cacheSyncRef.current.getCacheAge(userId));
      }

      setLastSyncResult(result);
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [userId, fetchFoldersFromServer]);

  // 自动同步
  useEffect(() => {
    if (!autoSync || !userId) return;

    // 初始同步
    syncFolders();

    // 定时同步
    const timer = setInterval(syncFolders, autoSyncIntervalMs);

    return () => clearInterval(timer);
  }, [autoSync, userId, autoSyncIntervalMs, syncFolders]);

  // 监听文件夹变化
  useEffect(() => {
    if (!cacheSyncRef.current || !userId) return;

    const listener = (syncUserId: string, syncFolders: CachedFolder[]) => {
      if (syncUserId === userId) {
        setFolders(syncFolders);
      }
    };

    cacheSyncRef.current.addSyncListener(listener);

    return () => {
      cacheSyncRef.current?.removeSyncListener(listener);
    };
  }, [userId]);

  // 预匹配
  const preMatch = useCallback(
    (tags: string[]): PreMatchResult => {
      if (!matcherRef.current) {
        return {
          matched: false,
          folderId: null,
          folderName: null,
          matchMode: "none",
          confidence: 0,
          matchedTags: [],
          needsServerValidation: true,
          latencyMs: 0,
        };
      }

      return matcherRef.current.match(tags, folders);
    },
    [folders],
  );

  // 批量预匹配
  const preMatchBatch = useCallback(
    (
      items: Array<{ id: string; tags: string[] }>,
    ): Map<string, PreMatchResult> => {
      if (!matcherRef.current) {
        return new Map();
      }

      return matcherRef.current.matchBatch(items, folders);
    },
    [folders],
  );

  // 清除缓存
  const clearCache = useCallback(async (): Promise<void> => {
    if (!userId || !cacheSyncRef.current) return;

    await cacheSyncRef.current.clearCache(userId);
    setFolders([]);
    setIsCacheValid(false);
    setCacheAge(null);
  }, [userId]);

  return {
    preMatch,
    preMatchBatch,
    syncFolders,
    folders,
    isSyncing,
    isCacheValid,
    cacheAge,
    lastSyncResult,
    clearCache,
  };
}

/**
 * 仅预匹配（不自动同步，需要手动提供文件夹）
 */
export function useTagPreMatchSimple(): {
  matcher: TagPreMatcher;
  preMatch: (tags: string[], folders: CachedFolder[]) => PreMatchResult;
  normalize: (tag: string) => string;
  expandTags: (tags: string[]) => string[];
} {
  const matcher = useMemo(() => new TagPreMatcher(), []);

  const preMatch = useCallback(
    (tags: string[], folders: CachedFolder[]): PreMatchResult => {
      return matcher.match(tags, folders);
    },
    [matcher],
  );

  const normalize = useCallback(
    (tag: string): string => {
      return matcher.normalize(tag);
    },
    [matcher],
  );

  const expandTags = useCallback(
    (tags: string[]): string[] => {
      return matcher.expandTags(tags);
    },
    [matcher],
  );

  return {
    matcher,
    preMatch,
    normalize,
    expandTags,
  };
}
