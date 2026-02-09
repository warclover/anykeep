/**
 * 可搜索的文件夹选择器（Combobox）
 *
 * 基于 Shadcn Command + Popover 组合实现，支持：
 * - 模糊搜索过滤
 * - 树形层级缩进显示
 * - 最近使用文件夹置顶
 * - 搜索时自动展示祖先路径
 * - 固定高度 + 内部滚动
 *
 * @module folder-combobox
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { Check, ChevronsUpDown, FolderIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FolderTreeNode } from "@/types/supabase";
import {
  flattenFolderTree,
  filterFoldersWithAncestors,
  type FlattenedFolder,
} from "@/lib/utils/folder-tree";

// ── 常量 ──────────────────────────────────────────────

const RECENT_FOLDERS_KEY = "anykeep:recent-folders";
const MAX_RECENT = 3;

// ── 最近使用 Hook ─────────────────────────────────────

function useRecentFolders() {
  const getRecent = useCallback((): number[] => {
    try {
      const raw = localStorage.getItem(RECENT_FOLDERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const addRecent = useCallback(
    (folderId: number) => {
      try {
        const current = getRecent().filter((id) => id !== folderId);
        const updated = [folderId, ...current].slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(updated));
      } catch {
        // localStorage 不可用时静默失败
      }
    },
    [getRecent],
  );

  return { getRecent, addRecent };
}

// ── Props 接口 ────────────────────────────────────────

interface FolderComboboxProps {
  /** 当前选中的文件夹 ID（字符串形式，与 Select 保持一致） */
  value: string;
  /** 选中变化回调 */
  onValueChange: (value: string) => void;
  /** 文件夹数据源 — 扁平结构（兼容 create/edit 的 props 传入） */
  folders?: Array<{ id: number; name: string }>;
  /** 文件夹数据源 — 树形结构（兼容 useFolders 返回值） */
  folderTree?: FolderTreeNode[];
  /** 占位符文本 */
  placeholder?: string;
  /** 是否显示"无文件夹"清除选项，默认 false */
  allowClear?: boolean;
  /** 清除选项文本 */
  clearLabel?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 触发按钮的额外 className */
  triggerClassName?: string;
  /** 是否启用"最近使用"置顶，默认 true */
  enableRecent?: boolean;
}

// ── 组件实现 ──────────────────────────────────────────

export function FolderCombobox({
  value,
  onValueChange,
  folders,
  folderTree,
  placeholder = "选择文件夹（可选）",
  allowClear = false,
  clearLabel = "无文件夹",
  disabled = false,
  triggerClassName,
  enableRecent = true,
}: FolderComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { getRecent, addRecent } = useRecentFolders();

  // ── 数据标准化：统一为 FlattenedFolder[] ──

  const flatList = useMemo<FlattenedFolder[]>(() => {
    if (folderTree && folderTree.length > 0) {
      return flattenFolderTree(folderTree);
    }
    // 扁平数据直接映射为 level=0
    return (folders || []).map((f) => ({ id: f.id, name: f.name, level: 0 }));
  }, [folderTree, folders]);

  // ── 搜索过滤（层级感知） ──

  const { list: filteredList, matchedIds } = useMemo(
    () => filterFoldersWithAncestors(flatList, searchQuery),
    [flatList, searchQuery],
  );

  // ── 最近使用 ──

  const recentFolders = useMemo(() => {
    if (!enableRecent || searchQuery.trim()) return [];
    const recentIds = getRecent();
    return recentIds
      .map((id) => flatList.find((f) => f.id === id))
      .filter((f): f is FlattenedFolder => !!f);
  }, [enableRecent, searchQuery, getRecent, flatList]);

  // ── 显示文本 ──

  const displayLabel = useMemo(() => {
    if (!value) return "";
    const folder = flatList.find((f) => f.id.toString() === value);
    return folder?.name || "";
  }, [value, flatList]);

  // ── 选中处理 ──

  const handleSelect = useCallback(
    (folderId: string) => {
      onValueChange(folderId);
      if (folderId && enableRecent) {
        const numId = parseInt(folderId, 10);
        if (!isNaN(numId)) {
          addRecent(numId);
        }
      }
      setSearchQuery("");
      setOpen(false);
    },
    [onValueChange, enableRecent, addRecent],
  );

  const handleClear = useCallback(() => {
    onValueChange("");
    setSearchQuery("");
    setOpen(false);
  }, [onValueChange]);

  // ── 渲染文件夹项 ──

  const renderFolderItem = (
    folder: FlattenedFolder,
    keyPrefix: string = "",
    isHighlighted: boolean = false,
  ) => {
    const isSelected = value === folder.id.toString();
    return (
      <CommandItem
        key={`${keyPrefix}${folder.id}`}
        value={`${keyPrefix}${folder.id}`}
        onSelect={() => handleSelect(folder.id.toString())}
        className="min-h-[44px]"
      >
        <div
          style={{ paddingLeft: `${folder.level * 16}px` }}
          className="flex items-center gap-1.5"
        >
          <FolderIcon className="size-3.5 text-muted-foreground shrink-0" />
          <span className={cn(isHighlighted && "font-medium")}>
            {folder.name}
          </span>
        </div>
        {isSelected && (
          <Check className="ml-auto size-4 text-primary shrink-0" />
        )}
      </CommandItem>
    );
  };

  // ── 是否有搜索词 ──

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-9",
            !displayLabel && "text-muted-foreground",
            triggerClassName,
          )}
          disabled={disabled}
        >
          <span className="truncate">{displayLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜索文件夹..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="text-base sm:text-sm"
          />
          <CommandList className="max-h-[200px] sm:max-h-[240px]">
            <CommandEmpty>未找到匹配的文件夹</CommandEmpty>

            {/* 清除选项 */}
            {allowClear && (
              <>
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={handleClear}
                    className="min-h-[44px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <X className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">
                        {clearLabel}
                      </span>
                    </div>
                    {!value && (
                      <Check className="ml-auto size-4 text-primary shrink-0" />
                    )}
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* 最近使用（仅在无搜索词时显示） */}
            {!hasSearch && recentFolders.length > 0 && (
              <>
                <CommandGroup heading="最近使用">
                  {recentFolders.map((folder) =>
                    renderFolderItem(folder, "recent-", false),
                  )}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* 文件夹列表 */}
            <CommandGroup heading={hasSearch ? "搜索结果" : "全部文件夹"}>
              {filteredList.map((folder) =>
                renderFolderItem(
                  folder,
                  "",
                  hasSearch && matchedIds.has(folder.id),
                ),
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
