/**
 * 科研人员画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 科研人员画像配置
 */
export const RESEARCHER_CONFIG: PersonaConfig = {
  id: "researcher",
  group: "academic",
  name: "科研人员",
  icon: "🔬",
  description: "科研机构研究员，专注学术研究和论文发表",

  behaviorSignals: {
    tagPatterns: [
      /论文|paper|文献|期刊|journal/i,
      /研究|实验|数据|分析|methodology/i,
      /引用|citation|参考|reference/i,
      /基金|项目|grant|funding/i,
      /会议|conference|symposium/i,
    ],
    platformPreferences: [
      "知网",
      "Google Scholar",
      "PubMed",
      "arXiv",
      "IEEE",
      "ResearchGate",
    ],
    contentTypes: ["论文", "文献综述", "实验数据", "研究报告", "会议论文"],
    folderPatterns: [/论文/, /文献/, /研究/, /项目/, /实验/],
    domainPatterns: [
      /cnki\.net/,
      /scholar\.google/,
      /pubmed\.ncbi/,
      /arxiv\.org/,
      /ieee\.org/,
    ],
  },

  intentBoosts: {
    paper_tracking: 1.8,
    literature_review: 1.7,
    citation_manage: 1.6,
    batch_summarize: 1.4,
    theme_organize: 1.3,
  },

  promptKey: "academic.researcher",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    academicCitations: true,
    codeBlocks: false,
    emojiStyle: "none",
  },
};
