import {
  Bug,
  Lightbulb,
  MessageCircleWarning,
  type LucideIcon,
} from "lucide-react";
import type {
  FeedbackType,
  FeedbackStatus,
  FeedbackPriority,
} from "@/types/user-feedback";

interface FeedbackTypeConfig {
  value: FeedbackType;
  label: string;
  icon: LucideIcon;
  description: string;
  color: string;
}

export const FEEDBACK_TYPES: FeedbackTypeConfig[] = [
  {
    value: "bug",
    label: "Bug 反馈",
    icon: Bug,
    description: "功能异常、崩溃、数据错误",
    color: "text-red-500",
  },
  {
    value: "complaint",
    label: "投诉",
    icon: MessageCircleWarning,
    description: "体验不佳、服务问题",
    color: "text-orange-500",
  },
  {
    value: "suggestion",
    label: "改进建议",
    icon: Lightbulb,
    description: "新功能、优化建议",
    color: "text-blue-500",
  },
];

export const FEEDBACK_STATUS_MAP: Record<
  FeedbackStatus,
  { label: string; color: string }
> = {
  pending: { label: "待处理", color: "bg-slate-100 text-slate-700" },
  reviewing: { label: "审核中", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "处理中", color: "bg-purple-100 text-purple-700" },
  resolved: { label: "已解决", color: "bg-green-100 text-green-700" },
  closed: { label: "已关闭", color: "bg-gray-100 text-gray-700" },
  rejected: { label: "已拒绝", color: "bg-red-100 text-red-700" },
};

export const FEEDBACK_PRIORITY_MAP: Record<
  FeedbackPriority,
  { label: string; color: string }
> = {
  low: { label: "低优先级", color: "text-slate-500" },
  normal: { label: "普通", color: "text-blue-500" },
  high: { label: "高优先级", color: "text-orange-500" },
  urgent: { label: "紧急", color: "text-red-500" },
};
