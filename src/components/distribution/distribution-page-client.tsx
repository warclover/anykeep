/**
 * 分发中心页面客户端组件
 *
 * @description 管理分发目标列表，支持添加、编辑、删除和手动同步
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  FileText,
  Download,
  Cloud,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  MoreVertical,
  Zap,
  Timer,
  Hand,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ObsidianConfigForm } from "./obsidian-config-form";
import type { DistributionTarget, TriggerMode } from "@/lib/distribution/types";

/**
 * 目标类型配置
 */
const TARGET_TYPE_CONFIG: Record<
  string,
  {
    icon: typeof FileText;
    label: string;
    description: string;
    color: string;
  }
> = {
  obsidian: {
    icon: FileText,
    label: "Obsidian",
    description: "本地 Markdown 同步",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  manual_export: {
    icon: Download,
    label: "手动导出",
    description: "下载为文件",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  notion: {
    icon: Cloud,
    label: "Notion",
    description: "云端数据库同步",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  },
};

/**
 * 触发模式配置
 */
const TRIGGER_MODE_CONFIG: Record<
  TriggerMode,
  { icon: typeof Hand; label: string }
> = {
  manual: { icon: Hand, label: "手动" },
  scheduled: { icon: Timer, label: "定时" },
  realtime: { icon: Zap, label: "实时" },
};

/**
 * 状态配置
 */
const STATUS_CONFIG: Record<
  string,
  { icon: typeof CheckCircle2; label: string; color: string }
> = {
  idle: {
    icon: CheckCircle2,
    label: "就绪",
    color: "text-green-600 dark:text-green-400",
  },
  syncing: {
    icon: RefreshCw,
    label: "同步中",
    color: "text-blue-600 dark:text-blue-400",
  },
  error: {
    icon: XCircle,
    label: "错误",
    color: "text-red-600 dark:text-red-400",
  },
  disabled: {
    icon: AlertTriangle,
    label: "已禁用",
    color: "text-gray-400",
  },
};

/**
 * 分发中心页面客户端组件
 */
export function DistributionPageClient() {
  const router = useRouter();
  const [targets, setTargets] = useState<DistributionTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingTargets, setSyncingTargets] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addTargetType, setAddTargetType] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<DistributionTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DistributionTarget | null>(
    null,
  );

  /**
   * 加载分发目标列表
   */
  const loadTargets = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/distribution/targets");
      if (!response.ok) {
        throw new Error("加载失败");
      }
      const data = await response.json();
      setTargets(data.targets || []);
    } catch (error) {
      toast.error("加载分发目标失败");
      console.error("Load targets error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  /**
   * 手动触发同步
   */
  const handleSync = async (targetId: string) => {
    setSyncingTargets((prev) => new Set(prev).add(targetId));

    try {
      const response = await fetch(`/api/distribution/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`同步完成：${result.distributedCount} 条内容`);
        // 刷新目标列表以更新状态
        await loadTargets();
      } else {
        toast.error(result.error || "同步失败");
      }
    } catch (error) {
      toast.error("同步请求失败");
      console.error("Sync error:", error);
    } finally {
      setSyncingTargets((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  /**
   * 删除目标
   */
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const response = await fetch(
        `/api/distribution/targets/${deleteTarget.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("删除失败");
      }

      toast.success("分发目标已删除");
      setTargets((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error("删除失败");
      console.error("Delete error:", error);
    }
  };

  /**
   * 添加/编辑目标提交
   */
  const handleSubmit = async (config: Record<string, unknown>) => {
    const isEdit = !!editTarget;
    const targetType = editTarget?.targetType || addTargetType;

    try {
      const url = isEdit
        ? `/api/distribution/targets/${editTarget.id}`
        : "/api/distribution/targets";

      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          name: `${TARGET_TYPE_CONFIG[targetType!]?.label || targetType} 同步`,
          targetConfig: {
            vaultPath: config.vaultPath,
            folderName: config.folderName,
            filenamePattern: config.filenamePattern,
            useYamlFrontmatter: config.useYamlFrontmatter,
          },
          trigger: {
            mode: config.triggerMode,
            intervalMinutes:
              config.triggerMode === "scheduled"
                ? config.scheduleIntervalMinutes
                : undefined,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "保存失败");
      }

      setShowAddDialog(false);
      setAddTargetType(null);
      setEditTarget(null);
      await loadTargets();
    } catch (error) {
      throw error;
    }
  };

  /**
   * 渲染目标卡片
   */
  const renderTargetCard = (target: DistributionTarget) => {
    const typeConfig = TARGET_TYPE_CONFIG[target.targetType] || {
      icon: Cloud,
      label: target.targetType,
      description: "",
      color: "bg-gray-100 text-gray-700",
    };
    const statusConfig = STATUS_CONFIG[target.status] || STATUS_CONFIG.idle;
    const triggerConfig = TRIGGER_MODE_CONFIG[target.trigger.mode];
    const Icon = typeConfig.icon;
    const StatusIcon = statusConfig.icon;
    const TriggerIcon = triggerConfig.icon;
    const isSyncing = syncingTargets.has(target.id);

    return (
      <Card key={target.id} className={cn(!target.enabled && "opacity-60")}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", typeConfig.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">{target.name}</CardTitle>
                <CardDescription className="text-sm">
                  {typeConfig.description}
                </CardDescription>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditTarget(target)}>
                  <Settings className="h-4 w-4 mr-2" />
                  编辑配置
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteTarget(target)}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 状态信息 */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div
                className={cn("flex items-center gap-1", statusConfig.color)}
              >
                <StatusIcon
                  className={cn("h-4 w-4", isSyncing && "animate-spin")}
                />
                <span>{isSyncing ? "同步中..." : statusConfig.label}</span>
              </div>
              <Badge variant="secondary" className="font-normal">
                <TriggerIcon className="h-3 w-3 mr-1" />
                {triggerConfig.label}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>已同步 {target.syncedCount || 0} 条</span>
            </div>
          </div>

          {/* 上次同步时间 */}
          {target.lastSyncAt && (
            <p className="text-xs text-muted-foreground">
              上次同步：{new Date(target.lastSyncAt).toLocaleString("zh-CN")}
            </p>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSync(target.id)}
              disabled={isSyncing || !target.enabled}
              className="flex-1"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              立即同步
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  /**
   * 渲染添加目标类型选择
   */
  const renderAddTargetTypeSelector = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(TARGET_TYPE_CONFIG)
        .filter(([key]) => key !== "notion") // Notion 暂未实现
        .map(([key, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={key}
              onClick={() => setAddTargetType(key)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-lg border-2 border-dashed",
                "hover:border-primary hover:bg-muted/50 transition-colors",
                "text-left",
              )}
            >
              <div className={cn("p-3 rounded-lg", config.color)}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">{config.label}</p>
                <p className="text-sm text-muted-foreground">
                  {config.description}
                </p>
              </div>
            </button>
          );
        })}
    </div>
  );

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">分发中心</h1>
          <p className="text-muted-foreground mt-1">
            将收藏内容自动同步到其他平台
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          添加目标
        </Button>
      </div>

      <Separator className="mb-8" />

      {/* 目标列表 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : targets.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-muted">
                <Cloud className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">尚未配置分发目标</p>
                <p className="text-sm text-muted-foreground mt-1">
                  添加一个目标开始自动同步你的收藏内容
                </p>
              </div>
              <Button onClick={() => setShowAddDialog(true)} className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                添加第一个目标
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {targets.map(renderTargetCard)}
        </div>
      )}

      {/* 添加目标对话框 */}
      <Dialog
        open={showAddDialog || !!addTargetType}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setAddTargetType(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {addTargetType
                ? `添加 ${TARGET_TYPE_CONFIG[addTargetType]?.label} 同步`
                : "选择分发目标类型"}
            </DialogTitle>
            <DialogDescription>
              {addTargetType ? "配置同步规则和触发方式" : "选择要同步到的平台"}
            </DialogDescription>
          </DialogHeader>

          {addTargetType === "obsidian" ? (
            <ObsidianConfigForm
              onSubmit={handleSubmit}
              onCancel={() => setAddTargetType(null)}
            />
          ) : addTargetType === "manual_export" ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                手动导出功能请使用「内容导出」页面
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setAddTargetType(null);
                  setShowAddDialog(false);
                  router.push("/export");
                }}
              >
                前往内容导出
              </Button>
            </div>
          ) : (
            renderAddTargetTypeSelector()
          )}
        </DialogContent>
      </Dialog>

      {/* 编辑目标对话框 */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑分发配置</DialogTitle>
            <DialogDescription>修改同步规则和触发方式</DialogDescription>
          </DialogHeader>

          {editTarget?.targetType === "obsidian" && (
            <ObsidianConfigForm
              isEdit
              initialConfig={{
                ...(editTarget.targetConfig as Record<string, unknown>),
                triggerMode: editTarget.trigger.mode,
                scheduleIntervalMinutes:
                  editTarget.trigger.scheduleIntervalMinutes,
              }}
              onSubmit={handleSubmit}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deleteTarget?.name}」吗？此操作无法撤销。
              已同步的内容不会被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
