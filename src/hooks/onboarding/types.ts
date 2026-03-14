/**
 * 功能引导系统 — 共享类型定义
 *
 * 支持多个独立引导流程（QuickAdd、拖放、批量选择等），
 * 每个流程使用独立的 localStorage key 追踪完成状态。
 */

export interface OnboardingStep {
  /** 步骤唯一标识 */
  id: string;
  /** CSS selector 定位目标元素，null 表示居中显示 */
  target: string | null;
  /** 步骤标题 */
  title: string;
  /** 步骤描述（支持 \n 换行） */
  description: string;
  /** tooltip 相对目标元素的位置 */
  position: "top" | "bottom" | "left" | "right" | "center";
  /** 进入此步骤时触发的可选动作 */
  action?: () => void;
}

export interface UseOnboardingReturn {
  /** 引导是否处于激活状态 */
  isActive: boolean;
  /** 当前步骤索引（0-based） */
  currentStep: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 当前步骤数据（未激活时为 null） */
  step: OnboardingStep | null;
  /** 进入下一步（最后一步时自动完成） */
  next: () => void;
  /** 返回上一步 */
  prev: () => void;
  /** 跳过引导（标记完成） */
  skip: () => void;
  /** 完成引导 */
  complete: () => void;
  /** 重置引导状态（用于开发测试） */
  reset: () => void;
}
