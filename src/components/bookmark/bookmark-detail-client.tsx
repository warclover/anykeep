/**
 * 收藏详情客户端组件
 * 展示收藏的完整信息并提供编辑、删除操作
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Edit,
  Trash2,
  Folder,
  Calendar,
  User,
  Share2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EditBookmarkDialog } from "@/components/bookmark/edit-bookmark-dialog";
import type { Bookmark } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { getPlatformConfig } from "@/lib/platform-utils";
import { formatFriendlyDate } from "@/lib/utils/date-utils";
import { generatePlaceholderImage } from "@/lib/utils/placeholder-image";
import { getProxiedImageUrl } from "@/lib/utils/image-proxy";

interface BookmarkDetailClientProps {
  bookmark: Bookmark & {
    folders?: { id: number; name: string } | null;
  };
}

export function BookmarkDetailClient({ bookmark }: BookmarkDetailClientProps) {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const platformConfig = getPlatformConfig(bookmark.platform);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // 防止重复调用标记已读 API
  const hasMarkedAsRead = useRef(false);

  // 访问详情页时自动标记已读
  useEffect(() => {
    const markAsRead = async () => {
      // 如果已读或已经调用过，则跳过
      if (bookmark.is_read || hasMarkedAsRead.current) {
        return;
      }

      hasMarkedAsRead.current = true;

      try {
        const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isRead: true }),
        });

        if (res.ok) {
          // 静默成功，不显示 toast（避免干扰用户阅读）
          router.refresh();
        }
      } catch {
        // 静默失败，不阻塞用户体验
      }
    };

    markAsRead();
  }, [bookmark.id, bookmark.is_read, router]);

  // 标签内联编辑状态
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editedTags, setEditedTags] = useState("");
  const [isSavingTags, setIsSavingTags] = useState(false);

  // 笔记内联编辑状态
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // 图片预览状态
  const [showImageLightbox, setShowImageLightbox] = useState(false);

  // 生成封面图（真实封面或占位符，微信图片使用代理）
  const coverImage =
    getProxiedImageUrl(bookmark.cover_url) ||
    generatePlaceholderImage(bookmark.title, bookmark.platform);

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

  const handleDelete = async () => {
    if (isDeleting) return;

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
      {/* 顶部操作栏 */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-3 md:py-4">
        <div className="flex items-center justify-between gap-2">
          {/* 返回按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="shrink-0"
          >
            <ArrowLeft className="size-4 md:mr-2" />
            <span className="hidden md:inline">返回</span>
          </Button>

          {/* 操作按钮组 - 移动端紧凑布局 */}
          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenOriginal}
              className="px-2 md:px-3"
            >
              <ExternalLink className="size-4 md:mr-2" />
              <span className="hidden md:inline">打开原文</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="px-2 md:px-3"
            >
              <Share2 className="size-4 md:mr-2" />
              <span className="hidden md:inline">分享</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="px-2 md:px-3"
            >
              <Edit className="size-4 md:mr-2" />
              <span className="hidden md:inline">编辑</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-2 md:px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="size-4 md:mr-2" />
              <span className="hidden md:inline">
                {isDeleting ? "删除中..." : "删除"}
              </span>
            </Button>
          </div>
        </div>
      </header>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 封面图 */}
          <div
            className="relative aspect-video overflow-hidden rounded-lg shadow-lg cursor-pointer group"
            onClick={() => setShowImageLightbox(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt={bookmark.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            {/* 平台标识 */}
            <div
              className={cn(
                "absolute top-4 left-4 px-3 py-1.5 text-sm font-medium text-white rounded",
                platformConfig.bgColor,
              )}
            >
              {platformConfig.name}
            </div>
            {/* 放大提示 */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-4 py-2 rounded-full text-white text-sm">
                点击查看大图
              </div>
            </div>
          </div>

          {/* 主要信息卡片 */}
          <Card>
            <CardHeader>
              {/* 标题 */}
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {bookmark.title}
              </h1>

              {/* 元信息 */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                {bookmark.source_name && (
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {bookmark.source_name}
                  </span>
                )}
                {bookmark.author &&
                  bookmark.author !== bookmark.source_name && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">
                        |
                      </span>
                      <div className="flex items-center gap-1">
                        <User className="size-4" />
                        <span>{bookmark.author}</span>
                      </div>
                    </>
                  )}
                {bookmark.publish_time && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="size-4" />
                      <span>{formatFriendlyDate(bookmark.publish_time)}</span>
                    </div>
                  </>
                )}
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <div className="flex items-center gap-1 text-gray-400">
                  <Calendar className="size-4" />
                  <span>收藏 {formatFriendlyDate(bookmark.created_at)}</span>
                </div>
                {bookmark.folders && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <Folder className="size-4" />
                      <span>{bookmark.folders.name}</span>
                    </div>
                  </>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* AI 摘要 */}
              {bookmark.ai_summary && (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      AI 摘要
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                      {bookmark.ai_summary}
                    </p>
                  </div>
                  <Separator />
                </>
              )}

              {/* AI 标签 */}
              {bookmark.ai_tags && bookmark.ai_tags.length > 0 && (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      AI 标签
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className="bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700 text-pink-600 dark:text-pink-300"
                      >
                        AI
                      </Badge>
                      {bookmark.ai_tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* 用户标签 */}
              {(bookmark.user_tags && bookmark.user_tags.length > 0) ||
              isEditingTags ? (
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
                        {bookmark.user_tags?.map((tag) => (
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

              {/* 处理状态 */}
              {bookmark.status === "PROCESSING" && (
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

              {/* 原文链接 */}
              <div className="pt-4">
                <Button
                  variant="outline"
                  onClick={handleOpenOriginal}
                  className="w-full md:w-auto"
                >
                  <ExternalLink className="size-4 mr-2" />
                  查看原文
                </Button>
              </div>
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

      {/* 图片预览 Lightbox */}
      <Dialog open={showImageLightbox} onOpenChange={setShowImageLightbox}>
        <DialogContent className="max-w-7xl w-[95vw] h-[95vh] p-0 overflow-hidden bg-black/95">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt={bookmark.title}
              className="max-w-full max-h-full object-contain"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setShowImageLightbox(false)}
            >
              <X className="size-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
