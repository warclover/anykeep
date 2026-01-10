/**
 * PersonalizedShortcutLearner - 个性化快捷指令学习器
 *
 * Phase 3 个性化学习核心组件
 *
 * 职责：
 * - 从用户行为中学习常用短语
 * - 自动生成快捷指令建议
 * - 管理用户快捷指令
 * - 快捷指令匹配与执行
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type {
  UserShortcut,
  ShortcutCandidate,
  ShortcutLearnerConfig,
  UserFeedback,
  UserBehavior,
} from "./types";
import type { IntentType } from "../router/types";

// ============================================
// 数据库类型定义（用于未生成类型的表）
// ============================================

/**
 * ai_user_shortcuts 表行类型
 */
type ShortcutRow = {
  id: number;
  user_id: string;
  shortcut_phrase: string;
  intent_type: string;
  intent_subtype: string | null;
  default_slots: Record<string, unknown>;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * ai_intent_feedback 表行类型
 */
type FeedbackRow = {
  user_id: string;
  session_id: string;
  turn_id: string;
  original_input: string;
  predicted_type: string;
  predicted_subtype: string | null;
  predicted_confidence: number;
  actual_behavior: string;
  corrected_type: string | null;
  corrected_subtype: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/**
 * 灵活的 Supabase 查询类型
 */
type FlexibleSupabaseClient = {
  from: (table: string) => {
    insert: (data: unknown) => {
      select: (cols?: string) => {
        single: () => Promise<{
          data: ShortcutRow | null;
          error: { code?: string } | null;
        }>;
      };
    };
    update: (data: unknown) => {
      eq: (
        col: string,
        val: string | number,
      ) => {
        eq: (
          col: string,
          val: string | number,
        ) => {
          select: (cols?: string) => {
            single: () => Promise<{ data: ShortcutRow | null; error: unknown }>;
          };
        } & Promise<{ error: unknown }>;
      };
    };
    delete: () => {
      eq: (
        col: string,
        val: string | number,
      ) => {
        eq: (col: string, val: string | number) => Promise<{ error: unknown }>;
      };
    };
    select: (cols?: string) => {
      eq: (
        col: string,
        val: string | number,
      ) => {
        eq?: (
          col: string,
          val: string | number,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (
              n: number,
            ) => Promise<{ data: ShortcutRow[] | null; error: unknown }>;
          };
        };
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit?: (
            n: number,
          ) => Promise<{ data: ShortcutRow[] | null; error: unknown }>;
        } & Promise<{ data: ShortcutRow[] | null; error: unknown }>;
      } & Promise<{ data: ShortcutRow[] | null; error: unknown }>;
    };
  };
  rpc: (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
};

/**
 * 反馈查询 Supabase 类型
 */
type FeedbackQueryClient = {
  from: (table: string) => {
    select: (cols?: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (
              n: number,
            ) => Promise<{ data: FeedbackRow[] | null; error: unknown }>;
          };
        };
      };
    };
  };
};

// ============================================
// 常量配置
// ============================================

const DEFAULT_CONFIG: Required<ShortcutLearnerConfig> = {
  minFrequencyThreshold: 3,
  confidenceThreshold: 0.7,
  maxShortcutsPerUser: 50,
  autoActivate: false,
  debug: false,
};

/**
 * 规范化短语（用于匹配）
 */
function normalizePhrase(phrase: string): string {
  return phrase
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, "");
}

/**
 * 计算短语相似度
 */
function phraseSimilarity(phrase1: string, phrase2: string): number {
  const p1 = normalizePhrase(phrase1);
  const p2 = normalizePhrase(phrase2);

  if (p1 === p2) return 1;

  // 简单的编辑距离相似度
  const maxLen = Math.max(p1.length, p2.length);
  if (maxLen === 0) return 1;

  let matches = 0;
  const minLen = Math.min(p1.length, p2.length);

  for (let i = 0; i < minLen; i++) {
    if (p1[i] === p2[i]) matches++;
  }

  return matches / maxLen;
}

// ============================================
// PersonalizedShortcutLearner 类
// ============================================

