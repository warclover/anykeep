/**
 * 升级版文件夹卡片组件
 * 更大尺寸、语义化颜色、始终可见的操作按钮
 *
 * V5.3 性能优化 (2026-02-01):
 * - P1-3.4: 使用 React.memo 避免列表中其他卡片变化时的不必要重渲染
 */

"use client";

import { memo } from "react";
import Link from "next/link";
import { Inbox, TrendingUp, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FolderActionMenu } from "./folder-action-menu";
import {
  FOLDER_GROUPS,
  SYSTEM_FOLDER_CONFIG,
  getFolderEmoji,
} from "./constants";
import type {
  FolderWithStats,
  LockStatus,
  FolderActionCallbacks,
} from "./types";
// 国际化
import { useUiText } from "@/lib/i18n";

// ==================== 组件 Props ====================

interface FolderCardProps extends FolderActionCallbacks {
  folder: FolderWithStats;
  allFolders: FolderWithStats[];
  lockStatus?: LockStatus;
}

// ==================== 主组件 ====================

export const FolderCard = memo(function FolderCard({
  folder,
  allFolders,
  lockStatus,
  onActionComplete,
  onFolderDeleted,
  onFolderRenamed,
  onFolderMerged,
  onExportFolder,
}: FolderCardProps) {
  // 国际化
  const t = useUiText();

  const isInbox = folder.is_system && folder.system_type === "INBOX";
  const isArchived = folder.is_archived;

  // 获取颜色配置
  const getColors = () => {
    if (isInbox) {
      return SYSTEM_FOLDER_CONFIG.colors;
    }
    const groupKey = folder.folder_group || "other";
    return FOLDER_GROUPS[groupKey]?.colors || FOLDER_GROUPS.other.colors;
  };

  const colors = getColors();

  // 如果文件夹有自定义颜色，使用内联样式
  const customColor = folder.color;
  const hasCustomColor = !!customColor;

  // 生成自定义颜色的样式
  const customColorStyle = hasCustomColor
    ? {
        borderColor: customColor,
        backgroundColor: `${customColor}15`, // 15% 透明度
      }
    : undefined;

  return (
    <div className="group relative">
      <Link href={`/home?folder=${folder.id}`}>
        <div
          className={cn(
            "relative rounded-xl border-2 transition-all duration-200",
            "h-[120px] w-full",
            !hasCustomColor && colors.bg,
            !hasCustomColor && colors.border,
            !hasCustomColor && colors.bgHover,
            "hover:shadow-lg hover:scale-[1.02]",
            isArchived && "opacity-60 grayscale-[30%]",
          )}
          style={customColorStyle}
          onMouseEnter={(e) => {
            if (hasCustomColor) {
              e.currentTarget.style.backgroundColor = `${customColor}25`;
            }
          }}
          onMouseLeave={(e) => {
            if (hasCustomColor) {
              e.currentTarget.style.backgroundColor = `${customColor}15`;
            }
          }}
        >
          {/* 左侧颜色条 */}
          {!isInbox && (
            <div
              className={cn(
                "absolute left-0 top-3 bottom-3 w-1 rounded-r-full",
                !hasCustomColor &&
                  `bg-gradient-to-b ${FOLDER_GROUPS[folder.folder_group || "other"]?.colors.gradient.from} ${FOLDER_GROUPS[folder.folder_group || "other"]?.colors.gradient.to}`,
              )}
              style={
                hasCustomColor ? { backgroundColor: customColor } : undefined
              }
            />
          )}

          {/* 内容区域 */}
          <div className="h-full p-4 pl-5 flex flex-col">
            {/* 顶部：图标 + 标题 */}
            <div className="flex items-start gap-3 flex-1">
              {/* 图标 */}
              <div
                className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                  "shadow-sm transition-transform group-hover:scale-110",
                  isInbox
                    ? "bg-slate-200 dark:bg-slate-700"
                    : !hasCustomColor && colors.iconBg,
                )}
                style={
                  hasCustomColor && !isInbox
                    ? { backgroundColor: `${customColor}30` }
                    : undefined
                }
              >
                {isInbox ? (
                  <Inbox className="size-5 text-slate-600 dark:text-slate-300" />
                ) : (
                  <span className="text-2xl">
                    {folder.icon || getFolderEmoji(folder.name)}
                  </span>
                )}
              </div>

              {/* 标题区域 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className={cn(
                      "text-xs font-semibold truncate max-w-[140px]",
                      "text-gray-800 dark:text-gray-100",
                    )}
                  >
                    {folder.name}
                  </h3>

                  {/* 标签 */}
                  {folder.is_system && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-slate-700 text-white"
                    >
                      {t.folder.system}
                    </Badge>
                  )}
                  {isArchived && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {t.folder.archived}
                    </Badge>
                  )}
                  {folder.is_locked && (
                    <span title={t.folder.aiLocked}>
                      <Lock className="size-3.5 text-amber-500" />
                    </span>
                  )}
                </div>

                {/* 描述文字 */}
                {folder.bookmark_count === 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {isInbox ? t.folder.inboxEmpty : t.folder.emptyContent}
                  </p>
                )}
              </div>
            </div>

            {/* 底部：统计信息 */}
            <div className="flex items-center justify-between mt-auto pt-2">
              <div className="flex items-center gap-2">
                <span className={cn("text-lg font-bold", colors.accent)}>
                  {folder.bookmark_count || 0}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.folder.itemsCount}
                </span>

                {folder.today_count > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-green-500 font-medium">
                    <TrendingUp className="size-3" />+{folder.today_count}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* 操作按钮 - 始终可见（半透明），hover 时完全显示 */}
      <div
        onClick={(e) => e.preventDefault()}
        className={cn(
          "absolute top-2 right-2 transition-opacity",
          "opacity-40 group-hover:opacity-100",
        )}
      >
        <FolderActionMenu
          folder={folder}
          allFolders={allFolders}
          onActionComplete={onActionComplete}
          onFolderDeleted={onFolderDeleted}
          onFolderRenamed={onFolderRenamed}
          onFolderMerged={onFolderMerged}
          onExportFolder={onExportFolder}
          initialLockStatus={lockStatus}
        />
      </div>
    </div>
  );
});

