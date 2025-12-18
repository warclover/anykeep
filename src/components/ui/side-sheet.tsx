"use client";

/**
 * SideSheet - 统一的右侧弹窗组件
 *
 * 设计规范 v1.0:
 * - 三种尺寸: sm (360px), md (440px), lg (540px)
 * - 统一的 Header 布局: 关闭按钮 | 标题 | 操作按钮
 * - 内容渐进动画 (Framer Motion)
 * - 响应式设计 (移动端全宽)
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

// ============================================================================
// 类型定义
// ============================================================================

type SideSheetSize = "sm" | "md" | "lg";

interface SideSheetProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 尺寸: sm=360px, md=440px, lg=540px */
  size?: SideSheetSize;
  /** 标题 */
  title: string;
  /** 副标题/描述 (可选) */
  description?: string;
  /** Header 右侧操作按钮 (可选) */
  headerAction?: React.ReactNode;
  /** Footer 内容 (可选) */
  footer?: React.ReactNode;
  /** 是否点击遮罩关闭 */
  closeOnOverlayClick?: boolean;
  /** 是否启用内容渐进动画 */
  animateContent?: boolean;
  /** 子内容 */
  children: React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 内容区域自定义类名 */
  contentClassName?: string;
}

// ============================================================================
// 常量配置
// ============================================================================

const SIZE_MAP: Record<SideSheetSize, string> = {
  sm: "w-full sm:w-[360px] sm:max-w-[360px]",
  md: "w-full sm:w-[440px] sm:max-w-[440px]",
  lg: "w-full sm:w-[540px] sm:max-w-[540px]",
};

// 动画配置
const OVERLAY_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const SHEET_VARIANTS: Variants = {
  hidden: {
    x: "100%",
    opacity: 0.8,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: "tween",
      duration: 0.3,
      ease: [0.32, 0.72, 0, 1], // iOS 风格缓动
    },
  },
  exit: {
    x: "100%",
    opacity: 0.8,
    transition: {
      type: "tween",
      duration: 0.5,
      ease: [0.32, 0.72, 0, 1],
    },
  },
};

// 内容渐进动画 - 使用 custom prop 动态延迟
const getContentItemVariants = (index: number): Variants => ({
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1 + index * 0.04,
      duration: 0.3,
      ease: [0.32, 0.72, 0, 1],
    },
  },
});

// ============================================================================
// 子组件
// ============================================================================

/**
 * SideSheetSection - 内容区块容器（带渐进动画）
 */
interface SideSheetSectionProps {
  /** 区块索引（用于动画延迟） */
  index?: number;
  /** 是否启用动画 */
  animate?: boolean;
  /** 自定义类名 */
  className?: string;
  children: React.ReactNode;
}

