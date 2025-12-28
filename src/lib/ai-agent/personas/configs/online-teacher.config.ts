/**
 * 在线讲师画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 在线讲师画像配置
 */
export const ONLINE_TEACHER_CONFIG: PersonaConfig = {
  id: "online_teacher",
  group: "content",
  name: "在线讲师",
  icon: "🎓",
  description: "在线教育内容创作者，制作和分享知识课程",

  behaviorSignals: {
    tagPatterns: [
      /课程|教程|培训|教学|lecture/i,
      /学员|学生|学习者|learner/i,
      /录制|直播|视频|PPT|课件/i,
      /知识付费|付费课程|会员/i,
      /答疑|互动|作业|练习/i,
    ],
    platformPreferences: [
      "得到",
      "知乎知学堂",
      "B站",
      "腾讯课堂",
      "网易云课堂",
      "Udemy",
    ],
    contentTypes: ["课程大纲", "教学视频", "课件PPT", "练习题", "案例素材"],
    folderPatterns: [/课程/, /教程/, /素材/, /学员/, /大纲/],
    domainPatterns: [
      /dedao\.cn/,
      /bilibili\.com/,
      /ke\.qq\.com/,
      /study\.163\.com/,
      /udemy\.com/,
    ],
  },

  intentBoosts: {
    course_organize: 1.8,
    content_series: 1.6,
    batch_summarize: 1.5,
    teaching_case: 1.4,
    theme_organize: 1.3,
  },

  promptKey: "content.online_teacher",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    academicCitations: false,
    emojiStyle: "minimal",
  },
};
