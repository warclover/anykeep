/**
 * MD 收藏页面 - 客户端组件
 * P2-007: Markdown 内容收藏
 *
 * 性能优化 V2: 使用 SWR 缓存策略
 * - 二次访问秒开（从缓存读取）
 * - 后台静默刷新（无感知更新）
 * - 乐观更新支持
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
  useMdCollectionsSWR,
  useDeleteMdCollection,
  useCreateMdCollection,
  useUploadMdFile,
  useMdViewPreference,
  useMdProcessingPoller,
  MdCardItem,
  MdListItem,
  MdViewToggle,
  MD_COLLECTION_LIMITS,
  CONTENT_TYPE_CONFIG,
} from "@/features/md-collections";
import type { MdCollection, MdContentType } from "@/features/md-collections";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePageToolbar } from "@/contexts/page-toolbar-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /** 服务端预取的数据 */
  initialData?: MdCollection[];
  /** 服务端预取的分页状态 */
  initialHasMore?: boolean;
}

export function MdCollectionPageClient({
  hasAccess,
  membershipType: _membershipType,
  initialData = [],
  initialHasMore = true,
}: MdCollectionPageClientProps) {
  const router = useRouter();

  // 数据获取（SWR 缓存策略）
  const {
    collections,
    isLoading,
    isValidating,
    error,
    hasMore,
    loadMore,
    refresh,
    removeLocal,
    addLocal,
    updateLocal,
  } = useMdCollectionsSWR({
    enabled: hasAccess,
    initialData,
    initialHasMore,
    onBackgroundError: (_err) => {
      // 后台刷新失败时静默提示
      toast.error("数据同步失败，显示的可能是缓存数据", { duration: 3000 });
    },
  });

  // AI 处理状态轮询
  useMdProcessingPoller({
    collections,
    onUpdate: updateLocal,
    enabled: hasAccess,
  });

  // 删除操作
  const { remove: deleteCollection, isLoading: isDeleting } =
    useDeleteMdCollection();

  // 创建操作
  const { create: createCollection, isLoading: isCreating } =
    useCreateMdCollection();

  // 上传操作
  const { upload: uploadFile, isLoading: isUploading } = useUploadMdFile();
  const [isBatchUploading, setIsBatchUploading] = useState(false);

  // 视图偏好
  const { viewMode, setViewMode } = useMdViewPreference("list");

  // 页面工具栏注入
  const pageToolbar = usePageToolbar();

  // 对话框状态
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [pasteForm, setPasteForm] = useState({
    title: "",
    content: "",
    contentType: "article" as MdContentType,
  });

  // 删除确认对话框状态
  const [deleteDialogState, setDeleteDialogState] = useState<{
    isOpen: boolean;
    itemId: number | null;
    itemTitle: string;
  }>({
    isOpen: false,
    itemId: null,
    itemTitle: "",
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
   * 下载 MD 文件
   */
  const handleDownload = useCallback((collection: MdCollection) => {
    const content = collection.raw_content ?? "";
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${collection.title.replace(/[/\\?%*:|"<>]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  /**
   * 另存为 TXT 文件（去除 Markdown 语法，保留纯文字）
   */
  const handleDownloadAsTxt = useCallback((collection: MdCollection) => {
    const raw = collection.raw_content ?? "";
    const plain = raw
      // 代码块 → 保留内容
      .replace(/```[\s\S]*?```/g, (m) =>
        m.replace(/```\w*\n?/g, "").replace(/```/g, ""),
      )
      // 图片 ![alt](url) → alt
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      // 链接 [text](url) → text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // 标题 # → 去除标记
      .replace(/^#{1,6}\s+/gm, "")
      // 粗体/斜体
      .replace(/(\*{1,3}|_{1,3})(.+?)\1/g, "$2")
      // 删除线
      .replace(/~~(.+?)~~/g, "$1")
      // 行内代码
      .replace(/`([^`]+)`/g, "$1")
      // 引用 >
      .replace(/^>\s?/gm, "")
      // 无序列表标记
      .replace(/^[\t ]*[-*+]\s+/gm, "")
      // 有序列表标记
      .replace(/^[\t ]*\d+\.\s+/gm, "")
      // 分隔线
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // HTML 标签
      .replace(/<[^>]+>/g, "")
      // 连续空行合并为单个
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const blob = new Blob([plain], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${collection.title.replace(/[/\\?%*:|"<>]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  /**
   * 打开删除确认对话框
   */
  const handleDeleteRequest = useCallback((id: number, title: string) => {
    setDeleteDialogState({
      isOpen: true,
      itemId: id,
      itemTitle: title,
    });
  }, []);

  /**
   * 确认删除
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDialogState.itemId) return;

    const success = await deleteCollection(deleteDialogState.itemId);
    if (success) {
      removeLocal(deleteDialogState.itemId);
      toast.success("删除成功");
    } else {
      toast.error("删除失败");
    }

    setDeleteDialogState({ isOpen: false, itemId: null, itemTitle: "" });
  }, [deleteDialogState.itemId, deleteCollection, removeLocal]);

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
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      setIsBatchUploading(true);

      let successCount = 0;
      let invalidCount = 0;
      let failedCount = 0;

      try {
        for (const file of files) {
          // 验证文件类型
          const ext = file.name.toLowerCase().split(".").pop();
          if (!["md", "txt", "markdown"].includes(ext || "")) {
            invalidCount++;
            continue;
          }

          // 验证文件大小
          if (file.size > MD_COLLECTION_LIMITS.maxFileSize) {
            invalidCount++;
            continue;
          }

          const result = await uploadFile(file);
          if (result) {
            addLocal(result);
            successCount++;
          } else {
            failedCount++;
          }
        }

        if (successCount > 0) {
          toast.success(
            files.length === 1 ? "上传成功" : `已上传 ${successCount} 个文件`,
          );
        }

        const skippedCount = invalidCount + failedCount;
        if (skippedCount > 0) {
          toast.warning(
            successCount > 0
              ? `已跳过 ${skippedCount} 个文件`
              : `上传失败，${skippedCount} 个文件未成功导入`,
          );
        }
      } finally {
        // 清空 input，允许重复选择同一批文件
        e.target.value = "";
        setIsBatchUploading(false);
      }
    },
    [uploadFile, addLocal],
  );

  const isUploadBusy = isUploading || isBatchUploading;

  // 注入 AppHeader 第二行工具栏（仅依赖稳定/标量值，避免 setViewMode/refresh 等引用变化导致 useMemo 每轮新引用 → useEffect 循环）
  const toolbarElement = useMemo(
    () => (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5">
          <h1 className="text-base font-semibold text-gray-900 dark:text-white leading-none">
            我的笔记
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-none">
            收藏和管理你的 Markdown 内容
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MdViewToggle value={viewMode} onChange={setViewMode} />
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 px-0"
            onClick={() => refresh()}
            disabled={isLoading || isValidating}
          >
            <RefreshCw
              className={cn(
                "w-3 h-3",
                (isLoading || isValidating) && "animate-spin",
              )}
            />
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            disabled={isUploadBusy}
            className="h-7 px-2 text-xs"
          >
            <label className="cursor-pointer">
              <Upload className="w-3 h-3 mr-1.5" />
              {isUploadBusy ? "上传中..." : "上传文件"}
              <input
                type="file"
                className="hidden"
                accept=".md,.txt,.markdown"
                multiple
                onChange={handleFileUpload}
                disabled={isUploadBusy}
              />
            </label>
          </Button>
          <Button
            size="sm"
            className="h-7 px-2 text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            onClick={() => setIsPasteDialogOpen(true)}
          >
            <Plus className="w-3 h-3 mr-1.5" />
            新建收藏
          </Button>
        </div>
      </div>
    ),
    // 故意不包含 setViewMode/refresh/handleFileUpload，避免引用每轮变化导致 toolbarElement 常新 → setToolbar 重渲染循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewMode, isLoading, isValidating, isUploadBusy],
  );

  const setPageToolbarFn = pageToolbar?.setToolbar;
  useEffect(() => {
    if (!hasAccess || !setPageToolbarFn) return;
    setPageToolbarFn(toolbarElement);
    return () => setPageToolbarFn(null);
  }, [hasAccess, setPageToolbarFn, toolbarElement]);

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
      {/* 新建收藏对话框（由 AppHeader 工具栏触发，Dialog 留在渲染树以保持 Portal 正常） */}
      <Dialog open={isPasteDialogOpen} onOpenChange={setIsPasteDialogOpen}>
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
            <Button variant="outline" asChild disabled={isUploadBusy}>
              <label className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                {isUploadBusy ? "上传中..." : "上传文件"}
                <input
                  type="file"
                  className="hidden"
                  accept=".md,.txt,.markdown"
                  multiple
                  onChange={handleFileUpload}
                  disabled={isUploadBusy}
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
                <MdListItem
                  key={collection.id}
                  collection={collection}
                  onClick={handleClick}
                  onDelete={(id) => handleDeleteRequest(id, collection.title)}
                  onDownload={handleDownload}
                  onDownloadAsTxt={handleDownloadAsTxt}
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
                  onDelete={(id) => handleDeleteRequest(id, collection.title)}
                  onDownload={handleDownload}
                  onDownloadAsTxt={handleDownloadAsTxt}
                  isDeleting={isDeleting}
                />
              ))}
            </div>
          )}

          {/* 加载更多 */}
          {hasMore && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoading || isValidating}
              >
                {isLoading || isValidating ? "加载中..." : "加载更多"}
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

      {/* 删除确认对话框 */}
      <AlertDialog
        open={deleteDialogState.isOpen}
        onOpenChange={(open) =>
          !open &&
          setDeleteDialogState({ isOpen: false, itemId: null, itemTitle: "" })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deleteDialogState.itemTitle}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
