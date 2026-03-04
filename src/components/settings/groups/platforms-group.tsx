"use client";

import { Button } from "@/components/ui/button";
import {
  SettingsGroupSection,
  SettingsItemCard,
} from "../settings-group-section";
import { SETTINGS_GROUPS } from "../settings-config";
import { ALL_PLATFORMS } from "@/lib/constants/platforms";
import { useUiText } from "@/lib/i18n";
import type { UserSettings } from "@/types/user-settings";

interface PlatformsGroupProps {
  settings: UserSettings;
}

export function PlatformsGroup({ settings }: PlatformsGroupProps) {
  const t = useUiText();

  const handlePlatformAuth = (platform: string) => {
    alert(t.settings.platformAuth.comingSoon.replace("{platform}", platform));
  };

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
}
