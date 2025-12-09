/**
 * 消息筛选器组件
 * @description 筛选消息状态和等级
 */

"use client";

import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MessageStatus, MessageLevel } from "@/lib/messages";

// ============================================
// 类型定义
// ============================================

export interface MessageFilterProps {
  /** 当前状态筛选 */
  status: MessageStatus | "all";
  /** 当前等级筛选 */
  level?: MessageLevel;
  /** 状态变更回调 */
  onStatusChange: (status: MessageStatus | "all") => void;
  /** 等级变更回调 */
  onLevelChange: (level: MessageLevel | undefined) => void;
}

// ============================================
// 选项定义
// ============================================

const STATUS_OPTIONS: { value: MessageStatus | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "unread", label: "未读" },
  { value: "read", label: "已读" },
  { value: "archived", label: "已归档" },
];

const LEVEL_OPTIONS: { value: MessageLevel | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "important", label: "重要" },
  { value: "normal", label: "普通" },
  { value: "silent", label: "静默" },
];

// ============================================
// 组件实现
// ============================================

export function MessageFilter({
  status,
  level,
  onStatusChange,
  onLevelChange,
}: MessageFilterProps) {
  // 是否有激活的筛选
  const hasActiveFilter = status !== "all" || level !== undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="size-4" />
          筛选
          {hasActiveFilter && (
            <span className="size-2 bg-primary rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {/* 状态筛选 */}
        <DropdownMenuLabel>状态</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(value) =>
            onStatusChange(value as MessageStatus | "all")
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* 等级筛选 */}
        <DropdownMenuLabel>等级</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={level || "all"}
          onValueChange={(value) =>
            onLevelChange(value === "all" ? undefined : (value as MessageLevel))
          }
        >
          {LEVEL_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
