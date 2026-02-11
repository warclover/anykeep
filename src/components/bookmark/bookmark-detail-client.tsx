/**
 * 收藏详情客户端组件
 * V4.2 集成来源徽章和学习反馈
 *
 * @description 展示收藏的完整信息并提供编辑、删除操作
 * - 显示来源徽章（V4.2）
 * - 移动对话框集成学习反馈
 * - V4.2.30: 乐观更新优化，移除 router.refresh() 提升性能
 * - V4.2.31: Phase 2.3.7 组件拆分，提取 Hook 和子组件
 * - V5.6: P3 非首屏组件懒加载（对话框 + AI 组件 + 视觉分析）
 * - V5.6: P4 快照状态服务端预取，消除客户端 useEffect 请求
 *
 * @version 1.4.0
 * @since 2025-12-11
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
// V5.7: 按需导入图标，避免加载整个 lucide-react 图标库（~50KB gzipped）
import Folder from "lucide-react/dist/esm/icons/folder";
import Globe from "lucide-react/dist/esm/icons/globe";
import { toast } from "sonner";
import { SourceBadge, inferSourceType } from "./source-badge";
import type { SourceInfo } from "./source-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SummaryRenderer } from "@/components/bookmark/summary-renderer";
import { BookmarkRating } from "@/components/bookmark/bookmark-rating";
import { RelatedBookmarksV2Lazy } from "@/components/bookmark/related-bookmarks-lazy";
import { UnifiedTagsSection } from "@/components/bookmark/unified-tags-section";
import { ContentTypeBadge } from "@/components/bookmark/content-type-badge";
import type { ContentType } from "@/lib/classification/content-type-detector";
import type { Bookmark, CustomUsageTag, Platform } from "@/types/supabase";
import { useCustomUsageTags } from "@/hooks/data";
import { cn } from "@/lib/utils";
import { getPlatformConfig } from "@/lib/platform-utils";
import { formatFriendlyDate } from "@/lib/utils/date-utils";
import { separateUserTagsExtended } from "@/lib/constants/usage-tags";
// V4.2.1: 快照功能（懒加载 + 功能开关）
import { SnapshotSectionLazy } from "@/components/snapshot";
// V4.2.2: 微信文章功能（懒加载 + Feature Flag）
import { lazy, Suspense } from "react";
import { useWechatArticleFeature } from "@/lib/feature-flags";
import { Skeleton } from "@/components/ui/skeleton";
import { SilentErrorBoundary } from "@/components/ui/lazy-error-boundary";
// V5.7: AISmartSummary 改为懒加载，减少首屏模块数（~500-1000 模块）
const AISmartSummary = lazy(() =>
  import("@/components/ai").then((m) => ({
    default: m.AISmartSummary,
  })),
);
import { useOptionalUser } from "@/contexts/user-context";
// Phase 2.3.7: 拆分组件
import { useDetailMutations } from "./hooks/use-detail-mutations";
import { DetailActionBar } from "./detail-action-bar";
import { DetailTagsEditor } from "./detail-tags-editor";
import { DetailNotesEditor } from "./detail-notes-editor";
// V5.7: 对话框集合 + AI 内容区提取为独立组件，减少主组件模块数
import { DetailDialogs } from "./detail-dialogs";
import { DetailAIContent } from "./detail-ai-content";

// V5.7: 微信文章区块（仅条件渲染时加载）
const WechatArticleSectionLazy = lazy(() =>
  import("@/components/wechat-article").then((m) => ({
    default: m.WechatArticleSection,
  })),
);

interface BookmarkDetailClientProps {
  bookmark: Bookmark & {
    folders?: { id: number; name: string } | null;
    /** Optional source ID for future knowledge linking (not yet in database) */
    source_id?: string | null;
  };
  folderPath?: Array<{ id: number; name: string }>;
  /** V4.2.22: SSR 预取的自定义用途标签，消除客户端加载延迟 */
  initialCustomUsageTags?: CustomUsageTag[];
  /** V5.6 P4: 服务端预取的快照状态，消除客户端 useEffect 请求 */
  initialHasSnapshot?: boolean;
}