/**
 * 个性化快捷指令学习器
 *
 * 从用户行为中学习并管理个性化快捷指令
 */
export class PersonalizedShortcutLearner {
  private config: Required<ShortcutLearnerConfig>;
  // 缓存用户快捷指令
  private shortcutCache: Map<string, UserShortcut[]> = new Map();

  constructor(config: ShortcutLearnerConfig = {}) {
    this.config = {
      minFrequencyThreshold:
        config.minFrequencyThreshold ?? DEFAULT_CONFIG.minFrequencyThreshold,
      confidenceThreshold:
        config.confidenceThreshold ?? DEFAULT_CONFIG.confidenceThreshold,
      maxShortcutsPerUser:
        config.maxShortcutsPerUser ?? DEFAULT_CONFIG.maxShortcutsPerUser,
      autoActivate: config.autoActivate ?? DEFAULT_CONFIG.autoActivate,
      debug: config.debug ?? DEFAULT_CONFIG.debug,
    };
  }

  // ============================================
  // 快捷指令学习
  // ============================================

  /**
   * 从用户反馈中学习快捷指令候选
   *
   * @param userId - 用户 ID
   * @param feedbacks - 用户反馈列表
   * @returns 快捷指令候选列表
   */
  learnFromFeedback(
    userId: string,
    feedbacks: UserFeedback[],
  ): ShortcutCandidate[] {
    // 只关注成功执行的反馈
    const acceptedFeedbacks = feedbacks.filter(
      (f) => f.userId === userId && f.actualBehavior === "accepted",
    );

    // 按输入分组统计
    const inputStats = new Map<
      string,
      {
        count: number;
        intents: Map<string, number>;
        contexts: string[];
      }
    >();

    for (const feedback of acceptedFeedbacks) {
      const normalizedInput = normalizePhrase(feedback.originalInput);

      if (!inputStats.has(normalizedInput)) {
        inputStats.set(normalizedInput, {
          count: 0,
          intents: new Map(),
          contexts: [],
        });
      }

      const stats = inputStats.get(normalizedInput)!;
      stats.count++;

      const intentKey = `${feedback.predictedIntent.type}:${feedback.predictedIntent.subType || "*"}`;
      stats.intents.set(intentKey, (stats.intents.get(intentKey) || 0) + 1);

      if (stats.contexts.length < 5) {
        stats.contexts.push(feedback.originalInput);
      }
    }

    // 生成候选
    const candidates: ShortcutCandidate[] = [];

    for (const [phrase, stats] of inputStats) {
      if (stats.count >= this.config.minFrequencyThreshold) {
        // 找到最常见的意图
        let maxIntentCount = 0;
        let topIntent = "";

        for (const [intent, count] of stats.intents) {
          if (count > maxIntentCount) {
            maxIntentCount = count;
            topIntent = intent;
          }
        }

        // 计算置信度
        const confidence = maxIntentCount / stats.count;

        if (confidence >= this.config.confidenceThreshold) {
          const [intentType, intentSubType] = topIntent.split(":");

          candidates.push({
            phrase,
            intentType: intentType as IntentType,
            intentSubType: intentSubType === "*" ? undefined : intentSubType,
            frequency: stats.count,
            confidence,
            sampleContexts: stats.contexts,
          });
        }
      }
    }

    if (this.config.debug) {
      logger.debug(
        { userId, candidateCount: candidates.length },
        "ShortcutLearner: Learned shortcut candidates",
      );
    }

    return candidates.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * 将候选转换为快捷指令并保存
   */
  async createShortcutsFromCandidates(
    userId: string,
    candidates: ShortcutCandidate[],
  ): Promise<UserShortcut[]> {
    const created: UserShortcut[] = [];

    // 检查用户当前快捷指令数量
    const existingCount = await this.getUserShortcutCount(userId);
    const availableSlots = this.config.maxShortcutsPerUser - existingCount;

    if (availableSlots <= 0) {
      logger.warn(
        { userId, existingCount, maxAllowed: this.config.maxShortcutsPerUser },
        "ShortcutLearner: User has reached max shortcuts limit",
      );
      return [];
    }

    // 只处理有空位的候选
    const candidatesToProcess = candidates.slice(0, availableSlots);

    for (const candidate of candidatesToProcess) {
      try {
        // 检查是否已存在相似的快捷指令
        const existing = await this.findSimilarShortcut(
          userId,
          candidate.phrase,
        );
        if (existing) {
          continue;
        }

        const shortcut = await this.createShortcut(userId, {
          shortcutPhrase: candidate.phrase,
          intentType: candidate.intentType,
          intentSubType: candidate.intentSubType,
          defaultSlots: {},
          isActive: this.config.autoActivate,
        });

        if (shortcut) {
          created.push(shortcut);
        }
      } catch (error) {
        logger.error(
          { error, candidate },
          "ShortcutLearner: Failed to create shortcut from candidate",
        );
      }
    }

    // 清除缓存
    this.shortcutCache.delete(userId);

    return created;
  }

  // ============================================
  // 快捷指令管理
  // ============================================

  /**
   * 创建快捷指令
   */
  async createShortcut(
    userId: string,
    data: {
      shortcutPhrase: string;
      intentType: IntentType;
      intentSubType?: string;
      defaultSlots?: Record<string, unknown>;
      isActive?: boolean;
    },
  ): Promise<UserShortcut | null> {
    const supabase = await createClient();

    const { data: result, error } = await (
      supabase as unknown as FlexibleSupabaseClient
    )
      .from("ai_user_shortcuts")
      .insert({
        user_id: userId,
        shortcut_phrase: data.shortcutPhrase,
        intent_type: data.intentType,
        intent_subtype: data.intentSubType ?? null,
        default_slots: data.defaultSlots ?? {},
        is_active: data.isActive ?? true,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // 重复键
        logger.debug(
          { userId, phrase: data.shortcutPhrase },
          "ShortcutLearner: Shortcut already exists",
        );
        return null;
      }
      logger.error(
        { error, userId },
        "ShortcutLearner: Failed to create shortcut",
      );
      throw error;
    }

    // 清除缓存
    this.shortcutCache.delete(userId);

    logger.info(
      { userId, phrase: data.shortcutPhrase, intentType: data.intentType },
      "ShortcutLearner: Created shortcut",
    );

    return result ? this.mapRowToShortcut(result) : null;
  }

  /**
   * 更新快捷指令
   */
  async updateShortcut(
    userId: string,
    shortcutId: number,
    updates: Partial<{
      shortcutPhrase: string;
      intentType: IntentType;
      intentSubType: string;
      defaultSlots: Record<string, unknown>;
      isActive: boolean;
    }>,
  ): Promise<UserShortcut | null> {
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.shortcutPhrase !== undefined) {
      updateData.shortcut_phrase = updates.shortcutPhrase;
    }
    if (updates.intentType !== undefined) {
      updateData.intent_type = updates.intentType;
    }
    if (updates.intentSubType !== undefined) {
      updateData.intent_subtype = updates.intentSubType;
    }
    if (updates.defaultSlots !== undefined) {
      updateData.default_slots = updates.defaultSlots;
    }
    if (updates.isActive !== undefined) {
      updateData.is_active = updates.isActive;
    }

    const { data, error } = await (
      supabase as unknown as FlexibleSupabaseClient
    )
      .from("ai_user_shortcuts")
      .update(updateData)
      .eq("id", shortcutId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error(
        { error, userId, shortcutId },
        "ShortcutLearner: Failed to update shortcut",
      );
      throw error;
    }

    // 清除缓存
    this.shortcutCache.delete(userId);

    return data ? this.mapRowToShortcut(data) : null;
  }

