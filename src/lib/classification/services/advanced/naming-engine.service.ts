/**
 * V4.0 命名优化引擎服务
 *
 * 功能：
 * 1. Few-Shot 学习用户命名风格
 * 2. 语义去重检测（防止创建重复文件夹）
 * 3. 中文命名优化（调用 AI 模型）
 * 4. 本地规则引擎（快速去重）
 *
 * 设计原则：
 * - 优先使用本地规则（快速、无成本）
 * - AI 调用作为兜底（准确、有成本）
 * - 缓存用户风格分析结果
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TypedSupabaseClient } from "@/types/supabase";
import { logger } from "@/lib/logger";
import {
  NAMING_SYSTEM_PROMPT,
  buildNamingPrompt,
  buildDeduplicationPrompt,
  parseNamingResponse,
  parseDeduplicationResponse,
  quickDeduplicationCheck,
  type NamingContext,
  type NamingResponse,
  type DeduplicationResponse,
} from "../../prompts/naming-prompt";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 命名优化结果
 */
export interface NamingOptimizationResult {
  /** 最终推荐名称 */
  finalName: string;

  /** 原始建议名称 */
  originalName: string;

  /** 是否进行了优化 */
  wasOptimized: boolean;

  /** 优化理由 */
  optimizationReason?: string;

  /** 去重检测结果 */
  deduplication?: {
    isDuplicate: boolean;
    duplicateOf?: string;
    suggestion: "use_existing" | "create_new" | "merge";
  };

  /** 风格分析 */
  styleAnalysis?: {
    detectedStyle: string;
    appliedRules: string[];
  };

  /** 是否使用了 AI */
  usedAI: boolean;

  /** 处理耗时 (ms) */
  processingTimeMs: number;
}

/**
 * 服务配置
 */
export interface NamingEngineConfig {
  /** 是否启用 AI 优化 */
  enableAIOptimization: boolean;

  /** AI 超时时间 (ms) */
  aiTimeoutMs: number;

  /** 缓存用户风格分析的时间 (ms) */
  styleCacheTimeMs: number;

  /** 最小文件夹样本数（低于此值不学习风格） */
  minFolderSamples: number;

  /** AI 模型 */
  aiModel: string;

  /** AI API 端点 */
  aiEndpoint: string;
}

const DEFAULT_CONFIG: NamingEngineConfig = {
  enableAIOptimization: true,
  aiTimeoutMs: 10000,
  styleCacheTimeMs: 30 * 60 * 1000, // 30 分钟
  minFolderSamples: 3,
  aiModel: "deepseek-chat",
  aiEndpoint: "https://api.deepseek.com/v1/chat/completions",
};

// ============================================================================
// 缓存
// ============================================================================

interface StyleCacheEntry {
  folders: Array<{ name: string; bookmarkCount: number }>;
  cachedAt: number;
}

const styleCache = new Map<string, StyleCacheEntry>();

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 命名优化引擎服务
 */
