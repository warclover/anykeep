/**
 * Classification Module Dependency Container
 * Manages service instances and dependencies
 *
 * V3.0 更新：集成 5 层匹配策略
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IClassificationService,
  IInboxOrganizerService,
  IInterestService,
} from "./services/interfaces";
import type { IMatcher, IScoreAggregator } from "./strategies/interfaces";

// Repositories
import {
  FolderProfileRepository,
  BookmarkRepository,
  InterestRepository,
  SuggestionRepository,
} from "./repositories";

// V2 Strategies
import {
  VectorMatcher,
  HistoryMatcher,
  AIRecommender,
  WeightedScoreAggregator,
} from "./strategies";

// V3 Strategies
import {
  UniversalCategoryMatcher,
  KnnDirectMatcher,
  FingerprintMatcher,
  TagMatcher,
} from "./v3/strategies";
import { V3_CONFIG } from "./v3/config";

// Services
import {
  ClassificationService,
  UserStageService,
  InterestService,
  InboxOrganizerService,
} from "./services";

// Constants
import { CLASSIFICATION_WEIGHTS } from "./constants";
import { logger } from "@/lib/logger";

/**
 * Dependency injection container for classification module
 */
export class ClassificationContainer {
  private supabase: SupabaseClient;

  // Singleton instance
  private static instance: ClassificationContainer | null = null;

  // Cached repositories
  private _folderProfileRepo: FolderProfileRepository | null = null;
  private _bookmarkRepo: BookmarkRepository | null = null;
  private _interestRepo: InterestRepository | null = null;
  private _suggestionRepo: SuggestionRepository | null = null;

  // Cached services
  private _classificationService: IClassificationService | null = null;
  private _inboxOrganizerService: IInboxOrganizerService | null = null;
  private _interestService: IInterestService | null = null;
  private _userStageService: UserStageService | null = null;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Initialize container with Supabase client
   */
  static initialize(supabase: SupabaseClient): ClassificationContainer {
    if (!ClassificationContainer.instance) {
      ClassificationContainer.instance = new ClassificationContainer(supabase);
    } else {
      // Update supabase client if already initialized
      ClassificationContainer.instance.supabase = supabase;
    }
    return ClassificationContainer.instance;
  }

  /**
   * Get container instance
   * @throws Error if not initialized
   */
  static getInstance(): ClassificationContainer {
    if (!ClassificationContainer.instance) {
      throw new Error(
        "ClassificationContainer not initialized. Call initialize() first.",
      );
    }
    return ClassificationContainer.instance;
  }

  /**
   * Check if container is initialized
   */
  static isInitialized(): boolean {
    return ClassificationContainer.instance !== null;
  }

  /**
   * Reset container (for testing)
   */
  static reset(): void {
    if (ClassificationContainer.instance) {
      ClassificationContainer.instance._folderProfileRepo = null;
      ClassificationContainer.instance._bookmarkRepo = null;
      ClassificationContainer.instance._interestRepo = null;
      ClassificationContainer.instance._suggestionRepo = null;
      ClassificationContainer.instance._classificationService = null;
      ClassificationContainer.instance._inboxOrganizerService = null;
      ClassificationContainer.instance._interestService = null;
      ClassificationContainer.instance._userStageService = null;
    }
    ClassificationContainer.instance = null;
  }

  // Repository getters

  private getFolderProfileRepository(): FolderProfileRepository {
    if (!this._folderProfileRepo) {
      this._folderProfileRepo = new FolderProfileRepository(this.supabase);
    }
    return this._folderProfileRepo;
  }

  private getBookmarkRepository(): BookmarkRepository {
    if (!this._bookmarkRepo) {
      this._bookmarkRepo = new BookmarkRepository(this.supabase);
    }
    return this._bookmarkRepo;
  }

  private getInterestRepository(): InterestRepository {
    if (!this._interestRepo) {
      this._interestRepo = new InterestRepository(this.supabase);
    }
    return this._interestRepo;
  }

  private getSuggestionRepository(): SuggestionRepository {
    if (!this._suggestionRepo) {
      this._suggestionRepo = new SuggestionRepository(this.supabase);
    }
    return this._suggestionRepo;
  }

  // Service getters

  /**
   * Get User Stage Service
   */
  getUserStageService(): UserStageService {
    if (!this._userStageService) {
      this._userStageService = new UserStageService(this.supabase);
    }
    return this._userStageService;
  }

