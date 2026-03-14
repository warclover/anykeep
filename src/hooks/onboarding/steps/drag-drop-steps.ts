/**
 * 拖放引导步骤定义
 *
 * 引导用户发现「拖拽书签到文件夹」的交互。
 * 仅在有 2+ 文件夹且有书签时激活。
 */

import type { OnboardingStep } from "../types";

export const DRAG_DROP_STORAGE_KEY = "anykeep_onboarding_drag_drop_v1";

export const DRAG_DROP_STEPS: OnboardingStep[] = [
  {
    id: "drag-drop-bookmark",
    target: ".bookmark-card",
    title: "📦 拖拽归档",
    description: "长按或拖拽书签卡片，可以快速移动到任意文件夹",
    position: "bottom",
  },
  {
    id: "drag-drop-folder",
    target: ".folder-nav-panel",
    title: "📁 文件夹接收区",
    description: "将书签拖拽到左侧文件夹上方即可完成归档\n释放鼠标自动移动",
    position: "right",
  },
];
