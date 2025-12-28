/**
 * 企业培训师画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 企业培训师画像配置
 */
export const TRAINER_CONFIG: PersonaConfig = {
  id: "trainer",
  group: "design",
  name: "企业培训师",
  icon: "👔",
  description: "企业内训师，设计和交付企业培训项目",

  behaviorSignals: {
    tagPatterns: [
      /培训|训练|training|内训|workshop/i,
      /课程|课件|教案|curriculum/i,
      /员工|团队|领导力|leadership/i,
      /方法论|模型|framework|工具/i,
      /案例|实战|演练|practice/i,
    ],
    platformPreferences: [
      "得到",
      "混沌学园",
      "人人都是产品经理",
      "HBR",
      "LinkedIn Learning",
    ],
    contentTypes: ["培训课件", "案例素材", "方法论", "工具模板", "讲师资料"],
    folderPatterns: [/培训/, /课程/, /案例/, /模板/, /方法/],
    domainPatterns: [
      /dedao\.cn/,
      /hundun\.cn/,
      /woshipm\.com/,
      /hbr\.org/,
      /linkedin\.com\/learning/,
    ],
  },

  intentBoosts: {
    training_design: 1.8,
    case_organize: 1.7,
    content_series: 1.6,
    batch_summarize: 1.4,
    theme_organize: 1.3,
  },

  promptKey: "design.trainer",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    emojiStyle: "minimal",
  },
};
