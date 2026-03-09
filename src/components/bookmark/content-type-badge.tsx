/**
 * Content Type Badge Component
 * Displays the detected content type as a small badge
 */

import { cn } from "@/lib/utils";
import { FileText, BookOpen, Video, Wrench } from "lucide-react";
import type { ContentType } from "@/lib/summary/content-type-detector";
import { CONTENT_TYPE_LABELS } from "@/lib/summary/content-type-detector";

interface ContentTypeBadgeProps {
  type: ContentType;
  /** Show only icon without label */
  iconOnly?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional class names */
  className?: string;
}

/**
 * Content type configuration with icons and colors
 */
const CONTENT_TYPE_CONFIG: Record<
  ContentType,
  {
    icon: typeof FileText;
    bgLight: string;
    bgDark: string;
    textLight: string;
    textDark: string;
    borderLight: string;
    borderDark: string;
  }
> = {
  article: {
    icon: FileText,
    bgLight: "bg-blue-50",
    bgDark: "dark:bg-blue-950/30",
    textLight: "text-blue-600",
    textDark: "dark:text-blue-400",
    borderLight: "border-blue-200",
    borderDark: "dark:border-blue-800",
  },
  tutorial: {
    icon: BookOpen,
    bgLight: "bg-green-50",
    bgDark: "dark:bg-green-950/30",
    textLight: "text-green-600",
    textDark: "dark:text-green-400",
    borderLight: "border-green-200",
    borderDark: "dark:border-green-800",
  },
  video: {
    icon: Video,
    bgLight: "bg-red-50",
    bgDark: "dark:bg-red-950/30",
    textLight: "text-red-600",
    textDark: "dark:text-red-400",
    borderLight: "border-red-200",
    borderDark: "dark:border-red-800",
  },
  tool: {
    icon: Wrench,
    bgLight: "bg-purple-50",
    bgDark: "dark:bg-purple-950/30",
    textLight: "text-purple-600",
    textDark: "dark:text-purple-400",
    borderLight: "border-purple-200",
    borderDark: "dark:border-purple-800",
  },
};

export function ContentTypeBadge({
  type,
  iconOnly = false,
  size = "sm",
  className,
}: ContentTypeBadgeProps) {
  const config = CONTENT_TYPE_CONFIG[type];
  const label = CONTENT_TYPE_LABELS[type];
  const Icon = config.icon;

  const sizeClasses = {
    sm: {
      wrapper: "px-1.5 py-0.5 text-xs gap-1",
      icon: "size-3",
    },
    md: {
      wrapper: "px-2 py-1 text-sm gap-1.5",
      icon: "size-3.5",
    },
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-medium",
        config.bgLight,
        config.bgDark,
        config.textLight,
        config.textDark,
        config.borderLight,
        config.borderDark,
        sizeClasses[size].wrapper,
        className,
      )}
      title={`内容类型: ${label}`}
    >
      <Icon className={sizeClasses[size].icon} />
      {!iconOnly && <span>{label}</span>}
    </span>
  );
}
