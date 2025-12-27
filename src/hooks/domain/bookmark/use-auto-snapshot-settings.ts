/**
 * 自动快照设置 Hook (P2-010)
 * 管理用户的自动快照配置
 */

"use client";

import { useCallback, useMemo } from "react";
import { useUser } from "@/hooks/data";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_AUTO_SNAPSHOT_SETTINGS,
  type AutoSnapshotSettings,
} from "@/types/user-settings";
import type { Json } from "@/types/supabase";

export interface UseAutoSnapshotSettingsResult {
  /** 当前设置（合并默认值） */
  settings: AutoSnapshotSettings;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 更新设置 */
  updateSettings: (updates: Partial<AutoSnapshotSettings>) => Promise<void>;
  /** 重置为默认设置 */
  resetToDefaults: () => Promise<void>;
  /** 添加触发标签 */
  addTriggerTag: (tag: string) => Promise<void>;
  /** 移除触发标签 */
  removeTriggerTag: (tag: string) => Promise<void>;
  /** 检查标签是否为触发标签 */
  isTriggerTag: (tag: string) => boolean;
}

/**
 * 自动快照设置管理 Hook
 */
export function useAutoSnapshotSettings(): UseAutoSnapshotSettingsResult {
  const { user, profile, isLoading: userLoading, refetch } = useUser();

  // 合并默认设置和用户设置
  const settings: AutoSnapshotSettings = useMemo(() => {
    const stored = (profile?.settings as Record<string, unknown>)
      ?.autoSnapshot as Partial<AutoSnapshotSettings> | undefined;
    return {
      ...DEFAULT_AUTO_SNAPSHOT_SETTINGS,
      ...(stored || {}),
    };
  }, [profile?.settings]);

  // 更新设置（直接更新 profile.settings）
  const updateSettings = useCallback(
    async (updates: Partial<AutoSnapshotSettings>) => {
      if (!user) throw new Error("用户未登录");

      const supabase = createClient();
      const currentSettings = (profile?.settings || {}) as Record<
        string,
        Json | undefined
      >;
      const newAutoSnapshot = { ...settings, ...updates };

      const updatedSettings: Record<string, Json | undefined> = {
        ...currentSettings,
        autoSnapshot: newAutoSnapshot as unknown as Json,
      };

      const { error } = await supabase
        .from("profiles")
        .update({ settings: updatedSettings })
        .eq("id", user.id);

      if (error) {
        throw new Error(`更新设置失败: ${error.message}`);
      }

      // 刷新用户数据
      await refetch();
    },
    [user, profile?.settings, settings, refetch],
  );

  // 重置为默认设置
  const resetToDefaults = useCallback(async () => {
    await updateSettings(DEFAULT_AUTO_SNAPSHOT_SETTINGS);
  }, [updateSettings]);

  // 添加触发标签
  const addTriggerTag = useCallback(
    async (tag: string) => {
      if (settings.triggerTags.includes(tag)) return;
      await updateSettings({
        triggerTags: [...settings.triggerTags, tag],
      });
    },
    [settings.triggerTags, updateSettings],
  );

  // 移除触发标签
  const removeTriggerTag = useCallback(
    async (tag: string) => {
      await updateSettings({
        triggerTags: settings.triggerTags.filter((t) => t !== tag),
      });
    },
    [settings.triggerTags, updateSettings],
  );

  // 检查是否为触发标签
  const isTriggerTag = useCallback(
    (tag: string) => {
      return settings.enabled && settings.triggerTags.includes(tag);
    },
    [settings.enabled, settings.triggerTags],
  );

  return {
    settings,
    isLoading: userLoading,
    updateSettings,
    resetToDefaults,
    addTriggerTag,
    removeTriggerTag,
    isTriggerTag,
  };
}
