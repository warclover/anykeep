/**
 * 批量操作书签列表项组件
 * 紧凑的列表视图，专为批量选择优化
 */

"use client";

import { memo, useMemo, useCallback } from "react";
import { Folder, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMergedTags, limitTags } from "@/lib/utils/unified-tags";
import { getFaviconInfo } from "@/lib/utils/favicon";
import type { Bookmark } from "@/types/supabase";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface BatchBookmarkItemProps {
  /** 书签数据 */
  bookmark: BookmarkWithFolder;
  /** 是否选中 */
  isSelected: boolean;
  /** 点击回调 */
  onClick: (id: number, event: React.MouseEvent) => void;
}

/**
 * 批量操作书签列表项组件
 */
export const BatchBookmarkItem = memo(function BatchBookmarkItem({
  bookmark,
  isSelected,
  onClick,
}: BatchBookmarkItemProps) {
  // 缓存 Favicon 信息（纯本地生成，无网络请求）
  const favicon = useMemo(() => getFaviconInfo(bookmark.url), [bookmark.url]);

  // 缓存合并后的标签
  const mergedTags = useMemo(() => getMergedTags(bookmark), [bookmark]);
  const { visible: displayTags, remaining: moreTagsCount } = useMemo(
    () => limitTags(mergedTags, 3),
    [mergedTags],
  );

  // 点击处理
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      onClick(bookmark.id, event);
    },
    [onClick, bookmark.id],
  );

  return (
    <div
      role="checkbox"
      aria-checked={isSelected}
      aria-label={`选择书签: ${bookmark.title || bookmark.url}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors cursor-pointer",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50",
        isSelected && "bg-blue-50 dark:bg-blue-900/20",
      )}
      onClick={handleClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
    >
      {/* 选择框 */}
      <div
        className={cn(
          "w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 transition-colors",
          isSelected
            ? "bg-blue-500 border-blue-500"
            : "border-gray-300 dark:border-gray-600",
        )}
      >
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Favicon */}
      <div
        className={cn(
          "w-4 h-4 flex-shrink-0 rounded text-[10px] font-medium flex items-center justify-center",
          favicon.bgClass,
          favicon.textClass,
        )}
      >
        {favicon.letter}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-w-0">
        {/* 标题 */}
        <p
          className={cn(
            "text-sm font-medium truncate",
            bookmark.title === "正在获取标题..."
              ? "text-gray-400 dark:text-gray-500 italic animate-pulse"
              : "text-gray-900 dark:text-white",
          )}
        >
          {bookmark.title || "无标题"}
        </p>

        {/* URL + 标签 + 文件夹 */}
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {/* URL */}
          <span className="truncate max-w-[200px]">{bookmark.url}</span>

          {/* 标签 */}
          {displayTags.length > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <div className="flex items-center gap-1 truncate">
                {displayTags.map((tag) => (
                  <span key={tag} className="text-blue-600 dark:text-blue-400">
                    #{tag}
                  </span>
                ))}
                {moreTagsCount > 0 && (
                  <span className="text-gray-400">+{moreTagsCount}</span>
                )}
              </div>
            </>
          )}

          {/* 文件夹 */}
          {bookmark.folders && (
            <>
              <span className="text-gray-300">•</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Folder className="w-3 h-3" />
                <span className="truncate max-w-[100px]">
                  {bookmark.folders.name}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
