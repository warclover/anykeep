"use client";

import { ColorThemeSelector } from "../color-theme-selector";
import {
  SettingsGroupSection,
  SettingsItemCard,
} from "../settings-group-section";
import { SETTINGS_GROUPS } from "../settings-config";
import { useUiText } from "@/lib/i18n";

export function AppearanceGroup() {
  const t = useUiText();

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
}
