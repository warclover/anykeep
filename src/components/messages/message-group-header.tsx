/**
 * 消息分组标题组件
 * @description 显示日期分组的粘性标题
 */

import type { DateGroup } from "@/lib/messages";

// ============================================
// 类型定义
// ============================================

export interface MessageGroupHeaderProps {
  /** 日期分组 key */
  dateGroup: DateGroup;
  /** 显示标签 */
  label: string;
}

// ============================================
// 组件实现
// ============================================

export function MessageGroupHeader({ label }: MessageGroupHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-2 border-b">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
