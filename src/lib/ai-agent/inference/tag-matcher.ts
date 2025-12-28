/**
 * 标签模式匹配器
 *
 * 根据用户的标签使用模式推断画像
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaType, InferenceSignal, TagPersonaRule } from "./types";

// =============================================================================
// 标签模式 → 画像映射规则
// =============================================================================

/**
 * 标签模式 → 画像映射规则
 */
export const TAG_PERSONA_RULES: TagPersonaRule[] = [
  // ==================== 学术研究型 ====================
  {
    pattern: /论文|文献|研究|学术|paper|research|thesis|dissertation/i,
    personas: [
      { persona: "phd", weight: 0.8 },
      { persona: "master", weight: 0.8 },
      { persona: "researcher", weight: 0.7 },
    ],
  },
  {
    pattern: /课程|教学|备课|讲义|syllabus|curriculum|教案/i,
    personas: [
      { persona: "teacher", weight: 0.9 },
      { persona: "student", weight: 0.5 },
    ],
  },
  {
    pattern: /考研|考试|复习|期末|备考|真题|刷题/i,
    personas: [
      { persona: "student", weight: 0.9 },
      { persona: "cert_seeker", weight: 0.7 },
    ],
  },
  {
    pattern: /毕业|毕设|开题|答辩|导师/i,
    personas: [
      { persona: "master", weight: 0.85 },
      { persona: "phd", weight: 0.8 },
    ],
  },
  {
    pattern: /arXiv|IEEE|ACM|CVPR|NIPS|NeurIPS|ICLR/i,
    personas: [
      { persona: "phd", weight: 0.95 },
      { persona: "ai_enthusiast", weight: 0.7 },
    ],
  },

  // ==================== 产品设计型 ====================
  {
    pattern: /竞品|PRD|需求|产品分析|用户调研|MRD|BRD/i,
    personas: [{ persona: "pm", weight: 0.95 }],
  },
  {
    pattern: /用户体验|UX|交互设计|可用性|用研|prototype|原型/i,
    personas: [
      { persona: "ux_researcher", weight: 0.9 },
      { persona: "pm", weight: 0.4 },
    ],
  },
  {
    pattern: /游戏设计|玩法|数值|关卡|game design|GDD/i,
    personas: [{ persona: "game_planner", weight: 0.95 }],
  },
  {
    pattern: /增长|留存|转化|漏斗|AARRR|北极星/i,
    personas: [
      { persona: "pm", weight: 0.85 },
      { persona: "analyst", weight: 0.6 },
    ],
  },
  {
    pattern: /B端|SaaS|ToB|企业服务/i,
    personas: [{ persona: "pm", weight: 0.8 }],
  },

  // ==================== 专业服务型 ====================
  {
    pattern: /咨询|方法论|案例|麦肯锡|BCG|贝恩|德勤|埃森哲/i,
    personas: [{ persona: "consultant", weight: 0.9 }],
  },
  {
    pattern: /研报|行业分析|市场研究|投研|估值|尽调|IPO/i,
    personas: [{ persona: "analyst", weight: 0.9 }],
  },
  {
    pattern: /法规|法律|判例|合同|诉讼|民法|刑法|合规/i,
    personas: [{ persona: "lawyer", weight: 0.95 }],
  },
  {
    pattern: /临床|医学|指南|病例|诊疗|药物|医疗/i,
    personas: [{ persona: "medical", weight: 0.95 }],
  },
  {
    pattern: /财报|年报|财务|审计|会计准则/i,
    personas: [
      { persona: "analyst", weight: 0.85 },
      { persona: "cert_seeker", weight: 0.6 },
    ],
  },

  // ==================== 技术实践型 ====================
  {
    pattern: /架构|系统设计|技术选型|微服务|分布式|高并发/i,
    personas: [
      { persona: "architect", weight: 0.9 },
      { persona: "indie_dev", weight: 0.5 },
    ],
  },
  {
    pattern: /AI|机器学习|深度学习|大模型|LLM|GPT|prompt|RAG/i,
    personas: [
      { persona: "ai_enthusiast", weight: 0.9 },
      { persona: "phd", weight: 0.4 },
    ],
  },
  {
    pattern: /安全|漏洞|渗透|CVE|攻防|逆向|CTF/i,
    personas: [{ persona: "security_researcher", weight: 0.95 }],
  },
  {
    pattern: /开源|GitHub|Star|fork|PR|issue|contributor/i,
    personas: [
      { persona: "indie_dev", weight: 0.85 },
      { persona: "dev_blogger", weight: 0.6 },
    ],
  },
  {
    pattern: /前端|后端|全栈|React|Vue|Node|Python|Java|Rust|Go/i,
    personas: [
      { persona: "indie_dev", weight: 0.8 },
      { persona: "dev_blogger", weight: 0.7 },
    ],
  },
  {
    pattern: /算法|数据结构|LeetCode|刷题|面试题/i,
    personas: [
      { persona: "indie_dev", weight: 0.75 },
      { persona: "student", weight: 0.7 },
    ],
  },

  // ==================== 内容创作型 ====================
  {
    pattern: /运营|涨粉|内容策略|流量|变现|IP/i,
    personas: [
      { persona: "creator", weight: 0.85 },
      { persona: "knowledge_blogger", weight: 0.7 },
    ],
  },
  {
    pattern: /写作|文案|标题|爆款|选题/i,
    personas: [
      { persona: "tech_blogger", weight: 0.75 },
      { persona: "knowledge_blogger", weight: 0.8 },
    ],
  },
  {
    pattern: /视频|剪辑|拍摄|UP主|抖音|B站/i,
    personas: [{ persona: "creator", weight: 0.9 }],
  },

  // ==================== 自我提升型 ====================
  {
    pattern: /CPA|CFA|PMP|考证|资格证|职业资格|司法考试|法考/i,
    personas: [{ persona: "cert_seeker", weight: 0.95 }],
  },
  {
    pattern: /转型|转行|职业规划|技能提升|跳槽|裸辞/i,
    personas: [
      { persona: "career_changer", weight: 0.9 },
      { persona: "lifelong_learner", weight: 0.6 },
    ],
  },
  {
    pattern: /英语|日语|雅思|托福|词汇|语法|口语|听力/i,
    personas: [{ persona: "language_learner", weight: 0.9 }],
  },
  {
    pattern: /读书|书单|阅读|笔记|知识管理|第二大脑/i,
    personas: [
      { persona: "lifelong_learner", weight: 0.85 },
      { persona: "knowledge_blogger", weight: 0.6 },
    ],
  },
  {
    pattern: /效率|时间管理|GTD|番茄|习惯|自律/i,
    personas: [{ persona: "lifelong_learner", weight: 0.75 }],
  },
];

