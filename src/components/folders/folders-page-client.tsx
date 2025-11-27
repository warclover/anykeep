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

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Folder,
  Inbox,
  Clock,
  BookmarkPlus,
  FolderOpen,
  TrendingUp,
  Sparkles,
  Globe,
  ChevronDown,
  ChevronRight,
  Briefcase,
  GraduationCap,
  Heart,
  Gamepad2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorMessage } from "@/components/ui/error-message";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CreateFolderDialog } from "@/components/folders/create-folder-dialog";
import { FolderActionMenu } from "@/components/folders/folder-action-menu";
import type {
  Folder as FolderType,
  Bookmark,
  FolderGroup,
} from "@/types/supabase";

// 扩展 Folder 类型，包含统计字段
type FolderWithStats = FolderType & {
  bookmark_count: number;
  today_count: number;
  is_archived?: boolean;
};

interface FoldersPageClientProps {
  folders: FolderWithStats[];
  recentBookmarks: (Bookmark & {
    folders?: { name: string } | null;
  })[];
  error?: string;
}

// ==================== 文件夹分组配置 ====================

// 分组配置
const FOLDER_GROUPS: Record<
  FolderGroup,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    keywords: string[];
    gradient: { from: string; to: string };
  }
> = {
  work: {
    label: "工作相关",
    icon: Briefcase,
    keywords: [
      "工作",
      "职场",
      "项目",
      "公司",
      "业务",
      "办公",
      "会议",
      "客户",
      "行业",
    ],
    gradient: { from: "from-blue-500", to: "to-indigo-500" },
  },
  study: {
    label: "学习成长",
    icon: GraduationCap,
    keywords: [
      "学习",
      "技术",
      "产品",
      "教程",
      "课程",
      "知识",
      "笔记",
      "读书",
      "教育",
      "培训",
    ],
    gradient: { from: "from-emerald-500", to: "to-teal-500" },
  },
  life: {
    label: "生活方式",
    icon: Heart,
    keywords: [
      "生活",
      "旅行",
      "美食",
      "健康",
      "运动",
      "家庭",
      "购物",
      "时尚",
      "美妆",
    ],
    gradient: { from: "from-pink-500", to: "to-rose-500" },
  },
  entertainment: {
    label: "休闲娱乐",
    icon: Gamepad2,
    keywords: ["娱乐", "游戏", "电影", "音乐", "视频", "动漫", "小说", "综艺"],
    gradient: { from: "from-purple-500", to: "to-violet-500" },
  },
  other: {
    label: "其他收藏",
    icon: MoreHorizontal,
    keywords: [],
    gradient: { from: "from-gray-400", to: "to-gray-500" },
  },
};

// V4.4更新：直接从数据库读取分组，不再根据名称判断
// 旧的自动判断逻辑已废弃，现在由数据库 folder_group 字段控制

// 分组文件夹
type GroupedFolders = {
  system: FolderWithStats[];
  groups: Record<FolderGroup, FolderWithStats[]>;
};

function groupFolders(folders: FolderWithStats[]): GroupedFolders {
  const result: GroupedFolders = {
    system: [],
    groups: {
      work: [],
      study: [],
      life: [],
      entertainment: [],
      other: [],
    },
  };

  for (const folder of folders) {
    if (folder.is_system) {
      result.system.push(folder);
    } else {
      // V4.4更新：直接使用数据库的 folder_group 字段
      const group = folder.folder_group || "other";
      result.groups[group].push(folder);
    }
  }

  // V4.4新增：按 sort_order 排序每个组内的文件夹
  Object.keys(result.groups).forEach((groupKey) => {
    result.groups[groupKey as FolderGroup].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
  });

  return result;
}

// ==================== 渐变色调色板 ====================
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