  /**
   * 删除快捷指令
   */
  async deleteShortcut(userId: string, shortcutId: number): Promise<void> {
    const supabase = await createClient();

    const { error } = await (supabase as unknown as FlexibleSupabaseClient)
      .from("ai_user_shortcuts")
      .delete()
      .eq("id", shortcutId)
      .eq("user_id", userId);

    if (error) {
      logger.error(
        { error, userId, shortcutId },
        "ShortcutLearner: Failed to delete shortcut",
      );
      throw error;
    }

    // 清除缓存
    this.shortcutCache.delete(userId);

    logger.info({ userId, shortcutId }, "ShortcutLearner: Deleted shortcut");
  }

  /**
   * 获取用户所有快捷指令
   */
  async getUserShortcuts(
    userId: string,
    options: { activeOnly?: boolean } = {},
  ): Promise<UserShortcut[]> {
    // 检查缓存
    const cacheKey = `${userId}:${options.activeOnly ? "active" : "all"}`;
    if (this.shortcutCache.has(cacheKey)) {
      return this.shortcutCache.get(cacheKey)!;
    }

    const supabase = await createClient();

    // Type for chainable query with optional eq
    type SelectChain = {
      eq: (col: string, val: string | boolean) => SelectChain;
      order: (col: string, opts: { ascending: boolean }) => SelectChain;
      then: <T>(
        resolve: (value: { data: ShortcutRow[] | null; error: unknown }) => T,
      ) => Promise<T>;
    };
    type ShortcutSelectQuery = {
      from: (table: string) => {
        select: (cols: string) => SelectChain;
      };
    };

    let query = (supabase as unknown as ShortcutSelectQuery)
      .from("ai_user_shortcuts")
      .select("*")
      .eq("user_id", userId)
      .order("usage_count", { ascending: false });

    if (options.activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error, userId },
        "ShortcutLearner: Failed to get user shortcuts",
      );
      throw error;
    }

    const shortcuts = (data || []).map((row) => this.mapRowToShortcut(row));

    // 更新缓存
    this.shortcutCache.set(cacheKey, shortcuts);

    return shortcuts;
  }

  /**
   * 获取用户快捷指令数量
   */
  private async getUserShortcutCount(userId: string): Promise<number> {
    const supabase = await createClient();

    // Type for count query
    type CountQuery = {
      from: (table: string) => {
        select: (
          cols: string,
          opts: { count: string; head: boolean },
        ) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ count: number | null; error: unknown }>;
        };
      };
    };

    const { count, error } = await (supabase as unknown as CountQuery)
      .from("ai_user_shortcuts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      logger.error(
        { error, userId },
        "ShortcutLearner: Failed to get shortcut count",
      );
      return 0;
    }

    return count || 0;
  }

  /**
   * 查找相似的快捷指令
   */
  private async findSimilarShortcut(
    userId: string,
    phrase: string,
  ): Promise<UserShortcut | null> {
    const shortcuts = await this.getUserShortcuts(userId);
    const normalizedPhrase = normalizePhrase(phrase);

    for (const shortcut of shortcuts) {
      const similarity = phraseSimilarity(
        normalizedPhrase,
        normalizePhrase(shortcut.shortcutPhrase),
      );
      if (similarity > 0.8) {
        return shortcut;
      }
    }

    return null;
  }

  // ============================================
  // 快捷指令匹配
  // ============================================

  /**
   * 匹配用户输入与快捷指令
   *
   * @param userId - 用户 ID
   * @param input - 用户输入
   * @returns 匹配的快捷指令（如果有）
   */
  async matchShortcut(
    userId: string,
    input: string,
  ): Promise<{
    matched: boolean;
    shortcut?: UserShortcut;
    similarity: number;
  }> {
    const shortcuts = await this.getUserShortcuts(userId, { activeOnly: true });
    const normalizedInput = normalizePhrase(input);

    let bestMatch: UserShortcut | undefined;
    let bestSimilarity = 0;

    for (const shortcut of shortcuts) {
      const similarity = phraseSimilarity(
        normalizedInput,
        normalizePhrase(shortcut.shortcutPhrase),
      );

      if (similarity > bestSimilarity && similarity >= 0.8) {
        bestSimilarity = similarity;
        bestMatch = shortcut;
      }
    }

    if (bestMatch) {
      // 更新使用统计
      await this.recordShortcutUsage(userId, bestMatch.shortcutPhrase);

      if (this.config.debug) {
        logger.debug(
          {
            userId,
            input,
            matchedPhrase: bestMatch.shortcutPhrase,
            similarity: bestSimilarity,
          },
          "ShortcutLearner: Matched shortcut",
        );
      }

      return {
        matched: true,
        shortcut: bestMatch,
        similarity: bestSimilarity,
      };
    }

    return {
      matched: false,
      similarity: 0,
    };
  }

  /**
   * 记录快捷指令使用
   */
  async recordShortcutUsage(
    userId: string,
    shortcutPhrase: string,
  ): Promise<void> {
    const supabase = await createClient();

    // 使用数据库函数更新（类型断言用于未定义的 RPC 函数）
    const { error } = await (supabase as unknown as FlexibleSupabaseClient).rpc(
      "update_shortcut_usage",
      {
        p_user_id: userId,
        p_shortcut_phrase: shortcutPhrase,
      },
    );

    if (error) {
      logger.error(
        { error, userId, shortcutPhrase },
        "ShortcutLearner: Failed to record shortcut usage",
      );
    }

    // 清除缓存
    this.shortcutCache.delete(userId);
  }

  // ============================================
  // 快捷指令建议
  // ============================================

  /**
   * 为用户生成快捷指令建议
   *
   * 基于用户历史行为分析
   */
  async generateSuggestions(userId: string): Promise<ShortcutCandidate[]> {
    // 获取用户最近的反馈
    const supabase = await createClient();

    // 使用类型断言获取反馈数据（表未在生成类型中定义）
    const { data, error } = await (supabase as unknown as FeedbackQueryClient)
      .from("ai_intent_feedback")
      .select("*")
      .eq("user_id", userId)
      .eq("actual_behavior", "accepted")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      logger.error(
        { error, userId },
        "ShortcutLearner: Failed to get feedback for suggestions",
      );
      return [];
    }

    const feedbacks: UserFeedback[] = ((data || []) as FeedbackRow[]).map(
      (row): UserFeedback => ({
        userId: row.user_id,
        sessionId: row.session_id,
        turnId: row.turn_id,
        originalInput: row.original_input,
        predictedIntent: {
          type: row.predicted_type as IntentType,
          subType: row.predicted_subtype ?? undefined,
          confidence: Number(row.predicted_confidence),
        },
        actualBehavior: row.actual_behavior as UserBehavior,
        correctedType: row.corrected_type ?? undefined,
        correctedSubType: row.corrected_subtype ?? undefined,
        metadata: row.metadata,
        timestamp: new Date(row.created_at),
      }),
    );

    // 学习候选
    const candidates = this.learnFromFeedback(userId, feedbacks);

    // 过滤已存在的快捷指令
    const existingShortcuts = await this.getUserShortcuts(userId);
    const existingPhrases = new Set(
      existingShortcuts.map((s) => normalizePhrase(s.shortcutPhrase)),
    );

    return candidates.filter(
      (c) => !existingPhrases.has(normalizePhrase(c.phrase)),
    );
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 将数据库行映射为 UserShortcut
   */
  private mapRowToShortcut(row: Record<string, unknown>): UserShortcut {
    return {
      id: row.id as number,
      userId: row.user_id as string,
      shortcutPhrase: row.shortcut_phrase as string,
      intentType: row.intent_type as IntentType,
      intentSubType: row.intent_subtype as string | undefined,
      defaultSlots: (row.default_slots as Record<string, unknown>) || {},
      usageCount: row.usage_count as number,
      lastUsedAt: row.last_used_at
        ? new Date(row.last_used_at as string)
        : undefined,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * 清除用户缓存
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.shortcutCache.delete(userId);
      this.shortcutCache.delete(`${userId}:active`);
      this.shortcutCache.delete(`${userId}:all`);
    } else {
      this.shortcutCache.clear();
    }
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 PersonalizedShortcutLearner 实例
 */
export function createShortcutLearner(
  config?: ShortcutLearnerConfig,
): PersonalizedShortcutLearner {
  return new PersonalizedShortcutLearner(config);
}
