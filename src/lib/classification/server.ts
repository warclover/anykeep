/**
 * Classification Module - Server-only exports
 *
 * This file contains exports that depend on server-side code (next/headers, etc.)
 * Import from '@/lib/classification/server' in Server Components and API routes only.
 *
 * @example
 * ```typescript
 * // In API route or Server Component:
 * import { classifyBookmarkV2 } from '@/lib/classification/server'
 * ```
 */

// Re-export everything from the main index (client-safe exports)
export * from "./index";

// Server-only: Integration layer
export {
  classifyBookmarkV2,
  updateFolderProfileAfterClassification,
  updateFolderProfilesOnBookmarkChange,
  initializeFolderNameProfile,
  shouldUseV2Classification,
} from "./integration";

// Server-only: Container (requires Supabase server client)
export {
  ClassificationContainer,
  getClassificationContainer,
} from "./container";

// Server-only: Services (client-safe parts)
export {
  ClassificationService,
  UserStageService,
  InterestService,
  InboxOrganizerService,
  FolderHealthService,
} from "./services";

// Server-only: TrustModeClassificationService (depends on server code)
export {
  TrustModeClassificationService,
  createTrustModeClassificationService,
} from "./services/server";

export type {
  EnhancedBookmarkInput,
  EnhancedClassificationResult,
} from "./services/server";

export type {
  FolderHealthStatus,
  MergeSuggestion,
  SplitSuggestion,
  FolderHealthReport,
} from "./services";
