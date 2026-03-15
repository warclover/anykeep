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

// L-4: storageKey 现在是必填参数，兼容层显式传入默认值
import { useFeatureOnboarding } from "@/hooks/onboarding/use-feature-onboarding";
import type { OnboardingStep } from "@/hooks/onboarding/types";

const QUICK_ADD_STORAGE_KEY = "anykeep_onboarding_quick_add_v1";

/** QuickAdd 专用 onboarding hook（向后兼容） */
export function useOnboarding(
  steps: OnboardingStep[],
  storageKey: string = QUICK_ADD_STORAGE_KEY,
) {
  return useFeatureOnboarding(steps, storageKey);
}

// Re-export QuickAdd 专用步骤定义
export const QUICK_ADD_ONBOARDING: OnboardingStep[] = [
  {
    id: "quick-add-intro",
    target: ".quick-add-bookmark",
    title: "✨ 一键收藏",
    description:
      "复制微信公众号、小红书、B站等平台的链接，点击这里自动粘贴识别并预览内容",
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
      "现在就试试粘贴一个链接吧\n\n💡 小技巧：\n• Tab 键打开详情面板\n• Esc 键取消操作\n• 手机端可通过分享菜单直接收藏",
    position: "center",
  },
];
