"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { NotificationSettingsCard } from "@/components/messages";
import {
  SettingsGroupSection,
  SettingsItemCard,
} from "../settings-group-section";
import { SETTINGS_GROUPS } from "../settings-config";
import { useUiText } from "@/lib/i18n";
import type { UserSettings } from "@/types/user-settings";

interface NotificationsGroupProps {
  settings: UserSettings;
  updateSetting: (
    category: keyof UserSettings,
    key: string,
    value: boolean,
  ) => void;
}

export function NotificationsGroup({
  settings,
  updateSetting,
}: NotificationsGroupProps) {
  const t = useUiText();

  return (
    <SettingsGroupSection group={SETTINGS_GROUPS[5]}>
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
                {t.settings.notifications.showWelcomeMessage || "欢迎消息"}
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
                updateSetting("notifications", "showWelcomeMessage", value)
              }
            />
          </div>
        </div>
      </SettingsItemCard>

      <div id="settings-item-notifications-notification-levels">
        <NotificationSettingsCard />
      </div>
    </SettingsGroupSection>
  );
}
