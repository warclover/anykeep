"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProfileSettingsCard } from "../profile-settings-card";
import { InterestSettingsCard } from "../interest-settings-card";
import {
  SettingsGroupSection,
  SettingsItemCard,
} from "../settings-group-section";
import { SETTINGS_GROUPS } from "../settings-config";
import { useUiText } from "@/lib/i18n";
import type { User } from "@supabase/supabase-js";

interface AccountGroupProps {
  user: User;
}

export function AccountGroup({ user }: AccountGroupProps) {
  const t = useUiText();

  return (
    <SettingsGroupSection group={SETTINGS_GROUPS[0]}>
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

      <div id="settings-item-account-profile">
        <ProfileSettingsCard />
      </div>

      <div id="settings-item-account-interests">
        <InterestSettingsCard />
      </div>
    </SettingsGroupSection>
  );
}
