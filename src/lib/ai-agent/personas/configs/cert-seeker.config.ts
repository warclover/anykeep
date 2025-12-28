/**
 * 考证备考者画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 考证备考者画像配置
 */
export const CERT_SEEKER_CONFIG: PersonaConfig = {
  id: "cert_seeker",
  group: "growth",
  name: "考证备考者",
  icon: "📝",
  description: "职业资格考试备考者",

  behaviorSignals: {
    tagPatterns: [
      /考试|备考|考证|认证/,
      /CPA|CFA|司考|法考|注会/,
      /真题|模拟题|错题|练习/,
      /知识点|考点|重点|难点/,
      /复习|冲刺|押题|背诵/,
    ],
    platformPreferences: ["知乎", "小红书", "B站", "考试吧", "高顿"],
    contentTypes: ["教材笔记", "错题记录", "真题解析", "备考经验", "考点总结"],
    folderPatterns: [/考试/, /备考/, /错题/, /笔记/, /真题/],
    domainPatterns: [
      /gaodun\.com/,
      /examcoo\.com/,
      /zhihu\.com/,
      /bilibili\.com/,
    ],
  },

  intentBoosts: {
    exam_organize: 1.8,
    error_analysis: 1.7,
    progress_track: 1.5,
    review_remind: 1.4,
    learning_path: 1.3,
  },

  promptKey: "growth.cert_seeker",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "concise",
    proactiveReminders: true,
    emojiStyle: "rich",
  },
};
