"use client";

import { useState } from "react";
import { clientLogger } from "@/lib/client-logger";
import type { UserSettings } from "@/types/user-settings";

export function useSettingsSave(initialSettings: UserSettings) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateSetting = (
    category: keyof UserSettings,
    key: string,
    value: boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "保存失败");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存设置失败";
      setSaveError(message);
      clientLogger.error({ error: message }, "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return {
    settings,
    setSettings,
    saving,
    saveSuccess,
    saveError,
    updateSetting,
    handleSave,
  };
}
