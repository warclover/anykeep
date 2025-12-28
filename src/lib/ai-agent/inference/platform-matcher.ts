/**
 * 平台信号匹配器
 *
 * 根据用户收藏的平台分布推断画像
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { InferenceSignal, PlatformPersonaRule } from "./types";

// =============================================================================
// 平台 → 画像映射规则
// =============================================================================

/**
 * 平台 → 画像映射规则
 * 每个平台可映射到多个画像，带有权重
 */
export const PLATFORM_PERSONA_RULES: Record<string, PlatformPersonaRule[]> = {
  // ==================== 学术研究型 ====================
  "arxiv.org": [
    { persona: "phd", weight: 0.9 },
    { persona: "master", weight: 0.8 },
    { persona: "ai_enthusiast", weight: 0.6 },
    { persona: "researcher", weight: 0.85 },
  ],
  "scholar.google.com": [
    { persona: "phd", weight: 0.85 },
    { persona: "master", weight: 0.8 },
    { persona: "teacher", weight: 0.7 },
  ],
  "cnki.net": [
    { persona: "master", weight: 0.85 },
    { persona: "phd", weight: 0.8 },
    { persona: "teacher", weight: 0.75 },
  ],
  "wanfangdata.com.cn": [
    { persona: "master", weight: 0.8 },
    { persona: "phd", weight: 0.75 },
  ],
  "coursera.org": [
    { persona: "student", weight: 0.7 },
    { persona: "lifelong_learner", weight: 0.8 },
    { persona: "career_changer", weight: 0.6 },
  ],
  "mooc.cn": [
    { persona: "student", weight: 0.8 },
    { persona: "teacher", weight: 0.5 },
  ],
  "icourse163.org": [
    { persona: "student", weight: 0.8 },
    { persona: "teacher", weight: 0.6 },
  ],
  "edx.org": [
    { persona: "lifelong_learner", weight: 0.8 },
    { persona: "student", weight: 0.7 },
  ],
  "udemy.com": [
    { persona: "lifelong_learner", weight: 0.7 },
    { persona: "career_changer", weight: 0.65 },
  ],

  // ==================== 产品设计型 ====================
  "36kr.com": [
    { persona: "pm", weight: 0.8 },
    { persona: "tech_blogger", weight: 0.7 },
    { persona: "analyst", weight: 0.6 },
  ],
  "producthunt.com": [
    { persona: "pm", weight: 0.85 },
    { persona: "indie_dev", weight: 0.8 },
  ],
  "uxdesign.cc": [
    { persona: "ux_researcher", weight: 0.9 },
    { persona: "pm", weight: 0.5 },
  ],
  "figma.com": [
    { persona: "ux_researcher", weight: 0.8 },
    { persona: "pm", weight: 0.4 },
  ],
  "dribbble.com": [
    { persona: "ux_researcher", weight: 0.7 },
    { persona: "creator", weight: 0.6 },
  ],
  "zcool.com.cn": [
    { persona: "creator", weight: 0.8 },
    { persona: "ux_researcher", weight: 0.6 },
  ],
  "woshipm.com": [{ persona: "pm", weight: 0.95 }],
  "pmcaff.com": [{ persona: "pm", weight: 0.9 }],

  // ==================== 技术实践型 ====================
  "github.com": [
    { persona: "indie_dev", weight: 0.8 },
    { persona: "dev_blogger", weight: 0.7 },
    { persona: "architect", weight: 0.6 },
  ],
  "juejin.cn": [
    { persona: "dev_blogger", weight: 0.85 },
    { persona: "indie_dev", weight: 0.7 },
  ],
  "v2ex.com": [
    { persona: "indie_dev", weight: 0.8 },
    { persona: "dev_blogger", weight: 0.6 },
  ],
  "news.ycombinator.com": [
    { persona: "indie_dev", weight: 0.85 },
    { persona: "ai_enthusiast", weight: 0.6 },
  ],
  "huggingface.co": [
    { persona: "ai_enthusiast", weight: 0.9 },
    { persona: "phd", weight: 0.5 },
  ],
  "csdn.net": [
    { persona: "dev_blogger", weight: 0.75 },
    { persona: "indie_dev", weight: 0.6 },
  ],
  "stackoverflow.com": [
    { persona: "indie_dev", weight: 0.8 },
    { persona: "dev_blogger", weight: 0.5 },
  ],
  "medium.com": [
    { persona: "tech_blogger", weight: 0.7 },
    { persona: "knowledge_blogger", weight: 0.6 },
  ],
  "dev.to": [
    { persona: "dev_blogger", weight: 0.85 },
    { persona: "indie_dev", weight: 0.7 },
  ],

  // ==================== 专业服务型 ====================
  "mckinsey.com": [
    { persona: "consultant", weight: 0.9 },
    { persona: "analyst", weight: 0.6 },
  ],
  "mbalib.com": [
    { persona: "consultant", weight: 0.85 },
    { persona: "pm", weight: 0.6 },
  ],
  "hbr.org": [
    { persona: "consultant", weight: 0.8 },
    { persona: "pm", weight: 0.5 },
  ],
  "wind.com.cn": [{ persona: "analyst", weight: 0.9 }],
  "eastmoney.com": [{ persona: "analyst", weight: 0.85 }],
  "bcg.com": [{ persona: "consultant", weight: 0.9 }],
  "bain.com": [{ persona: "consultant", weight: 0.9 }],

  // ==================== 内容创作型 ====================
  "mp.weixin.qq.com": [
    { persona: "tech_blogger", weight: 0.6 },
    { persona: "knowledge_blogger", weight: 0.6 },
    { persona: "creator", weight: 0.5 },
  ],
  "zhihu.com": [
    { persona: "knowledge_blogger", weight: 0.7 },
    { persona: "student", weight: 0.5 },
  ],
  "bilibili.com": [
    { persona: "creator", weight: 0.7 },
    { persona: "student", weight: 0.5 },
  ],
  "xiaohongshu.com": [{ persona: "creator", weight: 0.85 }],
  "douban.com": [
    { persona: "knowledge_blogger", weight: 0.6 },
    { persona: "creator", weight: 0.5 },
  ],
  "weibo.com": [{ persona: "creator", weight: 0.7 }],
  "toutiao.com": [{ persona: "knowledge_blogger", weight: 0.6 }],

  // ==================== 自我提升型 ====================
  "dedao.cn": [
    { persona: "lifelong_learner", weight: 0.9 },
    { persona: "knowledge_blogger", weight: 0.5 },
  ],
  "cpa.gaodun.com": [{ persona: "cert_seeker", weight: 0.95 }],
  "fenbi.com": [{ persona: "cert_seeker", weight: 0.9 }],
  "huatu.com": [{ persona: "cert_seeker", weight: 0.85 }],
  "duolingo.com": [{ persona: "language_learner", weight: 0.9 }],
  "shanbay.com": [{ persona: "language_learner", weight: 0.85 }],
};

