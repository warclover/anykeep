/**
 * Learning Feedback Toast
 * V4.2 学习反馈提示组件
 *
 * @description 当系统从用户操作中学习时显示反馈
 * - 显示学习内容（标签排除、来源偏好等）
 * - 显示学习效果
 * - 提供撤销选项
 * - 支持多种学习类型
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { Brain, FolderMinus, Tag, Link2, Undo2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// 类型定义
// ============================================================================

export type LearningType =
  | "tag_exclusion" // 标签排除
  | "source_exclusion" // 来源排除
  | "embedding_exclusion" // 向量排除
  | "folder_preference" // 文件夹偏好
  | "source_preference" // 来源偏好
  | "bulk_learning"; // 批量学习

export interface LearningFeedbackOptions {
  /** 学习类型 */
  type: LearningType;
  /** 学习来源文件夹名称 */
  sourceFolderName?: string;
  /** 学习目标文件夹名称 */
  targetFolderName?: string;
  /** 学习的标签 */
  tags?: string[];
  /** 学习的来源 */
  sourceName?: string;
  /** 学习数量（批量时） */
  count?: number;
  /** 撤销回调 */
  onUndo?: () => Promise<boolean>;
  /** Toast 持续时间（毫秒） */
  duration?: number;
}

// ============================================================================
// 配置
// ============================================================================

const LEARNING_TYPE_CONFIG: Record<
  LearningType,
  {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    color: string;
  }
