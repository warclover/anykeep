/**
 * 设置页面客户端组件 - 重构版
 * 采用左侧导航 + 右侧内容的分组布局
 */

"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, LogOut, Check } from "lucide-react";
import { InterestSettingsCard } from "./interest-settings-card";
import { ProfileSettingsCard } from "./profile-settings-card";
import { ClassificationSettingsCard } from "./classification-settings-card";
import { TrustModeSettingsCard } from "./trust-mode-settings-card";
import { SummaryModeSettingsCard } from "./summary-mode-settings-card";
import { AIOperationHistoryCard } from "./ai-operation-history-card";
import { AIProviderSettingsCard } from "./ai-provider-settings-card";
import { ColorThemeSelector } from "./color-theme-selector";
import { NotificationSettingsCard } from "@/components/messages";
import { SnapshotQuotaSectionLazy } from "@/components/snapshot";
import { AutoSnapshotSettings } from "./auto-snapshot-settings";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorMessage } from "@/components/ui/error-message";
import { clientLogger } from "@/lib/client-logger";
import type { User } from "@supabase/supabase-js";
import type { UserSettings } from "@/types/user-settings";
import { ALL_PLATFORMS } from "@/lib/constants/platforms";

// 新增组件导入
import { SettingsSidebar } from "./settings-sidebar";
import { SettingsMobileNav, SettingsMobileHeader } from "./settings-mobile-nav";
import {
  SettingsGroupSection,
  SettingsItemCard,
} from "./settings-group-section";
import { SETTINGS_GROUPS } from "./settings-config";
// 国际化
import { useUiText } from "@/lib/i18n";
import { useDeveloperMode } from "@/hooks/core/use-developer-mode";

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
  // 国际化
  const t = useUiText();
  // 开发者模式
  const { isDeveloperMode, setDeveloperMode } = useDeveloperMode();

  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 当前激活的分组 ID
  const [activeGroupId, setActiveGroupId] = useState<string>("account");
  // 移动端: 是否显示分组详情（null 表示显示分组列表）
  const [mobileSelectedGroup, setMobileSelectedGroup] = useState<string | null>(
    null,
  );

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
  const handlePlatformAuth = (platform: string) => {
    alert(t.settings.platformAuth.comingSoon.replace("{platform}", platform));
  };

  // 导出数据
  const [exporting, setExporting] = useState(false);
  const handleExportData = async () => {
    if (exporting) return;

    setExporting(true);
    try {
      const response = await fetch("/api/user/export", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(t.settings.export.failed);
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || "anykeep-export.json";

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      clientLogger.info({}, "Data exported successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.settings.export.failed;
      alert(message);
      clientLogger.error({ error: message }, "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  // 删除账号
  const [deleting, setDeleting] = useState(false);
  const handleDeleteAccount = async () => {
    if (!confirm(t.settings.deleteAccount.confirm)) {
      return;
    }

    const confirmEmail = prompt(t.settings.deleteAccount.promptEmail);
    if (!confirmEmail) {
      return;
    }

    if (confirmEmail !== user.email) {
      alert(t.settings.deleteAccount.emailMismatch);
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmDelete: true,
          confirmEmail,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.error?.message || t.settings.deleteAccount.failed,
        );
      }

      alert(t.settings.deleteAccount.deleted);
      router.push("/login");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t.settings.deleteAccount.failed;
      alert(message);
      clientLogger.error({ error: message }, "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  // 登出
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 处理分组点击
  const handleGroupClick = useCallback((groupId: string) => {
    setActiveGroupId(groupId);
  }, []);

  // 移动端: 选择分组
  const handleMobileGroupSelect = useCallback((groupId: string) => {
    setMobileSelectedGroup(groupId);
    setActiveGroupId(groupId);
  }, []);

  // 移动端: 返回分组列表
  const handleMobileBack = useCallback(() => {
    setMobileSelectedGroup(null);
  }, []);

  // 获取当前选中的分组配置
  const selectedGroup = SETTINGS_GROUPS.find(
    (g) => g.id === mobileSelectedGroup,
  );

  // 渲染分组内容
  const renderGroupContent = (groupId: string) => {
    switch (groupId) {
      case "account":
        return (
          <SettingsGroupSection group={SETTINGS_GROUPS[0]}>
            {/* 账号信息 */}
            <SettingsItemCard
              id="settings-item-account-account-info"
              title={t.settings.account.basicInfo}
              description={t.settings.account.basicInfoDesc}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t.settings.account.emailAddress}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {user.email}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-600 dark:text-green-300"
                  >
                    {t.settings.account.verified}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t.settings.account.userId}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {user.id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
              </div>
            </SettingsItemCard>

            {/* 用户画像 */}
            <div id="settings-item-account-profile">
              <ProfileSettingsCard />
            </div>

            {/* 兴趣领域 */}
            <div id="settings-item-account-interests">
              <InterestSettingsCard />
            </div>
          </SettingsGroupSection>
        );

      case "appearance":
        return (
          <SettingsGroupSection group={SETTINGS_GROUPS[1]}>
            <SettingsItemCard
              id="settings-item-appearance-theme"
              title={t.settings.appearance.colorTheme}
              description={t.settings.appearance.colorThemeDesc}
            >
              <ColorThemeSelector />
            </SettingsItemCard>
          </SettingsGroupSection>
        );

      case "ai":
        return (
          <SettingsGroupSection group={SETTINGS_GROUPS[2]}>
            {/* AI 功能开关 */}
            <SettingsItemCard
              id="settings-item-ai-ai-features"
              title={t.settings.ai.features}
              description={t.settings.ai.featuresDesc}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="auto-tags"
                      className="text-sm font-medium cursor-pointer"
                    >
                      {t.settings.ai.autoTags}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t.settings.ai.autoTagsDesc}
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
                      {t.settings.ai.autoSummary}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t.settings.ai.autoSummaryDesc}
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
                      {t.settings.ai.semanticSearch}
                      <Badge
                        variant="outline"
                        className="ml-2 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300 text-xs"
                      >
                        {t.settings.ai.experimental}
                      </Badge>
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t.settings.ai.semanticSearchDesc}
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
              </div>
            </SettingsItemCard>

            {/* 智能分类 */}
            <div id="settings-item-ai-classification">
              <ClassificationSettingsCard />
            </div>

            {/* 摘要模式 */}
            <div id="settings-item-ai-summary-mode">
              <SummaryModeSettingsCard />
            </div>

            {/* 托管模式 */}
            <div id="settings-item-ai-trust-mode">
              <TrustModeSettingsCard />
            </div>

            {/* AI 服务商 */}
            <div id="settings-item-ai-ai-provider">
              <AIProviderSettingsCard />
            </div>
          </SettingsGroupSection>
        );

      case "content":
        return (
          <SettingsGroupSection group={SETTINGS_GROUPS[3]}>
            {/* 快照配额 */}
            <div id="settings-item-content-snapshot-quota">
              <SnapshotQuotaSectionLazy />
            </div>

            {/* 自动快照 */}
            <div id="settings-item-content-auto-snapshot">
              <AutoSnapshotSettings />
            </div>
          </SettingsGroupSection>
        );

      case "platforms":
        return (
          <SettingsGroupSection group={SETTINGS_GROUPS[4]}>
            <SettingsItemCard
              id="settings-item-platforms-platform-auth"
              title={t.settings.platforms.title}
              description={t.settings.platforms.description}
            >
              <div className="space-y-4">
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
                            ? t.settings.platforms.connected
                            : t.settings.platforms.disconnected}
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
                        ? t.settings.platforms.disconnect
                        : t.settings.platforms.connect}
                    </Button>
                  </div>
                ))}
              </div>
            </SettingsItemCard>
          </SettingsGroupSection>
        );

      case "notifications":
        return (
          <SettingsGroupSection group={SETTINGS_GROUPS[5]}>
            {/* 通知偏好 */}
            <SettingsItemCard
              id="settings-item-notifications-notification-prefs"
              title={t.settings.notifications.title}
              description={t.settings.notifications.description}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="email-notifications"
                      className="text-sm font-medium cursor-pointer"
                    >
                      {t.settings.notifications.email}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t.settings.notifications.emailDesc}
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
                      {t.settings.notifications.inApp}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t.settings.notifications.inAppDesc}
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
                      {t.settings.notifications.weeklyDigest}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t.settings.notifications.weeklyDigestDesc}
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
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="show-welcome-message"
                      className="text-sm font-medium cursor-pointer"
                    >
                      {t.settings.notifications.showWelcomeMessage ||
                        "欢迎消息"}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t.settings.notifications.showWelcomeMessageDesc ||
                        "首页顶部显示欢迎回来和离线变化统计"}
                    </p>
                  </div>
                  <Switch
                    id="show-welcome-message"
                    checked={settings.notifications.showWelcomeMessage ?? false}
                    onCheckedChange={(value) =>
                      updateSetting(
                        "notifications",
                        "showWelcomeMessage",
                        value,
                      )
                    }
                  />
                </div>
              </div>
            </SettingsItemCard>

            {/* 消息分级 */}
            <div id="settings-item-notifications-notification-levels">
              <NotificationSettingsCard />
            </div>
          </SettingsGroupSection>
        );

      case "privacy":
        return (
          <SettingsGroupSection group={SETTINGS_GROUPS[6]}>
            {/* 数据安全 */}
            <SettingsItemCard
              id="settings-item-privacy-data-security"
              title={t.settings.privacy.title}
              description={t.settings.privacy.description}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Label
                      htmlFor="data-encryption"
                      className="text-sm font-medium cursor-pointer"
                    >
                      {t.settings.privacy.dataEncryption}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t.settings.privacy.dataEncryptionDesc}
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
                      {t.settings.privacy.shareAnalytics}
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t.settings.privacy.shareAnalyticsDesc}
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
              </div>
            </SettingsItemCard>

            {/* 账号管理 */}
            <SettingsItemCard
              id="settings-item-privacy-account-actions"
              title={t.settings.privacy.accountActions}
              description={t.settings.privacy.accountActionsDesc}
            >
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleExportData}
                  disabled={exporting}
                >
                  <Download className="size-4 mr-2" />
                  {exporting
                    ? t.settings.export.exporting
                    : t.settings.export.button}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  <Trash2 className="size-4 mr-2" />
                  {deleting
                    ? t.settings.deleteAccount.deleting
                    : t.settings.deleteAccount.button}
                </Button>
              </div>
            </SettingsItemCard>

            {/* 开发者模式 */}
            <SettingsItemCard
              id="settings-item-privacy-developer-mode"
              title={t.settings.privacy.developerMode}
              description={t.settings.privacy.developerModeDesc}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 pr-4">
                  <Label
                    htmlFor="developer-mode"
                    className="text-sm font-medium cursor-pointer"
                  >
                    {t.settings.privacy.developerMode}
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t.settings.privacy.developerModeDesc}
                  </p>
                </div>
                <Switch
                  id="developer-mode"
                  checked={isDeveloperMode}
                  onCheckedChange={(value) => setDeveloperMode(value)}
                />
              </div>
            </SettingsItemCard>
          </SettingsGroupSection>
        );

      case "support":
        return (
          <SettingsGroupSection group={SETTINGS_GROUPS[7]}>
            {/* AI 操作历史 */}
            <div id="settings-item-support-ai-history">
              <AIOperationHistoryCard />
            </div>

            {/* 帮助反馈 */}
            <SettingsItemCard
              id="settings-item-support-feedback"
              title={t.settings.support.title}
              description={t.settings.support.description}
            >
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push("/settings/feedback")}
              >
                {t.settings.support.myFeedback}
              </Button>
            </SettingsItemCard>
          </SettingsGroupSection>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold">
              {t.settings.header.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {t.settings.header.description}
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
                {t.settings.header.saved}
              </span>
            )}
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? t.settings.header.saving : t.settings.header.save}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="hidden sm:flex"
            >
              <LogOut className="size-4 mr-2" />
              {t.settings.header.logout}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      {error ? (
        <div className="flex-1 p-4 md:p-6">
          <ErrorMessage message={error} retry={handleRetry} />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* 桌面端: 左侧导航 */}
          <SettingsSidebar
            activeGroupId={activeGroupId}
            onGroupClick={handleGroupClick}
          />

          {/* 内容区域 */}
          <main className="flex-1 overflow-auto">
            <div className="p-4 md:p-6 max-w-3xl">
              {/* 移动端: 分组导航或分组详情 */}
              {mobileSelectedGroup === null ? (
                <SettingsMobileNav onGroupSelect={handleMobileGroupSelect} />
              ) : (
                selectedGroup && (
                  <>
                    <SettingsMobileHeader
                      group={selectedGroup}
                      onBack={handleMobileBack}
                    />
                    {renderGroupContent(mobileSelectedGroup)}
                  </>
                )
              )}

              {/* 桌面端: 显示所有分组 */}
              <div className="hidden lg:block space-y-8">
                {SETTINGS_GROUPS.map((group) => (
                  <div key={group.id}>{renderGroupContent(group.id)}</div>
                ))}

                {/* 退出登录 - 桌面端底部 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {t.settings.footer.accountActions}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={handleLogout}
                    >
                      <LogOut className="size-4 mr-2" />
                      {t.settings.header.logout}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* 移动端: 底部退出登录按钮 */}
      {mobileSelectedGroup === null && (
        <div className="lg:hidden p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={handleLogout}
          >
            <LogOut className="size-4 mr-2" />
            {t.settings.header.logout}
          </Button>
        </div>
      )}
    </div>
  );
}
