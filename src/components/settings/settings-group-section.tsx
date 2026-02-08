/**
 * 设置分组内容区域组件
 * 每个分组独立渲染，支持锚点定位
 */

"use client";

import { forwardRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getGroupAnchorId, type SettingsGroup } from "./settings-config";
import { useUiText } from "@/lib/i18n";
import { getNestedValue } from "@/lib/i18n/cache";

interface SettingsGroupSectionProps {
  group: SettingsGroup;
  children: React.ReactNode;
  className?: string;
}

/**
 * 设置分组区域包装组件
 * 提供统一的分组标题和锚点 ID
 */
export const SettingsGroupSection = forwardRef<
  HTMLDivElement,
  SettingsGroupSectionProps
>(({ group, children, className }, ref) => {
  const Icon = group.icon;
  const t = useUiText();
  const resolveKey = (key: string) =>
    getNestedValue<string>(t as unknown as Record<string, unknown>, key) ?? key;

  return (
    <section
      ref={ref}
      id={getGroupAnchorId(group.id)}
      className={cn("scroll-mt-20", className)}
    >
      {/* 分组标题 - 仅桌面端显示 */}
      <div className="hidden lg:flex items-center gap-2 mb-4">
        <Icon className={cn("size-5", group.iconColor)} />
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {resolveKey(group.label)}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {resolveKey(group.description)}
          </p>
        </div>
      </div>

      {/* 分组内容 */}
      <div className="space-y-4">{children}</div>
    </section>
  );
});

SettingsGroupSection.displayName = "SettingsGroupSection";

interface SettingsItemCardProps {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * 设置项卡片组件
 * 用于包装单个设置项
 */
export function SettingsItemCard({
  id,
  title,
  description,
  icon,
  children,
  className,
}: SettingsItemCardProps) {
  return (
    <Card id={id} className={cn("scroll-mt-24", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface SettingsSwitchRowProps {
  id: string;
  label: string;
  description?: string;
  badge?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * 设置开关行组件
 * 用于 Switch 类型的设置项
 */
export function SettingsSwitchRow({
  id,
  label,
  description,
  badge,
  checked,
  onCheckedChange,
  disabled,
}: SettingsSwitchRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex-1 pr-4">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
          {badge}
        </Label>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
