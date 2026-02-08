/**
 * 设置页面移动端导航组件
 * 在移动端显示为可点击的分组卡片列表
 */

"use client";

import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { SETTINGS_GROUPS, type SettingsGroup } from "./settings-config";
import { useUiText } from "@/lib/i18n";
import { getNestedValue } from "@/lib/i18n/cache";

interface SettingsMobileNavProps {
  onGroupSelect: (groupId: string) => void;
}

export function SettingsMobileNav({ onGroupSelect }: SettingsMobileNavProps) {
  const t = useUiText();
  const resolveKey = (key: string) =>
    getNestedValue<string>(t as unknown as Record<string, unknown>, key) ?? key;

  return (
    <div className="lg:hidden space-y-2">
      {SETTINGS_GROUPS.map((group) => {
        const Icon = group.icon;

        return (
          <button
            key={group.id}
            onClick={() => onGroupSelect(group.id)}
            className={cn(
              "w-full flex items-center gap-3 p-4 rounded-lg",
              "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
              "hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors",
              "text-left",
            )}
          >
            <div
              className={cn(
                "size-10 rounded-lg flex items-center justify-center",
                "bg-gray-100 dark:bg-gray-700",
              )}
            >
              <Icon className={cn("size-5", group.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {resolveKey(group.label)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {resolveKey(group.description)}
              </p>
            </div>
            <ChevronRight className="size-5 text-gray-400 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

interface SettingsMobileHeaderProps {
  group: SettingsGroup;
  onBack: () => void;
}

export function SettingsMobileHeader({
  group,
  onBack,
}: SettingsMobileHeaderProps) {
  const Icon = group.icon;
  const t = useUiText();
  const resolveKey = (key: string) =>
    getNestedValue<string>(t as unknown as Record<string, unknown>, key) ?? key;

  return (
    <div className="lg:hidden flex items-center gap-3 mb-4">
      <button
        onClick={onBack}
        className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <ChevronRight className="size-5 text-gray-500 rotate-180" />
      </button>
      <Icon className={cn("size-5", group.iconColor)} />
      <div>
        <h3 className="font-medium text-gray-900 dark:text-white">
          {resolveKey(group.label)}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {resolveKey(group.description)}
        </p>
      </div>
    </div>
  );
}
