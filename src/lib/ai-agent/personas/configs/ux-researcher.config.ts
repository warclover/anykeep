/**
 * UX研究员画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * UX研究员画像配置
 */
export const UX_RESEARCHER_CONFIG: PersonaConfig = {
  id: "ux_researcher",
  group: "design",
  name: "UX研究员",
  icon: "🎨",
  description: "用户体验研究员",

  behaviorSignals: {
    tagPatterns: [
      /用户(体验|研究|测试|访谈)/,
      /UX|UI|交互|设计/,
      /可用性|易用性|体验优化/,
      /设计(规范|系统|模式|语言)/,
      /原型|线框图|流程图/,
    ],
    platformPreferences: [
      "Dribbble",
      "Behance",
      "站酷",
      "优设",
      "人人都是产品经理",
    ],
    contentTypes: ["用研报告", "设计规范", "交互案例", "可用性测试", "竞品UX"],
    folderPatterns: [/设计/, /用研/, /交互/, /案例/, /规范/],
    domainPatterns: [
      /dribbble\.com/,
      /behance\.net/,
      /zcool\.com\.cn/,
      /uisdc\.com/,
    ],
  },

  intentBoosts: {
    pattern_library: 1.7,
    feedback_cluster: 1.6,
    insight_organize: 1.5,
    competitive_analysis: 1.4,
  },

  promptKey: "design.ux_researcher",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    emojiStyle: "rich",
  },
};
