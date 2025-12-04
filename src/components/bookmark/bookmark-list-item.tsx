/**
 * 浏览器书签列表项组件
 * 专为浏览器书签设计的紧凑列表视图
 *
 * 性能优化：
 * - 使用原生 img 标签避免 Next.js 图像优化器的网络请求
 * - 使用 DuckDuckGo favicon 服务（国内可访问）
 * - 添加 loading="lazy" 延迟加载
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  Folder,
  Globe,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Bookmark } from "@/types/supabase";
import { cn } from "@/lib/utils";

interface BookmarkListItemProps {
  bookmark: Bookmark & {
    folders?: { name: string } | null;
  };
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  // 批量选择模式
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}

/**
 * 从 URL 提取域名用于显示 Favicon
 * 使用 DuckDuckGo favicon 服务（国内可访问，比 Google 更稳定）
 */
function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // DuckDuckGo favicon 服务：国内可访问，无需 VPN
    return `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`;
  } catch {
    return ""; // 返回空字符串，让 onError 处理
  }
}

/**
 * 浏览器书签列表项组件
 */
export function BookmarkListItem({
  bookmark,
  onEdit,
  onDelete,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: BookmarkListItemProps) {
  const [imageError, setImageError] = useState(false);

  const handleDelete = () => {
    if (onDelete) {
      onDelete(bookmark.id);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(bookmark.id);
    }
  };

  const handleToggleSelect = () => {
    if (onToggleSelect) {
      onToggleSelect(bookmark.id);
    }
  };

  // 性能优化：缓存 Favicon URL 计算结果
  const faviconUrl = useMemo(() => getFaviconUrl(bookmark.url), [bookmark.url]);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50",
        isSelectionMode && "cursor-pointer",
        isSelected && "bg-blue-50 dark:bg-blue-900/20",
      )}
      onClick={isSelectionMode ? handleToggleSelect : undefined}
    >
      {/* 选择框（批量选择模式） */}
      {isSelectionMode && (
        <div
          className={cn(
            "w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0",
            isSelected
              ? "bg-blue-500 border-blue-500"
              : "border-gray-300 dark:border-gray-600",
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      )}

      {/* Favicon - 使用原生 img 避免 Next.js 图像优化器的网络请求超时 */}
      <div className="w-4 h-4 flex-shrink-0 relative">
        {!imageError && faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            width={16}
            height={16}
            loading="lazy"
            className="w-4 h-4 object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <Globe className="w-4 h-4 text-gray-400 dark:text-gray-600" />
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-w-0">
        {/* 标题 */}
        <Link
          href={`/bookmark/${bookmark.id}`}
          className={cn(
            "block text-sm font-medium truncate transition-colors",
            bookmark.title === "正在获取标题..."
              ? "text-gray-400 dark:text-gray-500 italic animate-pulse"
              : "text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400",
          )}
        >
          {bookmark.title || "无标题"}
        </Link>

        {/* URL */}
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {bookmark.url}
        </p>

        {/* 标签 + 文件夹 */}
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
          {/* 标签 */}
          {bookmark.ai_tags && bookmark.ai_tags.length > 0 && (
            <div className="flex items-center gap-1 truncate">
              {bookmark.ai_tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-blue-600 dark:text-blue-400">
                  #{tag}
                </span>
              ))}
              {bookmark.ai_tags.length > 3 && (
                <span className="text-gray-400">
                  +{bookmark.ai_tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* 文件夹 */}
          {bookmark.folders && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Folder className="w-3 h-3" />
              <span className="truncate max-w-[120px]">
                {bookmark.folders.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 操作菜单 */}
      {!isSelectionMode && (
        <div
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="更多操作"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  打开链接
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="mr-2 h-4 w-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-red-600 focus:text-red-600 dark:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// 辅助组件：Check Icon（用于选择框）
function Check({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
