/**
 * 智能列表区块组件
 * @description 侧边栏中显示智能列表区块的容器组件，支持拖拽排序
 * @version 10.2.3 - V4.2.25 性能优化：支持 localStorage 缓存立即显示
 */

"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  lazy,
  Suspense,
  useMemo,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { SmartListSkeleton } from "@/components/skeleton/page-skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SmartListItem } from "./smart-list-item";
import { getSmartListCache } from "@/lib/smart-list/cache";

// V4.2.24: 懒加载 DnD 排序组件（减少 ~30KB 初始包体积）
const SortableSmartListContent = lazy(
  () => import("./sortable-smart-list-content"),
);

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
import { SmartListEditorDialog } from "./smart-list-editor-dialog";
import { useSmartLists } from "@/hooks/use-smart-lists";
import type {
  SmartListClient,
  CreateSmartListRequest,
  UpdateSmartListRequest,
} from "@/types/smart-list";

// ============================================
// 类型定义
// ============================================

export interface SmartListSectionProps {
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 是否显示创建按钮 */
  showCreateButton?: boolean;
  /** 延迟加载时间（毫秒），0 表示立即加载 */
  loadDelay?: number;
  /** 是否使用 requestIdleCallback 延迟加载 */
  useIdleCallback?: boolean;
}

// ============================================
// 静态列表项组件（DnD 加载前的回退）
// ============================================

interface StaticSmartListItemProps {
  smartList: SmartListClient;
  onTogglePin: (id: number, isPinned: boolean) => void;
  onEdit: (smartList: SmartListClient) => void;
  onDelete: (id: number) => void;
}