// ==================== 列表项组件 ====================

interface FolderListItemProps extends FolderActionCallbacks {
  folder: FolderWithStats;
  allFolders: FolderWithStats[];
  lockStatus?: LockStatus;
}

export const FolderListItem = memo(function FolderListItem({
  folder,
  allFolders,
  lockStatus,
  onActionComplete,
  onFolderDeleted,
  onFolderRenamed,
  onFolderMerged,
  onExportFolder,
}: FolderListItemProps) {
  // 国际化
  const t = useUiText();

  const isInbox = folder.is_system && folder.system_type === "INBOX";
  const isArchived = folder.is_archived;

  // 获取颜色配置
  const groupKey = folder.folder_group || "other";
  const colors = isInbox
    ? SYSTEM_FOLDER_CONFIG.colors
    : FOLDER_GROUPS[groupKey]?.colors || FOLDER_GROUPS.other.colors;

  return (
    <div className="group relative">
      <Link href={`/home?folder=${folder.id}`}>
        <div
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border transition-all",
            "hover:shadow-sm hover:border-primary/30",
            colors.border,
            isArchived && "opacity-60",
          )}
        >
          {/* 左侧颜色条 */}
          <div
            className={cn(
              "w-1 h-8 rounded-full flex-shrink-0",
              `bg-gradient-to-b ${FOLDER_GROUPS[groupKey]?.colors.gradient.from || "from-gray-400"} ${FOLDER_GROUPS[groupKey]?.colors.gradient.to || "to-gray-500"}`,
            )}
          />

          {/* 图标 */}
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              isInbox ? "bg-slate-100 dark:bg-slate-800" : colors.iconBg,
            )}
          >
            {isInbox ? (
              <Inbox className="size-4 text-slate-600 dark:text-slate-400" />
            ) : (
              <span className="text-lg">{getFolderEmoji(folder.name)}</span>
            )}
          </div>

          {/* 名称 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 dark:text-white truncate">
                {folder.name}
              </h4>
              {folder.is_system && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {t.folder.system}
                </Badge>
              )}
              {isArchived && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {t.folder.archived}
                </Badge>
              )}
              {folder.is_locked && (
                <span title={t.folder.aiLocked}>
                  <Lock className="size-3 text-amber-500" />
                </span>
              )}
            </div>
          </div>

          {/* 统计 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn("text-sm font-medium", colors.accent)}>
              {folder.bookmark_count || 0}
            </span>
            <span className="text-xs text-muted-foreground">
              {t.folder.items}
            </span>
            {folder.today_count > 0 && (
              <span className="text-xs text-green-500 font-medium">
                +{folder.today_count}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* 操作菜单 */}
      <div
        onClick={(e) => e.preventDefault()}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <FolderActionMenu
          folder={folder}
          allFolders={allFolders}
          onActionComplete={onActionComplete}
          onFolderDeleted={onFolderDeleted}
          onFolderRenamed={onFolderRenamed}
          onFolderMerged={onFolderMerged}
          onExportFolder={onExportFolder}
          initialLockStatus={lockStatus}
        />
      </div>
    </div>
  );
});

// ==================== 卡片网格组件 ====================

interface FolderCardGridProps extends FolderActionCallbacks {
  folders: FolderWithStats[];
  allFolders: FolderWithStats[];
  lockStatusMap: Record<string, LockStatus>;
  emptyMessage?: string;
}

export function FolderCardGrid({
  folders,
  allFolders,
  lockStatusMap,
  onActionComplete,
  onFolderDeleted,
  onFolderRenamed,
  onFolderMerged,
  onExportFolder,
  emptyMessage,
}: FolderCardGridProps) {
  // 国际化
  const t = useUiText();

  const displayEmptyMessage = emptyMessage ?? t.folder.emptyMessage;

  if (folders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>{displayEmptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          allFolders={allFolders}
          lockStatus={lockStatusMap[folder.id]}
          onActionComplete={onActionComplete}
          onFolderDeleted={onFolderDeleted}
          onFolderRenamed={onFolderRenamed}
          onFolderMerged={onFolderMerged}
          onExportFolder={onExportFolder}
        />
      ))}
    </div>
  );
}
