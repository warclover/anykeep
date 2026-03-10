/**
 * 通知偏好设置组件
 * 管理消息通知的展示方式和偏好
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Volume2,
  VolumeX,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import { API_SETTINGS } from "@/lib/constants/api-paths";
import type { NotificationPreferences } from "@/lib/messages/types";

// 默认偏好值
const DEFAULT_PREFERENCES: NotificationPreferences = {
  silent_toast: false,
  normal_toast: true,
  important_toast: true,
  web_push_enabled: false,
  web_push_subscription: null,
  do_not_disturb: false,
  dnd_start_time: null,
  dnd_end_time: null,
};

export function NotificationSettingsCard() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 加载偏好设置
  const loadPreferences = useCallback(async () => {
    try {
      const response = await fetch(API_SETTINGS.notifications);
      const result = await response.json();

      if (result.success && result.data) {
        setPreferences(result.data);
      }
    } catch (error) {
      clientLogger.error({ error }, "Failed to load notification preferences");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // 更新单个偏好
  const updatePreference = (
    key: keyof NotificationPreferences,
    value: boolean,
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };

  // 保存偏好
  const savePreferences = async () => {
    setSaving(true);
    try {
      const response = await fetch(API_SETTINGS.notifications, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("通知设置已保存");
        setHasChanges(false);
      } else {
        throw new Error(result.error?.message || "保存失败");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      toast.error(message);
      clientLogger.error({ error }, "Failed to save notification preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5 text-orange-600 dark:text-orange-400" />
            消息通知设置
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5 text-orange-600 dark:text-orange-400" />
              消息通知设置
            </CardTitle>
            <CardDescription className="mt-1.5">
              管理不同级别消息的通知方式
            </CardDescription>
          </div>
          {hasChanges && (
            <Button onClick={savePreferences} disabled={saving} size="sm">
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存更改"
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 消息分级说明 */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
          <h4 className="text-sm font-medium">消息等级说明</h4>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-gray-400" />
              <span className="text-muted-foreground">
                <strong>静默消息</strong>：自动分类、批量操作等日常记录
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">
                <strong>普通消息</strong>：导入完成、分类建议等需知晓的信息
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">
                <strong>重要消息</strong>：配额预警、系统公告等关键提醒
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* 弹窗通知设置 */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Volume2 className="size-4" />
            弹窗通知 (Toast)
          </h4>

          {/* 静默消息 */}
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label
                htmlFor="silent-toast"
                className="text-sm font-medium cursor-pointer flex items-center gap-2"
              >
                <div className="size-2 rounded-full bg-gray-400" />
                静默消息弹窗
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                自动分类完成、批量操作等操作记录
              </p>
            </div>
            <Switch
              id="silent-toast"
              checked={preferences.silent_toast}
              onCheckedChange={(value) =>
                updatePreference("silent_toast", value)
              }
            />
          </div>

          {/* 普通消息 */}
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label
                htmlFor="normal-toast"
                className="text-sm font-medium cursor-pointer flex items-center gap-2"
              >
                <div className="size-2 rounded-full bg-blue-500" />
                普通消息弹窗
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                导入完成、分类建议等需要知晓的信息
              </p>
            </div>
            <Switch
              id="normal-toast"
              checked={preferences.normal_toast}
              onCheckedChange={(value) =>
                updatePreference("normal_toast", value)
              }
            />
          </div>

          {/* 重要消息 */}
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label
                htmlFor="important-toast"
                className="text-sm font-medium cursor-pointer flex items-center gap-2"
              >
                <div className="size-2 rounded-full bg-orange-500" />
                重要消息弹窗
                <Badge variant="secondary" className="text-xs">
                  推荐开启
                </Badge>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                配额预警、系统公告等关键提醒
              </p>
            </div>
            <Switch
              id="important-toast"
              checked={preferences.important_toast}
              onCheckedChange={(value) =>
                updatePreference("important_toast", value)
              }
            />
          </div>
        </div>

        <Separator />

        {/* 勿扰模式 */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <VolumeX className="size-4" />
            勿扰模式
          </h4>

          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label
                htmlFor="do-not-disturb"
                className="text-sm font-medium cursor-pointer"
              >
                开启勿扰模式
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                开启后，所有弹窗通知将被静默，但消息仍会记录到消息中心
              </p>
            </div>
            <Switch
              id="do-not-disturb"
              checked={preferences.do_not_disturb}
              onCheckedChange={(value) =>
                updatePreference("do_not_disturb", value)
              }
            />
          </div>

          {preferences.do_not_disturb && (
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-3 flex items-start gap-2">
              <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-orange-700 dark:text-orange-300">
                勿扰模式已开启，您将不会收到任何弹窗通知。重要消息仍会显示在消息中心。
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* 浏览器推送（预留） */}
        <div className="space-y-4 opacity-60">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Info className="size-4" />
            浏览器推送
            <Badge variant="outline" className="text-xs">
              即将推出
            </Badge>
          </h4>

          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label className="text-sm font-medium text-muted-foreground">
                启用浏览器推送通知
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                即使不在页面也能收到重要消息提醒
              </p>
            </div>
            <Switch disabled checked={false} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type { NotificationPreferences };