// =============================================================================
// 平台信号匹配器
// =============================================================================

/**
 * 平台信号匹配器
 */
export class PlatformMatcher {
  /**
   * 从 URL 提取域名
   */
  extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // 移除 www. 前缀
      return urlObj.hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }

  /**
   * 匹配平台信号
   * @param platformDistribution 平台分布统计 { domain: count }
   * @param totalBookmarks 总收藏数
   */
  match(
    platformDistribution: Record<string, number>,
    totalBookmarks: number,
  ): InferenceSignal[] {
    const signals: InferenceSignal[] = [];

    if (totalBookmarks === 0) {
      return signals;
    }

    for (const [domain, count] of Object.entries(platformDistribution)) {
      const rules = PLATFORM_PERSONA_RULES[domain];
      if (!rules || rules.length === 0) continue;

      // 计算该平台的权重（基于占比）
      const ratio = count / totalBookmarks;

      signals.push({
        type: "platform",
        source: domain,
        personas: rules.map((r) => r.persona),
        weight: ratio,
        count,
      });
    }

    return signals;
  }

  /**
   * 获取所有已知平台列表
   */
  getKnownPlatforms(): string[] {
    return Object.keys(PLATFORM_PERSONA_RULES);
  }

  /**
   * 检查域名是否在已知平台列表中
   */
  isKnownPlatform(domain: string): boolean {
    return domain in PLATFORM_PERSONA_RULES;
  }

  /**
   * 获取平台对应的画像规则
   */
  getPlatformRules(domain: string): PlatformPersonaRule[] | null {
    return PLATFORM_PERSONA_RULES[domain] || null;
  }
}

/**
 * 单例实例
 */
export const platformMatcher = new PlatformMatcher();
