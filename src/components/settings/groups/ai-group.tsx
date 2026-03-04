"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ClassificationSettingsCard } from "../classification-settings-card";
import { SummaryModeSettingsCard } from "../summary-mode-settings-card";
import { TrustModeSettingsCard } from "../trust-mode-settings-card";
import { AIProviderSettingsCard } from "../ai-provider-settings-card";
import {
  SettingsGroupSection,
  SettingsItemCard,
} from "../settings-group-section";
import { SETTINGS_GROUPS } from "../settings-config";
import { useUiText } from "@/lib/i18n";
import type { UserSettings } from "@/types/user-settings";

interface AIGroupProps {
  settings: UserSettings;
  updateSetting: (
    category: keyof UserSettings,
    key: string,
    value: boolean,
  ) => void;
}

export function AIGroup({ settings, updateSetting }: AIGroupProps) {
  const t = useUiText();

  return (
    <SettingsGroupSection group={SETTINGS_GROUPS[2]}>
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

      <div id="settings-item-ai-classification">
        <ClassificationSettingsCard />
      </div>

      <div id="settings-item-ai-summary-mode">
        <SummaryModeSettingsCard />
      </div>

      <div id="settings-item-ai-trust-mode">
        <TrustModeSettingsCard />
      </div>

      <div id="settings-item-ai-ai-provider">
        <AIProviderSettingsCard />
      </div>
    </SettingsGroupSection>
  );
}
