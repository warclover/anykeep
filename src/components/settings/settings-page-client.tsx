"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { ErrorMessage } from "@/components/ui/error-message";
import { SettingsSidebar } from "./settings-sidebar";
import { SettingsMobileNav, SettingsMobileHeader } from "./settings-mobile-nav";
import { SETTINGS_GROUPS } from "./settings-config";
import { SettingsGroupRenderer } from "./groups/settings-group-renderer";
import { SettingsHeader } from "./settings-header";
import { useSettingsSave } from "./hooks/use-settings-save";
import { useAccountActions } from "./hooks/use-account-actions";
import { useSettingsNavigation } from "./hooks/use-settings-navigation";
import { useUiText } from "@/lib/i18n";
import type { User } from "@supabase/supabase-js";
import type { UserSettings } from "@/types/user-settings";

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
  const t = useUiText();

  const {
    settings,
    setSettings,
    saving,
    saveSuccess,
    saveError,
    updateSetting,
    handleSave,
  } = useSettingsSave(initialSettings);
  const {
    exporting,
    deleting,
    handleExportData,
    handleDeleteAccount,
    handleLogout,
  } = useAccountActions({ userEmail: user.email });
  const {
    activeGroupId,
    mobileSelectedGroup,
    handleGroupClick,
    handleMobileGroupSelect,
    handleMobileBack,
  } = useSettingsNavigation();

  const selectedGroup = SETTINGS_GROUPS.find(
    (g) => g.id === mobileSelectedGroup,
  );
  const rendererProps = {
    user,
    settings,
    setSettings,
    updateSetting,
    exporting,
    deleting,
    onExportData: handleExportData,
    onDeleteAccount: handleDeleteAccount,
  };

  return (
    <div className="h-full flex flex-col">
      <SettingsHeader
        saving={saving}
        saveSuccess={saveSuccess}
        saveError={saveError}
        onSave={handleSave}
        onLogout={handleLogout}
      />

      {error ? (
        <div className="flex-1 p-4 md:p-6">
          <ErrorMessage message={error} retry={() => router.refresh()} />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <SettingsSidebar
            activeGroupId={activeGroupId}
            onGroupClick={handleGroupClick}
          />
          <main className="flex-1 overflow-auto">
            <div className="p-4 md:p-6 max-w-3xl">
              {mobileSelectedGroup === null ? (
                <SettingsMobileNav onGroupSelect={handleMobileGroupSelect} />
              ) : (
                selectedGroup && (
                  <>
                    <SettingsMobileHeader
                      group={selectedGroup}
                      onBack={handleMobileBack}
                    />
                    <SettingsGroupRenderer
                      groupId={mobileSelectedGroup}
                      {...rendererProps}
                    />
                  </>
                )
              )}
              <div className="hidden lg:block space-y-8">
                {SETTINGS_GROUPS.map((group) => (
                  <div key={group.id}>
                    <SettingsGroupRenderer
                      groupId={group.id}
                      {...rendererProps}
                    />
                  </div>
                ))}
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
