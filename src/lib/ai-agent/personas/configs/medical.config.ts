/**
 * 医学从业者画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 医学从业者画像配置
 */
export const MEDICAL_CONFIG: PersonaConfig = {
  id: "medical",
  group: "professional",
  name: "医学从业者",
  icon: "🩺",
  description: "医疗健康领域从业者，关注临床和医学研究",

  behaviorSignals: {
    tagPatterns: [
      /医学|临床|诊断|治疗|medical/i,
      /指南|guideline|共识|consensus/i,
      /病例|case|症状|病理/i,
      /药物|药品|用药|pharmaceutical/i,
      /研究|论文|文献|study/i,
    ],
    platformPreferences: [
      "PubMed",
      "丁香园",
      "医学界",
      "UpToDate",
      "梅斯医学",
      "Medscape",
    ],
    contentTypes: ["临床指南", "病例报告", "医学论文", "药物资讯", "继教课程"],
    folderPatterns: [/医学/, /临床/, /指南/, /病例/, /药物/],
    domainPatterns: [
      /pubmed\.ncbi/,
      /dxy\.cn/,
      /uptodate\.com/,
      /medsci\.cn/,
      /medscape\.com/,
    ],
  },

  intentBoosts: {
    guideline_tracking: 1.8,
    literature_review: 1.7,
    case_organize: 1.6,
    paper_tracking: 1.5,
    theme_organize: 1.3,
  },

  promptKey: "professional.medical",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    academicCitations: true,
    emojiStyle: "none",
  },
};
