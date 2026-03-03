/**
 * 内容分析页面客户端组件
 *
 * 三 Tab 设计：
 * - 对比分析：选择 2 篇内容进行对比
 * - 主题综述：选择 3 篇以上进行综述
 * - 历史记录：查看所有分析���告
 *
 * @version 2.0.0
 * @since 2026-02-13
 */

"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  FileText,
  Clock,
  BookOpen,
  MoreVertical,
  Trash2,
  RefreshCcw,
  ArrowUpDown,
  Lightbulb,
  GitCompare,
  Layers,
  History,
  Loader2,
  CheckSquare,
  Square,
  ExternalLink,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useSynthesisListQuery } from "@/hooks/synthesis/use-synthesis-list-query";
import type {
  SynthesisReportSummary,
  SynthesisDepthMode,
  SynthesisStatus,
  SynthesisOutputStyle,
} from "@/lib/synthesis";
import { AdvancedSettingsPanel } from "@/components/synthesis/advanced-settings-panel";
import { clientLogger } from "@/lib/client-logger";

// ============ 常量配置 ============

// 深度模式配置
const DEPTH_MODE_LABELS: Record<
  SynthesisDepthMode,
  { label: string; icon: string }
> = {
  quick: { label: "快读", icon: "⚡" },
  standard: { label: "标准", icon: "📖" },
  academic: { label: "学术", icon: "🎓" },
};

// 状态配置
const STATUS_CONFIG: Record<
  SynthesisStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "等待中", variant: "secondary" },
  generating: { label: "生成中", variant: "default" },
  completed: { label: "已完成", variant: "outline" },
  failed: { label: "失败", variant: "destructive" },
  cancelled: { label: "已取消", variant: "secondary" },
};

// 排序选项
const SORT_OPTIONS = [
  {
    value: "createdAt-desc",
    label: "最新创建",
    sort: "createdAt" as const,
    order: "desc" as const,
  },
  {
    value: "createdAt-asc",
    label: "最早创建",
    sort: "createdAt" as const,
    order: "asc" as const,
  },
  {
    value: "updatedAt-desc",
    label: "最近更新",
    sort: "updatedAt" as const,
    order: "desc" as const,
  },
  {
    value: "wordCount-desc",
    label: "字数最多",
    sort: "wordCount" as const,
    order: "desc" as const,
  },
  {
    value: "wordCount-asc",
    label: "字数最少",
    sort: "wordCount" as const,
    order: "asc" as const,
  },
];

// 平台显示名称映射
const PLATFORM_LABELS: Record<string, string> = {
  wechat: "微信",
  bilibili: "B站",
  zhihu: "知乎",
  weibo: "微博",
  xiaohongshu: "小红书",
  twitter: "Twitter",
  youtube: "YouTube",
  unknown: "其他",
};

// 书签类型
interface BookmarkItem {
  id: number;
  title: string;
  url: string;
  platform: string | null;
  ai_summary: string | null;
  created_at: string;
  folder_name: string | null;
}

// Tab 类型
type AnalysisTab = "compare" | "synthesis" | "history";

// ============ 工具函数 ============

/**
 * 判断报告类型
 */
function getReportType(
  outputStyle: SynthesisOutputStyle,
  sourceCount: number,
): { label: string; icon: typeof GitCompare; color: string } {
  if (outputStyle === "comparison" || sourceCount === 2) {
    return {
      label: "对比分析",
      icon: GitCompare,
      color: "text-cyan-600 dark:text-cyan-400",
    };
  }
  return {
    label: "主题综述",
    icon: Layers,
    color: "text-purple-600 dark:text-purple-400",
  };
}

/**
 * 获取平台显示名称
 */
function getPlatformLabel(platform: string | null): string {
  return PLATFORM_LABELS[platform || "unknown"] || platform || "其他";
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "刚刚";
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return `${Math.floor(diffDays / 30)}月前`;
}

// ============ 子组件 ============

/**
 * 分析卡片组件
 */
