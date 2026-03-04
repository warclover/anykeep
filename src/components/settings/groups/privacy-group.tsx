"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";
import {
  SettingsGroupSection,
  SettingsItemCard,
} from "../settings-group-section";
import { SETTINGS_GROUPS } from "../settings-config";
import { useUiText } from "@/lib/i18n";
import { useDeveloperMode } from "@/hooks/core/use-developer-mode";
import type { UserSettings } from "@/types/user-settings";

interface PrivacyGroupProps {
  settings: UserSettings;
  updateSetting: (
    category: keyof UserSettings,
    key: string,
    value: boolean,
  ) => void;
  exporting: boolean;
  deleting: boolean;
  onExportData: () => void;
  onDeleteAccount: () => void;
}

export function PrivacyGroup({
  settings,
  updateSetting,
  exporting,
  deleting,
  onExportData,
  onDeleteAccount,
}: PrivacyGroupProps) {
  const t = useUiText();
  const { isDeveloperMode, setDeveloperMode } = useDeveloperMode();

  return (
    <SettingsGroupSection group={SETTINGS_GROUPS[6]}>
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

      <SettingsItemCard
        id="settings-item-privacy-account-actions"
        title={t.settings.privacy.accountActions}
        description={t.settings.privacy.accountActionsDesc}
      >
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={onExportData}
            disabled={exporting}
          >
            <Download className="size-4 mr-2" />
            {exporting ? t.settings.export.exporting : t.settings.export.button}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
            onClick={onDeleteAccount}
            disabled={deleting}
          >
            <Trash2 className="size-4 mr-2" />
            {deleting
              ? t.settings.deleteAccount.deleting
              : t.settings.deleteAccount.button}
          </Button>
        </div>
      </SettingsItemCard>

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
}
