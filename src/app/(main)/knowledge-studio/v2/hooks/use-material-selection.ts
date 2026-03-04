"use client";

import { useState, useCallback, useMemo } from "react";
import { useBookmarks } from "@/hooks/queries/use-bookmarks";
import { useDebouncedValue, type Ks2TextFn } from "../utils";
import { MATERIAL_LIMITS } from "@/lib/knowledge-studio/v2/constants";
import type { MaterialInput } from "@/lib/knowledge-studio/blueprint/types";

interface UseMaterialSelectionParams {
  k: Ks2TextFn;
}

export function useMaterialSelection({ k }: UseMaterialSelectionParams) {
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [materialsFromRecommendations, setMaterialsFromRecommendations] =
    useState<Record<string, MaterialInput>>({});
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [isBlueprintExpanded, setIsBlueprintExpanded] = useState(true);
  const [isManualSelectExpanded, setIsManualSelectExpanded] = useState(false);

  const debouncedSearchQuery = useDebouncedValue(materialSearchQuery, 300);

  const {
    data: bookmarksData,
    isLoading: isLoadingBookmarks,
    isFetching: isFetchingBookmarks,
  } = useBookmarks({
    limit: debouncedSearchQuery ? 50 : 20,
    platform: platformFilter || undefined,
    search: debouncedSearchQuery || undefined,
  });

  const isSearching =
    materialSearchQuery !== debouncedSearchQuery || isFetchingBookmarks;
  const bookmarks = useMemo(
    () => bookmarksData?.items || [],
    [bookmarksData?.items],
  );

  const allMaterialsForSelector = useMemo(
    () =>
      bookmarks.map((b) => ({
        id: String(b.id),
        title: b.title || k("noTitle"),
        url: b.url,
        platform: b.platform || undefined,
        summary: b.aiSummary || undefined,
        createdAt: new Date(b.createdAt),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookmarks],
  );

  const selectedMaterials = useMemo<MaterialInput[]>(() => {
    const fromBookmarks = bookmarks
      .filter((b) => selectedMaterialIds.includes(String(b.id)))
      .map((b) => ({
        bookmarkId: String(b.id),
        title: b.title || k("noTitle"),
        content: b.aiSummary || b.description || "",
        url: b.url,
        platform: b.platform || undefined,
      }));
    const fromRecommendations = selectedMaterialIds
      .filter((id) => !fromBookmarks.some((m) => m.bookmarkId === id))
      .map((id) => materialsFromRecommendations[id])
      .filter(Boolean) as MaterialInput[];
    return [...fromBookmarks, ...fromRecommendations];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarks, selectedMaterialIds, materialsFromRecommendations]);

  const handleMaterialsChange = useCallback((selectedIds: string[]) => {
    setSelectedMaterialIds(selectedIds);
  }, []);

  const handleAddMaterial = useCallback(
    (materialId: string, material?: MaterialInput) => {
      if (
        !selectedMaterialIds.includes(materialId) &&
        selectedMaterialIds.length < MATERIAL_LIMITS.HARD_MAX
      ) {
        setSelectedMaterialIds((prev) => [...prev, materialId]);
        if (material) {
          setMaterialsFromRecommendations((prev) => ({
            ...prev,
            [materialId]: material,
          }));
        }
      }
    },
    [selectedMaterialIds],
  );

  return {
    selectedMaterialIds,
    selectedMaterials,
    allMaterialsForSelector,
    handleMaterialsChange,
    handleAddMaterial,
    platformFilter,
    setPlatformFilter,
    materialSearchQuery,
    setMaterialSearchQuery,
    isBlueprintExpanded,
    setIsBlueprintExpanded,
    isManualSelectExpanded,
    setIsManualSelectExpanded,
    isLoadingBookmarks,
    isSearching,
    setMaterialsFromRecommendations,
  };
}
