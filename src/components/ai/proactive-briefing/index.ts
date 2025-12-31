/**
 * 主动简报组件模块导出
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

// 主组件
export {
  ProactiveBriefingCard,
  CompactBriefingCard,
  type ProactiveBriefingCardProps,
  type CompactBriefingCardProps,
} from "./proactive-briefing-card";

// 洞察项组件
export { InsightItem, type InsightItemProps } from "./insight-item";

// 操作按钮组件
export {
  ActionButton,
  ActionButtonGroup,
  type ActionButtonProps,
  type ActionButtonGroupProps,
} from "./action-button";

// 骨架屏组件
export {
  BriefingSkeleton,
  CompactBriefingSkeleton,
  type BriefingSkeletonProps,
  type CompactBriefingSkeletonProps,
} from "./briefing-skeleton";
