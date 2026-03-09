"use client";

import { SnapshotQuotaSectionLazy } from "@/components/snapshot";
import { AutoSnapshotSettings } from "../auto-snapshot-settings";
import { SettingsGroupSection } from "../settings-group-section";
import { SETTINGS_GROUPS } from "../settings-config";
interface ContentGroupProps {
  settings?: unknown;
  setSettings?: unknown;
}

export function ContentGroup(_props: ContentGroupProps) {
  return (
    <SettingsGroupSection group={SETTINGS_GROUPS[3]}>
      <div id="settings-item-content-snapshot-quota">
        <SnapshotQuotaSectionLazy />
      </div>

      <div id="settings-item-content-auto-snapshot">
        <AutoSnapshotSettings />
      </div>
    </SettingsGroupSection>
  );
}
