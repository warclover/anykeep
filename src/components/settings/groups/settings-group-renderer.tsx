"use client";

import { AccountGroup } from "./account-group";
import { AppearanceGroup } from "./appearance-group";
import { AIGroup } from "./ai-group";
import { ContentGroup } from "./content-group";
import { PlatformsGroup } from "./platforms-group";
import { NotificationsGroup } from "./notifications-group";
import { PrivacyGroup } from "./privacy-group";
import { SupportGroup } from "./support-group";
import type { User } from "@supabase/supabase-js";
import type { UserSettings } from "@/types/user-settings";

interface SettingsGroupRendererProps {
  groupId: string;
  user: User;
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
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

export function SettingsGroupRenderer({
  groupId,
  user,
  settings,
  setSettings,
  updateSetting,
  exporting,
  deleting,
  onExportData,
  onDeleteAccount,
}: SettingsGroupRendererProps) {
  switch (groupId) {
    case "account":
      return <AccountGroup user={user} />;
    case "appearance":
      return <AppearanceGroup />;
    case "ai":
      return <AIGroup settings={settings} updateSetting={updateSetting} />;
    case "content":
      return <ContentGroup settings={settings} setSettings={setSettings} />;
    case "platforms":
      return <PlatformsGroup settings={settings} />;
    case "notifications":
      return (
        <NotificationsGroup settings={settings} updateSetting={updateSetting} />
      );
    case "privacy":
      return (
        <PrivacyGroup
          settings={settings}
          updateSetting={updateSetting}
          exporting={exporting}
          deleting={deleting}
          onExportData={onExportData}
          onDeleteAccount={onDeleteAccount}
        />
      );
    case "support":
      return <SupportGroup />;
    default:
      return null;
  }
}
