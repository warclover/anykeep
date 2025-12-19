/**
 * 收藏详情客户端组件
 * V4.2 集成来源徽章和学习反馈
 *
 * @description 展示收藏的完整信息并提供编辑、删除操作
 * - 显示来源徽章（V4.2）
 * - 移动对话框集成学习反馈
 *
 * @version 1.1.0
 * @since 2025-12-11
 */

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Edit,
  Trash2,
  Folder,
  FolderInput,
  Share2,
  Check,
  X,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch";
import { SourceBadge, inferSourceType } from "./source-badge";
import type { SourceInfo } from "./source-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EditBookmarkDialog } from "@/components/bookmark/edit-bookmark-dialog";
import { MoveToFolderDialog } from "@/components/bookmark/move-to-folder-dialog";
import { SummaryRenderer } from "@/components/bookmark/summary-renderer";
import { BookmarkRating } from "@/components/bookmark/bookmark-rating";
import {
  VisionInsights,
  VisionAnalysisTrigger,
} from "@/components/bookmark/vision-insights";
import { RelatedBookmarksV2Lazy } from "@/components/bookmark/related-bookmarks-lazy";
import { useVisionAnalysis } from "@/hooks/use-vision-analysis";
import type { BookmarkVisionData } from "@/types/vision";
import { hasVisionData } from "@/types/vision";
import { UsageTagInlineEditor } from "@/components/bookmark/usage-tag-inline-editor";
import { ContentTypeBadge } from "@/components/bookmark/content-type-badge";
import type { ContentType } from "@/lib/classification/content-type-detector";
import type { Bookmark, CustomUsageTag } from "@/types/supabase";
import { useCustomUsageTags } from "@/hooks/use-custom-usage-tags";
import { cn } from "@/lib/utils";
import { getPlatformConfig } from "@/lib/platform-utils";
import { formatFriendlyDate } from "@/lib/utils/date-utils";
import { separateUserTagsExtended } from "@/lib/constants/usage-tags";
// V4.2.1: 快照功能（懒加载 + 功能开关）
import { SnapshotSectionLazy } from "@/components/snapshot";

interface BookmarkDetailClientProps {
  bookmark: Bookmark & {
    folders?: { id: number; name: string } | null;
    /** Optional source ID for future knowledge linking (not yet in database) */
    source_id?: string | null;
  };
  folderPath?: Array<{ id: number; name: string }>;
  /** V4.2.22: SSR 预取的自定义用途标签，消除客户端加载延迟 */
  initialCustomUsageTags?: CustomUsageTag[];
}

