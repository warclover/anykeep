"use client";

/**
 * Detail Drawer Component
 *
 * Right-side sliding drawer for advanced bookmark options.
 * Contains folder selection, tags, and notes inputs.
 *
 * @version 1.1.0 - Added API folder loading
 * @since 2025-12-16
 */

import { useEffect, useRef } from "react";
import { X, FolderOpen, Tag, FileText, Loader2 } from "lucide-react";
import { useFolderList } from "../hooks/useFolderList";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { BookmarkMetadata } from "../hooks/useQuickAddState";

// Platform icons
const PLATFORM_ICONS: Record<string, string> = {
  WX_OFFICIAL: "📄",
  BILIBILI: "🎬",
  XIAOHONGSHU: "📱",
  DOUYIN: "🎵",
  TAOBAO: "🛒",
  DEFAULT: "🔗",
};

export interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: BookmarkMetadata | null;
  folderId: number | null;
  tags: string[];
  notes: string;
  onFolderChange: (folderId: number | null) => void;
  onTagsChange: (tags: string[]) => void;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export function DetailDrawer({
  isOpen,
  onClose,
  metadata,
  folderId,
  tags,
  notes,
  onFolderChange,
  onTagsChange,
  onNotesChange,
  onSubmit,
  isSubmitting = false,
}: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Load folders from API
  const {
    folders,
    isLoading: foldersLoading,
    error: foldersError,
  } = useFolderList();

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        drawerRef.current &&
        !drawerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Handle tag input
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const value = (e.target as HTMLInputElement).value.trim();
      if (value && !tags.includes(value)) {
        onTagsChange([...tags, value]);
        (e.target as HTMLInputElement).value = "";
      }
    } else if (e.key === "Backspace" && !(e.target as HTMLInputElement).value) {
      // Remove last tag on backspace
      onTagsChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/10 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn(
          "fixed top-0 right-0 h-full w-[360px] bg-white z-50",
          "shadow-[-8px_0_30px_rgba(0,0,0,0.1)]",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        style={{
          transition: "transform 350ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">添加收藏</h2>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-gray-400 hover:text-gray-600"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-col h-[calc(100%-130px)] overflow-y-auto p-5 space-y-5">
          {/* Metadata Preview */}
          {metadata && (
            <div className="p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-lg">
                  {PLATFORM_ICONS[metadata.platform || "DEFAULT"]}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-gray-900 line-clamp-2">
                    {metadata.title}
                  </h3>
                  {metadata.sourceName && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {metadata.sourceName}
                    </p>
                  )}
                </div>
              </div>
              {metadata.description && (
                <p className="text-xs text-gray-600 line-clamp-2">
                  {metadata.description}
                </p>
              )}
            </div>
          )}

          {/* Folder Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm text-gray-700">
              <FolderOpen className="w-4 h-4" />
              文件夹
              {foldersLoading && (
                <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
              )}
            </Label>
            <select
              value={folderId || ""}
              onChange={(e) =>
                onFolderChange(e.target.value ? Number(e.target.value) : null)
              }
              disabled={foldersLoading}
              className={cn(
                "w-full h-9 px-3 rounded-md border border-gray-200",
                "bg-white text-sm",
                "focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500",
                "disabled:bg-gray-50 disabled:cursor-not-allowed",
              )}
            >
              <option value="">待整理</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.displayName}
                </option>
              ))}
            </select>
            {foldersError ? (
              <p className="text-xs text-red-500">{foldersError}</p>
            ) : (
              <p className="text-xs text-gray-400">AI 会自动推荐适合的文件夹</p>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm text-gray-700">
              <Tag className="w-4 h-4" />
              标签
            </Label>
            <div
              className={cn(
                "flex flex-wrap gap-1.5 p-2 min-h-[38px]",
                "border border-gray-200 rounded-md",
                "focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500",
              )}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5",
                    "bg-purple-100 text-purple-700 text-xs rounded-full",
                  )}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-purple-400 hover:text-purple-600"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                type="text"
                placeholder={tags.length === 0 ? "添加标签..." : ""}
                onKeyDown={handleTagKeyDown}
                className="flex-1 min-w-[80px] bg-transparent outline-none text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm text-gray-700">
              <FileText className="w-4 h-4" />
              笔记
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="添加个人笔记..."
              className="min-h-[100px] resize-none text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-5 py-4 border-t bg-white">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              className={cn(
                "flex-1",
                "bg-emerald-500 hover:bg-emerald-600 text-white",
              )}
              onClick={onSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  保存中
                </span>
              ) : (
                "收藏"
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
