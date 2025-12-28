/**
 * 语言学习者画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 语言学习者画像配置
 */
export const LANGUAGE_LEARNER_CONFIG: PersonaConfig = {
  id: "language_learner",
  group: "growth",
  name: "语言学习者",
  icon: "🌍",
  description: "外语学习者，提升语言能力和跨文化理解",

  behaviorSignals: {
    tagPatterns: [
      /语言|language|外语|英语|日语/i,
      /词汇|vocabulary|单词|表达/i,
      /语法|grammar|句型|pattern/i,
      /听力|口语|阅读|写作/i,
      /练习|exercise|学习|study/i,
    ],
    platformPreferences: [
      "多邻国",
      "不背单词",
      "扇贝",
      "TED",
      "BBC Learning",
      "NHK World",
    ],
    contentTypes: ["语言课程", "词汇列表", "语料素材", "练习资料", "文化内容"],
    folderPatterns: [/语言/, /英语/, /日语/, /词汇/, /学习/],
    domainPatterns: [
      /duolingo\.com/,
      /ted\.com/,
      /bbc\.com\/learningenglish/,
      /nhk\.or\.jp/,
    ],
  },

  intentBoosts: {
    corpus_manage: 1.8,
    expression_extract: 1.7,
    resource_integrate: 1.6,
    theme_organize: 1.5,
    batch_summarize: 1.3,
  },

  promptKey: "growth.language_learner",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "auto",
    proactiveReminders: true,
    emojiStyle: "minimal",
    language: "auto",
  },
};