export function BookmarkDetailClient({
  bookmark,
  folderPath = [],
  initialCustomUsageTags = [],
}: BookmarkDetailClientProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const platformConfig = getPlatformConfig(bookmark.platform);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  // V6.0新增：评级和锁定状态
  const [rating, setRating] = useState(bookmark.rating || 0);
  const [isLocked, setIsLocked] = useState(bookmark.is_locked || false);
  const [isMarkedForDeletion, setIsMarkedForDeletion] = useState(
    bookmark.is_marked_for_deletion || false,
  );

  // V10.0新增：视觉分析
  const {
    data: newVisionData,
    isLoading: isAnalyzingVision,
    analyze: analyzeVision,
  } = useVisionAnalysis();

  // 使用 mounted 状态避免 Hydration 错误
  // 视觉数据只在客户端挂载后才计算，确保服务端和客户端初始渲染一致
  const [mounted, setMounted] = useState(false);
  const [existingVisionData, setExistingVisionData] =
    useState<BookmarkVisionData | null>(null);

  useEffect(() => {
    setMounted(true);
    // 仅在客户端计算视觉数据
    if (hasVisionData(bookmark.ai_vision_data)) {
      setExistingVisionData(
        bookmark.ai_vision_data as unknown as BookmarkVisionData,
      );
    }
  }, [bookmark.ai_vision_data]);

  // 使用已有的视觉数据或新分析的数据
  const visionData = newVisionData || existingVisionData;

  // 判断是否为浏览器书签
  const isBrowserPlatform = [
    "BROWSER_CHROME",
    "BROWSER_EDGE",
    "BROWSER_FIREFOX",
    "BROWSER_SAFARI",
  ].includes(bookmark.platform);

  // 防止重复调用标记已读 API
  const hasMarkedAsRead = useRef(false);

  // 访问详情页时自动标记已读
  // V4.2.23: 移除 router.refresh()，避免页面二次渲染
  // 首页通过 SWR 后台刷新获取最新已读状态
  useEffect(() => {
    const markAsRead = async () => {
      // 如果已读或已经调用过，则跳过
      if (bookmark.is_read || hasMarkedAsRead.current) {
        return;
      }

      hasMarkedAsRead.current = true;

      try {
        await fetch(`/api/bookmarks/${bookmark.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isRead: true }),
        });
        // V4.2.23: 静默成功，不调用 router.refresh()
        // 这是后台静默操作，无需触发页面刷新
        // 用户返回首页时，SWR 会自动获取最新状态
      } catch {
        // 静默失败，不阻塞用户体验
      }
    };

    markAsRead();
  }, [bookmark.id, bookmark.is_read]);

  // V4.2.24: 自定义用途标签 - SWR 缓存 + SSR 初始数据
  // fallbackData 作为初始值，避免客户端首次请求
  // 后续通过 SWR 缓存去重，跨组件共享状态
  const { customTags: customUsageTags } = useCustomUsageTags({
    initialData: initialCustomUsageTags,
  });

  // 分离用途标签和普通标签（确保传入数组，避免 null/undefined）
  const { usageTags, regularTags } = separateUserTagsExtended(
    bookmark.user_tags ?? [],
    customUsageTags,
  );

  // V4.2: 构建来源信息
  const sourceInfo = useMemo((): SourceInfo | null => {
    // 优先使用 source_id（如果有）
    if (bookmark.source_id) {
      return {
        sourceId: bookmark.source_id,
        sourceName: bookmark.source_name || undefined,
        domain: bookmark.url ? new URL(bookmark.url).hostname : undefined,
        sourceType: inferSourceType(bookmark.source_id),
      };
    }
    // 否则从 URL 推断
    if (bookmark.url) {
      try {
        const domain = new URL(bookmark.url).hostname;
        return {
          sourceId: domain,
          sourceName: bookmark.source_name || domain,
          domain: domain,
          sourceType: inferSourceType(domain),
        };
      } catch {
        return null;
      }
    }
    return null;
  }, [bookmark.source_id, bookmark.source_name, bookmark.url]);

  // 标签内联编辑状态
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editedTags, setEditedTags] = useState("");
  const [isSavingTags, setIsSavingTags] = useState(false);

  // 笔记内联编辑状态
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const handleBack = () => {
    router.push("/home");
  };

  const handleOpenOriginal = () => {
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
  };

  const handleEdit = () => {
    setShowEditDialog(true);
  };

  const handleShare = async () => {
    const shareData = {
      title: bookmark.title,
      text: `${bookmark.title}${bookmark.ai_summary ? "\n\n" + bookmark.ai_summary : ""}`,
      url: bookmark.url,
    };

    // 优先使用 Web Share API（移动端原生分享）
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success("分享成功");
      } catch (error) {
        // 用户取消分享
        if (error instanceof Error && error.name !== "AbortError") {
          toast.error("分享失败");
        }
      }
    } else {
      // 降级到复制链接
      try {
        await navigator.clipboard.writeText(bookmark.url);
        toast.success("链接已复制到剪贴板");
      } catch {
        toast.error("复制失败，请手动复制");
      }
    }
  };

  // V6.0新增：处理评级变更（乐观更新）
  const handleRatingChange = async (newRating: number) => {
    const previousRating = rating;
    // 乐观更新：立即更新 UI
    setRating(newRating);

    try {
      const res = await fetchWithAbort(`/api/bookmarks/${bookmark.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rating: newRating }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "评级更新失败");
      }

      // 成功：静默处理，不显示 toast
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      // 失败：回滚状态并提示
      setRating(previousRating);
      toast.error(error instanceof Error ? error.message : "评级更新失败");
    }
  };

  // V6.0新增：处理锁定切换（乐观更新）
  const handleLockToggle = async () => {
    const previousState = isLocked;
    const newLockState = !isLocked;
    // 乐观更新：立即更新 UI
    setIsLocked(newLockState);

    try {
      const res = await fetchWithAbort(`/api/bookmarks/${bookmark.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isLocked: newLockState }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "操作失败");
      }
      // 成功：静默处理
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      // 失败：回滚状态并提示
      setIsLocked(previousState);
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  // V6.0新增：处理删除标记切换（乐观更新）
  const handleMarkerToggle = async () => {
    const previousState = isMarkedForDeletion;
    const newMarkerState = !isMarkedForDeletion;
    // 乐观更新：立即更新 UI
    setIsMarkedForDeletion(newMarkerState);

    try {
      const res = await fetchWithAbort(`/api/bookmarks/${bookmark.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isMarkedForDeletion: newMarkerState }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "操作失败");
      }
      // 成功：静默处理
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      // 失败：回滚状态并提示
      setIsMarkedForDeletion(previousState);
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    // V6.0新增：锁定检查
    if (isLocked) {
      toast.error("此收藏已锁定，无法删除");
      return;
    }

    // 二次确认
    if (!confirm("确定要删除这条收藏吗？删除后无法恢复。")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetchWithAbort(`/api/bookmarks/${bookmark.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "删除失败");
      }

      toast.success("删除成功");
      router.push("/home");
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        setIsDeleting(false);
        return;
      }
      toast.error(error instanceof Error ? error.message : "删除失败");
      setIsDeleting(false);
    }
  };

  const handleEditTags = () => {
    setIsEditingTags(true);
    setEditedTags(bookmark.user_tags?.join(", ") || "");
  };

  const handleCancelEditTags = () => {
    setIsEditingTags(false);
    setEditedTags("");
  };

  const handleSaveTags = async () => {
    if (isSavingTags) return;

    setIsSavingTags(true);
    try {
      // 解析标签字符串
      const tags = editedTags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      // 调用更新 API
      const res = await fetchWithAbort(`/api/bookmarks/${bookmark.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userTags: tags.length > 0 ? tags : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "更新标签失败");
      }

      toast.success("标签更新成功");
      setIsEditingTags(false);
      router.refresh();
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : "更新标签失败");
    } finally {
      setIsSavingTags(false);
    }
  };

  const handleEditNotes = () => {
    setIsEditingNotes(true);
    setEditedNotes(bookmark.notes || "");
  };

  const handleCancelEditNotes = () => {
    setIsEditingNotes(false);
    setEditedNotes("");
  };

  const handleSaveNotes = async () => {
    if (isSavingNotes) return;

    setIsSavingNotes(true);
    try {
      // 调用更新 API
      const res = await fetchWithAbort(`/api/bookmarks/${bookmark.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: editedNotes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "更新备注失败");
      }

      toast.success("备注更新成功");
      setIsEditingNotes(false);
      router.refresh();
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : "更新备注失败");
    } finally {
      setIsSavingNotes(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* 内容区域 */}
      <div className="flex-1 overflow-auto px-1 md:px-2 pt-1 pb-4">
        <div className="max-w-5xl mx-auto">
          {/* 主要信息卡片 */}
          <Card>
            <CardHeader className="pb-1">
              {/* V4.2.24: 3行紧凑布局 */}
              <div className="space-y-2">
                {/* === 行1：标题 + 核心元数据 === */}
                <div>
                  {/* 上排：标题 + 平台/类型徽章 */}
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-tight">
                      {bookmark.title}
                    </h1>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* 平台徽章 */}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md",
                          isBrowserPlatform
                            ? "border border-white/20"
                            : platformConfig.bgColor,
                        )}
                        style={
                          isBrowserPlatform
                            ? {
                                backgroundColor: platformConfig.brandColor,
                                color: "#FFFFFF",
                              }
                            : undefined
                        }
                      >
                        {isBrowserPlatform && (
                          <Globe className="size-3 flex-shrink-0" />
                        )}
                        <span>{platformConfig.name}</span>
                      </span>
                      {/* 内容类型徽章 */}
                      {bookmark.ai_content_type && (
                        <ContentTypeBadge
                          type={bookmark.ai_content_type as ContentType}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>

                  {/* 下排：元数据 + 评级/锁定/删除标记 */}
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    {/* 左侧：文件夹 · 来源 · 作者 · 时间 */}
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      {/* 文件夹 */}
                      {bookmark.folders && folderPath.length > 0 && (
                        <>
                          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Folder className="size-3" />
                            <span>
                              {folderPath[folderPath.length - 1].name}
                            </span>
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">
                            ·
                          </span>
                        </>
                      )}
                      {/* 来源徽章 */}
                      {sourceInfo && (
                        <>
                          <SourceBadge
                            source={sourceInfo}
                            size="sm"
                            showTooltip={true}
                          />
                          <span className="text-gray-300 dark:text-gray-600">
                            ·
                          </span>
                        </>
                      )}
                      {/* 作者 */}
                      {bookmark.author &&
                        bookmark.author !== bookmark.source_name && (
                          <>
                            <span>{bookmark.author}</span>
                            <span className="text-gray-300 dark:text-gray-600">
                              ·
                            </span>
                          </>
                        )}
                      {/* 发表时间 */}
                      {bookmark.publish_time && (
                        <>
                          <span>
                            发表 {formatFriendlyDate(bookmark.publish_time)}
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">
                            ·
                          </span>
                        </>
                      )}
                      {/* 收藏时间 */}
                      <span className="text-gray-400">
                        收藏{" "}
                        {formatFriendlyDate(bookmark.created_at || new Date())}
                      </span>
                    </div>

                    {/* 右侧：评级 + 锁定 + 删除标记 */}
                    <div className="flex-shrink-0">
                      <BookmarkRating
                        rating={rating}
                        isLocked={isLocked}
                        isMarkedForDeletion={isMarkedForDeletion}
                        onRatingChange={handleRatingChange}
                        onLockToggle={handleLockToggle}
                        onMarkerToggle={handleMarkerToggle}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* === 行2：标签区（AI标签 + 用途标签） === */}
                <div className="space-y-1.5">
                  {/* AI 标签行 */}
                  {bookmark.ai_tags && bookmark.ai_tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-pink-50 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-700 text-pink-600 dark:text-pink-300 font-medium text-xs">
                        AI 标签
                      </span>
                      {bookmark.ai_tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 用途标签行 */}
                  <UsageTagInlineEditor
                    bookmarkId={bookmark.id}
                    bookmarkUrl={bookmark.url}
                    selectedTags={usageTags}
                    regularTags={regularTags}
                    onSaveSuccess={() => router.refresh()}
                    compact={true}
                  />
                </div>

                {/* === 行3：操作栏 === */}
                <div className="flex items-center justify-between gap-2">
                  {/* 左侧：返回 + 主要操作 */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBack}
                      className="h-8 px-2"
                    >
                      <ArrowLeft className="size-4" />
                      <span className="ml-1">返回</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenOriginal}
                      className="h-8"
                    >
                      <ExternalLink className="size-3.5" />
                      <span className="ml-1.5">打开原文</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleShare}
                      className="h-8 px-2"
                    >
                      <Share2 className="size-3.5" />
                      <span className="ml-1 hidden sm:inline">分享</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEdit}
                      className="h-8 px-2"
                    >
                      <Edit className="size-3.5" />
                      <span className="ml-1 hidden sm:inline">编辑</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMoveDialog(true)}
                      className="h-8 px-2"
                    >
                      <FolderInput className="size-3.5" />
                      <span className="ml-1 hidden sm:inline">移动到</span>
                    </Button>
                  </div>

                  {/* 右侧：删除按钮（危险操作分离） */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting || isLocked}
                    className={cn(
                      "h-8 px-2",
                      isLocked
                        ? "opacity-50 cursor-not-allowed"
                        : "text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20",
                    )}
                  >
                    <Trash2 className="size-3.5" />
                    <span className="ml-1">
                      {isDeleting ? "删除中..." : "删除"}
                    </span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <Separator className="my-0" />

            <CardContent className="pt-1 space-y-5">
              {/* AI 摘要（无标题，直接显示内容） */}
              {bookmark.ai_summary && (
                <>
                  <SummaryRenderer summary={bookmark.ai_summary} />
                  <Separator />
                </>
              )}

              {/* V10.0新增：视觉洞察 */}
              {/* 仅在客户端挂载后渲染，避免 Hydration 错误 */}
              {mounted && (visionData || bookmark.cover_url) && (
                <>
                  <div>
                    {visionData ? (
                      <VisionInsights
                        data={visionData}
                        showHeader={true}
                        defaultExpanded={true}
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            视觉分析
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            使用 AI 分析图片内容，提取文字和视觉特征
                          </p>
                        </div>
                        <VisionAnalysisTrigger
                          isAnalyzing={isAnalyzingVision}
                          onAnalyze={() => analyzeVision(bookmark.id)}
                        />
                      </div>
                    )}
                  </div>
                  <Separator />
                </>
              )}

              {/* 用户标签（只显示普通标签，用途标签已在顶部展示） */}
              {regularTags.length > 0 || isEditingTags ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        我的标签
                      </h3>
                      {!isEditingTags && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleEditTags}
                        >
                          <Edit className="size-3 mr-1" />
                          编辑
                        </Button>
                      )}
                    </div>
                    {isEditingTags ? (
                      <div className="space-y-3">
                        <Input
                          value={editedTags}
                          onChange={(e) => setEditedTags(e.target.value)}
                          placeholder="输入标签，用逗号或空格分隔"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveTags}
                            disabled={isSavingTags}
                          >
                            <Check className="size-3 mr-1" />
                            {isSavingTags ? "保存中..." : "保存"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEditTags}
                            disabled={isSavingTags}
                          >
                            <X className="size-3 mr-1" />
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {regularTags.map((tag) => (
                          <Badge key={tag} variant="default">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Separator />
                </>
              ) : null}

              {/* 备注 */}
              {bookmark.notes || isEditingNotes ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        我的备注
                      </h3>
                      {!isEditingNotes && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleEditNotes}
                        >
                          <Edit className="size-3 mr-1" />
                          编辑
                        </Button>
                      )}
                    </div>
                    {isEditingNotes ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editedNotes}
                          onChange={(e) => setEditedNotes(e.target.value)}
                          placeholder="输入备注..."
                          rows={4}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveNotes}
                            disabled={isSavingNotes}
                          >
                            <Check className="size-3 mr-1" />
                            {isSavingNotes ? "保存中..." : "保存"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEditNotes}
                            disabled={isSavingNotes}
                          >
                            <X className="size-3 mr-1" />
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                        {bookmark.notes}
                      </p>
                    )}
                  </div>
                  <Separator />
                </>
              ) : null}

              {/* Phase 2: 知识关联推荐 (V4.2.24: 视口懒加载优化) */}
              <RelatedBookmarksV2Lazy
                bookmarkId={bookmark.id}
                defaultExpanded={true}
                limit={5}
                minStrength={0.3}
              />

              {/* V4.2.1: 网页快照 */}
              <SnapshotSectionLazy
                bookmarkId={bookmark.id}
                bookmarkUrl={bookmark.url}
                defaultExpanded={false}
              />

              {/* 处理状态：仅当状态为 PROCESSING 且 AI 内容尚未生成时显示 */}
              {bookmark.status === "PROCESSING" &&
                !bookmark.ai_tags?.length &&
                !bookmark.ai_summary && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <span className="animate-pulse text-lg">●</span>
                    <span className="text-sm">
                      AI 处理中，稍后将自动生成摘要和标签...
                    </span>
                  </div>
                )}
              {bookmark.status === "FAILED" && (
                <div className="text-sm text-red-500 dark:text-red-400">
                  AI 处理失败，部分信息可能不完整
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 编辑收藏对话框 */}
      <EditBookmarkDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        bookmark={bookmark}
      />

      {/* 移动到文件夹对话框 - V4.2: 传递学习所需的来源信息 */}
      <MoveToFolderDialog
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
        bookmark={{
          ...bookmark,
          // V4.2: 传递学习所需的额外信息
          title: bookmark.title,
          tags: bookmark.user_tags || bookmark.ai_tags || undefined,
          source_id: bookmark.source_id || sourceInfo?.sourceId || undefined,
          source_name:
            bookmark.source_name || sourceInfo?.sourceName || undefined,
        }}
        enableLearning={true}
      />
    </div>
  );
}
