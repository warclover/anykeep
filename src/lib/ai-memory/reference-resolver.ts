/**
 * ReferenceResolver - 指代词解析器
 *
 * 职责：
 * - 检测用户输入中的指代词（刚才、这些、那个等）
 * - 基于会话状态解析指代词的实际指向
 * - 生成解析后的输入供后续处理
 *
 * @version 1.1.0
 * @since 2025-12-25
 * @updated 2025-12-27 - 添加序数指代解析（第N篇、最后一篇等）
 */

import { logger } from "@/lib/logger";
import type {
  ConversationState,
  ReferenceType,
  ResolvedReference,
  ReferenceResolutionResult,
  MentionedEntity,
  ReferenceResolverConfig,
} from "./types";
import { DEFAULT_REFERENCE_RESOLVER_CONFIG } from "./types";

// ============================================
// 辅助函数
// ============================================

/**
 * 中文数字映射表
 */
const CHINESE_NUMBERS: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  两: 2,
};

/**
 * 从匹配文本中提取序数
 *
 * @param match - 匹配的文本，如"第一篇"、"第3个"
 * @returns 序数值，无法解析返回 0
 */
function extractOrdinal(match: string): number {
  // 匹配阿拉伯数字
  const arabicMatch = match.match(/\d+/);
  if (arabicMatch) {
    return parseInt(arabicMatch[0], 10);
  }

  // 匹配中文数字
  const chineseMatch = match.match(/[一二三四五六七八九十两]/);
  if (chineseMatch) {
    return CHINESE_NUMBERS[chineseMatch[0]] || 0;
  }

  return 0;
}

/**
 * 从匹配文本中提取范围
 *
 * @param match - 匹配的文本，如"前三篇"、"后5个"
 * @returns { count: 数量, isFromEnd: 是否从末尾开始 }
 */
function extractRange(match: string): { count: number; isFromEnd: boolean } {
  const isFromEnd = match.startsWith("后");
  const count = extractOrdinal(match);
  return { count, isFromEnd };
}

// ============================================
// 指代词模式定义
// ============================================

/**
 * 指代词模式
 */
interface ReferencePattern {
  /** 正则模式 */
  patterns: RegExp[];
  /** 指代类型 */
  type: ReferenceType;
  /** 解析函数 */
  resolve: (
    match: string,
    state: ConversationState,
  ) => MentionedEntity[] | null;
  /** 优先级（越小越高） */
  priority: number;
}

/**
 * 指代词模式列表
 */