export function SideSheetSection({
  index = 0,
  animate = true,
  className,
  children,
}: SideSheetSectionProps) {
  if (!animate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={getContentItemVariants(index)}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * SideSheetPrimaryZone - 主要操作区（高亮背景）
 */
interface SideSheetPrimaryZoneProps {
  index?: number;
  animate?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function SideSheetPrimaryZone({
  index = 0,
  animate = true,
  className,
  children,
}: SideSheetPrimaryZoneProps) {
  return (
    <SideSheetSection index={index} animate={animate}>
      <div
        className={cn(
          "rounded-xl bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50",
          "dark:from-violet-950/30 dark:via-blue-950/30 dark:to-cyan-950/30",
          "border border-violet-100/50 dark:border-violet-800/30",
          "p-4 space-y-3",
          className,
        )}
      >
        {children}
      </div>
    </SideSheetSection>
  );
}

/**
 * SideSheetSecondaryZone - 次要内容区
 */
interface SideSheetSecondaryZoneProps {
  index?: number;
  animate?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function SideSheetSecondaryZone({
  index = 1,
  animate = true,
  className,
  children,
}: SideSheetSecondaryZoneProps) {
  return (
    <SideSheetSection index={index} animate={animate}>
      <div
        className={cn(
          "rounded-xl bg-slate-50/80 dark:bg-slate-900/50",
          "border border-slate-100 dark:border-slate-800",
          "p-4 space-y-3",
          className,
        )}
      >
        {children}
      </div>
    </SideSheetSection>
  );
}

/**
 * SideSheetExpandableZone - 可折叠区域
 */
interface SideSheetExpandableZoneProps {
  index?: number;
  animate?: boolean;
  title: string;
  description?: string;
  defaultExpanded?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function SideSheetExpandableZone({
  index = 2,
  animate = true,
  title,
  description,
  defaultExpanded = false,
  className,
  children,
}: SideSheetExpandableZoneProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <SideSheetSection index={index} animate={animate}>
      <div
        className={cn(
          "rounded-xl border border-slate-200 dark:border-slate-700",
          "overflow-hidden",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex items-center justify-between p-4",
            "text-sm font-medium text-slate-700 dark:text-slate-300",
            "hover:bg-slate-50 dark:hover:bg-slate-800/50",
            "transition-colors duration-150",
          )}
        >
          <div className="flex flex-col items-start gap-0.5">
            <span>{title}</span>
            {description && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                {description}
              </span>
            )}
          </div>
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-slate-400"
          >
            <svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="px-4 pb-4 pt-0 space-y-3 border-t border-slate-100 dark:border-slate-800">
                <div className="pt-3">{children}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SideSheetSection>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function SideSheet({
  open,
  onOpenChange,
  size = "md",
  title,
  description,
  headerAction,
  footer,
  closeOnOverlayClick = true,
  animateContent = true,
  children,
  className,
  contentClassName,
}: SideSheetProps) {
  // 处理遮罩点击
  const handleOverlayClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (closeOnOverlayClick) {
        e.preventDefault();
        onOpenChange(false);
      }
    },
    [closeOnOverlayClick, onOpenChange],
  );

  // 处理关闭按钮
  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <AnimatePresence mode="wait">
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* Overlay 遮罩 */}
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[3px]"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={OVERLAY_VARIANTS}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onClick={handleOverlayClick}
              />
            </DialogPrimitive.Overlay>

            {/* Sheet 内容 */}
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className={cn(
                  // 定位：顶部与页面粘贴框齐平，避免遮挡用户名区域
                  "fixed z-50",
                  "top-20 bottom-3 right-3",
                  "sm:top-[88px] sm:bottom-4 sm:right-4",
                  // 尺寸：根据新的 top 值计算高度
                  "h-[calc(100%-92px)] sm:h-[calc(100%-104px)]",
                  // 背景和边框
                  "bg-white dark:bg-slate-900",
                  "border border-slate-200/80 dark:border-slate-700/80",
                  // 增强阴影效果 - 多层阴影营造深度感
                  "shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.05),0_12px_24px_rgba(0,0,0,0.09),0_24px_48px_rgba(0,0,0,0.06)]",
                  "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.2),0_12px_24px_rgba(0,0,0,0.3),0_24px_48px_rgba(0,0,0,0.2)]",
                  // 圆角 - 四边都圆角
                  "rounded-2xl",
                  // 布局
                  "flex flex-col overflow-hidden",
                  // GPU 加速
                  "will-change-transform backface-hidden",
                  SIZE_MAP[size],
                  className,
                )}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={SHEET_VARIANTS}
              >
                {/* ============================================
                    Header 区域 - 64px 固定高度
                ============================================ */}
                <div className="flex-shrink-0 h-16 px-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                  {/* 左侧：关闭按钮 */}
                  <button
                    type="button"
                    onClick={handleClose}
                    className={cn(
                      "size-9 rounded-lg flex items-center justify-center",
                      "text-slate-500 hover:text-slate-700",
                      "dark:text-slate-400 dark:hover:text-slate-200",
                      "hover:bg-slate-100 dark:hover:bg-slate-800",
                      "transition-colors duration-150",
                      "focus:outline-none focus:ring-2 focus:ring-violet-500/50",
                    )}
                    aria-label="关闭"
                  >
                    <X className="size-5" />
                  </button>

                  {/* 中间：标题 */}
                  <div className="flex-1 text-center px-2">
                    <DialogPrimitive.Title className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {title}
                    </DialogPrimitive.Title>
                    {description && (
                      <DialogPrimitive.Description className="sr-only">
                        {description}
                      </DialogPrimitive.Description>
                    )}
                  </div>

                  {/* 右侧：操作按钮 */}
                  <div className="flex items-center min-w-[36px] justify-end">
                    {headerAction}
                  </div>
                </div>

                {/* ============================================
                    Content 区域 - 可滚动
                ============================================ */}
                <div
                  className={cn(
                    "flex-1 overflow-y-auto",
                    "px-6 py-5 space-y-5",
                    contentClassName,
                  )}
                >
                  {animateContent ? (
                    <SideSheetAnimatedContent>
                      {children}
                    </SideSheetAnimatedContent>
                  ) : (
                    children
                  )}
                </div>

                {/* ============================================
                    Footer 区域 - 可选，sticky
                ============================================ */}
                {footer && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.2 }}
                    className={cn(
                      "flex-shrink-0 px-6 py-4",
                      "border-t border-slate-100 dark:border-slate-800",
                      "bg-slate-50/80 dark:bg-slate-900/80",
                    )}
                  >
                    {footer}
                  </motion.div>
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/**
 * SideSheetAnimatedContent - 自动为直接子元素添加渐进动画
 */
function SideSheetAnimatedContent({ children }: { children: React.ReactNode }) {
  const childArray = React.Children.toArray(children);

  return (
    <>
      {childArray.map((child, index) => {
        // 如果子元素已经是 SideSheetSection 等带动画的组件，直接渲染
        if (React.isValidElement(child)) {
          const childType = child.type as React.ComponentType;
          const childName = childType.displayName || childType.name || "";

          // 检查是否是 SideSheet 的子组件
          if (childName.startsWith("SideSheet")) {
            // 保留原有 props，动态传递 index
            const childProps = child.props as Record<string, unknown>;
            return React.cloneElement(child, {
              key: index,
              index: (childProps.index as number) ?? index,
            } as Record<string, unknown>);
          }
        }

        // 否则包装一层动画
        return (
          <motion.div
            key={index}
            initial="hidden"
            animate="visible"
            variants={getContentItemVariants(index)}
          >
            {child}
          </motion.div>
        );
      })}
    </>
  );
}

// 导出所有组件
export {
  type SideSheetProps,
  type SideSheetSize,
  type SideSheetSectionProps,
  type SideSheetPrimaryZoneProps,
  type SideSheetSecondaryZoneProps,
  type SideSheetExpandableZoneProps,
};
