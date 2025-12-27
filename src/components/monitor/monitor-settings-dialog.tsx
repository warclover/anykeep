/**
 * 监控设置对话框组件
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import { useState, useEffect } from "react";
import { Loader2, Clock, Bell, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitor, useMonitorActions } from "@/hooks/monitor";
import {
  CHECK_INTERVAL_LABELS,
  type CheckInterval,
} from "@/lib/monitor/constants";

interface MonitorSettingsDialogProps {
  /** 对话框开关状态 */
  open: boolean;
  /** 状态变更回调 */
  onOpenChange: (open: boolean) => void;
  /** 监控 ID */
  monitorId: number | null;
}

/**
 * 监控设置对话框
 */
export function MonitorSettingsDialog({
  open,
  onOpenChange,
  monitorId,
}: MonitorSettingsDialogProps) {
  const { monitor, isLoading: isLoadingMonitor } = useMonitor(
    open ? monitorId : null,
  );
  const { updateMonitor, isLoading: isUpdating } = useMonitorActions();

  // 表单状态
  const [checkInterval, setCheckInterval] = useState<CheckInterval>("daily");
  const [customIntervalHours, setCustomIntervalHours] = useState<number>(24);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 同步表单状态
  useEffect(() => {
    if (monitor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 从 API 数据同步到表单状态是正确的行为
      setCheckInterval(monitor.checkInterval);

      setCustomIntervalHours(monitor.customIntervalHours || 24);

      setNotificationEnabled(monitor.notificationEnabled);

      setError(null);
    }
  }, [monitor]);

  // 检查是否有变更
  const hasChanges = monitor
    ? checkInterval !== monitor.checkInterval ||
      (checkInterval === "custom" &&
        customIntervalHours !== monitor.customIntervalHours) ||
      notificationEnabled !== monitor.notificationEnabled
    : false;

  // 提交表单
  const handleSubmit = async () => {
    if (!monitorId) return;
    setError(null);

    try {
      await updateMonitor(monitorId, {
        checkInterval,
        customIntervalHours:
          checkInterval === "custom" ? customIntervalHours : undefined,
        notificationEnabled,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>监控设置</DialogTitle>
          <DialogDescription>修改此监控的检查频率和通知设置</DialogDescription>
        </DialogHeader>

        {isLoadingMonitor ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : monitor ? (
          <div className="space-y-4 py-4">
            {/* 书签信息 */}
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">监控目标</Label>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="font-medium text-sm truncate">
                  {monitor.bookmarkTitle}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {monitor.bookmarkUrl}
                </p>
              </div>
            </div>

            {/* 检查间隔 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                检查频率
              </Label>
              <Select
                value={checkInterval}
                onValueChange={(value) =>
                  setCheckInterval(value as CheckInterval)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHECK_INTERVAL_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 自定义间隔输入 */}
              {checkInterval === "custom" && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    value={customIntervalHours}
                    onChange={(e) =>
                      setCustomIntervalHours(parseInt(e.target.value, 10) || 24)
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">小时</span>
                </div>
              )}
            </div>

            {/* 通知设置 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5">
                  <Bell className="h-4 w-4" />
                  变更通知
                </Label>
                <p className="text-xs text-muted-foreground">
                  页面内容变化时发送通知
                </p>
              </div>
              <Switch
                checked={notificationEnabled}
                onCheckedChange={setNotificationEnabled}
              />
            </div>

            {/* 错误提示 */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            监控不存在
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isUpdating || !hasChanges || !monitor}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              "保存设置"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
