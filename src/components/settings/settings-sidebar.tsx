/**
 * 设置页面侧边导航组件
 * 桌面端显示固定左侧导航，移动端隐藏
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  SETTINGS_GROUPS,
  getGroupAnchorId,
  type SettingsGroup,
} from "./settings-config";

interface SettingsSidebarProps {
  activeGroupId: string;
  onGroupClick: (groupId: string) => void;
}

export function SettingsSidebar({
  activeGroupId,
  onGroupClick,
}: SettingsSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set([activeGroupId]),
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleGroupClick = (group: SettingsGroup) => {
    // 展开分组
    if (!expandedGroups.has(group.id)) {
      setExpandedGroups((prev) => new Set([...prev, group.id]));
    }
    // 滚动到对应区域
    onGroupClick(group.id);
    // 使用锚点滚动
    const element = document.getElementById(getGroupAnchorId(group.id));
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav className="hidden lg:block w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
      <div className="sticky top-0 p-4 space-y-1">
        {SETTINGS_GROUPS.map((group) => {
          const Icon = group.icon;
          const isActive = activeGroupId === group.id;
          const isExpanded = expandedGroups.has(group.id);

          return (
            <div key={group.id}>
              {/* 分组标题 */}
              <button
                onClick={() => handleGroupClick(group)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                  "hover:bg-gray-100 dark:hover:bg-gray-800",
                  isActive && "bg-gray-100 dark:bg-gray-800",
                )}
              >
                <Icon className={cn("size-4 flex-shrink-0", group.iconColor)} />
                <span
                  className={cn(
                    "flex-1 text-sm font-medium truncate",
                    isActive
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-600 dark:text-gray-400",
                  )}
                >
                  {group.label}
                </span>
                {group.items.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroup(group.id);
                    }}
                    className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-3.5 text-gray-400" />
                    ) : (
                      <ChevronRight className="size-3.5 text-gray-400" />
                    )}
                  </button>
                )}
              </button>

              {/* 子项列表 */}
              {isExpanded && group.items.length > 1 && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onGroupClick(group.id);
                        const element = document.getElementById(
                          `settings-item-${group.id}-${item.id}`,
                        );
                        if (element) {
                          element.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