function StaticSmartListItem({
  smartList,
  onTogglePin,
  onEdit,
  onDelete,
}: StaticSmartListItemProps) {
  return (
    <div className="group relative flex items-center">
      <div className="flex-1">
        <SmartListItem
          smartList={smartList}
          count={smartList.bookmarkCount}
          onTogglePin={onTogglePin}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

// ============================================
// 组件实现
// ============================================

export function SmartListSection({
  defaultExpanded = true,
  showCreateButton = true,
  loadDelay = 1000, // 默认延迟 1 秒加载
  useIdleCallback = true, // 默认使用 requestIdleCallback
}: SmartListSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // V4.2.25: 读取 localStorage 缓存，实现立即显示
  const cachedData = useMemo(() => {
    if (typeof window === "undefined") return null;
    return getSmartListCache();
  }, []);
  const hasCache = cachedData !== null && cachedData.length > 0;

  // 延迟加载控制 - 如果有缓存则立即启用
  const [shouldFetch, setShouldFetch] = useState(loadDelay === 0 || hasCache);

  // 延迟加载逻辑
  useEffect(() => {
    if (loadDelay === 0 || shouldFetch) return;

    let cleanup: (() => void) | undefined;

    if (
      useIdleCallback &&
      typeof window !== "undefined" &&
      "requestIdleCallback" in window
    ) {
      // 使用 requestIdleCallback 在浏览器空闲时加载
      const idleId = window.requestIdleCallback(
        () => setShouldFetch(true),
        { timeout: loadDelay + 1000 }, // 最大等待时间
      );
      cleanup = () => window.cancelIdleCallback(idleId);
    } else {
      // 回退到 setTimeout
      const timerId = setTimeout(() => setShouldFetch(true), loadDelay);
      cleanup = () => clearTimeout(timerId);
    }

    return cleanup;
  }, [loadDelay, useIdleCallback, shouldFetch]);

  // 对话框状态
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSmartList, setEditingSmartList] = useState<
    SmartListClient | undefined
  >();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // 使用 SWR Hook 获取智能列表（支持延迟加载）
  const {
    smartLists,
    isFirstLoad,
    error,
    refresh,
    create,
    update,
    togglePin,
    remove,
    preview,
    reorder,
    initPresets,
  } = useSmartLists({
    includePresets: true,
    enabled: shouldFetch, // 只有 shouldFetch 为 true 时才获取数据
  });

  // V10.2: 自动初始化预设（首次访问时自动创建 6 个预设）
  const hasAttemptedAutoInit = useRef(false);
  const [isAutoIniting, setIsAutoIniting] = useState(false);

  useEffect(() => {
    // 条件：加载完成、列表为空、尚未尝试自动初始化
    if (
      !isFirstLoad &&
      smartLists.length === 0 &&
      !hasAttemptedAutoInit.current
    ) {
      hasAttemptedAutoInit.current = true;
      setIsAutoIniting(true);

      // 自动初始化预设（静默执行，不打扰用户）
      initPresets()
        .then((count) => {
          if (count > 0) {
            toast.success(`已为您创建 ${count} 个预设智能列表`, {
              description: "点击侧边栏查看",
            });
          }
        })
        .catch((err) => {
          // 静默处理错误，用户可以手动重试
          console.error("Auto-init presets failed:", err);
        })
        .finally(() => {
          setIsAutoIniting(false);
        });
    }
  }, [isFirstLoad, smartLists.length, initPresets]);

  // 处理置顶切换
  const handleTogglePin = useCallback(
    async (id: number, isPinned: boolean) => {
      try {
        await togglePin(id, isPinned);
        toast.success(isPinned ? "已置顶" : "已取消置顶");
      } catch (err) {
        toast.error("操作失败，请稍后重试");
        console.error("Failed to toggle pin:", err);
      }
    },
    [togglePin],
  );

  // 处理删除确认
  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirmId === null) return;

    try {
      await remove(deleteConfirmId);
      toast.success("智能列表已删除");
    } catch (err) {
      toast.error("删除失败，请稍后重试");
      console.error("Failed to delete smart list:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, remove]);

  // 初始化预设
  const handleInitPresets = useCallback(async () => {
    try {
      const count = await initPresets();
      toast.success(`已创建 ${count} 个预设智能列表`);
    } catch (err) {
      toast.error("初始化失败，请稍后重试");
      console.error("Failed to init presets:", err);
    }
  }, [initPresets]);

  // 切换展开/收起
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // 打开新建对话框
  const handleCreate = useCallback(() => {
    setEditingSmartList(undefined);
    setIsEditorOpen(true);
  }, []);

  // 打开编辑对话框
  const handleEdit = useCallback((smartList: SmartListClient) => {
    setEditingSmartList(smartList);
    setIsEditorOpen(true);
  }, []);

  // 保存（创建或更新）
  const handleSave = useCallback(
    async (data: CreateSmartListRequest | UpdateSmartListRequest) => {
      try {
        if (editingSmartList) {
          await update(editingSmartList.id, data as UpdateSmartListRequest);
          toast.success("智能列表已更新");
        } else {
          await create(data as CreateSmartListRequest);
          toast.success("智能列表已创建");
        }
      } catch (err) {
        toast.error(
          editingSmartList ? "更新失败，请稍后重试" : "创建失败，请稍后重试",
        );
        throw err; // 重新抛出以便对话框处理
      }
    },
    [editingSmartList, create, update],
  );

  // 加载中状态（包括延迟等待和数据获取）
  // V4.2.25: 使用 isFirstLoad 替代 isLoading，有缓存时不显示骨架屏
  if (!shouldFetch || isFirstLoad) {
    return (
      <div className="py-2">
        <div className="px-3 mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
            智能列表
          </p>
        </div>
        {/* 骨架屏：与实际内容布局一致，减少布局偏移 */}
        <SmartListSkeleton count={6} />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="py-2">
        <div className="px-3 mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
            智能列表
          </p>
        </div>
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-red-500 mb-2">
            <AlertTriangle className="size-3.5" />
            <span>加载失败</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => refresh()}
          >
            重试
          </Button>
        </div>
      </div>
    );
  }

  // 空状态 - 自动初始化中或手动重试按钮
  if (smartLists.length === 0) {
    return (
      <div className="py-2">
        <div className="px-3 mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
            智能列表
          </p>
        </div>
        <div className="px-3 py-2">
          {isAutoIniting ? (
            // 自动初始化进行中
            <div className="flex items-center justify-center py-2 text-xs text-gray-500">
              <Loader2 className="size-3 mr-1.5 animate-spin" />
              正在创建预设...
            </div>
          ) : (
            // 自动初始化失败后的手动重试按钮
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleInitPresets}
            >
              <Plus className="size-3 mr-1" />
              初始化预设模板
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 分离置顶和非置顶列表
  const pinnedLists = smartLists.filter((list) => list.isPinned);
  const unpinnedLists = smartLists.filter((list) => !list.isPinned);

  return (
    <>
      <div className="py-2">
        {/* 标题栏 */}
        <div className="px-3 mb-2 flex items-center justify-between">
          <button
            onClick={toggleExpanded}
            className="flex items-center gap-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            智能列表
          </button>

          {showCreateButton && (
            <Button
              variant="ghost"
              size="icon"
              className="size-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={handleCreate}
            >
              <Plus className="size-3" />
            </Button>
          )}
        </div>

        {/* 列表内容（V4.2.24: 懒加载 DnD 排序功能） */}
        {isExpanded && (
          <Suspense
            fallback={
              // 静态列表作为 DnD 加载前的回退
              <div className="space-y-0.5">
                {pinnedLists.map((smartList) => (
                  <StaticSmartListItem
                    key={smartList.id}
                    smartList={smartList}
                    onTogglePin={handleTogglePin}
                    onEdit={handleEdit}
                    onDelete={setDeleteConfirmId}
                  />
                ))}
                {pinnedLists.length > 0 && unpinnedLists.length > 0 && (
                  <div className="my-1 mx-3 border-t border-gray-100 dark:border-gray-800" />
                )}
                {unpinnedLists.map((smartList) => (
                  <StaticSmartListItem
                    key={smartList.id}
                    smartList={smartList}
                    onTogglePin={handleTogglePin}
                    onEdit={handleEdit}
                    onDelete={setDeleteConfirmId}
                  />
                ))}
              </div>
            }
          >
            <SortableSmartListContent
              smartLists={smartLists}
              pinnedLists={pinnedLists}
              unpinnedLists={unpinnedLists}
              onReorder={reorder}
              onTogglePin={handleTogglePin}
              onEdit={handleEdit}
              onDelete={setDeleteConfirmId}
            />
          </Suspense>
        )}
      </div>

      {/* 编辑对话框 */}
      <SmartListEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        smartList={editingSmartList}
        onSave={handleSave}
        onPreview={preview}
      />

      {/* 删除确认对话框 */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个智能列表吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default SmartListSection;
