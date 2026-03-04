"use client";

import { SnapshotQuotaSectionLazy } from "@/components/snapshot";
import { AutoSnapshotSettings } from "../auto-snapshot-settings";
import { KnowledgeStudioSettingsCard } from "../knowledge-studio-settings-card";
import { SettingsGroupSection } from "../settings-group-section";
import { SETTINGS_GROUPS } from "../settings-config";
import type { UserSettings } from "@/types/user-settings";
import type { BriefingMode } from "@/types/user-settings";

interface ContentGroupProps {
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
}

export function ContentGroup({ settings, setSettings }: ContentGroupProps) {
  return (
    <SettingsGroupSection group={SETTINGS_GROUPS[3]}>
      <div id="settings-item-content-snapshot-quota">
        <SnapshotQuotaSectionLazy />
      </div>

      <div id="settings-item-content-auto-snapshot">
        <AutoSnapshotSettings />
      </div>

      <div id="settings-item-content-knowledge-studio">
        <KnowledgeStudioSettingsCard
          briefingMode={settings.knowledgeStudio?.briefingMode || "off"}
          onUpdate={async (briefingMode: BriefingMode) => {
            setSettings((prev) => ({
              ...prev,
              knowledgeStudio: {
                ...(prev.knowledgeStudio || { briefingMode: "off" }),
                briefingMode,
              },
            }));
          }}
        />
      </div>
    </SettingsGroupSection>
  );
}
