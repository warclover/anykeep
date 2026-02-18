/**
 * Condense shared utilities (safe for client & server).
 *
 * 注意：此文件必须不依赖任何 server-only/Node-only 模块，
 * 以便在 Client Component 中复用预设与字数统计。
 */

export const CONDENSE_PRESETS = {
  /** 小红书：短、口语化、强调要点 */
  xiaohongshu: {
    label: "小红书",
    targetWords: 800,
  },
  /** 微信短文：适合快速阅读 */
  wechat_short: {
    label: "微信-短文",
    targetWords: 1200,
  },
  /** 微信标准：适合公众号标准篇幅 */
  wechat_standard: {
    label: "微信-标准",
    targetWords: 2000,
  },
  /** 通用摘要：更强压缩 */
  summary: {
    label: "摘要",
    targetWords: 600,
  },
} as const;

export type CondensePreset = keyof typeof CONDENSE_PRESETS;

/**
 * 简单字数统计（中英文混合）
 * - 中文按字符计（剔除空白）
 * - 英文按单词计
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const englishWords = (
    text.replace(/[\u4e00-\u9fa5]/g, " ").match(/\b\w+\b/g) ?? []
  ).length;
  return chineseChars + englishWords;
}
