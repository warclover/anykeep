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
  useMdCollectionsSWR,
  useDeleteMdCollection,
  useCreateMdCollection,
  useUploadMdFile,
  useMdViewPreference,
  MdCardItem,
  MdListItem,
  MdViewToggle,
  MD_COLLECTION_LIMITS,
  CONTENT_TYPE_CONFIG,
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
  } = useMdCollectionsSWR({
    enabled: hasAccess,
    initialData,
    initialHasMore,
    onBackgroundError: (err) => {
      // 后台刷新失败时静默提示（使用 error 级别便于监控）
      console.error("[MdCollections] 后台刷新失败:", err.message);
      toast.error("数据同步失败，显示的可能是缓存数据", { duration: 3000 });
    },
  });

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
            disabled={isLoading || isValidating}
          >
            <RefreshCw
              className={cn(
                "w-4 h-4",
                (isLoading || isValidating) && "animate-spin",
              )}
            />
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
                <MdListItem
                  key={collection.id}
                  collection={collection}
                  onClick={handleClick}
                  onDelete={(id) => handleDeleteRequest(id, collection.title)}
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
