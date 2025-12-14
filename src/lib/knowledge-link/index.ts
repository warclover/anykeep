/**
 * Knowledge Link Module
 *
 * 知识关联模块统一入口
 *
 * 功能：
 * - 自动发现书签之间的关联（语义相似、实体匹配、标签匹配）
 * - 提供相关内容查询
 * - 知识图谱统计
 *
 * @version 1.0.0
 * @since 2025-12-15
 *
 * @example
 * ```typescript
 * import { getLinkService, type RelatedBookmark } from '@/lib/knowledge-link';
 *
 * const linkService = getLinkService();
 *
 * // 获取相关书签
 * const related = await linkService.getRelatedBookmarks(bookmarkId, userId);
 *
 * // 处理新书签（自动发现关联）
 * await linkService.processNewBookmark(bookmarkId, userId);
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Core Types
  LinkType,
  KnowledgeLink,
  LinkEvidence,
  LinkEvidenceDetails,

  // Related Bookmarks
  RelatedBookmark,
  GetRelatedOptions,

  // Discovery
  LinkDiscoveryInput,
  LinkDiscoveryOptions,
  DiscoveredLink,

  // Stats
  KnowledgeGraphStats,

  // Config
  LinkServiceConfig,

  // Repository
  SaveLinkInput,
  BatchSaveLinkInput,
  LinkQueryFilter,
} from "./types/link.types";

export {
  LINK_TYPE_LABELS,
  LINK_TYPE_ICONS,
  DEFAULT_DISCOVERY_OPTIONS,
  DEFAULT_LINK_SERVICE_CONFIG,
} from "./types/link.types";

// ============================================================================
// Services
// ============================================================================

export type { ILinkService } from "./services/link.service";

export {
  LinkService,
  getLinkService,
  resetLinkService,
} from "./services/link.service";

export type { ISimilarityEngineService } from "./services/similarity-engine.service";

export {
  SimilarityEngineService,
  getSimilarityEngineService,
  resetSimilarityEngineService,
} from "./services/similarity-engine.service";

export type { IEntityMatcherService } from "./services/entity-matcher.service";

export {
  EntityMatcherService,
  getEntityMatcherService,
  resetEntityMatcherService,
} from "./services/entity-matcher.service";

// ============================================================================
// Repositories
// ============================================================================

export type { ILinkRepository } from "./repositories/link.repository";

export {
  LinkRepository,
  getLinkRepository,
  resetLinkRepository,
} from "./repositories/link.repository";

// ============================================================================
// Event Handlers
// ============================================================================

export type { LinkEventHandlerConfig } from "./handlers/link-event-handler";

export {
  LinkEventHandler,
  getLinkEventHandler,
  initializeLinkEventHandler,
  resetLinkEventHandler,
} from "./handlers/link-event-handler";
