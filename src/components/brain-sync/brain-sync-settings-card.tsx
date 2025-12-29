/**
 * Brain-Sync 设置卡片组件
 *
 * 在设置页面中显示 Brain-Sync 相关配置选项
 *
 * @version 1.1.0
 * @since 2025-12-29
 * @updated 2025-12-29 - 启用开关自动保存，无需手动点击保存按钮
 */

"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Calendar, Clock, Bell, Sparkles } from "lucide-react";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 类型定义
// ============================================

interface BrainSyncPreferences {
  enabled: boolean;
  preferredDay: string;
  preferredTime: string;
  weeklyLimit: number;
  notificationChannel: "sidebar" | "push" | "both" | "none";
}

interface BrainSyncStats {
  totalFlashcards: number;
  masteredCount: number;
  learningCount: number;
  pendingCount: number;
}

interface BrainSyncSettingsCardProps {
  userId: string;
}

// ============================================
// 常量
// ============================================

const DAY_OPTIONS = [
  { value: "monday", label: "周一" },
  { value: "tuesday", label: "周二" },
  { value: "wednesday", label: "周三" },
  { value: "thursday", label: "周四" },
  { value: "friday", label: "周五" },
  { value: "saturday", label: "周六" },
  { value: "sunday", label: "周日" },
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: `${i.toString().padStart(2, "0")}:00`,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

const NOTIFICATION_OPTIONS = [
  { value: "sidebar", label: "侧边栏提醒" },
  { value: "push", label: "推送通知" },
  { value: "both", label: "两者都启用" },
  { value: "none", label: "关闭通知" },
];

// ============================================
// 组件实现
// ============================================

export function BrainSyncSettingsCard({ userId }: BrainSyncSettingsCardProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [preferences, setPreferences] = useState<BrainSyncPreferences>({
    enabled: false,
    preferredDay: "monday",
    preferredTime: "09:00",
    weeklyLimit: 10,
    notificationChannel: "sidebar",
  });
  const [stats, setStats] = useState<BrainSyncStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 加载偏好设置
  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await fetch("/api/brain-sync/preferences");
        const data = await response.json();

        if (data.success && data.data.preferences) {
          const prefs = data.data.preferences;
          setPreferences({
            enabled: prefs.enabled,
            preferredDay: prefs.preferredDay,
            preferredTime: prefs.preferredTime,
            weeklyLimit: prefs.weeklyLimit,
            notificationChannel: prefs.notificationChannel,
          });
        }

        // 加载统计信息
        const statsResponse = await fetch(
          "/api/brain-sync/stats?timeRange=all",
        );
        const statsData = await statsResponse.json();

        if (statsData.success && statsData.data) {
          setStats({
            totalFlashcards: statsData.data.stats.totalFlashcards,
            masteredCount: statsData.data.stats.masteredCount,
            learningCount: statsData.data.stats.learningCount,
            pendingCount: statsData.data.stats.pendingCount,
          });
        }
      } catch (err) {
        clientLogger.error(
          { error: err instanceof Error ? err.message : String(err) },
          "Failed to load Brain-Sync preferences",
        );
        setError("加载设置失败");
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [userId]);

  // 保存偏好设置（不包含 enabled，因为它自动保存）
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch("/api/brain-sync/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 注意：不包含 enabled，因为它在切换时自动保存
          preferredDay: preferences.preferredDay,
          preferredTime: preferences.preferredTime,
          weeklyLimit: preferences.weeklyLimit,
          notificationChannel: preferences.notificationChannel,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "保存失败");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      clientLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to save Brain-Sync preferences",
      );
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // 更新单个设置
  const updatePreference = <K extends keyof BrainSyncPreferences>(
    key: K,
    value: BrainSyncPreferences[K],
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  };

  /**
   * 切换启用状态（自动保存）
   * 用户体验优化：启用开关切换后立即保存，无需手动点击保存按钮
   */
  const handleToggleEnabled = async (checked: boolean) => {
    setTogglingEnabled(true);
    setError(null);

    // 乐观更新 UI
    setPreferences((prev) => ({ ...prev, enabled: checked }));

    try {
      const response = await fetch("/api/brain-sync/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });

      const data = await response.json();

      if (!data.success) {
        // 回滚状态
        setPreferences((prev) => ({ ...prev, enabled: !checked }));
        throw new Error(data.error || "切换失败");
      }

      clientLogger.info(
        { enabled: checked },
        "Brain-Sync enabled toggle saved",
      );
    } catch (err) {
      clientLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to toggle Brain-Sync enabled",
      );
      setError(err instanceof Error ? err.message : "切换失败");
    } finally {
      setTogglingEnabled(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Brain-Sync 主动复习
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <CardTitle>Brain-Sync 主动复习</CardTitle>
          </div>
          {preferences.enabled && (
            <Badge
              variant="secondary"
              className="bg-purple-100 text-purple-700"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              已启用
            </Badge>
          )}
        </div>
        <CardDescription>
          使用 SM-2 间隔重复算法，科学安排复习计划，帮助您牢固记忆收藏内容
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 启用开关 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="brain-sync-enabled">启用主动复习</Label>
            <p className="text-sm text-muted-foreground">
              开启后，系统会为您的收藏内容生成复习卡片
            </p>
          </div>
          <Switch
            id="brain-sync-enabled"
            checked={preferences.enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={togglingEnabled}
          />
        </div>

        {/* 统计信息 */}
        {stats && preferences.enabled && (
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.totalFlashcards}</div>
              <div className="text-xs text-muted-foreground">总卡片</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.masteredCount}
              </div>
              <div className="text-xs text-muted-foreground">已掌握</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.learningCount}
              </div>
              <div className="text-xs text-muted-foreground">学习中</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.pendingCount}
              </div>
              <div className="text-xs text-muted-foreground">待学习</div>
            </div>
          </div>
        )}

        {/* 详细设置（仅在启用时显示） */}
        {preferences.enabled && (
          <>
            {/* 首选复习日 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                首选复习日
              </Label>
              <Select
                value={preferences.preferredDay}
                onValueChange={(value) =>
                  updatePreference("preferredDay", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 首选时间 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                首选时间
              </Label>
              <Select
                value={preferences.preferredTime}
                onValueChange={(value) =>
                  updatePreference("preferredTime", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time.value} value={time.value}>
                      {time.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 每周上限 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>每周复习上限</Label>
                <span className="text-sm font-medium">
                  {preferences.weeklyLimit} 张
                </span>
              </div>
              <Slider
                value={[preferences.weeklyLimit]}
                onValueChange={([value]) =>
                  updatePreference("weeklyLimit", value)
                }
                min={5}
                max={50}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                建议每周复习 10-20 张卡片，保持稳定的学习节奏
              </p>
            </div>

            {/* 通知方式 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                通知方式
              </Label>
              <Select
                value={preferences.notificationChannel}
                onValueChange={(value) =>
                  updatePreference(
                    "notificationChannel",
                    value as BrainSyncPreferences["notificationChannel"],
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
            {error}
          </div>
        )}

        {/* 保存按钮 */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            {saveSuccess && (
              <span className="text-green-600">✓ 设置已保存</span>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              "保存设置"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