const REFERENCE_PATTERNS: ReferencePattern[] = [
  // ============================================
  // 序数指代（最高优先级）
  // ============================================

  // 第N篇/个 → lastSearchResults[N-1]
  {
    patterns: [/第[一二三四五六七八九十两\d]+(?:篇|个|条)(?:文章|内容|结果)?/g],
    type: "ordinal_result",
    resolve: (match, state) => {
      if (
        !state.lastSearchResults ||
        state.lastSearchResults.resultIds.length === 0
      ) {
        return null;
      }

      const ordinal = extractOrdinal(match);
      const ids = state.lastSearchResults.resultIds;
      const summaries = state.lastSearchResults.resultSummaries;

      if (ordinal > 0 && ordinal <= ids.length) {
        const id = ids[ordinal - 1];
        const summary = summaries?.find((s) => s.id === id);

        return [
          {
            type: "bookmark" as const,
            id,
            name: summary?.title || `搜索结果第 ${ordinal} 篇`,
            mentionedAt: Date.now(),
          },
        ];
      }
      return null;
    },
    priority: 0, // 最高优先级
  },

  // 最后一篇/个
  {
    patterns: [/最后(?:一)?(?:篇|个|条)(?:文章|内容|结果)?/g],
    type: "last_result",
    resolve: (match, state) => {
      if (
        !state.lastSearchResults ||
        state.lastSearchResults.resultIds.length === 0
      ) {
        return null;
      }

      const ids = state.lastSearchResults.resultIds;
      const summaries = state.lastSearchResults.resultSummaries;
      const lastId = ids[ids.length - 1];
      const summary = summaries?.find((s) => s.id === lastId);

      return [
        {
          type: "bookmark" as const,
          id: lastId,
          name: summary?.title || "搜索结果最后一篇",
          mentionedAt: Date.now(),
        },
      ];
    },
    priority: 0,
  },

  // 前N篇/后N篇
  // 注意：后N篇需要排除"最后一篇"的情况，使用负向后行断言
  {
    patterns: [
      /前[一二三四五六七八九十两\d]+(?:篇|个|条)/g,
      /(?<!最)后[一二三四五六七八九十两\d]+(?:篇|个|条)/g,
    ],
    type: "range_result",
    resolve: (match, state) => {
      if (!state.lastSearchResults) return null;

      const { count, isFromEnd } = extractRange(match);
      if (count <= 0) return null;

      const ids = state.lastSearchResults.resultIds;
      const summaries = state.lastSearchResults.resultSummaries;

      const selectedIds = isFromEnd ? ids.slice(-count) : ids.slice(0, count);

      return selectedIds.map((id, i) => {
        const summary = summaries?.find((s) => s.id === id);
        const position = isFromEnd ? ids.length - count + i + 1 : i + 1;

        return {
          type: "bookmark" as const,
          id,
          name: summary?.title || `搜索结果第 ${position} 篇`,
          mentionedAt: Date.now(),
        };
      });
    },
    priority: 1,
  },

  // ============================================
  // 原有指代模式
  // ============================================

  // 刚才/刚刚 → lastOutput
  {
    patterns: [
      /刚才(?:的|那个?)?/g,
      /刚刚(?:的|那个?)?/g,
      /方才(?:的|那个?)?/g,
      /上面(?:的|那个?)?/g,
    ],
    type: "last_output",
    resolve: (match, state) => {
      if (!state.lastOutput) return null;

      // 如果有关联实体，返回实体列表
      if (
        state.lastOutput.relatedEntityIds &&
        state.lastOutput.relatedEntityIds.length > 0
      ) {
        return state.lastOutput.relatedEntityIds.map((id) => ({
          type: "bookmark" as const,
          id,
          name: `刚才的结果 #${id}`,
          mentionedAt: Date.now(),
        }));
      }

      // 否则返回一个虚拟实体表示最近输出
      return [
        {
          type: "bookmark" as const,
          id: "__last_output__",
          name: state.lastOutput.summary,
          mentionedAt: Date.now(),
        },
      ];
    },
    priority: 1,
  },

  // 这些/这几个 → lastSearchResults
  {
    patterns: [
      /这些(?:内容|文章|书签|结果)?/g,
      /这几(?:个|篇)(?:内容|文章|书签|结果)?/g,
      /这[0-9一二三四五六七八九十]+(?:个|篇)(?:内容|文章|书签|结果)?/g,
      /上述(?:内容|文章|书签|结果)?/g,
    ],
    type: "these_results",
    resolve: (match, state) => {
      if (!state.lastSearchResults) return null;

      return state.lastSearchResults.resultIds.map((id) => ({
        type: "bookmark" as const,
        id,
        name: `搜索结果 #${id}`,
        mentionedAt: Date.now(),
      }));
    },
    priority: 2,
  },

  // 那个文件夹 → mentionedFolders[0]
  {
    patterns: [/那个?文件夹/g, /那个?(?:收藏)?夹/g, /刚才(?:的|那个)?文件夹/g],
    type: "that_folder",
    resolve: (match, state) => {
      if (state.mentionedFolders.length === 0) return null;

      // 返回最近提及的文件夹
      return [state.mentionedFolders[state.mentionedFolders.length - 1]];
    },
    priority: 3,
  },

  // 那篇文章/那个链接 → mentionedBookmarks[0]
  {
    patterns: [
      /那(?:篇|个)(?:文章|内容|链接|书签|收藏)?/g,
      /刚才(?:的|那个?)?(?:文章|内容|链接|书签)?/g,
    ],
    type: "that_bookmark",
    resolve: (match, state) => {
      if (state.mentionedBookmarks.length === 0) return null;

      // 返回最近提及的书签
      return [state.mentionedBookmarks[state.mentionedBookmarks.length - 1]];
    },
    priority: 4,
  },

  // 上一个 → 上一轮的操作对象
  {
    patterns: [/上一(?:个|篇)(?:文章|内容|链接|书签)?/g, /前一(?:个|篇)/g],
    type: "previous",
    resolve: (match, state) => {
      // 优先从搜索结果中获取上一个
      if (
        state.lastSearchResults &&
        state.lastSearchResults.resultIds.length > 0
      ) {
        const ids = state.lastSearchResults.resultIds;
        return [
          {
            type: "bookmark" as const,
            id: ids[ids.length - 1],
            name: `上一个结果`,
            mentionedAt: Date.now(),
          },
        ];
      }

      // 否则从提及的书签中获取
      if (state.mentionedBookmarks.length > 0) {
        return [state.mentionedBookmarks[state.mentionedBookmarks.length - 1]];
      }

      return null;
    },
    priority: 5,
  },

  // 提到的/说过的 → 综合提及
  {
    patterns: [
      /(?:之前|刚才)?(?:提到|说过|讲过)的(?:那个?)?/g,
      /(?:我们)?讨论的/g,
    ],
    type: "mentioned",
    resolve: (match, state) => {
      // 收集所有最近提及的实体
      const allMentioned: MentionedEntity[] = [
        ...state.mentionedBookmarks,
        ...state.mentionedFolders,
        ...state.mentionedTags,
      ];

      if (allMentioned.length === 0) return null;

      // 按时间排序，返回最近的
      allMentioned.sort((a, b) => b.mentionedAt - a.mentionedAt);

      return [allMentioned[0]];
    },
    priority: 6,
  },
];

