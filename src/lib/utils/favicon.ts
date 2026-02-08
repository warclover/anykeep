/**
 * Favicon 工具函数
 *
 * 策略：纯本地生成，不依赖任何外部 favicon 服务
 * - 避免 DuckDuckGo / Google favicon 服务在国内网络超时
 * - 通过域名首字母 + 确定性配色生成辨识度足够的图标
 */

/** 域名对应的配色方案（基于首字母 hash 确定性选取） */
const COLORS = [
  {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-600 dark:text-red-400",
  },
  {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-600 dark:text-orange-400",
  },
  {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-600 dark:text-amber-400",
  },
  {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  {
    bg: "bg-teal-100 dark:bg-teal-900/30",
    text: "text-teal-600 dark:text-teal-400",
  },
  {
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    text: "text-cyan-600 dark:text-cyan-400",
  },
  {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
  },
  {
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  {
    bg: "bg-violet-100 dark:bg-violet-900/30",
    text: "text-violet-600 dark:text-violet-400",
  },
  {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-600 dark:text-pink-400",
  },
];

export interface FaviconInfo {
  /** 域名首字母（大写） */
  letter: string;
  /** Tailwind 背景色 class */
  bgClass: string;
  /** Tailwind 文字色 class */
  textClass: string;
}

/**
 * 从 URL 提取域名信息，生成本地 favicon 数据
 * @param url - 书签原始 URL
 * @returns FaviconInfo 包含首字母和配色
 */
export function getFaviconInfo(url: string): FaviconInfo {
  try {
    const { hostname } = new URL(url);
    // 去掉 www. 前缀，取第一个有意义的字符
    const domain = hostname.replace(/^www\./, "");
    const letter = (domain[0] || "?").toUpperCase();
    // 基于域名字符串做简单 hash，确保同域名总是同色
    const hash = Array.from(domain).reduce(
      (acc, c) => acc + c.charCodeAt(0),
      0,
    );
    const color = COLORS[hash % COLORS.length];
    return { letter, bgClass: color.bg, textClass: color.text };
  } catch {
    return { letter: "?", bgClass: COLORS[0].bg, textClass: COLORS[0].text };
  }
}
