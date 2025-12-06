/**
 * Classification Module Dependency Container
 * Manages service instances and dependencies
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

// Strategies
import {
  VectorMatcher,
  HistoryMatcher,
  AIRecommender,
  WeightedScoreAggregator,
} from "./strategies";

// Services
import {
  ClassificationService,
  UserStageService,
  InterestService,
  InboxOrganizerService,
} from "./services";

// Constants
import { CLASSIFICATION_WEIGHTS } from "./constants";

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
   * Get Classification Service
   */
  getClassificationService(): IClassificationService {
    if (!this._classificationService) {
      const folderProfileRepo = this.getFolderProfileRepository();
      const bookmarkRepo = this.getBookmarkRepository();

      // Create matchers
      const matchers: IMatcher[] = [
        new VectorMatcher(folderProfileRepo, {
          weight: CLASSIFICATION_WEIGHTS.VECTOR,
        }),
        new HistoryMatcher(bookmarkRepo, {
          weight: CLASSIFICATION_WEIGHTS.HISTORY,
        }),
        new AIRecommender(folderProfileRepo, {
          weight: CLASSIFICATION_WEIGHTS.AI,
        }),
      ];

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
