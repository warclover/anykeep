/**
 * 设置页面客户端组件
 */

"use client";

import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Shield,
  Sparkles,
  Bell,
  Link as LinkIcon,
  User as UserIcon,
  Download,
  Trash2,
  LogOut,
  Check,
} from "lucide-react";
import { InterestSettingsCard } from "./interest-settings-card";
import { ProfileSettingsCard } from "./profile-settings-card";
import { ClassificationSettingsCard } from "./classification-settings-card";
import { TrustModeSettingsCard } from "./trust-mode-settings-card";
import { SummaryModeSettingsCard } from "./summary-mode-settings-card";
import { AIOperationHistoryCard } from "./ai-operation-history-card";
import { NotificationSettingsCard } from "@/components/messages";
import { SnapshotQuotaSectionLazy } from "@/components/snapshot";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorMessage } from "@/components/ui/error-message";
import { clientLogger } from "@/lib/client-logger";
import type { User } from "@supabase/supabase-js";
import type { UserSettings } from "@/types/user-settings";
import { ALL_PLATFORMS } from "@/lib/constants/platforms";

interface SettingsPageClientProps {
  user: User;
  settings: UserSettings;
  error?: string;
}

export function SettingsPageClient({
  user,
  settings: initialSettings,
  error,
}: SettingsPageClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleRetry = () => {
    router.refresh();
  };

  // 更新设置
  const updateSetting = (
    category: keyof UserSettings,
    key: string,
    value: boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    // 清除之前的保存状态
    setSaveSuccess(false);
    setSaveError(null);
  };

  // 保存设置到数据库
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/user/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "保存失败");
      }

      setSaveSuccess(true);
      // 3秒后自动隐藏成功提示
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存设置失败";
      setSaveError(message);
      clientLogger.error({ error: message }, "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // 平台授权
  const handlePlatformAuth = (_platform: string) => {
    // TODO: 实现平台 OAuth 流程
  };

  // 导出数据
  const handleExportData = async () => {
    // TODO: 实现数据导出
  };

  // 删除账号
  const handleDeleteAccount = async () => {
    if (confirm("确定要删除账号吗？此操作不可逆！")) {
      // TODO: 实现账号删除
    }
  };

  // 登出
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold mb-2">
              设置
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              管理你的账号、授权和偏好设置
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-sm text-red-600 dark:text-red-400">
                {saveError}
              </span>
            )}
            {saveSuccess && (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <Check className="size-4" />
                已保存
              </span>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存设置"}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-6">
        {error ? (
          <ErrorMessage message={error} retry={handleRetry} />
        ) : (
          <div className="max-w-4xl space-y-6">
            {/* 账号信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="size-5 text-purple-600 dark:text-purple-400" />
                  账号信息
                </CardTitle>
                <CardDescription>管理你的个人信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      邮箱地址
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {user.email}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-600 dark:text-green-300"
                  >
                    已验证
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      用户 ID
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {user.id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 平台授权管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="size-5 text-blue-600 dark:text-blue-400" />
                  平台授权管理
                </CardTitle>
                <CardDescription>
                  连接你的社交媒体账号，自动同步收藏内容
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {ALL_PLATFORMS.map((platform) => (
                  <div
                    key={platform.key}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 ${platform.bgColor} rounded-lg flex items-center justify-center text-white text-xl`}
                      >
                        {platform.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {platform.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {settings.platforms[
                            platform.key as keyof typeof settings.platforms
                          ]
                            ? "已连接"
                            : "未连接"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={
                        settings.platforms[
                          platform.key as keyof typeof settings.platforms
                        ]
                          ? "outline"
                          : "default"
                      }
                      size="sm"
                      onClick={() => handlePlatformAuth(platform.key)}
                    >
                      {settings.platforms[
                        platform.key as keyof typeof settings.platforms
                      ]
                        ? "断开"
                        : "连接"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 兴趣领域设置 */}
            <InterestSettingsCard />

            {/* 智能分类设置 - V3.0 */}
            <ClassificationSettingsCard />

            {/* 托管模式设置 - V4.2 */}
            <TrustModeSettingsCard />

            {/* 摘要模式设置 - V3.0 */}
            <SummaryModeSettingsCard />

            {/* AI 操作历史 - V4.2 */}
            <AIOperationHistoryCard />

            {/* 扩展画像设置 */}
            <ProfileSettingsCard />

            {/* 网页快照配额 - V4.2.1 */}
            <SnapshotQuotaSectionLazy />

            {/* AI 智能功能 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-purple-600 dark:text-purple-400" />
                  AI 智能功能
                </CardTitle>
                <CardDescription>配置 AI 自动处理和分析功能</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="auto-tags"
                      className="text-sm font-medium cursor-pointer"
                    >
                      自动标签生成
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      使用 AI 为收藏内容自动生成相关标签
                    </p>
                  </div>
                  <Switch
                    id="auto-tags"
                    checked={settings.ai.autoTags}
                    onCheckedChange={(value) =>
                      updateSetting("ai", "autoTags", value)
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="auto-summary"
                      className="text-sm font-medium cursor-pointer"
                    >
                      自动摘要生成
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      自动为长文章生成简洁的摘要
                    </p>
                  </div>
                  <Switch
                    id="auto-summary"
                    checked={settings.ai.autoSummary}
                    onCheckedChange={(value) =>
                      updateSetting("ai", "autoSummary", value)
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="semantic-search"
                      className="text-sm font-medium cursor-pointer"
                    >
                      语义搜索
                      <Badge
                        variant="outline"
                        className="ml-2 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300 text-xs"
                      >
                        实验性
                      </Badge>
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      使用 AI 理解搜索意图，获得更准确的结果
                    </p>
                  </div>
                  <Switch
                    id="semantic-search"
                    checked={settings.ai.semanticSearch}
                    onCheckedChange={(value) =>
                      updateSetting("ai", "semanticSearch", value)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* 隐私与安全 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-green-600 dark:text-green-400" />
                  隐私与安全
                </CardTitle>
                <CardDescription>保护你的数据和隐私</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="data-encryption"
                      className="text-sm font-medium cursor-pointer"
                    >
                      数据加密
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      启用端到端加密保护你的收藏内容
                    </p>
                  </div>
                  <Switch
                    id="data-encryption"
                    checked={settings.privacy.dataEncryption}
                    onCheckedChange={(value) =>
                      updateSetting("privacy", "dataEncryption", value)
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="share-analytics"
                      className="text-sm font-medium cursor-pointer"
                    >
                      分享使用数据
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      帮助我们改进产品（不包含个人隐私）
                    </p>
                  </div>
                  <Switch
                    id="share-analytics"
                    checked={settings.privacy.shareAnalytics}
                    onCheckedChange={(value) =>
                      updateSetting("privacy", "shareAnalytics", value)
                    }
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleExportData}
                  >
                    <Download className="size-4 mr-2" />
                    导出我的数据
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
                    onClick={handleDeleteAccount}
                  >
                    <Trash2 className="size-4 mr-2" />
                    删除我的账号
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 通知偏好 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="size-5 text-orange-600 dark:text-orange-400" />
                  通知偏好
                </CardTitle>
                <CardDescription>管理通知方式和频率</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="email-notifications"
                      className="text-sm font-medium cursor-pointer"
                    >
                      邮件通知
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      接收重要更新和提醒邮件
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={settings.notifications.email}
                    onCheckedChange={(value) =>
                      updateSetting("notifications", "email", value)
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="in-app-notifications"
                      className="text-sm font-medium cursor-pointer"
                    >
                      应用内通知
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      在应用内显示通知提示
                    </p>
                  </div>
                  <Switch
                    id="in-app-notifications"
                    checked={settings.notifications.inApp}
                    onCheckedChange={(value) =>
                      updateSetting("notifications", "inApp", value)
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="weekly-digest"
                      className="text-sm font-medium cursor-pointer"
                    >
                      每周摘要
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      每周一封收藏统计和推荐邮件
                    </p>
                  </div>
                  <Switch
                    id="weekly-digest"
                    checked={settings.notifications.weeklyDigest}
                    onCheckedChange={(value) =>
                      updateSetting("notifications", "weeklyDigest", value)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* 消息通知设置（分级控制） */}
            <NotificationSettingsCard />

            {/* 账号操作 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="size-5 text-gray-600 dark:text-gray-400" />
                  账号操作
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleLogout}
                >
                  <LogOut className="size-4 mr-2" />
                  退出登录
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