  /**
   * Get V3 Matchers (Public for debugging)
   */
  public getV3Matchers(): IMatcher[] {
    const folderProfileRepo = this.getFolderProfileRepository();
    const bookmarkRepo = this.getBookmarkRepository();

    // 构建匹配器列表（V3.0 5 层策略）
    const matchers: IMatcher[] = [];

    // ═══════════════════════════════════════════════════════════════
    // 第 1 层：k-NN 直接锁定（最高优先级，可跳过后续层）
    // ═══════════════════════════════════════════════════════════════
    if (V3_CONFIG.enableKnnDirect) {
      matchers.push(
        new KnnDirectMatcher(bookmarkRepo, {
          weight: 1.0, // 最高权重
          thresholds: { similarity: V3_CONFIG.knnDirectThreshold },
        }),
      );
      logger.debug(
        { matcher: "knn-direct", enabled: true },
        "V3 Matcher enabled",
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // 第 2 层：标签指纹匹配
    // ═══════════════════════════════════════════════════════════════
    if (V3_CONFIG.enableFolderFingerprint) {
      matchers.push(
        new FingerprintMatcher(this.supabase, {
          weight: 0.25,
        }),
      );
      logger.debug(
        { matcher: "fingerprint", enabled: true },
        "V3 Matcher enabled",
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // 第 3 层：Tag-to-Tag 精准匹配
    // ═══════════════════════════════════════════════════════════════
    if (V3_CONFIG.enableTagMatcher) {
      matchers.push(
        new TagMatcher(this.supabase, {
          weight: 0.3,
        }),
      );
      logger.debug({ matcher: "tag", enabled: true }, "V3 Matcher enabled");
    }

    // ═══════════════════════════════════════════════════════════════
    // 第 4 层：向量相似度匹配 (V2 核心)
    // ═══════════════════════════════════════════════════════════════
    matchers.push(
      new VectorMatcher(folderProfileRepo, {
        weight: CLASSIFICATION_WEIGHTS.VECTOR,
      }),
    );

    // ═══════════════════════════════════════════════════════════════
    // 第 5 层：通用分类匹配（冷启动兜底）
    // ═══════════════════════════════════════════════════════════════
    if (V3_CONFIG.enableUniversalCategories) {
      matchers.push(
        new UniversalCategoryMatcher(folderProfileRepo, {
          weight: 0.2,
        }),
      );
      logger.debug(
        { matcher: "universal", enabled: true },
        "V3 Matcher enabled",
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // 历史匹配 + AI 推荐（辅助层）
    // ═══════════════════════════════════════════════════════════════
    matchers.push(
      new HistoryMatcher(bookmarkRepo, {
        weight: CLASSIFICATION_WEIGHTS.HISTORY,
      }),
    );

    matchers.push(
      new AIRecommender(folderProfileRepo, {
        weight: CLASSIFICATION_WEIGHTS.AI,
      }),
    );

    return matchers;
  }

  /**
   * Get Classification Service
   * V3.0: 集成 5 层匹配策略
   *
   * @deprecated 自 V4.1 起，生产环境推荐使用 createSimpleClassificationService()
   * @see src/lib/classification/services/simple-classification.service.ts
   *
   * 此方法仍保留用于：
   * - 环境变量 CLASSIFICATION_VERSION=v3 时的回滚
   * - 调试工具中的 V3 对比测试
   */
  getClassificationService(): IClassificationService {
    if (!this._classificationService) {
      const matchers = this.getV3Matchers();

      logger.info(
        {
          totalMatchers: matchers.length,
          v3Features: {
            knnDirect: V3_CONFIG.enableKnnDirect,
            fingerprint: V3_CONFIG.enableFolderFingerprint,
            tagMatcher: V3_CONFIG.enableTagMatcher,
            universal: V3_CONFIG.enableUniversalCategories,
          },
        },
        "V3 Classification Service initialized",
      );

      // Create aggregator
      const aggregator: IScoreAggregator = new WeightedScoreAggregator();

      // Create service
      this._classificationService = new ClassificationService(
        matchers,
        aggregator,
        this.getUserStageService(),
        this.supabase,
      );
    }
    return this._classificationService;
  }

  /**
   * Get Interest Service
   */
  getInterestService(): IInterestService {
    if (!this._interestService) {
      this._interestService = new InterestService(
        this.getInterestRepository(),
        this.supabase,
      );
    }
    return this._interestService;
  }

  /**
   * Get Inbox Organizer Service
   */
  getInboxOrganizerService(): IInboxOrganizerService {
    if (!this._inboxOrganizerService) {
      this._inboxOrganizerService = new InboxOrganizerService(
        this.getBookmarkRepository(),
        this.getFolderProfileRepository(),
        this.getSuggestionRepository(),
        this.getInterestRepository(),
        this.supabase,
      );
    }
    return this._inboxOrganizerService;
  }

  /**
   * Get all services (convenience method)
   */
  getAllServices(): {
    classification: IClassificationService;
    interest: IInterestService;
    inboxOrganizer: IInboxOrganizerService;
    userStage: UserStageService;
  } {
    return {
      classification: this.getClassificationService(),
      interest: this.getInterestService(),
      inboxOrganizer: this.getInboxOrganizerService(),
      userStage: this.getUserStageService(),
    };
  }
}

/**
 * Helper function to get initialized container
 * @throws Error if not initialized
 */
export function getClassificationContainer(): ClassificationContainer {
  return ClassificationContainer.getInstance();
}
