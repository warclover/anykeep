/**
 * MD 收藏页面 - 客户端组件
 * P2-007: Markdown 内容收藏
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  Upload,
  ClipboardPaste,
  Lock,
  Crown,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useMdCollections,
  useDeleteMdCollection,
  useCreateMdCollection,
  useUploadMdFile,
  useMdViewPreference,
  MdCardItem,
  MdViewToggle,
} from "@/features/md-collections";
import {
  CONTENT_TYPE_CONFIG,
  DEFAULT_CONTENT_TYPE_CONFIG,
  MD_COLLECTION_LIMITS,
} from "@/features/md-collections";
import type { MdCollection, MdContentType } from "@/features/md-collections";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MdCollectionPageClientProps {
  hasAccess: boolean;
  membershipType: string;
}

export function MdCollectionPageClient({
  hasAccess,
  membershipType: _membershipType,
}: MdCollectionPageClientProps) {
  const router = useRouter();

  // 数据获取
  const {
    collections,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    removeLocal,
    addLocal,
  } = useMdCollections({ autoLoad: hasAccess });

  // 删除操作
  const { remove: deleteCollection, isLoading: isDeleting } =
    useDeleteMdCollection();

  // 创建操作
  const { create: createCollection, isLoading: isCreating } =
    useCreateMdCollection();

  // 上传操作
  const { upload: uploadFile, isLoading: isUploading } = useUploadMdFile();

  // 视图偏好
  const { viewMode, setViewMode } = useMdViewPreference("list");

  // 对话框状态
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [pasteForm, setPasteForm] = useState({
    title: "",
    content: "",
    contentType: "article" as MdContentType,
  });

  /**
   * 处理点击查看详情
   */
  const handleClick = useCallback(
    (id: number) => {
      router.push(`/md-collections/${id}`);
    },
    [router],
  );

  /**
   * 处理删除
   */
  const handleDelete = useCallback(
    async (id: number) => {
      if (!confirm("确定要删除这篇 MD 收藏吗？")) return;

      const success = await deleteCollection(id);
      if (success) {
        removeLocal(id);
        toast.success("删除成功");
      } else {
        toast.error("删除失败");
      }
    },
    [deleteCollection, removeLocal],
  );

  /**
   * 处理粘贴创建
   */
  const handlePasteCreate = useCallback(async () => {
    if (!pasteForm.content.trim()) {
      toast.error("请输入内容");
      return;
    }

    const result = await createCollection({
      title: pasteForm.title || "无标题",
      rawContent: pasteForm.content,
      contentType: pasteForm.contentType,
    });

    if (result) {
      addLocal(result);
      toast.success("创建成功");
      setIsPasteDialogOpen(false);
      setPasteForm({ title: "", content: "", contentType: "article" });
    } else {
      toast.error("创建失败");
    }
  }, [pasteForm, createCollection, addLocal]);

  /**
   * 处理文件上传
   */
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 验证文件类型
      const ext = file.name.toLowerCase().split(".").pop();
      if (!["md", "txt", "markdown"].includes(ext || "")) {
        toast.error("仅支持 .md 或 .txt 文件");
        return;
      }

      // 验证文件大小
      if (file.size > MD_COLLECTION_LIMITS.maxFileSize) {
        toast.error("文件大小不能超过 1MB");
        return;
      }

      const result = await uploadFile(file);
      if (result) {
        addLocal(result);
        toast.success("上传成功");
      } else {
        toast.error("上传失败");
      }

      // 清空 input
      e.target.value = "";
    },
    [uploadFile, addLocal],
  );

  // 无权限状态
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          MD 收藏功能
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-md">
          MD 收藏功能仅限 Pro 会员使用。升级到 Pro 即可享受 Markdown
          内容收藏、专业阅读视图、AI 智能摘要等功能。
        </p>
        <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
          <Crown className="w-4 h-4 mr-2" />
          升级到 Pro
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            MD 收藏
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            收藏和管理你的 Markdown 内容
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          <MdViewToggle value={viewMode} onChange={setViewMode} />

          {/* 刷新按钮 */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => refresh()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>

          {/* 上传按钮 */}
          <Button variant="outline" asChild disabled={isUploading}>
            <label className="cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              上传文件
              <input
                type="file"
                className="hidden"
                accept=".md,.txt,.markdown"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>
          </Button>

          {/* 粘贴对话框 */}
          <Dialog open={isPasteDialogOpen} onOpenChange={setIsPasteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
                <Plus className="w-4 h-4 mr-2" />
                新建收藏
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>粘贴 Markdown 内容</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="title">标题（可选）</Label>
                  <Input
                    id="title"
                    placeholder="自动从内容提取"
                    value={pasteForm.title}
                    onChange={(e) =>
                      setPasteForm({ ...pasteForm, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="contentType">内容类型</Label>
                  <Select
                    value={pasteForm.contentType}
                    onValueChange={(v) =>
                      setPasteForm({
                        ...pasteForm,
                        contentType: v as MdContentType,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* 只显示小写的用户选项 */}
                      {(
                        [
                          "article",
                          "tutorial",
                          "code",
                          "note",
                          "documentation",
                        ] as const
                      ).map((key) => (
                        <SelectItem key={key} value={key}>
                          {CONTENT_TYPE_CONFIG[key]?.label || key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="content">Markdown 内容</Label>
                  <Textarea
                    id="content"
                    placeholder="在此粘贴 Markdown 内容..."
                    className="min-h-[300px] font-mono text-sm"
                    value={pasteForm.content}
                    onChange={(e) =>
                      setPasteForm({ ...pasteForm, content: e.target.value })
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsPasteDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handlePasteCreate}
                    disabled={isCreating || !pasteForm.content.trim()}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500"
                  >
                    {isCreating ? "创建中..." : "创建收藏"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 错误状态 */}
      {error && (
        <div className="text-center py-8 text-red-500">
          <p>{error}</p>
          <Button variant="outline" onClick={() => refresh()} className="mt-4">
            重试
          </Button>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && collections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            暂无 MD 收藏
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-md">
            支持直接粘贴 Markdown 内容或上传 .md 文件
          </p>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                上传文件
                <input
                  type="file"
                  className="hidden"
                  accept=".md,.txt,.markdown"
                  onChange={handleFileUpload}
                />
              </label>
            </Button>
            <Button
              onClick={() => setIsPasteDialogOpen(true)}
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              <ClipboardPaste className="w-4 h-4 mr-2" />
              粘贴内容
            </Button>
          </div>
        </div>
      )}

      {/* 列表/卡片视图 */}
      {collections.length > 0 && (
        <>
          {viewMode === "list" ? (
            /* 列表视图 */
            <div className="space-y-3">
              {collections.map((collection) => (
                <MdCollectionItem
                  key={collection.id}
                  collection={collection}
                  onClick={handleClick}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                />
              ))}
            </div>
          ) : (
            /* 卡片视图 */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map((collection) => (
                <MdCardItem
                  key={collection.id}
                  collection={collection}
                  onClick={handleClick}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                />
              ))}
            </div>
          )}

          {/* 加载更多 */}
          {hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={loadMore} disabled={isLoading}>
                {isLoading ? "加载中..." : "加载更多"}
              </Button>
            </div>
          )}
        </>
      )}

      {/* 加载状态 */}
      {isLoading && collections.length === 0 && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MD 收藏列表项
 */
function MdCollectionItem({
  collection,
  onClick,
  onDelete,
  isDeleting,
}: {
  collection: MdCollection;
  onClick: (id: number) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}) {
  const contentTypeConfig = (collection.content_type
    ? CONTENT_TYPE_CONFIG[collection.content_type]
    : null) ??
    DEFAULT_CONTENT_TYPE_CONFIG ?? {
      label: "文档",
      color: "bg-gray-100 text-gray-600",
    };

  return (
    <div
      className="group p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors cursor-pointer"
      onClick={() => onClick(collection.id)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <h3 className="font-medium text-gray-900 dark:text-white truncate mb-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            {collection.title}
          </h3>

          {/* 元信息 */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {/* 内容类型 */}
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-xs font-medium",
                contentTypeConfig.color,
              )}
            >
              {contentTypeConfig.label}
            </span>

            {/* 字数 */}
            <span>{collection.word_count?.toLocaleString() || 0} 字</span>

            {/* 阅读时间 */}
            <span>{collection.reading_time_minutes || 1} 分钟</span>

            {/* 处理状态 */}
            {collection.processing_status === "processing" && (
              <span className="text-amber-500">AI 处理中...</span>
            )}
            {collection.processing_status === "failed" && (
              <span className="text-red-500">处理失败</span>
            )}

            {/* 创建时间 */}
            <span>
              {new Date(collection.created_at).toLocaleDateString("zh-CN")}
            </span>
          </div>

          {/* AI 摘要 */}
          {collection.ai_summary && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
              {collection.ai_summary}
            </p>
          )}

          {/* AI 标签 */}
          {collection.ai_tags && collection.ai_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {collection.ai_tags.slice(0, 5).map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={(e) => {
              e.stopPropagation(); // 阻止事件冒泡
              onDelete(collection.id);
            }}
            disabled={isDeleting}
          >
            删除
          </Button>
        </div>
      </div>
    </div>
  );
}
