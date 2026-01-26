/**
 * Classification Container - Service Registrations
 *
 * 服务注册工厂，负责将所有服务注册到容器
 *
 * @version 1.0.0
 * @since 2026-01-24 Phase 4
 */

import type { EnhancedContainer } from "./container";
import { SERVICE_TYPES } from "./types";

// ============================================================================
// Repositories
// ============================================================================

import {
  FolderProfileRepository,
  BookmarkRepository,
  InterestRepository,
  SuggestionRepository,
} from "../../repositories";

// ============================================================================
// Services
// ============================================================================

import {
  UserStageService,
  InterestService,
  InboxOrganizerService,
} from "../../services";

// ============================================================================
// Infrastructure Services
// ============================================================================

import { EmbeddingService } from "../shared-services/embedding";
import { VectorSearchService } from "../shared-services/vector-search/index";
import { LLMService } from "../shared-services/llm/index";
import {
  createLogger,
  type LoggerService,
} from "../shared-services/logger/index";

// ============================================================================
// Modern Strategy Services
// ============================================================================

import { ClassificationPipelineService } from "../../strategies/modern";
import { FeedbackService } from "../../strategies/modern/feedback";
import { ChatToRuleService } from "../../strategies/modern/chat-to-rule";

// ============================================================================
// Strategy Adapters
// ============================================================================

import { ClassicStrategyAdapter } from "../../strategies/adapters/classic-adapter";
import { ModernStrategyAdapter } from "../../strategies/adapters/modern-adapter";
import { createSimpleClassificationService } from "../../services/simple-classification.service";

/**
 * 注册所有仓储服务
 */
export function registerRepositories(container: EnhancedContainer): void {
  const supabase = container.getSupabase();

  // 文件夹画像仓储
  container.register(
    SERVICE_TYPES.FolderProfileRepository,
    () => new FolderProfileRepository(supabase),
    "singleton",
  );

  // 书签仓储
  container.register(
    SERVICE_TYPES.BookmarkRepository,
    // Fix: BookmarkRepository requires userId, but in singleton container context we don't have it.
    // Passing empty string as placeholder. Services using this MUST provide userId in method calls if required,
    // or we need to refactor BookmarkRepository to be stateless/scoped.
    () => new BookmarkRepository(supabase, ""),
    "singleton",
  );

  // 兴趣仓储
  container.register(
    SERVICE_TYPES.InterestRepository,
    () => new InterestRepository(supabase),
    "singleton",
  );

  // 建议仓储
  container.register(
    SERVICE_TYPES.SuggestionRepository,
    () => new SuggestionRepository(supabase),
    "singleton",
  );
}

/**
 * 注册基础设施服务
 */
export function registerInfrastructureServices(
  container: EnhancedContainer,
): void {
  // 日志服务
  container.register(
    SERVICE_TYPES.Logger,
    () => createLogger("Classification"),
    "singleton",
  );

  // 嵌入服务
  container.register(
    SERVICE_TYPES.EmbeddingService,
    (c) => {
      const logger = c.get<LoggerService>(SERVICE_TYPES.Logger);
      return new EmbeddingService(logger, {});
    },
    "singleton",
  );

  // 向量搜索服务
  container.register(
    SERVICE_TYPES.VectorSearchService,
    (c) => {
      const logger = c.get<LoggerService>(SERVICE_TYPES.Logger);
      return new VectorSearchService(logger, {});
    },
    "singleton",
  );

  // LLM 服务
  container.register(
    SERVICE_TYPES.LLMService,
    (c) => {
      const logger = c.get<LoggerService>(SERVICE_TYPES.Logger);
      return new LLMService(logger);
    },
    "singleton",
  );
}

/**
 * 注册业务服务
 */
export function registerBusinessServices(container: EnhancedContainer): void {
  const supabase = container.getSupabase();

  // 用户阶段服务
  container.register(
    SERVICE_TYPES.UserStageService,
    () => new UserStageService(supabase),
    "singleton",
  );

  // 兴趣服务
  container.register(
    SERVICE_TYPES.InterestService,
    (c) => {
      const interestRepo = c.get<InterestRepository>(
        SERVICE_TYPES.InterestRepository,
      );
      return new InterestService(interestRepo, supabase);
    },
    "singleton",
  );

  // 收件箱组织服务
  container.register(
    SERVICE_TYPES.InboxOrganizerService,
    (c) => {
      const bookmarkRepo = c.get<BookmarkRepository>(
        SERVICE_TYPES.BookmarkRepository,
      );
      const folderProfileRepo = c.get<FolderProfileRepository>(
        SERVICE_TYPES.FolderProfileRepository,
      );
      const suggestionRepo = c.get<SuggestionRepository>(
        SERVICE_TYPES.SuggestionRepository,
      );
      const interestRepo = c.get<InterestRepository>(
        SERVICE_TYPES.InterestRepository,
      );
      return new InboxOrganizerService(
        bookmarkRepo,
        folderProfileRepo,
        suggestionRepo,
        interestRepo,
        supabase,
      );
    },
    "singleton",
  );
}

/**
 * 注册 Modern 策略服务
 */
export function registerModernServices(container: EnhancedContainer): void {
  const supabase = container.getSupabase();

  // Pipeline 服务
  container.register(
    SERVICE_TYPES.PipelineService,
    (c) => {
      const logger = c.get<LoggerService>(SERVICE_TYPES.Logger);
      const embeddingService = c.get<EmbeddingService>(
        SERVICE_TYPES.EmbeddingService,
      );
      const vectorSearch = c.get<VectorSearchService>(
        SERVICE_TYPES.VectorSearchService,
      );
      const llmService = c.get<LLMService>(SERVICE_TYPES.LLMService);

      return new ClassificationPipelineService(
        logger,
        embeddingService,
        vectorSearch,
        llmService,
        undefined,
        supabase,
      );
    },
    "singleton",
  );

  // 反馈服务
  container.register(
    SERVICE_TYPES.FeedbackService,
    (c) => {
      const logger = c.get<LoggerService>(SERVICE_TYPES.Logger);
      const llmService = c.get<LLMService>(SERVICE_TYPES.LLMService);
      return new FeedbackService(supabase, logger, llmService);
    },
    "singleton",
  );

  // Chat-to-Rule 服务
  container.register(
    SERVICE_TYPES.ChatToRuleService,
    (c) => {
      const logger = c.get<LoggerService>(SERVICE_TYPES.Logger);
      const llmService = c.get<LLMService>(SERVICE_TYPES.LLMService);
      return new ChatToRuleService(supabase, logger, llmService);
    },
    "singleton",
  );

  // Classic Strategy (V4 Adapter)
  container.register(
    SERVICE_TYPES.ClassicStrategy,
    (_c) => {
      const service = createSimpleClassificationService(supabase);
      return new ClassicStrategyAdapter(service);
    },
    "singleton",
  );

  // Modern Strategy (V5 Adapter)
  container.register(
    SERVICE_TYPES.ModernStrategy,
    (c) => {
      const pipelineService = c.get<ClassificationPipelineService>(
        SERVICE_TYPES.PipelineService,
      );
      return new ModernStrategyAdapter(pipelineService);
    },
    "singleton",
  );
}

/**
 * 注册所有服务
 *
 * 按依赖顺序注册：
 * 1. 仓储层
 * 2. 基础设施服务
 * 3. 业务服务
 * 4. Modern 策略服务
 */
export function registerAllServices(container: EnhancedContainer): void {
  registerRepositories(container);
  registerInfrastructureServices(container);
  registerBusinessServices(container);
  registerModernServices(container);
}
