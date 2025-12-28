/**
 * 大学教师画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 大学教师画像配置
 */
export const TEACHER_CONFIG: PersonaConfig = {
  id: "teacher",
  group: "academic",
  name: "大学教师",
  icon: "👨‍🏫",
  description: "高校教师、讲师，负责教学和科研",

  behaviorSignals: {
    tagPatterns: [
      /教学|教案|课件|备课|授课/,
      /论文|文献|期刊|学术/,
      /课程|教材|教育|培养/,
      /学生|研究生|本科生|指导/,
      /科研|项目|基金|成果/,
    ],
    platformPreferences: [
      "知网",
      "学堂在线",
      "中国大学MOOC",
      "知乎",
      "微信公众号",
    ],
    contentTypes: ["教材PDF", "论文", "教学案例", "MOOC视频", "课件PPT"],
    folderPatterns: [/课程/, /教学/, /论文/, /科研/, /学生/],
    domainPatterns: [
      /cnki\.net/,
      /xuetangx\.com/,
      /icourse163\.org/,
      /zhihu\.com/,
    ],
  },

  intentBoosts: {
    course_organize: 1.7,
    teaching_case: 1.5,
    paper_tracking: 1.4,
    batch_summarize: 1.3,
    knowledge_map: 1.2,
  },

  promptKey: "academic.teacher",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    academicCitations: true,
    emojiStyle: "minimal",
  },
};
