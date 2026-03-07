"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useFilter } from "@/contexts/home-page";
import { prefetchCustomUsageTags } from "@/hooks/data";

interface UseHomeUrlSyncOptions {
  propPlatform?: string;
  propFolder?: string;
}

export interface UseHomeUrlSyncReturn {
  currentPlatform: string;
  setCurrentPlatform: (v: string) => void;
  currentFolder: string;
  setCurrentFolder: (v: string) => void;
  localUsageTags: string[];
  setLocalUsageTags: (v: string[]) => void;
  currentSort: string;
  isBrowserPlatform: boolean;
  isTrashFolder: boolean;
  currentSmartListId: number | null | undefined;
  handlePlatformChange: (platformValue: string) => void;
  handleSortChange: (sortValue: string) => void;
}

export function useHomeUrlSync(
  { propPlatform, propFolder }: UseHomeUrlSyncOptions,
  smartListId?: number | null,
): UseHomeUrlSyncReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  // P0-2: 细粒度 Context 订阅（仅 filter）
  const filter = useFilter();

  const urlPlatform = propPlatform ?? searchParams?.get("platform") ?? "";
  const urlFolder = propFolder ?? searchParams?.get("folder") ?? "";
  const urlUsageTags = searchParams?.get("usageTags") || "";
  const urlSort = searchParams?.get("sort") || "created_desc";

  const parsedUsageTags = urlUsageTags
    ? urlUsageTags.split(",").filter(Boolean)
    : [];

  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    if (urlPlatform && urlPlatform !== filter.platform) {
      filter.setPlatform(urlPlatform);
    }
    if (urlFolder && urlFolder !== filter.folder) {
      filter.setFolder(urlFolder);
    }
    if (
      parsedUsageTags.length > 0 &&
      JSON.stringify(parsedUsageTags) !== JSON.stringify([...filter.usageTags])
    ) {
      filter.setUsageTags(parsedUsageTags);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首次挂载
  }, []);

  useEffect(() => {
    prefetchCustomUsageTags(queryClient);
  }, [queryClient]);

  const urlSmartListParam = searchParams?.get("smartList");
  const urlSmartListId = urlSmartListParam
    ? parseInt(urlSmartListParam, 10)
    : null;
  const currentSmartListId =
    urlSmartListId && !isNaN(urlSmartListId) ? urlSmartListId : smartListId;

  const [currentPlatform, setCurrentPlatform] = useState(urlPlatform);
  const [currentFolder, setCurrentFolder] = useState(urlFolder);
  const [localUsageTags, setLocalUsageTags] = useState(parsedUsageTags);
  const currentSort = urlSort;

  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    setCurrentPlatform(filter.platform);
    setCurrentFolder(filter.folder);
    setLocalUsageTags([...filter.usageTags]);
  }, [filter.platform, filter.folder, filter.usageTags]);

  const isBrowserPlatform = currentPlatform === "browser";
  const isTrashFolder = currentFolder === "trash";

  const handlePlatformChange = useCallback(
    (platformValue: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (platformValue) {
        params.set("platform", platformValue);
      } else {
        params.delete("platform");
      }
      router.replace(`/home?${params.toString()}`);
    },
    [searchParams, router],
  );

  const handleSortChange = useCallback(
    (sortValue: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("sort", sortValue);
      router.replace(`/home?${params.toString()}`);
    },
    [searchParams, router],
  );

  return {
    currentPlatform,
    setCurrentPlatform,
    currentFolder,
    setCurrentFolder,
    localUsageTags,
    setLocalUsageTags,
    currentSort,
    isBrowserPlatform,
    isTrashFolder,
    currentSmartListId,
    handlePlatformChange,
    handleSortChange,
  };
}
