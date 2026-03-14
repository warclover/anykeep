/**
 * Onboarding Hook（re-export 兼容层）
 *
 * 实际实现已迁移到 @/hooks/onboarding/use-feature-onboarding。
 * 保留此文件以兼容现有 import。
 */

export type {
  OnboardingStep,
  UseOnboardingReturn,
} from "@/hooks/onboarding/types";

export { useFeatureOnboarding as useOnboarding } from "@/hooks/onboarding/use-feature-onboarding";

// Re-export QuickAdd 专用步骤定义
import type { OnboardingStep } from "@/hooks/onboarding/types";

export const QUICK_ADD_ONBOARDING: OnboardingStep[] = [
  {
    id: "quick-add-intro",
    target: ".quick-add-bookmark",
    title: "✨ 一键收藏",
    description: "复制任意网页链接，点击这里自动粘贴识别并预览内容",
    position: "bottom",
  },
  {
    id: "quick-add-actions",
    target: ".quick-add-bookmark",
    title: "🎯 快速操作",
    description:
      "按 Enter 或点击「收藏」快速保存\n点击 ⚙️ 可选择文件夹和添加标签",
    position: "bottom",
  },
  {
    id: "quick-add-complete",
    target: null,
    title: "🎉 准备就绪！",
    description:
      "现在就试试粘贴一个链接吧\n\n💡 小技巧：\n• Tab 键打开详情面板\n• Esc 键取消操作\n• Enter 键快速收藏",
    position: "center",
  },
];
