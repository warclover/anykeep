'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Bookmark } from '@/types/bookmark';

interface SelectionContextType {
  selectedBookmarks: Bookmark[];
  setSelectedBookmarks: (bookmarks: Bookmark[]) => void;
  clearSelection: () => void;
  toggleSelection: (bookmark: Bookmark) => void;
  isSelected: (bookmarkId: string) => boolean;
  selectRange: (startId: string, endId: string, allBookmarks: Bookmark[]) => void;
  selectAll: (bookmarks: Bookmark[]) => void;
}

const SelectionContext = createContext<SelectionContextType | null>(null);

interface SelectionProviderProps {
  children: ReactNode;
}

export function SelectionProvider({ children }: SelectionProviderProps) {
  const [selectedBookmarks, setSelectedBookmarks] = useState<Bookmark[]>([]);

  const clearSelection = useCallback(() => {
    setSelectedBookmarks([]);
  }, []);

  const toggleSelection = useCallback((bookmark: Bookmark) => {
    setSelectedBookmarks(prev => {
      const isSelected = prev.some(b => b.id === bookmark.id);
      if (isSelected) {
        return prev.filter(b => b.id !== bookmark.id);
      }
      return [...prev, bookmark];
    });
  }, []);

  const isSelected = useCallback((bookmarkId: string) => {
    return selectedBookmarks.some(b => b.id === bookmarkId);
  }, [selectedBookmarks]);

  const selectRange = useCallback((
    startId: string,
    endId: string,
    allBookmarks: Bookmark[]
  ) => {
    const startIndex = allBookmarks.findIndex(b => b.id === startId);
    const endIndex = allBookmarks.findIndex(b => b.id === endId);

    if (startIndex === -1 || endIndex === -1) return;

    const [from, to] = startIndex < endIndex
      ? [startIndex, endIndex]
      : [endIndex, startIndex];

    const range = allBookmarks.slice(from, to + 1);
    setSelectedBookmarks(prev => {
      const existingIds = new Set(prev.map(b => b.id));
      const newBookmarks = range.filter(b => !existingIds.has(b.id));
      return [...prev, ...newBookmarks];
    });
  }, []);

  const selectAll = useCallback((bookmarks: Bookmark[]) => {
    setSelectedBookmarks(bookmarks);
  }, []);

  return (
    <SelectionContext.Provider
      value={{
        selectedBookmarks,
        setSelectedBookmarks,
        clearSelection,
        toggleSelection,
        isSelected,
        selectRange,
        selectAll,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within SelectionProvider');
  }
  return context;
}
