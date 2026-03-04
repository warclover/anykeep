"use client";

import { useState, useCallback } from "react";

export function useBookmarkSelection(maxCount: number) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelection = useCallback(
    (bookmarkId: number) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(bookmarkId)) {
          next.delete(bookmarkId);
        } else {
          if (next.size >= maxCount) return prev;
          next.add(bookmarkId);
        }
        return next;
      });
    },
    [maxCount],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelection,
    clearSelection,
  };
}
