"use client";

/**
 * 待确认消息专页
 * V4.2 半托管模式核心功能
 *
 * @description 专门展示需要用户确认的 AI 建议
 * - 分类确认：低置信度分类需要用户选择
 * - 文件夹操作：创建/合并/拆分/重命名建议
 * - 支持批量操作
 * - 按类型筛选
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  CheckCheck,
  RefreshCw,
  X,
  ArrowLeft,
  Clock,
  FolderOpen,
  FolderPlus,
  GitMerge,
  Scissors,
  Pencil,
  Inbox,
  Sparkles,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ConfirmationMessageItem } from "@/components/messages/confirmation-message-item";
import { FolderSelectorDialog } from "@/components/messages/folder-selector-dialog";
import { useConfirmations } from "@/hooks/use-confirmations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ConfirmationType, ClassificationChoice } from "@/types/confirmation";

// ============================================================================
// 类型定义
// ============================================================================

type FilterType = "all" | ConfirmationType;

interface FilterOption {
  value: FilterType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// ============================================================================
// 常量配置
// ============================================================================

const FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "全部", icon: Clock },
  { value: "classification", label: "分类确认", icon: FolderOpen },
  { value: "folder_create", label: "新建文件夹", icon: FolderPlus },
  { value: "folder_merge", label: "合并文件夹", icon: GitMerge },
  { value: "folder_split", label: "拆分文件夹", icon: Scissors },
  { value: "folder_rename", label: "重命名", icon: Pencil },
];

// ============================================================================
// 空状态组件
// ============================================================================

function EmptyState({ filter }: { filter: FilterType }) {
  const filterLabel =
    FILTER_OPTIONS.find((f) => f.value === filter)?.label || "待确认";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div className="rounded-full bg-muted p-6 mb-4">
        <Sparkles className="size-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">没有{filterLabel}消息</h3>
      <p className="text-muted-foreground text-center max-w-sm">
        当 AI 对分类不太确定或需要进行文件夹操作时，会在这里征求您的意见。
      </p>
    </motion.div>
  );
}

// ============================================================================
// 筛选标签组件
// ============================================================================

function FilterTabs({
  activeFilter,
  onFilterChange,
  typeCounts,
  pendingCount,
}: {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  typeCounts: Partial<Record<ConfirmationType, number>>;
  pendingCount: number;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
      {FILTER_OPTIONS.map((option) => {
        const Icon = option.icon;
        const count =
          option.value === "all"
            ? pendingCount
            : typeCounts[option.value as ConfirmationType] || 0;
        const isActive = activeFilter === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onFilterChange(option.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <Icon className="size-3.5" />
            <span>{option.label}</span>
            {count > 0 && (
              <Badge
                variant={isActive ? "secondary" : "outline"}
                className={cn(
                  "px-1.5 py-0 text-xs",
                  isActive && "bg-primary-foreground/20 text-primary-foreground"
                )}
              >
                {count > 99 ? "99+" : count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// 批量操作栏组件
// ============================================================================

function BatchActionBar({
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onBatchConfirm,
  onBatchReject,
  isAllSelected,
  isLoading,
}: {
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchConfirm: () => void;
  onBatchReject: () => void;
  isAllSelected: boolean;
  isLoading: boolean;
}) {
  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-background border shadow-lg">
        <span className="text-sm text-muted-foreground">
          已选择 <strong className="text-foreground">{selectedCount}</strong> 项
        </span>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={isAllSelected ? onDeselectAll : onSelectAll}
        >
          {isAllSelected ? "取消全选" : "全选"}
        </Button>

        <div className="h-4 w-px bg-border" />

        <Button
          size="sm"
          onClick={onBatchConfirm}
          disabled={isLoading}
          className="gap-1"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCheck className="size-4" />
          )}
          全部确认
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onBatchReject}
          disabled={isLoading}
          className="gap-1"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
          全部拒绝
        </Button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// 确认消息列表项（带选择框）
// ============================================================================

function SelectableConfirmationItem({
  confirmation,
  isSelected,
  onSelect,
  onConfirm,
  onReject,
  onSelectOther,
  onToInbox,
  isLoading,
}: {
  confirmation: Parameters<typeof ConfirmationMessageItem>[0]["confirmation"];
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onConfirm?: (id: number, selectedFolderId?: number | null) => void;
  onReject?: (id: number) => void;
  onSelectOther?: (id: number) => void;
  onToInbox?: (id: number) => void;
  isLoading?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "relative",
        isSelected && "ring-2 ring-primary ring-offset-2 rounded-lg"
      )}
    >
      {/* 选择框 */}
      <div className="absolute left-2 top-4 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="bg-background"
        />
      </div>

      {/* 消息项 */}
      <div className="pl-8">
        <ConfirmationMessageItem
          confirmation={confirmation}
          onConfirm={onConfirm}
          onReject={onReject}
          onSelectOther={onSelectOther}
          onToInbox={onToInbox}
          isLoading={isLoading}
        />
      </div>
    </motion.div>
  );
}

// ============================================================================
// 主页面组件
// ============================================================================