// =============================================================================
// 标签模式匹配器
// =============================================================================

/**
 * 标签模式匹配器
 */
export class TagMatcher {
  /**
   * 匹配标签信号
   * @param tagFrequency 标签频率统计 { tag: count }
   * @param totalBookmarks 总收藏数
   */
  match(
    tagFrequency: Record<string, number>,
    totalBookmarks: number,
  ): InferenceSignal[] {
    const signals: InferenceSignal[] = [];
    const matchedPatterns = new Set<string>();

    if (totalBookmarks === 0) {
      return signals;
    }

    for (const [tag, count] of Object.entries(tagFrequency)) {
      for (const rule of TAG_PERSONA_RULES) {
        // 避免同一模式重复匹配
        const patternKey = rule.pattern.source;
        if (matchedPatterns.has(patternKey)) continue;

        if (rule.pattern.test(tag)) {
          matchedPatterns.add(patternKey);

          signals.push({
            type: "tag",
            source: tag,
            personas: rule.personas.map((p) => p.persona),
            // 标签权重放大（标签通常更有意义）
            weight: Math.min((count / totalBookmarks) * 10, 1),
            count,
          });
        }
      }
    }

    return signals;
  }

  /**
   * 检查标签是否匹配任何规则
   */
  hasMatch(tag: string): boolean {
    return TAG_PERSONA_RULES.some((rule) => rule.pattern.test(tag));
  }

  /**
   * 获取标签匹配的画像
   */
  getMatchingPersonas(tag: string): PersonaType[] {
    for (const rule of TAG_PERSONA_RULES) {
      if (rule.pattern.test(tag)) {
        return rule.personas.map((p) => p.persona);
      }
    }
    return [];
  }

  /**
   * 获取所有规则的模式
   */
  getAllPatterns(): RegExp[] {
    return TAG_PERSONA_RULES.map((rule) => rule.pattern);
  }
}

/**
 * 单例实例
 */
export const tagMatcher = new TagMatcher();