export class NamingEngineService {
  private supabase: TypedSupabaseClient;
  private config: NamingEngineConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<NamingEngineConfig>,
  ) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 优化文件夹名称
   */
  async optimizeName(
    userId: string,
    proposedName: string,
    bookmarkTitle: string,
    bookmarkTags: string[],
    bookmarkSummary?: string,
  ): Promise<NamingOptimizationResult> {
    const startTime = Date.now();

    try {
      // 1. 获取用户现有文件夹
      const existingFolders = await this.getUserFolders(userId);
      const existingNames = existingFolders.map((f) => f.name);

      // 2. 本地快速去重检测
      const quickDuplicate = quickDeduplicationCheck(
        proposedName,
        existingNames,
      );
      if (quickDuplicate) {
        return {
          finalName: quickDuplicate,
          originalName: proposedName,
          wasOptimized: true,
          optimizationReason: `与现有文件夹「${quickDuplicate}」语义相似`,
          deduplication: {
            isDuplicate: true,
            duplicateOf: quickDuplicate,
            suggestion: "use_existing",
          },
          usedAI: false,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // 3. 如果文件夹样本不足或未启用 AI，直接返回原名
      if (
        !this.config.enableAIOptimization ||
        existingFolders.length < this.config.minFolderSamples
      ) {
        return {
          finalName: proposedName,
          originalName: proposedName,
          wasOptimized: false,
          usedAI: false,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // 4. 调用 AI 进行命名优化
      const namingContext: NamingContext = {
        proposedName,
        bookmarkTitle,
        bookmarkTags,
        bookmarkSummary,
        existingFolders,
      };

      const aiResult = await this.callAIForNaming(namingContext);

      if (aiResult) {
        return {
          finalName: aiResult.optimizedName,
          originalName: proposedName,
          wasOptimized: !aiResult.keptOriginal,
          optimizationReason: aiResult.reason,
          styleAnalysis: aiResult.styleAnalysis,
          usedAI: true,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // AI 失败，返回原名
      return {
        finalName: proposedName,
        originalName: proposedName,
        wasOptimized: false,
        usedAI: false,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "NamingEngine: Optimization failed",
      );

      return {
        finalName: proposedName,
        originalName: proposedName,
        wasOptimized: false,
        usedAI: false,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 检测语义重复
   */
  async checkDuplication(
    userId: string,
    newName: string,
  ): Promise<DeduplicationResponse> {
    try {
      // 获取现有文件夹
      const existingFolders = await this.getUserFolders(userId);
      const existingNames = existingFolders.map((f) => f.name);

      // 1. 本地快速检测
      const quickDuplicate = quickDeduplicationCheck(newName, existingNames);
      if (quickDuplicate) {
        return {
          isDuplicate: true,
          duplicateOf: quickDuplicate,
          similarityReason: "名称语义相似",
          suggestion: "use_existing",
        };
      }

      // 2. 如果启用 AI，进行深度检测
      if (this.config.enableAIOptimization && existingNames.length > 0) {
        const aiResult = await this.callAIForDeduplication({
          newName,
          existingNames,
        });

        if (aiResult) {
          return aiResult;
        }
      }

      // 无重复
      return {
        isDuplicate: false,
        suggestion: "create_new",
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "NamingEngine: Deduplication check failed",
      );

      return {
        isDuplicate: false,
        suggestion: "create_new",
      };
    }
  }

  /**
   * 获取用户文件夹列表（带缓存）
   */
  private async getUserFolders(
    userId: string,
  ): Promise<Array<{ name: string; bookmarkCount: number }>> {
    // 检查缓存
    const cached = styleCache.get(userId);
    if (cached && Date.now() - cached.cachedAt < this.config.styleCacheTimeMs) {
      return cached.folders;
    }

    // 从数据库加载
    const { data, error } = await this.supabase
      .from("folders")
      .select("name")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_system", false);

    if (error) {
      logger.warn(
        { error: error.message },
        "NamingEngine: Failed to load user folders",
      );
      return cached?.folders || [];
    }

    // 简化：直接使用文件夹名，后续可优化获取书签数量
    const simpleFolders = (data || []).map((f) => ({
      name: f.name as string,
      bookmarkCount: 5, // 默认值，后续优化
    }));

    // 缓存
    styleCache.set(userId, {
      folders: simpleFolders,
      cachedAt: Date.now(),
    });

    return simpleFolders;
  }

  /**
   * 调用 AI 进行命名优化
   */
  private async callAIForNaming(
    context: NamingContext,
  ): Promise<NamingResponse | null> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      logger.warn("NamingEngine: DEEPSEEK_API_KEY not configured");
      return null;
    }

    try {
      const prompt = buildNamingPrompt(context);

      const response = await fetch(this.config.aiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.aiModel,
          messages: [
            { role: "system", content: NAMING_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(this.config.aiTimeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const aiContent = data.choices?.[0]?.message?.content;

      if (!aiContent) {
        return null;
      }

      const parsed = parseNamingResponse(aiContent);

      logger.info(
        {
          originalName: context.proposedName,
          optimizedName: parsed?.optimizedName,
          keptOriginal: parsed?.keptOriginal,
        },
        "NamingEngine: AI optimization completed",
      );

      return parsed;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "NamingEngine: AI naming call failed",
      );
      return null;
    }
  }

  /**
   * 调用 AI 进行去重检测
   */
  private async callAIForDeduplication(context: {
    newName: string;
    existingNames: string[];
  }): Promise<DeduplicationResponse | null> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return null;
    }

    try {
      const prompt = buildDeduplicationPrompt(context);

      const response = await fetch(this.config.aiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.aiModel,
          messages: [
            {
              role: "system",
              content: "你是一个语义分析专家，擅长判断文件夹名称是否语义重复。",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(this.config.aiTimeoutMs),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const aiContent = data.choices?.[0]?.message?.content;

      if (!aiContent) {
        return null;
      }

      return parseDeduplicationResponse(aiContent);
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "NamingEngine: AI deduplication call failed",
      );
      return null;
    }
  }

  /**
   * 清除用户缓存
   */
  static clearCache(userId: string): void {
    styleCache.delete(userId);
  }

  /**
   * 清除所有缓存
   */
  static clearAllCache(): void {
    styleCache.clear();
  }
}

/**
 * 工厂函数
 */
export function createNamingEngineService(
  supabase: SupabaseClient<Database>,
  config?: Partial<NamingEngineConfig>,
): NamingEngineService {
  return new NamingEngineService(supabase, config);
}