export function FoldersPageClient({
  folders,
  recentBookmarks,
  error,
}: FoldersPageClientProps) {
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [localFolders, setLocalFolders] = useState(folders);

  // 分组折叠状态
  const [expandedGroups, setExpandedGroups] = useState<
    Record<FolderGroup, boolean>
  >({
    work: true,
    study: true,
    life: true,
    entertainment: true,
    other: true,
  });

  // 同步 folders 到 localFolders
  useEffect(() => {
    setLocalFolders(folders);
  }, [folders]);

  // 分组后的文件夹 - 使用 localFolders 而不是 folders
  const groupedFolders = useMemo(
    () => groupFolders(localFolders),
    [localFolders],
  );

  // 切换分组展开/折叠
  const toggleGroup = (group: FolderGroup) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const handleRetry = () => {
    router.refresh();
  };

  const handleCreateClick = () => {
    setShowCreateDialog(true);
  };

  // 获取非空分组列表
  const nonEmptyGroups = (Object.keys(FOLDER_GROUPS) as FolderGroup[]).filter(
    (group) => groupedFolders.groups[group].length > 0,
  );

  // 渲染单个文件夹卡片
  const renderFolderCard = (folder: FolderWithStats) => {
    const gradient = getFolderGradient(folder.id);
    const isInbox = folder.is_system && folder.system_type === "INBOX";

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
        <div
          className={`group relative rounded-xl p-[2px] transition-all duration-300
            bg-gradient-to-br ${gradient.from} ${gradient.to}
            ${isInbox ? "!bg-gradient-to-br !from-primary/40 !to-primary/20" : ""}
            ${folder.is_archived ? "opacity-60" : ""}
            hover:p-[2px] hover:scale-[1.02]
            ${coloredShadow}
          `}
        >
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
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
            <CardContent className="relative p-4 md:p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
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
                    allFolders={localFolders}
                    onActionComplete={() => router.refresh()}
                  />
                </div>
              </div>
              <div
                className={`rounded-xl p-4 bg-gradient-to-br ${gradient.from} ${gradient.to} ${
                  isInbox
                    ? "!bg-gradient-to-br !from-primary/10 !to-primary/5"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
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
                  <div className="w-px h-12 bg-gray-200 dark:bg-gray-700 mx-4" />
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
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold">
            收藏夹
          </h2>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleCreateClick}>
              <Plus className="size-4 mr-2" />
              <span className="hidden md:inline">新建文件夹</span>
              <span className="md:hidden">新建</span>
            </Button>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          按文件夹整理你的收藏内容
          {localFolders.length > 0 && (
            <span className="ml-2">· {localFolders.length} 个文件夹</span>
          )}
        </p>
      </header>

      {/* Folders with Grouping */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-6">
        {error ? (
          <ErrorMessage message={error} retry={handleRetry} />
        ) : (
          <>
            {/* 全局空状态 - 无文件夹 */}
            {localFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 md:py-20">
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
            ) : (
              <div className="space-y-6">
                {/* 系统文件夹区域 - 始终置顶 */}
                {groupedFolders.system.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Inbox className="size-4 text-primary" />
                      </div>
                      <h3 className="text-gray-900 dark:text-white font-semibold">
                        系统文件夹
                      </h3>
                      <Badge variant="secondary" className="text-xs">
                        {groupedFolders.system.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupedFolders.system.map((folder) =>
                        renderFolderCard(folder),
                      )}
                    </div>
                  </section>
                )}

                {/* 分组文件夹区域 */}
                {nonEmptyGroups.map((groupKey) => {
                  const groupConfig = FOLDER_GROUPS[groupKey];
                  const GroupIcon = groupConfig.icon;
                  const groupFolders = groupedFolders.groups[groupKey];
                  const isExpanded = expandedGroups[groupKey];

                  return (
                    <Collapsible
                      key={groupKey}
                      open={isExpanded}
                      onOpenChange={() => toggleGroup(groupKey)}
                    >
                      <section className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                        {/* 分组标题 - 可点击折叠 */}
                        <CollapsibleTrigger asChild>
                          <button
                            className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors
                              bg-gradient-to-r ${groupConfig.gradient.from}/5 ${groupConfig.gradient.to}/5
                            `}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${groupConfig.gradient.from} ${groupConfig.gradient.to} flex items-center justify-center shadow-sm`}
                              >
                                <GroupIcon className="size-5 text-white" />
                              </div>
                              <div className="text-left">
                                <h3 className="text-gray-900 dark:text-white font-semibold">
                                  {groupConfig.label}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 text-xs">
                                  {groupFolders.length} 个文件夹 ·{" "}
                                  {groupFolders.reduce(
                                    (sum, f) => sum + f.bookmark_count,
                                    0,
                                  )}{" "}
                                  篇收藏
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {groupFolders.length}
                              </Badge>
                              {isExpanded ? (
                                <ChevronDown className="size-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="size-5 text-gray-400" />
                              )}
                            </div>
                          </button>
                        </CollapsibleTrigger>

                        {/* 分组内容 */}
                        <CollapsibleContent>
                          <div className="p-4 pt-2 bg-white dark:bg-gray-900">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {groupFolders.map((folder) =>
                                renderFolderCard(folder),
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </section>
                    </Collapsible>
                  );
                })}
              </div>
            )}

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
        folders={localFolders}
      />
    </div>
  );
}
