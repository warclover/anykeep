/**
 * 创建监控对话框组件
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import { useState, useCallback, useEffect } from "react";
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
import { useMonitorActions } from "@/hooks/monitor";
import {
  CHECK_INTERVAL_LABELS,
  type CheckInterval,
} from "@/lib/monitor/constants";

interface CreateMonitorDialogProps {
  /** 对话框开关状态 */
  open: boolean;
  /** 状态变更回调 */
  onOpenChange: (open: boolean) => void;
  /** 关联的书签 */
  bookmark: {
    id: number;
    title: string;
    url: string;
  };
  /** 用户会员类型 */
  membershipType?: "FREE" | "PRO";
  /** 创建成功回调 */
  onSuccess?: () => void;
}

/**
 * 根据会员类型获取可用的检查间隔
 */
function getAllowedIntervals(membershipType: "FREE" | "PRO"): CheckInterval[] {
  if (membershipType === "PRO") {
    return ["every_6h", "twice_daily", "daily", "weekly", "custom"];
  }
  return ["daily", "weekly"];
}

/**
 * 创建监控对话框
 */
export function CreateMonitorDialog({
  open,
  onOpenChange,
  bookmark,
  membershipType = "FREE",
  onSuccess,
}: CreateMonitorDialogProps) {
  const { createMonitor, isLoading } = useMonitorActions();

  // 表单状态
  const [checkInterval, setCheckInterval] = useState<CheckInterval>("daily");
  const [customIntervalHours, setCustomIntervalHours] = useState<number>(24);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowedIntervals = getAllowedIntervals(membershipType);

  // 重置表单
  const resetForm = useCallback(() => {
    setCheckInterval("daily");
    setCustomIntervalHours(24);
    setNotificationEnabled(true);
    setError(null);
  }, []);

  // 对话框关闭时重置
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 对话框关闭时重置表单状态是正确的行为
      resetForm();
    }
  }, [open, resetForm]);

  // 提交表单
  const handleSubmit = async () => {
    setError(null);

    try {
      await createMonitor({
        bookmarkId: bookmark.id,
        checkInterval,
        customIntervalHours:
          checkInterval === "custom" ? customIntervalHours : undefined,
        notificationEnabled,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加页面监控</DialogTitle>
          <DialogDescription>
            监控此页面的内容变化，当页面更新时将收到通知
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 书签信息 */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">监控目标</Label>
            <div className="p-3 bg-muted/50 rounded-md">
              <p className="font-medium text-sm truncate">{bookmark.title}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {bookmark.url}
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
                {Object.entries(CHECK_INTERVAL_LABELS).map(([key, label]) => {
                  const isAllowed = allowedIntervals.includes(
                    key as CheckInterval,
                  );
                  return (
                    <SelectItem
                      key={key}
                      value={key}
                      disabled={!isAllowed}
                      className={!isAllowed ? "opacity-50" : ""}
                    >
                      {label}
                      {!isAllowed && " (PRO)"}
                    </SelectItem>
                  );
                })}
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

            {membershipType === "FREE" && (
              <p className="text-xs text-muted-foreground">
                免费用户支持每日和每周检查，升级 PRO 可解锁更高频率
              </p>
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : (
              "开始监控"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