function AnalysisCard({
  report,
  onDelete,
  onRetry,
}: {
  report: SynthesisReportSummary;
  onDelete: (report: SynthesisReportSummary) => void;
  onRetry: (reportId: string) => void;
}) {
  const depthConfig = DEPTH_MODE_LABELS[report.depthMode];
  const statusConfig = STATUS_CONFIG[report.status];
  const reportType = getReportType(report.outputStyle, report.sourceCount);
  const TypeIcon = reportType.icon;

  return (
    <Card className="hover:bg-muted/50 transition-colors group relative">
      <Link href={`/synthesis/${report.id}`} className="block">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base line-clamp-1 pr-8">
              {report.title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${reportType.color} border-current`}
              >
                <TypeIcon className="h-3 w-3 mr-1" />
                {reportType.label}
              </Badge>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 概述预览 */}
          {report.overviewPreview && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {report.overviewPreview}
            </p>
          )}

          {/* 元信息标签 */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {depthConfig.icon} {depthConfig.label}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {report.sourceCount} 来源
            </span>
            {report.wordCount > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {report.wordCount} 字
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(report.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* 四维统计 */}
          {report.status === "completed" && (
            <div className="flex gap-2">
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                共识 {report.consensusCount}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              >
                分歧 {report.divergenceCount}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              >
                盲区 {report.blindSpotCount}
              </Badge>
            </div>
          )}
        </CardContent>
      </Link>

      {/* 操作菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.preventDefault()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {report.status === "failed" && (
            <>
              <DropdownMenuItem onClick={() => onRetry(report.id)}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                重新生成
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(report)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}

/**
 * 书签列表项组件
 */
function BookmarkListItem({
  bookmark,
  isSelected,
  onToggle,
  disabled,
}: {
  bookmark: BookmarkItem;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "w-full flex items-start gap-3 p-3 text-left transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-primary/5",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {isSelected ? (
        <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      ) : (
        <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{bookmark.title}</span>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-primary shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {getPlatformLabel(bookmark.platform)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(bookmark.created_at)}
          </span>
          {bookmark.folder_name && (
            <span className="text-xs text-muted-foreground truncate">
              · {bookmark.folder_name}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * 空状态组件
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <GitCompare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">还没有分析报告</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        选择 2 篇内容进行对比分析，或 3 篇以上进行主题综述
      </p>
    </div>
  );
}

/** P2: 书签列表骨架屏（对比/主题 Tab 加载态） */
function BookmarkListSkeleton() {
  return (
    <div className="divide-y">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-start gap-3 p-3 animate-pulse">
          <div className="h-5 w-5 shrink-0 rounded bg-muted" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="flex gap-2">
              <div className="h-4 bg-muted rounded w-12" />
              <div className="h-4 bg-muted rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ 主组件 ============

/**
 * 内容分析页面客户端组件
 */
export function ContentAnalysisListClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 从 URL 获取初始 Tab
  const initialTab =
    (searchParams?.get("tab") as AnalysisTab | null) || "compare";

  // Tab 状态
  const [activeTab, setActiveTab] = useState<AnalysisTab>(initialTab);

  // 历史记录相关状态
  const [search, setSearch] = useState("");
  const [depthFilter, setDepthFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortValue, setSortValue] = useState("createdAt-desc");

  // 书签选择相关状态
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(true);
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 配置状态（默认值）
  const [depthMode, setDepthMode] = useState<SynthesisDepthMode>("standard");
  const [outputStyle, setOutputStyle] =
    useState<SynthesisOutputStyle>("narrative");

  // 创建状态
  const [isCreating, setIsCreating] = useState(false);

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] =
    useState<SynthesisReportSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 每页数量
  const PAGE_SIZE = 20;

  // 防抖定时器 ref
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // 书签首屏是否已加载过（防 Strict Mode 双挂载重复请求）
  const initialBookmarksLoadDone = useRef(false);

  // 根据 Tab 设置数量限制
  const minCount = activeTab === "compare" ? 2 : 3;
  const maxCount = activeTab === "compare" ? 2 : Infinity;

  // 解析排序选项
  const sortOption =
    SORT_OPTIONS.find((o) => o.value === sortValue) || SORT_OPTIONS[0];

  // P0: 仅在「历史记录」Tab 时请求综述列表，并用 TanStack Query 去重
  const { data, isLoading, error, refetch } = useSynthesisListQuery({
    search: search || undefined,
    depthMode:
      depthFilter !== "all" ? (depthFilter as SynthesisDepthMode) : undefined,
    status:
      statusFilter !== "all" ? (statusFilter as SynthesisStatus) : undefined,
    sort: sortOption.sort,
    order: sortOption.order,
    enabled: activeTab === "history",
  });

  const reports = data?.data || [];

  // 加载书签列表
  const loadBookmarks = useCallback(
    async (pageNum: number, append = false) => {
      if (pageNum === 1) {
        setIsLoadingBookmarks(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String((pageNum - 1) * PAGE_SIZE),
          excludeBrowser: "true",
        });

        if (bookmarkSearch) {
          params.append("keyword", bookmarkSearch);
        }

        const response = await fetch(`/api/bookmarks?${params}`);
        if (response.ok) {
          const result = await response.json();
          const newBookmarks = result.data?.bookmarks || [];

          if (append) {
            setBookmarks((prev) => [...prev, ...newBookmarks]);
          } else {
            setBookmarks(newBookmarks);
          }

          setHasMore(result.data?.pagination?.hasMore ?? false);
        }
      } catch (error) {
        clientLogger.error({ error }, "Failed to load bookmarks:");
      } finally {
        setIsLoadingBookmarks(false);
        setIsLoadingMore(false);
      }
    },
    [bookmarkSearch],
  );

  // 同步 Tab 到 URL
  const handleTabChange = useCallback(
    (tab: string) => {
      const newTab = tab as AnalysisTab;
      setActiveTab(newTab);
      setSelectedIds(new Set()); // 切换 Tab 时清空选择

      // 更新 URL
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("tab", newTab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });

      // 更新输出风格
      if (newTab === "compare") {
        setOutputStyle("comparison");
      } else if (newTab === "synthesis") {
        setOutputStyle("narrative");
      }
      // 切换到对比/主题 Tab 且书签未加载过时再加载（不预加载，减少请求）
      if (
        (newTab === "compare" || newTab === "synthesis") &&
        bookmarks.length === 0
      ) {
        loadBookmarks(1);
      }
    },
    [pathname, searchParams, router, bookmarks.length, loadBookmarks],
  );

  // P0: 初始加载书签（仅一次，防 Strict Mode 双挂载重复请求）
  useEffect(() => {
    if (activeTab === "history") return;
    if (initialBookmarksLoadDone.current) return;
    initialBookmarksLoadDone.current = true;
    loadBookmarks(1);
  }, [activeTab, loadBookmarks]);

  // 搜索变化时防抖重新加载（仅响应用户输入；首屏空搜索不在此处理）
  const searchEffectEverRun = useRef(false);
  useEffect(() => {
    if (activeTab === "history") return;
    if (bookmarkSearch === "" && !searchEffectEverRun.current) {
      searchEffectEverRun.current = true;
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      loadBookmarks(1);
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [bookmarkSearch, activeTab, loadBookmarks]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadBookmarks(nextPage, true);
  }, [page, loadBookmarks]);

  // 切换选择
  const toggleSelection = useCallback(
    (bookmarkId: number) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(bookmarkId)) {
          next.delete(bookmarkId);
        } else {
          if (next.size >= maxCount) {
            return prev;
          }
          next.add(bookmarkId);
        }
        return next;
      });
    },
    [maxCount],
  );

  // 计算选中数量
  const selectedCount = selectedIds.size;

  // 是否可以开始分析
  const canStartAnalysis =
    selectedCount >= minCount && selectedCount <= maxCount;

  // 处理创建分析
  const handleStartAnalysis = useCallback(async () => {
    if (!canStartAnalysis) return;

    setIsCreating(true);

    try {
      const requestBody = {
        sourceType: "selection",
        depthMode,
        outputStyle: activeTab === "compare" ? "comparison" : outputStyle,
        bookmarkIds: Array.from(selectedIds),
      };

      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "创建失败");
      }

      const { data: result } = await response.json();
      router.push(`/synthesis/${result.id}?generate=true`);
    } catch (error) {
      clientLogger.error({ error }, "Create analysis error:");
      toast.error("创建分析失败，请重试");
    } finally {
      setIsCreating(false);
    }
  }, [
    canStartAnalysis,
    depthMode,
    outputStyle,
    selectedIds,
    activeTab,
    router,
  ]);

  // 按钮文案
  const buttonText = useMemo(() => {
    if (isCreating) return "创建中...";
    if (selectedCount === 0) {
      return activeTab === "compare"
        ? "请选择 2 篇内容"
        : "请选择 3 篇以上内容";
    }
    if (activeTab === "compare") {
      if (selectedCount < 2) return `还需选择 ${2 - selectedCount} 篇`;
      return "开始对比";
    } else {
      if (selectedCount < 3) return `还需选择 ${3 - selectedCount} 篇`;
      return "开始综述";
    }
  }, [isCreating, selectedCount, activeTab]);

  // 使用说明
  const tabHint = useMemo(() => {
    if (activeTab === "compare") {
      return "选择 2 篇内容，AI 将对比它们的异同点";
    } else if (activeTab === "synthesis") {
      return "选择 3 篇以上内容，AI 将综合萃取知识精华";
    }
    return "";
  }, [activeTab]);

  // 处理删除
  const handleDelete = useCallback((report: SynthesisReportSummary) => {
    setDeleteTarget(report);
  }, []);

  // 确认删除
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/synthesis/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("删除失败");
      }

      toast.success("删除成功");
      refetch();
    } catch (error) {
      clientLogger.error({ error }, "Delete synthesis error:");
      toast.error("删除失败，请重试");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, refetch]);

  // 取消删除
  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  // 处理重试
  const handleRetry = useCallback(
    async (reportId: string) => {
      try {
        const response = await fetch(`/api/synthesis/${reportId}/regenerate`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("重新生成失败");
        }

        toast.success("已开始重新生成");
        router.push(`/synthesis/${reportId}?generate=true`);
      } catch (error) {
        clientLogger.error({ error }, "Retry synthesis error:");
        toast.error("重新生成失败，请重试");
      }
    },
    [router],
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 标题 */}
      <div className="container max-w-4xl pt-6 pb-2">
        <h1 className="text-2xl font-bold">内容分析</h1>
      </div>

      {/* Tab 切换 */}
      <div className="container max-w-4xl pb-4">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger
              value="compare"
              className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
            >
              <GitCompare className="h-4 w-4" />
              对比分析
            </TabsTrigger>
            <TabsTrigger
              value="synthesis"
              className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
            >
              <Layers className="h-4 w-4" />
              主题综述
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
            >
              <History className="h-4 w-4" />
              历史记录
            </TabsTrigger>
          </TabsList>

          {/* 对比分析 Tab */}
          <TabsContent value="compare" className="mt-0">
            <div className="flex flex-col flex-1 -mx-4 md:-mx-8 px-4 md:px-8">
              {/* 提示说明 */}
              <Alert className="mt-4 bg-muted/50 border-muted">
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>{tabHint}</AlertDescription>
              </Alert>

              {/* 搜索框 */}
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={bookmarkSearch}
                  onChange={(e) => setBookmarkSearch(e.target.value)}
                  placeholder="搜索书签..."
                  className="pl-9"
                />
              </div>

              {/* 书签列表 */}
              <ScrollArea
                className="flex-1 mt-4 border rounded-lg"
                style={{ height: "calc(100vh - 320px)" }}
              >
                {isLoadingBookmarks ? (
                  <BookmarkListSkeleton />
                ) : bookmarks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckSquare className="h-8 w-8 mb-2" />
                    <p className="text-sm">
                      {bookmarkSearch ? "未找到匹配的书签" : "暂无书签"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {bookmarks.map((bookmark) => {
                      const isSelected = selectedIds.has(bookmark.id);
                      const isDisabled =
                        !isSelected &&
                        activeTab === "compare" &&
                        selectedCount >= maxCount;

                      return (
                        <BookmarkListItem
                          key={bookmark.id}
                          bookmark={bookmark}
                          isSelected={isSelected}
                          onToggle={() => toggleSelection(bookmark.id)}
                          disabled={isDisabled}
                        />
                      );
                    })}

                    {/* 加载更多 */}
                    {hasMore && (
                      <div className="p-3 flex justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleLoadMore}
                          disabled={isLoadingMore}
                        >
                          {isLoadingMore ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              加载中...
                            </>
                          ) : (
                            "加载更多"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* 底部操作栏 */}
              <div className="sticky bottom-0 border-t bg-background py-4 -mx-4 md:-mx-8 px-4 md:px-8 mt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      已选{" "}
                      <span className="font-medium text-foreground">
                        {selectedCount}
                      </span>{" "}
                      篇 / 最多 2 篇
                    </span>
                  </div>

                  <Button
                    onClick={handleStartAnalysis}
                    disabled={!canStartAnalysis || isCreating}
                    className="gap-2"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {buttonText}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 主题综述 Tab */}
          <TabsContent value="synthesis" className="mt-0">
            <div className="flex flex-col flex-1 -mx-4 md:-mx-8 px-4 md:px-8">
              {/* 提示说明 */}
              <Alert className="mt-4 bg-muted/50 border-muted">
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>{tabHint}</AlertDescription>
              </Alert>

              {/* 搜索框 */}
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={bookmarkSearch}
                  onChange={(e) => setBookmarkSearch(e.target.value)}
                  placeholder="搜索书签..."
                  className="pl-9"
                />
              </div>

              {/* 书签列表 */}
              <ScrollArea
                className="flex-1 mt-4 border rounded-lg"
                style={{ height: "calc(100vh - 340px)" }}
              >
                {isLoadingBookmarks ? (
                  <BookmarkListSkeleton />
                ) : bookmarks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckSquare className="h-8 w-8 mb-2" />
                    <p className="text-sm">
                      {bookmarkSearch ? "未找到匹配的书签" : "暂无书签"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {bookmarks.map((bookmark) => {
                      const isSelected = selectedIds.has(bookmark.id);

                      return (
                        <BookmarkListItem
                          key={bookmark.id}
                          bookmark={bookmark}
                          isSelected={isSelected}
                          onToggle={() => toggleSelection(bookmark.id)}
                        />
                      );
                    })}

                    {/* 加载更多 */}
                    {hasMore && (
                      <div className="p-3 flex justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleLoadMore}
                          disabled={isLoadingMore}
                        >
                          {isLoadingMore ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              加载中...
                            </>
                          ) : (
                            "加载更多"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* 底部操作栏 */}
              <div className="sticky bottom-0 border-t bg-background py-4 -mx-4 md:-mx-8 px-4 md:px-8 mt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      已选{" "}
                      <span className="font-medium text-foreground">
                        {selectedCount}
                      </span>{" "}
                      篇
                    </span>

                    {/* 高级设置 */}
                    <AdvancedSettingsPanel
                      depthMode={depthMode}
                      outputStyle={outputStyle}
                      onDepthModeChange={setDepthMode}
                      onOutputStyleChange={setOutputStyle}
                      disabled={isCreating}
                    />
                  </div>

                  <Button
                    onClick={handleStartAnalysis}
                    disabled={!canStartAnalysis || isCreating}
                    className="gap-2"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {buttonText}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 历史记录 Tab */}
          <TabsContent value="history" className="mt-0">
            <div className="space-y-4 mt-4">
              {/* 功能说明 */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <Lightbulb className="h-4 w-4 shrink-0" />
                <span className="flex items-center gap-1">
                  <GitCompare className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  对比分析：2 篇内容对比异同
                </span>
                <span className="text-muted-foreground/50">|</span>
                <span className="flex items-center gap-1">
                  <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  主题综述：3+ 篇内容综合萃取
                </span>
              </div>

              {/* 搜索和筛选 */}
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索分析报告..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={sortValue} onValueChange={setSortValue}>
                  <SelectTrigger className="w-32">
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="排序" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={depthFilter} onValueChange={setDepthFilter}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="深度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部深度</SelectItem>
                    <SelectItem value="quick">⚡ 快读</SelectItem>
                    <SelectItem value="standard">📖 标准</SelectItem>
                    <SelectItem value="academic">🎓 学术</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="generating">生成中</SelectItem>
                    <SelectItem value="pending">等待中</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 列表内容 */}
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="h-5 bg-muted rounded w-2/3" />
                          <div className="h-5 bg-muted rounded w-16" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="h-4 bg-muted rounded w-full" />
                        <div className="h-4 bg-muted rounded w-4/5" />
                        <div className="flex gap-2">
                          <div className="h-4 bg-muted rounded w-12" />
                          <div className="h-4 bg-muted rounded w-16" />
                          <div className="h-4 bg-muted rounded w-14" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-destructive/10 p-4 mb-4">
                    <FileText className="h-8 w-8 text-destructive" />
                  </div>
                  <h3 className="text-lg font-medium mb-2 text-destructive">
                    加载失败
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    请检查网络连接后重试
                  </p>
                  <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    重试
                  </Button>
                </div>
              ) : reports.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <AnalysisCard
                      key={report.id}
                      report={report}
                      onDelete={handleDelete}
                      onRetry={handleRetry}
                    />
                  ))}
                </div>
              )}

              {/* 分页信息 */}
              {data?.pagination && data.pagination.total > 0 && (
                <div className="text-center text-sm text-muted-foreground">
                  共 {data.pagination.total} 份分析报告
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && cancelDelete()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除分析报告「{deleteTarget?.title}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
