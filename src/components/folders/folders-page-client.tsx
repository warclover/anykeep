/**
 * 收藏夹页面客户端组件
 * 展示文件夹卡片网格和最近添加的收藏
 *
 * UI/UX 优化:
 * - P0: 空状态情感化设计
 * - P0: 统计数字展示（总收藏数、当日新增）
 * - P1: 系统文件夹特殊标识
 * - P1: 排序控件
 * - P1: 渐变小清新色调卡片设计
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Folder,
  Inbox,
  ArrowUpDown,
  Clock,
  SortAsc,
  Hash,
  BookmarkPlus,
  FolderOpen,
  TrendingUp,
  Sparkles,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorMessage } from "@/components/ui/error-message";
import { CreateFolderDialog } from "@/components/folders/create-folder-dialog";
import { FolderActionMenu } from "@/components/folders/folder-action-menu";
import type { Folder as FolderType, Bookmark } from "@/types/supabase";

// 扩展 Folder 类型，包含统计字段
type FolderWithStats = FolderType & {
  bookmark_count: number;
  today_count: number;
  is_archived?: boolean;
};

// 排序选项
type SortOption = "recent" | "name" | "count";

interface FoldersPageClientProps {
  folders: FolderWithStats[];
  recentBookmarks: (Bookmark & {
    folders?: { name: string } | null;
  })[];
  error?: string;
}

// 渐变小清新色调调色板 - 增强版
const GRADIENT_COLORS = [
  {
    from: "from-pink-200",
    to: "to-rose-100",
    accent: "text-pink-600",
    bg: "bg-pink-500/10",
    shadow: "shadow-pink-200/50",
    glow: "pink",
  },
  {
    from: "from-purple-200",
    to: "to-violet-100",
    accent: "text-purple-600",
    bg: "bg-purple-500/10",
    shadow: "shadow-purple-200/50",
    glow: "purple",
  },
  {
    from: "from-blue-200",
    to: "to-sky-100",
    accent: "text-blue-600",
    bg: "bg-blue-500/10",
    shadow: "shadow-blue-200/50",
    glow: "blue",
  },
  {
    from: "from-cyan-200",
    to: "to-teal-100",
    accent: "text-cyan-600",
    bg: "bg-cyan-500/10",
    shadow: "shadow-cyan-200/50",
    glow: "cyan",
  },
  {
    from: "from-green-200",
    to: "to-emerald-100",
    accent: "text-green-600",
    bg: "bg-green-500/10",
    shadow: "shadow-green-200/50",
    glow: "green",
  },
  {
    from: "from-lime-200",
    to: "to-green-100",
    accent: "text-lime-600",
    bg: "bg-lime-500/10",
    shadow: "shadow-lime-200/50",
    glow: "lime",
  },
  {
    from: "from-amber-200",
    to: "to-yellow-100",
    accent: "text-amber-600",
    bg: "bg-amber-500/10",
    shadow: "shadow-amber-200/50",
    glow: "amber",
  },
  {
    from: "from-orange-200",
    to: "to-amber-100",
    accent: "text-orange-600",
    bg: "bg-orange-500/10",
    shadow: "shadow-orange-200/50",
    glow: "orange",
  },
  {
    from: "from-red-200",
    to: "to-rose-100",
    accent: "text-red-500",
    bg: "bg-red-400/10",
    shadow: "shadow-red-200/50",
    glow: "red",
  },
  {
    from: "from-indigo-200",
    to: "to-blue-100",
    accent: "text-indigo-600",
    bg: "bg-indigo-500/10",
    shadow: "shadow-indigo-200/50",
    glow: "indigo",
  },
];

// 根据文件夹 ID 获取固定的渐变色
function getFolderGradient(folderId: number) {
  const index = folderId % GRADIENT_COLORS.length;
  return GRADIENT_COLORS[index];
}

// Emoji 图标映射
const FOLDER_EMOJIS: Record<string, string> = {
  产品学习: "📚",
  技术学习: "💻",
  生活方式: "☕",
  旅行计划: "✈️",
  职场技能: "💼",
  行业资讯: "📰",
  学习: "📖",
  工作: "💼",
  娱乐: "🎮",
  收藏: "⭐",
  default: "📁",
};

function getFolderEmoji(folderName: string): string {
  return FOLDER_EMOJIS[folderName] || FOLDER_EMOJIS["default"];
}

// 排序文件夹
function sortFolders(
  folders: FolderWithStats[],
  sortBy: SortOption,
): FolderWithStats[] {
  // 系统文件夹始终置顶
  const systemFolders = folders.filter((f) => f.is_system);
  const normalFolders = folders.filter((f) => !f.is_system);

  const sortedNormal = [...normalFolders].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name, "zh-CN");
      case "count":
        return (b.bookmark_count || 0) - (a.bookmark_count || 0);
      case "recent":
      default:
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
    }
  });

  return [...systemFolders, ...sortedNormal];
}

// 排序选项配置
const SORT_OPTIONS = [
  { value: "recent" as SortOption, label: "最近创建", icon: Clock },
  { value: "name" as SortOption, label: "名称排序", icon: SortAsc },
  { value: "count" as SortOption, label: "收藏数量", icon: Hash },
];

export function FoldersPageClient({
  folders,
  recentBookmarks,
  error,
}: FoldersPageClientProps) {
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  // 排序后的文件夹列表
  const sortedFolders = useMemo(
    () => sortFolders(folders, sortBy),
    [folders, sortBy],
  );

  const handleRetry = () => {
    router.refresh();
  };

  const handleCreateClick = () => {
    setShowCreateDialog(true);
  };

  const currentSortOption = SORT_OPTIONS.find((opt) => opt.value === sortBy);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold">
            收藏夹
          </h2>
          <div className="flex items-center gap-2">
            {/* 排序控件 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden md:flex">
                  <ArrowUpDown className="size-4 mr-2" />
                  {currentSortOption?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={sortBy === option.value ? "bg-accent" : ""}
                  >
                    <option.icon className="size-4 mr-2" />
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" onClick={handleCreateClick}>
              <Plus className="size-4 mr-2" />
              <span className="hidden md:inline">新建文件夹</span>
              <span className="md:hidden">新建</span>
            </Button>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          按文件夹整理你的收藏内容
          {folders.length > 0 && (
            <span className="ml-2">· {folders.length} 个文件夹</span>
          )}
        </p>
      </header>

      {/* Folders Grid */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-6">
        {error ? (
          <ErrorMessage message={error} retry={handleRetry} />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
              {sortedFolders.map((folder) => {
                const gradient = getFolderGradient(folder.id);
                const isInbox =
                  folder.is_system && folder.system_type === "INBOX";

                // 生成彩色阴影样式
                const coloredShadow =
                  {
                    pink: "hover:shadow-[0_8px_30px_rgb(236,72,153,0.3),0_4px_15px_rgb(236,72,153,0.2)]",
                    purple:
                      "hover:shadow-[0_8px_30px_rgb(168,85,247,0.3),0_4px_15px_rgb(168,85,247,0.2)]",
                    blue: "hover:shadow-[0_8px_30px_rgb(59,130,246,0.3),0_4px_15px_rgb(59,130,246,0.2)]",
                    cyan: "hover:shadow-[0_8px_30px_rgb(6,182,212,0.3),0_4px_15px_rgb(6,182,212,0.2)]",
                    green:
                      "hover:shadow-[0_8px_30px_rgb(34,197,94,0.3),0_4px_15px_rgb(34,197,94,0.2)]",
                    lime: "hover:shadow-[0_8px_30px_rgb(132,204,22,0.3),0_4px_15px_rgb(132,204,22,0.2)]",
                    amber:
                      "hover:shadow-[0_8px_30px_rgb(245,158,11,0.3),0_4px_15px_rgb(245,158,11,0.2)]",
                    orange:
                      "hover:shadow-[0_8px_30px_rgb(249,115,22,0.3),0_4px_15px_rgb(249,115,22,0.2)]",
                    red: "hover:shadow-[0_8px_30px_rgb(239,68,68,0.3),0_4px_15px_rgb(239,68,68,0.2)]",
                    indigo:
                      "hover:shadow-[0_8px_30px_rgb(99,102,241,0.3),0_4px_15px_rgb(99,102,241,0.2)]",
                  }[gradient.glow] || "";

                return (
                  <Link key={folder.id} href={`/home?folder=${folder.id}`}>
                    {/* 外层包装 - 渐变边框效果 */}
                    <div
                      className={`group relative rounded-xl p-[2px] transition-all duration-300
                      bg-gradient-to-br ${gradient.from} ${gradient.to}
                      ${isInbox ? "!bg-gradient-to-br !from-primary/40 !to-primary/20" : ""}
                      ${folder.is_archived ? "opacity-60" : ""}
                      hover:p-[2px] hover:scale-[1.02]
                      ${coloredShadow}
                    `}
                    >
                      {/* 发光效果层 */}
                      <div
                        className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl -z-10
                        bg-gradient-to-br ${gradient.from} ${gradient.to}
                        ${isInbox ? "!bg-gradient-to-br !from-primary/30 !to-primary/10" : ""}
                      `}
                      />

                      <Card
                        className={`relative overflow-hidden rounded-[10px] border-0
                        backdrop-blur-md bg-white/80 dark:bg-gray-900/80
                        ${folder.is_archived ? "border-dashed" : ""}
                      `}
                      >
                        {/* 玻璃拟态装饰 - 顶部高光 */}
                        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

                        <CardContent className="relative p-4 md:p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              {/* 文件夹图标 */}
                              <div
                                className={`text-2xl md:text-3xl transition-transform group-hover:scale-110 ${
                                  folder.is_archived ? "grayscale" : ""
                                }`}
                              >
                                {isInbox ? (
                                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm">
                                    <Inbox className="size-5 md:size-6 text-primary" />
                                  </div>
                                ) : (
                                  <div
                                    className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${gradient.from} ${gradient.to} flex items-center justify-center shadow-sm`}
                                  >
                                    <span className="text-xl md:text-2xl">
                                      {getFolderEmoji(folder.name)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-gray-900 dark:text-white text-sm md:text-base font-semibold">
                                    {folder.name}
                                  </h3>
                                  {folder.is_system && (
                                    <Badge
                                      variant="default"
                                      className="text-xs px-1.5 py-0 bg-primary/80"
                                    >
                                      系统
                                    </Badge>
                                  )}
                                  {folder.is_archived && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs px-1.5 py-0"
                                    >
                                      已停用
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div onClick={(e) => e.preventDefault()}>
                              <FolderActionMenu
                                folder={folder}
                                allFolders={folders}
                                onActionComplete={() => router.refresh()}
                              />
                            </div>
                          </div>

                          {/* 统计数字展示区 */}
                          <div
                            className={`rounded-xl p-4 bg-gradient-to-br ${gradient.from} ${gradient.to} ${
                              isInbox
                                ? "!bg-gradient-to-br !from-primary/10 !to-primary/5"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              {/* 总收藏数 */}
                              <div className="flex-1 text-center">
                                <div
                                  className={`text-2xl md:text-3xl font-bold ${isInbox ? "text-primary" : gradient.accent}`}
                                >
                                  {folder.bookmark_count || 0}
                                </div>
                                <div className="text-gray-500 dark:text-gray-400 text-xs mt-1 flex items-center justify-center gap-1">
                                  <Folder className="size-3" />
                                  总收藏
                                </div>
                              </div>

                              {/* 分隔线 */}
                              <div className="w-px h-12 bg-gray-200 dark:bg-gray-700 mx-4" />

                              {/* 当日新增 */}
                              <div className="flex-1 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <span
                                    className={`text-2xl md:text-3xl font-bold ${
                                      folder.today_count > 0
                                        ? "text-green-500"
                                        : "text-gray-400 dark:text-gray-500"
                                    }`}
                                  >
                                    {folder.today_count > 0
                                      ? `+${folder.today_count}`
                                      : "0"}
                                  </span>
                                  {folder.today_count > 0 && (
                                    <TrendingUp className="size-4 text-green-500" />
                                  )}
                                </div>
                                <div className="text-gray-500 dark:text-gray-400 text-xs mt-1 flex items-center justify-center gap-1">
                                  <Sparkles className="size-3" />
                                  今日新增
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 空状态提示 */}
                          {folder.bookmark_count === 0 && (
                            <div className="mt-3 flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-xs">
                              {isInbox ? (
                                <>
                                  <BookmarkPlus className="size-3" />
                                  <span>新收藏将自动归入这里</span>
                                </>
                              ) : (
                                <>
                                  <FolderOpen className="size-3" />
                                  <span>还没有收藏内容</span>
                                </>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </Link>
                );
              })}

              {/* 全局空状态 - 无文件夹 */}
              {folders.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 md:py-20">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Folder className="size-10 md:size-12 text-primary" />
                  </div>
                  <h3 className="text-gray-900 dark:text-white text-lg md:text-xl font-medium mb-2">
                    开始整理你的收藏
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-sm mb-6">
                    创建文件夹来分类管理你的收藏内容，让知识更有条理
                  </p>
                  <Button size="lg" onClick={handleCreateClick}>
                    <Plus className="size-5 mr-2" />
                    创建第一个文件夹
                  </Button>
                </div>
              )}
            </div>

            {/* Recent Collections */}
            {recentBookmarks.length > 0 && (
              <div>
                <h3 className="text-gray-900 dark:text-white mb-3 md:mb-4 font-medium flex items-center gap-2">
                  <Clock className="size-4 text-gray-400" />
                  最近添加
                </h3>
                <div className="space-y-3">
                  {recentBookmarks.map((bookmark) => (
                    <Link key={bookmark.id} href={`/bookmark/${bookmark.id}`}>
                      <Card className="hover:shadow-sm hover:border-primary/20 transition-all cursor-pointer">
                        <CardContent className="p-3 md:p-4">
                          <div className="flex items-center gap-3 md:gap-4">
                            {bookmark.cover_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={bookmark.cover_url}
                                alt={bookmark.title}
                                className="w-12 h-12 md:w-16 md:h-16 object-cover rounded flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded flex items-center justify-center flex-shrink-0">
                                <Globe className="size-5 text-gray-400 dark:text-gray-500" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-gray-900 dark:text-white line-clamp-1 text-sm md:text-base">
                                {bookmark.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Folder className="size-3 text-gray-400 dark:text-gray-500" />
                                <span className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">
                                  {bookmark.folders?.name || "未分类"}
                                </span>
                              </div>
                            </div>
                            <div className="hidden md:flex gap-1 flex-wrap">
                              {bookmark.ai_tags?.slice(0, 2).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 创建文件夹对话框 */}
      <CreateFolderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        folders={folders}
      />
    </div>
  );
}