> = {
  tag_exclusion: {
    icon: Tag,
    title: "标签偏好已记录",
    color: "text-orange-500",
  },
  source_exclusion: {
    icon: Link2,
    title: "来源偏好已记录",
    color: "text-blue-500",
  },
  embedding_exclusion: {
    icon: Brain,
    title: "内容偏好已学习",
    color: "text-purple-500",
  },
  folder_preference: {
    icon: FolderMinus,
    title: "分类偏好已更新",
    color: "text-green-500",
  },
  source_preference: {
    icon: Link2,
    title: "来源分类已学习",
    color: "text-cyan-500",
  },
  bulk_learning: {
    icon: Brain,
    title: "批量操作已学习",
    color: "text-indigo-500",
  },
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 生成学习描述文本
 */
function generateDescription(options: LearningFeedbackOptions): string {
  const { type, sourceFolderName, targetFolderName, tags, sourceName, count } =
    options;

  switch (type) {
    case "tag_exclusion":
      if (tags && tags.length > 0) {
        const tagList = tags.slice(0, 3).join("、");
        const more = tags.length > 3 ? ` 等${tags.length}个标签` : "";
        return `「${tagList}${more}」不会再推荐到「${sourceFolderName}」`;
      }
      return `标签偏好已从「${sourceFolderName}」移除`;

    case "source_exclusion":
      return `「${sourceName}」的内容不会再推荐到「${sourceFolderName}」`;

    case "embedding_exclusion":
      return `相似内容不会再推荐到「${sourceFolderName}」`;

    case "folder_preference":
      return `已学习您倾向于将内容放入「${targetFolderName}」`;

    case "source_preference":
      return `「${sourceName}」的内容将优先推荐到「${targetFolderName}」`;

    case "bulk_learning":
      return `已从${count || 0}个书签的移动中学习您的分类偏好`;

    default:
      return "分类偏好已更新";
  }
}

// ============================================================================
// Toast 内容组件
// ============================================================================

interface LearningToastContentProps extends LearningFeedbackOptions {
  toastId: string | number;
}

function LearningToastContent({
  type,
  toastId,
  onUndo,
  ...options
}: LearningToastContentProps) {
  const config = LEARNING_TYPE_CONFIG[type];
  const Icon = config.icon;
  const description = generateDescription({ type, ...options });

  const handleUndo = useCallback(async () => {
    if (onUndo) {
      const success = await onUndo();
      if (success) {
        toast.dismiss(toastId);
        toast.success("已撤销学习", { duration: 2000 });
      } else {
        toast.error("撤销失败", { duration: 2000 });
      }
    }
  }, [onUndo, toastId]);

  return (
    <div className="flex items-start gap-3 w-full">
      {/* 图标 */}
      <div className={cn("mt-0.5", config.color)}>
        <Icon className="size-5" />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{config.title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>

      {/* 撤销按钮 */}
      {onUndo && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUndo}
          className="flex-shrink-0 h-8 px-2 text-xs"
        >
          <Undo2 className="size-3 mr-1" />
          撤销
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 显示学习反馈 Toast
 */
export function showLearningFeedback(options: LearningFeedbackOptions): void {
  const { duration = 5000, ...restOptions } = options;

  toast.custom(
    (t) => (
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 w-full max-w-md">
        <LearningToastContent {...restOptions} toastId={t} />
      </div>
    ),
    {
      duration,
      position: "bottom-right",
    },
  );
}

/**
 * 显示简单的学习成功提示
 */
export function showSimpleLearningFeedback(message: string): void {
  toast.success(message, {
    icon: <Brain className="size-4 text-primary" />,
    duration: 3000,
    position: "bottom-right",
  });
}

/**
 * 显示学习信息提示（不带撤销）
 */
export function showLearningInfo(message: string): void {
  toast(message, {
    icon: <Info className="size-4 text-blue-500" />,
    duration: 3000,
    position: "bottom-right",
  });
}

// ============================================================================
// Hook: 使用学习反馈
// ============================================================================

export interface UseLearningFeedbackReturn {
  /** 显示标签排除反馈 */
  showTagExclusion: (
    tags: string[],
    folderName: string,
    onUndo?: () => Promise<boolean>,
  ) => void;
  /** 显示来源排除反馈 */
  showSourceExclusion: (
    sourceName: string,
    folderName: string,
    onUndo?: () => Promise<boolean>,
  ) => void;
  /** 显示文件夹偏好反馈 */
  showFolderPreference: (
    folderName: string,
    onUndo?: () => Promise<boolean>,
  ) => void;
  /** 显示来源偏好反馈 */
  showSourcePreference: (
    sourceName: string,
    folderName: string,
    onUndo?: () => Promise<boolean>,
  ) => void;
  /** 显示批量学习反馈 */
  showBulkLearning: (count: number, onUndo?: () => Promise<boolean>) => void;
  /** 显示简单反馈 */
  showSimple: (message: string) => void;
}

export function useLearningFeedback(): UseLearningFeedbackReturn {
  const showTagExclusion = useCallback(
    (tags: string[], folderName: string, onUndo?: () => Promise<boolean>) => {
      showLearningFeedback({
        type: "tag_exclusion",
        tags,
        sourceFolderName: folderName,
        onUndo,
      });
    },
    [],
  );

  const showSourceExclusion = useCallback(
    (
      sourceName: string,
      folderName: string,
      onUndo?: () => Promise<boolean>,
    ) => {
      showLearningFeedback({
        type: "source_exclusion",
        sourceName,
        sourceFolderName: folderName,
        onUndo,
      });
    },
    [],
  );

  const showFolderPreference = useCallback(
    (folderName: string, onUndo?: () => Promise<boolean>) => {
      showLearningFeedback({
        type: "folder_preference",
        targetFolderName: folderName,
        onUndo,
      });
    },
    [],
  );

  const showSourcePreference = useCallback(
    (
      sourceName: string,
      folderName: string,
      onUndo?: () => Promise<boolean>,
    ) => {
      showLearningFeedback({
        type: "source_preference",
        sourceName,
        targetFolderName: folderName,
        onUndo,
      });
    },
    [],
  );

  const showBulkLearning = useCallback(
    (count: number, onUndo?: () => Promise<boolean>) => {
      showLearningFeedback({
        type: "bulk_learning",
        count,
        onUndo,
      });
    },
    [],
  );

  const showSimple = useCallback((message: string) => {
    showSimpleLearningFeedback(message);
  }, []);

  return {
    showTagExclusion,
    showSourceExclusion,
    showFolderPreference,
    showSourcePreference,
    showBulkLearning,
    showSimple,
  };
}

export default showLearningFeedback;
