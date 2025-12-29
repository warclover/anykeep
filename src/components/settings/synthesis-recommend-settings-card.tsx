/**
 * 综述推荐设置卡片
 *
 * 用于开启/关闭 AI 智能推荐功能
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useState, useEffect } from "react";
import { Lightbulb, RefreshCw, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSynthesisRecommend } from "@/hooks/synthesis/use-synthesis-recommend";
import { RECOMMEND_LIMITS } from "@/lib/synthesis/types/recommend";

export function SynthesisRecommendSettingsCard() {
  const { preferences, isLoading, toggleEnabled, refresh } =
    useSynthesisRecommend({
      autoFetch: true,
      autoShowBubble: false, // 设置页面不自动显示气泡
    });

  const [localEnabled, setLocalEnabled] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // 同步本地状态
  useEffect(() => {
    if (preferences) {
      setLocalEnabled(preferences.enabled);
    }
  }, [preferences]);

  // 处理开关切换
  const handleToggle = async (checked: boolean) => {
    setLocalEnabled(checked);
    setIsUpdating(true);
    try {
      await toggleEnabled(checked);
    } finally {
      setIsUpdating(false);
    }
  };

  // 清除已忽略的主题
  const handleClearDismissed = async () => {
    try {
      const response = await fetch("/api/synthesis/recommend/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clearDismissed: true,
        }),
      });
      if (response.ok) {
        refresh();
      }
    } catch {
      // 忽略错误
    }
  };

  const dismissedCount = preferences?.dismissedTopics.length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-5 text-amber-500" />
          综述智能推荐
        </CardTitle>
        <CardDescription>
          AI 会根据您的收藏内容，主动推荐可以生成综述的相似主题
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="size-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">加载中...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 启用开关 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor="synthesis-recommend-toggle"
                  className="text-base font-medium"
                >
                  启用智能推荐
                </Label>
                <p className="text-sm text-muted-foreground">
                  开启后，当检测到可合成主题时会显示推荐气泡
                </p>
              </div>
              <Switch
                id="synthesis-recommend-toggle"
                checked={localEnabled}
                onCheckedChange={handleToggle}
                disabled={isUpdating}
              />
            </div>

            <Separator />

            {/* 推荐限制说明 */}
            <div className="space-y-2">
              <div className="text-sm font-medium">推荐频率</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  每日最多 {RECOMMEND_LIMITS.MAX_DAILY_SHOWS} 次
                </Badge>
                <Badge variant="outline" className="text-xs">
                  间隔至少 {RECOMMEND_LIMITS.MIN_SHOW_INTERVAL / 60000} 分钟
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {RECOMMEND_LIMITS.AUTO_DISMISS_DELAY / 1000} 秒后自动关闭
                </Badge>
              </div>
            </div>

            <Separator />

            {/* 已忽略主题管理 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">已忽略的主题</div>
                <p className="text-sm text-muted-foreground">
                  您选择不再提示的推荐主题
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{dismissedCount} 个</Badge>
                {dismissedCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearDismissed}
                    className="text-xs h-7"
                  >
                    <Trash2 className="size-3 mr-1" />
                    清除
                  </Button>
                )}
              </div>
            </div>

            {/* 今日已显示次数 */}
            {preferences && preferences.dailyShowCount > 0 && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">今日已推荐</span>
                  <span>
                    {preferences.dailyShowCount} /{" "}
                    {RECOMMEND_LIMITS.MAX_DAILY_SHOWS} 次
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
