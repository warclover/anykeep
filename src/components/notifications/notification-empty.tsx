/**
 * 通知空状态
 * @description 无通知时的占位组件
 */

import { Bell, CheckCircle, Filter, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type NotificationEmptyVariant =
  | "default"
  | "all-read"
  | "filtered"
  | "search";

interface NotificationEmptyProps {
  variant?: NotificationEmptyVariant;
  filterStatus?: string;
  filterPriority?: string;
  searchQuery?: string;
  className?: string;
}

const VARIANT_CONFIG: Record<
  NotificationEmptyVariant,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    bgColor: string;
    title: string;
    description: string;
  }
> = {
  default: {
    icon: Bell,
    iconColor: "text-muted-foreground",
    bgColor: "bg-muted/50",
    title: "暂无通知",
    description: "当有新消息时，会在这里显示",
  },
  "all-read": {
    icon: CheckCircle,
    iconColor: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    title: "全部已读",
    description: "太棒了！你已经处理完所有通知",
  },
  filtered: {
    icon: Filter,
    iconColor: "text-muted-foreground",
    bgColor: "bg-muted/50",
    title: "无匹配结果",
    description: "试试调整筛选条件",
  },
  search: {
    icon: Search,
    iconColor: "text-muted-foreground",
    bgColor: "bg-muted/50",
    title: "未找到相关通知",
    description: "换个关键词试试",
  },
};

export function NotificationEmpty({
  variant = "default",
  filterStatus,
  filterPriority,
  searchQuery,
  className,
}: NotificationEmptyProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  // 动态生成筛选提示
  let dynamicDescription = config.description;
  if (variant === "filtered") {
    const hints: string[] = [];
    if (filterStatus && filterStatus !== "all") {
      hints.push(filterStatus === "unread" ? "未读" : "已读");
    }
    if (filterPriority) {
      hints.push(filterPriority);
    }
    if (hints.length > 0) {
      dynamicDescription = `${hints.join("的")}通知暂无内容`;
    }
  }

  if (variant === "search" && searchQuery) {
    dynamicDescription = `未找到「${searchQuery}」相关通知`;
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className,
      )}
    >
      {/* 图标 */}
      <div
        className={cn(
          "flex items-center justify-center size-16 rounded-full mb-4",
          config.bgColor,
        )}
      >
        <Icon className={cn("size-8", config.iconColor)} />
      </div>

      {/* 标题 */}
      <h3 className="text-lg font-medium text-foreground mb-1">
        {config.title}
      </h3>

      {/* 描述 */}
      <p className="text-sm text-muted-foreground max-w-xs">
        {dynamicDescription}
      </p>
    </div>
  );
}