export default function PendingConfirmationsPage() {
  const router = useRouter();

  // 状态
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [showBatchRejectDialog, setShowBatchRejectDialog] = useState(false);
  const [folderSelectorOpen, setFolderSelectorOpen] = useState(false);
  const [currentConfirmationId, setCurrentConfirmationId] = useState<
    number | null
  >(null);

  // 获取确认消息
  const {
    confirmations,
    isLoading,
    pendingCount,
    typeCounts,
    pagination,
    refresh,
    loadMore,
    confirmClassification,
    confirmFolderOperation,
    reject,
    batchConfirm,
    batchReject,
  } = useConfirmations({
    pendingOnly: true,
    type: filter === "all" ? undefined : filter,
    limit: 20,
    autoRefreshInterval: 60000, // 每分钟刷新
  });

  // 过滤后的确认消息
  const filteredConfirmations = useMemo(() => {
    if (filter === "all") return confirmations;
    return confirmations.filter((c) => c.type === filter);
  }, [confirmations, filter]);

  // 选择状态
  const isAllSelected =
    filteredConfirmations.length > 0 &&
    filteredConfirmations.every((c) => selectedIds.has(c.id));
  const selectedCount = selectedIds.size;

  // 处理单个选择
  const handleSelect = useCallback((id: number, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  // 全选
  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredConfirmations.map((c) => c.id)));
  }, [filteredConfirmations]);

  // 取消全选
  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 处理确认
  const handleConfirm = useCallback(
    async (id: number, selectedFolderId?: number | null) => {
      const confirmation = confirmations.find((c) => c.id === id);
      if (!confirmation) return;

      if (confirmation.type === "classification") {
        const choice: ClassificationChoice = {
          selectedFolderId: selectedFolderId ?? null,
        };
        const success = await confirmClassification(id, choice);
        if (success) {
          toast.success("已确认分类");
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      } else {
        const success = await confirmFolderOperation(id, { accepted: true });
        if (success) {
          toast.success("已同意操作");
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      }
    },
    [confirmations, confirmClassification, confirmFolderOperation]
  );

  // 处理拒绝
  const handleReject = useCallback(
    async (id: number) => {
      const success = await reject(id);
      if (success) {
        toast.success("已拒绝");
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [reject]
  );

  // 处理选择其他文件夹
  const handleSelectOther = useCallback((id: number) => {
    setCurrentConfirmationId(id);
    setFolderSelectorOpen(true);
  }, []);

  // 处理移至待整理
  const handleToInbox = useCallback(
    async (id: number) => {
      const choice: ClassificationChoice = {
        selectedFolderId: null,
      };
      const success = await confirmClassification(id, choice);
      if (success) {
        toast.success("已移至待整理");
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [confirmClassification]
  );

  // 处理文件夹选择
  const handleFolderSelected = useCallback(
    async (folderId: number | null, _folderName: string) => {
      if (currentConfirmationId) {
        await handleConfirm(currentConfirmationId, folderId);
      }
      setFolderSelectorOpen(false);
      setCurrentConfirmationId(null);
    },
    [currentConfirmationId, handleConfirm]
  );

  // 批量确认
  const handleBatchConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setBatchLoading(true);
    try {
      const result = await batchConfirm(Array.from(selectedIds));
      if (result.success > 0) {
        toast.success(`已确认 ${result.success} 项`);
        setSelectedIds(new Set());
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} 项确认失败`);
      }
    } finally {
      setBatchLoading(false);
    }
  }, [selectedIds, batchConfirm]);

  // 批量拒绝
  const handleBatchReject = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setBatchLoading(true);
    try {
      const result = await batchReject(Array.from(selectedIds));
      if (result.success > 0) {
        toast.success(`已拒绝 ${result.success} 项`);
        setSelectedIds(new Set());
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} 项拒绝失败`);
      }
    } finally {
      setBatchLoading(false);
      setShowBatchRejectDialog(false);
    }
  }, [selectedIds, batchReject]);

  // 处理刷新
  const handleRefresh = useCallback(async () => {
    await refresh();
    toast.success("已刷新");
  }, [refresh]);

  return (
    <div className="flex flex-col h-full">
      {/* 页面头部 */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/messages")}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                待确认
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {pendingCount}
                  </Badge>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                AI 需要您确认的分类和操作建议
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              title="刷新"
            >
              <RefreshCw
                className={cn("size-4", isLoading && "animate-spin")}
              />
            </Button>
          </div>
        </div>

        {/* 筛选标签 */}
        <div className="px-4 sm:px-6 pb-3">
          <FilterTabs
            activeFilter={filter}
            onFilterChange={setFilter}
            typeCounts={typeCounts}
            pendingCount={pendingCount}
          />
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto pb-24">
        {isLoading && filteredConfirmations.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredConfirmations.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="px-4 sm:px-6 py-4 space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredConfirmations.map((confirmation) => (
                <SelectableConfirmationItem
                  key={confirmation.id}
                  confirmation={confirmation}
                  isSelected={selectedIds.has(confirmation.id)}
                  onSelect={(selected) =>
                    handleSelect(confirmation.id, selected)
                  }
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                  onSelectOther={handleSelectOther}
                  onToInbox={handleToInbox}
                  isLoading={batchLoading}
                />
              ))}
            </AnimatePresence>

            {/* 加载更多 */}
            {pagination.hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : null}
                  加载更多
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 批量操作栏 */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <BatchActionBar
            selectedCount={selectedCount}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onBatchConfirm={handleBatchConfirm}
            onBatchReject={() => setShowBatchRejectDialog(true)}
            isAllSelected={isAllSelected}
            isLoading={batchLoading}
          />
        )}
      </AnimatePresence>

      {/* 文件夹选择器 */}
      <FolderSelectorDialog
        open={folderSelectorOpen}
        onOpenChange={setFolderSelectorOpen}
        onSelect={handleFolderSelected}
        title="选择文件夹"
        description="请选择要将书签分类到的文件夹"
      />

      {/* 批量拒绝确认对话框 */}
      <AlertDialog
        open={showBatchRejectDialog}
        onOpenChange={setShowBatchRejectDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认拒绝</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要拒绝选中的 {selectedCount} 项建议吗？
              拒绝后，这些书签将保持在当前位置不变。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchReject}
              disabled={batchLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {batchLoading ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : null}
              确认拒绝
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
