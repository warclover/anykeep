/**
 * 律师/法务画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 律师/法务画像配置
 */
export const LAWYER_CONFIG: PersonaConfig = {
  id: "lawyer",
  group: "professional",
  name: "律师/法务",
  icon: "⚖️",
  description: "法律从业者，处理法律事务和合规咨询",

  behaviorSignals: {
    tagPatterns: [
      /法律|法规|条例|law|regulation/i,
      /合同|协议|条款|contract/i,
      /案例|判决|裁定|诉讼/i,
      /合规|compliance|审查|风控/i,
      /知识产权|专利|商标|版权/i,
    ],
    platformPreferences: [
      "北大法宝",
      "中国裁判文书网",
      "威科先行",
      "法律快车",
      "无讼",
    ],
    contentTypes: ["法律法规", "合同模板", "案例分析", "法律解读", "合规指南"],
    folderPatterns: [/法律/, /合同/, /案例/, /合规/, /法规/],
    domainPatterns: [
      /pkulaw\.com/,
      /wenshu\.court\.gov\.cn/,
      /wolterskluwer\.com/,
      /itslaw\.com/,
    ],
  },

  intentBoosts: {
    legal_research: 1.8,
    contract_manage: 1.7,
    compliance_check: 1.6,
    find_related: 1.4,
    theme_organize: 1.3,
  },

  promptKey: "professional.lawyer",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    academicCitations: true,
    emojiStyle: "none",
  },
};