export function BookmarkDetailClient({
  bookmark,
  folderPath = [],
  initialCustomUsageTags = [],
  initialHasSnapshot = false,
}: BookmarkDetailClientProps) {
  const router = useRouter();
  const platformConfig = getPlatformConfig(bookmark.platform ?? "UNKNOWN");
  // 获取用户信息（用于 AI 助手）
  const userContext = useOptionalUser();
  const userId = userContext?.user?.id;

  // 对话框状态
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showMonitorDialog, setShowMonitorDialog] = useState(false);
  // 文章快照状态
  // V5.6 P4: 使用服务端预取的初始值，消除客户端 useEffect 请求
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [hasSnapshot, setHasSnapshot] = useState(initialHasSnapshot);

  // Phase 2.3.7: 使用提取的 mutations hook
  const {
    rating,
    isLocked,
    isMarkedForDeletion,
    localUserTags,
    localNotes,
    localSummary,
    isDeleting,
    // 标签编辑
    isEditingTags,
    editedTags,
    isSavingTags,
    setEditedTags,
    handleEditTags,
    handleCancelEditTags,
    handleSaveTags,
    // 备注编辑
    isEditingNotes,
    editedNotes,
    isSavingNotes,
    setEditedNotes,
    handleEditNotes,
    handleCancelEditNotes,
    handleSaveNotes,
    // 操作
    handleRatingChange,
    handleLockToggle,
    handleMarkerToggle,
    handleDelete,
    setLocalUserTags,
    setLocalSummary,
  } = useDetailMutations({
    bookmarkId: bookmark.id,
    initialRating: bookmark.rating || 0,
    initialIsLocked: bookmark.is_locked || false,
    initialIsMarkedForDeletion: bookmark.is_marked_for_deletion || false,
    initialUserTags: bookmark.user_tags,
    initialNotes: bookmark.notes,
    initialSummary: bookmark.ai_summary,
    initialIsRead: bookmark.is_read || false,
  });

  // 判断是否为浏览器书签
  const isBrowserPlatform = [
    "BROWSER_CHROME",
    "BROWSER_EDGE",
    "BROWSER_FIREFOX",
    "BROWSER_SAFARI",
  ].includes(bookmark.platform ?? "");

  // V4.2.2: 判断是否为微信公众号文章并且功能开关已启用
  const isWechatArticleEnabled = useWechatArticleFeature();
  const isWechatPlatform = bookmark.platform === "WECHAT_OFFICIAL_ACCOUNT";
  const showWechatArticle = isWechatArticleEnabled && isWechatPlatform;

  // V5.6 P4: checkSnapshot 已移至服务端预取（page.tsx Promise.all）
  // 通过 initialHasSnapshot prop 传入，消除客户端额外网络请求

  // 创建文章快照
  const handleSnapshot = useCallback(async () => {
    try {
      setIsSnapshotting(true);
      const response = await fetch("/api/wechat-article/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarkId: bookmark.id }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("服务器响应异常，请稍后重试");
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "创建快照失败");
      }

      setHasSnapshot(true);
      toast.success("文章快照获取成功");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建快照失败");
    } finally {
      setIsSnapshotting(false);
    }
  }, [bookmark.id]);

  // V4.2.24: 自定义用途标签 - SWR 缓存 + SSR 初始数据
  // fallbackData 作为初始值，避免客户端首次请求
  // 后续通过 SWR 缓存去重，跨组件共享状态
  const { customTags: customUsageTags } = useCustomUsageTags({
    initialData: initialCustomUsageTags,
  });

  // 分离用途标签和普通标签（确保传入数组，避免 null/undefined）
  // V4.2.30: 使用本地状态 localUserTags，支持乐观更新
  const { usageTags, regularTags } = separateUserTagsExtended(
    localUserTags ?? [],
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

  // Phase 2.3.7: 简化的本地处理函数
  const handleBack = () => {
    router.push("/home");
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
                      {bookmark.title ?? ""}
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
                      {/* 收藏属性标签 */}
                      <span className="inline-flex items-center justify-center w-[4.5rem] px-0 py-0.5 rounded bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-700 text-cyan-600 dark:text-cyan-300 font-medium text-xs flex-shrink-0 box-border">
                        收藏属性
                      </span>
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

                {/* === 行2：标签区（AI标签 + 用途标签统一显示） === */}
                <UnifiedTagsSection
                  aiTags={bookmark.ai_tags || []}
                  bookmarkId={bookmark.id}
                  bookmarkUrl={bookmark.url}
                  platform={
                    (bookmark.platform ?? undefined) as Platform | undefined
                  }
                  selectedUsageTags={usageTags}
                  regularTags={regularTags}
                  onSaveSuccess={(newUsageTags) => {
                    // V4.2.30: 乐观更新 - 合并新用途标签与普通标签
                    const newUserTags = [...newUsageTags, ...regularTags];
                    setLocalUserTags(
                      newUserTags.length > 0 ? newUserTags : null,
                    );
                  }}
                />

                {/* === 行3：操作栏 === */}
                <DetailActionBar
                  title={bookmark.title ?? ""}
                  url={bookmark.url}
                  aiSummary={localSummary}
                  isLocked={isLocked}
                  isDeleting={isDeleting}
                  userId={userId}
                  onBack={handleBack}
                  onEdit={() => setShowEditDialog(true)}
                  onMoveToFolder={() => setShowMoveDialog(true)}
                  onDelete={handleDelete}
                  onOpenAIPanel={() => setShowAIPanel(true)}
                  onAddMonitor={() => setShowMonitorDialog(true)}
                />
              </div>
            </CardHeader>

            <Separator className="my-0" />

            <CardContent className="pt-1 space-y-5">
              {/* AI 智能摘要（支持编辑和重新生成） V5.7: 懒加载 */}
              {userId ? (
                <>
                  <Suspense
                    fallback={<Skeleton className="h-24 w-full rounded-lg" />}
                  >
                    <AISmartSummary
                      bookmarkId={bookmark.id}
                      existingSummary={localSummary}
                      bookmarkTitle={bookmark.title ?? ""}
                      url={bookmark.url}
                      onSummaryUpdate={(newSummary) =>
                        setLocalSummary(newSummary)
                      }
                      readonly={false}
                      onSnapshot={handleSnapshot}
                      isSnapshotting={isSnapshotting}
                      hasSnapshot={hasSnapshot}
                    />
                  </Suspense>
                  <Separator />
                </>
              ) : (
                /* 未登录时使用原始摘要渲染 */
                localSummary && (
                  <>
                    <SummaryRenderer summary={localSummary} />
                    <Separator />
                  </>
                )
              )}

              {/* V5.7: AI 内容区提取为独立组件（快捷操作/聊天/视觉/相关内容） */}
              <DetailAIContent
                bookmark={bookmark}
                userId={userId}
                localUserTags={localUserTags}
                setLocalUserTags={setLocalUserTags}
                onOpenAIPanel={() => setShowAIPanel(true)}
              />

              {/* 用户标签（只显示普通标签，用途标签已在顶部展示） */}
              {(regularTags.length > 0 || isEditingTags) && (
                <>
                  <DetailTagsEditor
                    regularTags={regularTags}
                    isEditing={isEditingTags}
                    editedTags={editedTags}
                    isSaving={isSavingTags}
                    onEditedTagsChange={setEditedTags}
                    onEdit={handleEditTags}
                    onCancel={handleCancelEditTags}
                    onSave={handleSaveTags}
                  />
                  <Separator />
                </>
              )}

              {/* 备注 - Phase 2.3.7: 使用 DetailNotesEditor 组件 */}
              {(localNotes || isEditingNotes) && (
                <>
                  <DetailNotesEditor
                    notes={localNotes}
                    isEditing={isEditingNotes}
                    editedNotes={editedNotes}
                    isSaving={isSavingNotes}
                    onEditedNotesChange={setEditedNotes}
                    onEdit={handleEditNotes}
                    onCancel={handleCancelEditNotes}
                    onSave={handleSaveNotes}
                  />
                  <Separator />
                </>
              )}

              {/* Phase 2: 知识关联推荐 (V4.2.24: 视口懒加载优化) */}
              <RelatedBookmarksV2Lazy
                bookmarkId={bookmark.id}
                defaultExpanded={true}
                limit={5}
                minStrength={0.3}
              />

              {/* V4.2.1: 网页快照（微信文章不显示，使用专用微信快照组件） */}
              {!showWechatArticle && (
                <SnapshotSectionLazy
                  bookmarkId={bookmark.id}
                  bookmarkUrl={bookmark.url}
                  defaultExpanded={false}
                />
              )}

              {/* V4.2.2: 微信文章完整内容（仅微信公众号平台 + Feature Flag 启用时显示） */}
              {showWechatArticle && (
                <SilentErrorBoundary>
                  <Suspense
                    fallback={<Skeleton className="h-64 w-full rounded-lg" />}
                  >
                    <WechatArticleSectionLazy
                      key={`wechat-article-${bookmark.id}-${hasSnapshot}`}
                      bookmarkId={bookmark.id}
                      bookmarkUrl={bookmark.url}
                      defaultExpanded={false}
                    />
                  </Suspense>
                </SilentErrorBoundary>
              )}

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

      {/* V5.7: 对话框集合提取为独立组件 */}
      <DetailDialogs
        bookmark={bookmark}
        userId={userId}
        localUserTags={localUserTags}
        sourceInfo={sourceInfo}
        showEditDialog={showEditDialog}
        setShowEditDialog={setShowEditDialog}
        showMoveDialog={showMoveDialog}
        setShowMoveDialog={setShowMoveDialog}
        showAIPanel={showAIPanel}
        setShowAIPanel={setShowAIPanel}
        showMonitorDialog={showMonitorDialog}
        setShowMonitorDialog={setShowMonitorDialog}
      />
    </div>
  );
}
