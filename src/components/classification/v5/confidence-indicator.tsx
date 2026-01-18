/**
 * 智能分类 v5.0 - 置信度指示器组件
 *
 * 功能：
 * - 显示分类置信度百分比
 * - 使用颜色区分高/中/低置信度
 * - 提供视觉化的进度条
 */

'use client';

import { cn } from '@/lib/utils';

/**
 * 置信度级别
 */
type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * 置信度指示器属性
 */
interface ConfidenceIndicatorProps {
  /** 置信度分数 (0.0-1.0) */
  confidence: number;
  /** 显示模式 */
  variant?: 'default' | 'compact' | 'detailed';
  /** 自定义类名 */
  className?: string;
  /** 是否显示标签 */
  showLabel?: boolean;
}

/**
 * 获取置信度级别
 */
function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.70) return 'medium';
  return 'low';
}

/**
 * 获取置信度级别配置
 */
function getConfidenceLevelConfig(level: ConfidenceLevel) {
  const configs = {
    high: {
      label: '高置信度',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-950',
      barColor: 'bg-green-500',
      borderColor: 'border-green-200 dark:border-green-800',
    },
    medium: {
      label: '中等置信度',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-950',
      barColor: 'bg-yellow-500',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
    },
    low: {
      label: '低置信度',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-950',
      barColor: 'bg-red-500',
      borderColor: 'border-red-200 dark:border-red-800',
    },
  };

  return configs[level];
}

/**
 * 置信度指示器组件
 */
export function ConfidenceIndicator({
  confidence,
  variant = 'default',
  className,
  showLabel = true,
}: ConfidenceIndicatorProps) {
  const level = getConfidenceLevel(confidence);
  const config = getConfidenceLevelConfig(level);
  const percentage = Math.round(confidence * 100);

  // Compact 模式：仅显示百分比徽章
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
          config.bgColor,
          config.color,
          className
        )}
      >
        <span>{percentage}%</span>
      </div>
    );
  }

  // Detailed 模式：显示完整信息
  if (variant === 'detailed') {
    return (
      <div className={cn('space-y-2', className)}>
        {/* 标题和百分比 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            置信度
          </span>
          <span className={cn('text-sm font-semibold', config.color)}>
            {percentage}%
          </span>
        </div>

        {/* 进度条 */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className={cn('h-full transition-all duration-300', config.barColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* 级别标签 */}
        {showLabel && (
          <div className="flex items-center justify-between">
            <span className={cn('text-xs', config.color)}>{config.label}</span>
            <span className="text-xs text-muted-foreground">
              {level === 'high' && '可靠'}
              {level === 'medium' && '一般'}
              {level === 'low' && '需确认'}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Default 模式：显示百分比和进度条
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* 百分比 */}
      <span className={cn('text-sm font-semibold', config.color)}>
        {percentage}%
      </span>

      {/* 进度条 */}
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className={cn('h-full transition-all duration-300', config.barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* 级别标签（可选） */}
      {showLabel && (
        <span className={cn('text-xs', config.color)}>{config.label}</span>
      )}
    </div>
  );
}
