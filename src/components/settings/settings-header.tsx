"use client";

import { Button } from "@/components/ui/button";
import { LogOut, Check } from "lucide-react";
import { useUiText } from "@/lib/i18n";

interface SettingsHeaderProps {
  saving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  onSave: () => void;
  onLogout: () => void;
}

export function SettingsHeader({
  saving,
  saveSuccess,
  saveError,
  onSave,
  onLogout,
}: SettingsHeaderProps) {
  const t = useUiText();

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold">
            {t.settings.header.title}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t.settings.header.description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveError && (
            <span className="text-sm text-red-600 dark:text-red-400">
              {saveError}
            </span>
          )}
          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <Check className="size-4" />
              {t.settings.header.saved}
            </span>
          )}
          <Button onClick={onSave} disabled={saving} size="sm">
            {saving ? t.settings.header.saving : t.settings.header.save}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="hidden sm:flex"
          >
            <LogOut className="size-4 mr-2" />
            {t.settings.header.logout}
          </Button>
        </div>
      </div>
    </header>
  );
}
