/**
 * Interest module constants
 *
 * Extracted from classification-v1/constants/limits for independence.
 *
 * @module interests
 * @version 1.0.0
 * @since 2026-03-11
 */

/**
 * Custom interest limits
 */
export const CUSTOM_INTEREST_LIMITS = {
  /** Maximum custom interests per user */
  MAX_CUSTOM_INTERESTS: 5,
  /** Maximum name length */
  MAX_NAME_LENGTH: 20,
  /** Maximum keywords per interest */
  MAX_KEYWORDS: 10,
  /** Maximum suggested folders per interest */
  MAX_SUGGESTED_FOLDERS: 3,
} as const;

/**
 * Folder limits for initial folder creation during onboarding
 */
export const INITIAL_FOLDER_LIMITS = {
  /** Initial folder creation minimum */
  INITIAL_MIN: 3,
  /** Initial folder creation maximum */
  INITIAL_MAX: 7,
} as const;