// ============================================
// ReferenceResolver 类
// ============================================

/**
 * 指代词解析器
 */
export class ReferenceResolver {
  private config: Required<ReferenceResolverConfig>;

  constructor(config: ReferenceResolverConfig = {}) {
    this.config = {
      ...DEFAULT_REFERENCE_RESOLVER_CONFIG,
      ...config,
    };
  }

  /**
   * 解析输入中的指代词
   *
   * @param input - 用户输入
   * @param state - 会话状态
   * @returns 解析结果
   */
  resolve(input: string, state: ConversationState): ReferenceResolutionResult {
    const references: ResolvedReference[] = [];
    const unresolvedReferences: string[] = [];
    let resolvedInput = input;

    // 按优先级排序模式
    const sortedPatterns = [...REFERENCE_PATTERNS].sort(
      (a, b) => a.priority - b.priority,
    );

    // 遍历所有模式
    for (const pattern of sortedPatterns) {
      for (const regex of pattern.patterns) {
        // 重置正则状态
        regex.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = regex.exec(input)) !== null) {
          const matchedText = match[0];

          // 尝试解析
          const resolved = pattern.resolve(matchedText, state);

          if (resolved && resolved.length > 0) {
            // 计算置信度
            const confidence = this.calculateConfidence(resolved, state);

            if (confidence >= this.config.minConfidence) {
              references.push({
                originalText: matchedText,
                type: pattern.type,
                resolvedEntities: resolved,
                confidence,
                explanation: this.generateExplanation(pattern.type, resolved),
              });

              // 在解析后的输入中替换指代词
              resolvedInput = this.replaceReference(
                resolvedInput,
                matchedText,
                resolved,
              );
            } else {
              unresolvedReferences.push(matchedText);
            }
          } else {
            unresolvedReferences.push(matchedText);
          }
        }
      }
    }

    logger.debug(
      {
        originalInput: input.substring(0, 50),
        referencesFound: references.length,
        unresolvedCount: unresolvedReferences.length,
      },
      "ReferenceResolver: Resolved references",
    );

    return {
      originalInput: input,
      resolvedInput,
      references,
      hasUnresolvedReferences: unresolvedReferences.length > 0,
      unresolvedReferences:
        unresolvedReferences.length > 0 ? unresolvedReferences : undefined,
    };
  }

  /**
   * 检测输入是否包含指代词
   *
   * @param input - 用户输入
   * @returns 是否包含指代词
   */
  hasReferences(input: string): boolean {
    for (const pattern of REFERENCE_PATTERNS) {
      for (const regex of pattern.patterns) {
        regex.lastIndex = 0;
        if (regex.test(input)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 获取输入中的所有指代词（不解析）
   *
   * @param input - 用户输入
   * @returns 指代词列表
   */
  detectReferences(input: string): string[] {
    const detected: string[] = [];

    for (const pattern of REFERENCE_PATTERNS) {
      for (const regex of pattern.patterns) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(input)) !== null) {
          if (!detected.includes(match[0])) {
            detected.push(match[0]);
          }
        }
      }
    }

    return detected;
  }

  /**
   * 计算解析置信度
   */
  private calculateConfidence(
    resolved: MentionedEntity[],
    state: ConversationState,
  ): number {
    let confidence = 0.5; // 基础置信度

    // 有搜索结果时增加置信度
    if (state.lastSearchResults && state.lastSearchResults.resultCount > 0) {
      confidence += 0.2;
    }

    // 有最近输出时增加置信度
    if (state.lastOutput) {
      confidence += 0.15;
    }

    // 有提及实体时增加置信度
    if (
      state.mentionedBookmarks.length > 0 ||
      state.mentionedFolders.length > 0
    ) {
      confidence += 0.15;
    }

    // 解析到具体实体时增加置信度
    if (resolved.length > 0 && resolved[0].id !== "__last_output__") {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 生成解析说明
   */
  private generateExplanation(
    type: ReferenceType,
    resolved: MentionedEntity[],
  ): string {
    const entityNames = resolved
      .slice(0, 3)
      .map((e) => e.name)
      .join("、");

    switch (type) {
      case "last_output":
        return `指代刚才的输出内容：${entityNames}`;
      case "these_results":
        return `指代搜索结果（${resolved.length} 项）`;
      case "that_folder":
        return `指代文件夹：${entityNames}`;
      case "that_bookmark":
        return `指代书签：${entityNames}`;
      case "previous":
        return `指代上一个操作对象：${entityNames}`;
      case "mentioned":
        return `指代之前提到的：${entityNames}`;
      case "ordinal_result":
        return `指代搜索结果中的特定项：${entityNames}`;
      case "last_result":
        return `指代搜索结果最后一项：${entityNames}`;
      case "range_result":
        return `指代搜索结果范围（${resolved.length} 项）：${entityNames}`;
      default:
        return `解析为：${entityNames}`;
    }
  }

  /**
   * 替换指代词为具体内容
   */
  private replaceReference(
    input: string,
    reference: string,
    resolved: MentionedEntity[],
  ): string {
    // 如果只有一个实体，替换为实体名称
    if (resolved.length === 1) {
      return input.replace(reference, `"${resolved[0].name}"`);
    }

    // 多个实体，替换为 ID 列表
    const ids = resolved.map((e) => e.id).join(",");
    return input.replace(reference, `[ID: ${ids}]`);
  }

  /**
   * 获取配置
   */
  getConfig(): Required<ReferenceResolverConfig> {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ReferenceResolverConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * 创建 ReferenceResolver 实例
 */
export function createReferenceResolver(
  config?: ReferenceResolverConfig,
): ReferenceResolver {
  return new ReferenceResolver(config);
}

/**
 * 默认 ReferenceResolver 实例
 */
export const referenceResolver = new ReferenceResolver();
