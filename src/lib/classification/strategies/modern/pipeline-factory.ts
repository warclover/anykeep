/**
 * ClassificationPipeline 工厂类
 *
 * 解决每次分类都重复创建服务实例的问题
 * 使用单例模式复用 Logger、Embedding、VectorSearch、LLM 服务
 *
 * @version 1.0.0
 * @since 2026-01-24
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger/index";
import { DashScopeEmbeddingAdapter } from "@/lib/classification/infrastructure/shared-services/embedding/dashscope-embedding-adapter";
import { VectorSearchService } from "@/lib/classification/infrastructure/shared-services/vector-search/index";
import { LLMService } from "@/lib/classification/infrastructure/shared-services/llm/index";
import { ClassificationPipelineService } from "./classification-pipeline.service";
import type { ClassificationPipelineConfig } from "./types";

/**
 * Pipeline 工厂配置
 */
export interface PipelineFactoryConfig {
  /** DashScope QPM 限制 */
  dashscopeQpm?: number;
  /** Supabase URL */
  supabaseUrl?: string;
  /** Supabase Service Key */
  supabaseServiceKey?: string;
  /** Pipeline 配置 */
  pipelineConfig?: Partial<ClassificationPipelineConfig>;
}

/**
 * 缓存的 Pipeline 实例（按 userId 隔离，但共享底层服务）
 */
interface CachedPipeline {
  pipeline: ClassificationPipelineService;
  createdAt: number;
}

/**
 * V5 Classification Pipeline 工厂
 *
 * 特性：
 * 1. 单例模式：底层服务（Logger/Embedding/VectorSearch/LLM）全局共享
 * 2. Pipeline 缓存：复用 Pipeline 实例，减少初始化开销
 * 3. 懒加载：首次使用时才创建服务
 * 4. TTL 过期：Pipeline 实例 10 分钟过期，防止内存泄漏
 */
export class ClassificationPipelineFactory {
  private static instance: ClassificationPipelineFactory | null = null;

  private loggerService: LoggerService | null = null;
  private embeddingService: DashScopeEmbeddingAdapter | null = null;
  private vectorSearchService: VectorSearchService | null = null;
  private llmService: LLMService | null = null;

  private pipelineCache: Map<string, CachedPipeline> = new Map();
  private readonly PIPELINE_TTL_MS = 10 * 60 * 1000; // 10 分钟

  private config: PipelineFactoryConfig;

  private constructor(config?: PipelineFactoryConfig) {
    this.config = {
      dashscopeQpm: config?.dashscopeQpm ?? 60,
      supabaseUrl:
        config?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      supabaseServiceKey:
        config?.supabaseServiceKey ??
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        "",
      pipelineConfig: config?.pipelineConfig ?? {},
    };
  }

  /**
   * 获取工厂单例
   */
  static getInstance(
    config?: PipelineFactoryConfig,
  ): ClassificationPipelineFactory {
    if (!ClassificationPipelineFactory.instance) {
      ClassificationPipelineFactory.instance =
        new ClassificationPipelineFactory(config);
    }
    return ClassificationPipelineFactory.instance;
  }

  /**
   * 重置工厂（主要用于测试）
   */
  static resetInstance(): void {
    if (ClassificationPipelineFactory.instance) {
      ClassificationPipelineFactory.instance.pipelineCache.clear();
      ClassificationPipelineFactory.instance = null;
    }
  }

  /**
   * 获取或创建 Pipeline 实例
   *
   * @param supabase - Supabase 客户端（用于 FolderContextProvider）
   * @returns ClassificationPipelineService 实例
   */
  getPipeline(supabase?: SupabaseClient): ClassificationPipelineService {
    // 清理过期的 Pipeline
    this.cleanExpiredPipelines();

    // 使用固定 key，因为底层服务是共享的
    const cacheKey = "default";
    const cached = this.pipelineCache.get(cacheKey);

    if (cached && Date.now() - cached.createdAt < this.PIPELINE_TTL_MS) {
      return cached.pipeline;
    }

    // 初始化共享服务（懒加载）
    this.ensureServicesInitialized();

    // 创建新的 Pipeline
    const pipeline = new ClassificationPipelineService(
      this.loggerService!,
      this.embeddingService!,
      this.vectorSearchService!,
      this.llmService!,
      {
        t0ConfidenceThreshold:
          this.config.pipelineConfig?.t0ConfidenceThreshold ?? 0.85,
        vectorConflictThreshold:
          this.config.pipelineConfig?.vectorConflictThreshold ?? 0.15,
        hybridWeights: {
          content: this.config.pipelineConfig?.hybridWeights?.content ?? 0.7,
          behavior: this.config.pipelineConfig?.hybridWeights?.behavior ?? 0.3,
        },
        rrfK: this.config.pipelineConfig?.rrfK ?? 60,
      },
      supabase,
    );

    this.pipelineCache.set(cacheKey, {
      pipeline,
      createdAt: Date.now(),
    });

    return pipeline;
  }

  /**
   * 确保底层服务已初始化
   */
  private ensureServicesInitialized(): void {
    if (!this.loggerService) {
      this.loggerService = new LoggerService();
    }

    if (!this.embeddingService) {
      this.embeddingService = new DashScopeEmbeddingAdapter(
        this.loggerService,
        this.config.dashscopeQpm ?? 60,
      );
    }

    if (!this.vectorSearchService) {
      this.vectorSearchService = new VectorSearchService(this.loggerService, {
        supabaseUrl: this.config.supabaseUrl,
        supabaseServiceKey: this.config.supabaseServiceKey,
      });
    }

    if (!this.llmService) {
      this.llmService = new LLMService(this.loggerService);
    }
  }

  /**
   * 清理过期的 Pipeline
   */
  private cleanExpiredPipelines(): void {
    const now = Date.now();
    for (const [key, cached] of this.pipelineCache.entries()) {
      if (now - cached.createdAt >= this.PIPELINE_TTL_MS) {
        this.pipelineCache.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计（用于监控）
   */
  getCacheStats(): {
    pipelineCacheSize: number;
    servicesInitialized: boolean;
  } {
    return {
      pipelineCacheSize: this.pipelineCache.size,
      servicesInitialized:
        !!this.loggerService &&
        !!this.embeddingService &&
        !!this.vectorSearchService &&
        !!this.llmService,
    };
  }
}

/**
 * 便捷函数：获取 Pipeline 实例
 */
export function getClassificationPipeline(
  supabase?: SupabaseClient,
): ClassificationPipelineService {
  return ClassificationPipelineFactory.getInstance().getPipeline(supabase);
}
