/**
 * Folder Health 模块常量
 *
 * 从 classification-v1/constants/limits 提取的
 * FolderHealthService 所需子集。
 *
 * @module folder/health
 * @version 1.0.0
 * @since 2026-03-11
 */

/**
 * Folder limits - 文件夹健康分析阈值
 */
export const FOLDER_LIMITS = {
  /** Merge suggestion similarity threshold (80%) */
  MERGE_SIMILARITY_THRESHOLD: 0.8,
  /** Split suggestion size threshold (bookmarks count) */
  SPLIT_SIZE_THRESHOLD: 100,
  /** Split suggestion diversity threshold - below this is too diverse */
  SPLIT_DIVERSITY_THRESHOLD: 0.5,
  /** Maximum merge suggestions to return */
  MAX_MERGE_SUGGESTIONS: 5,
  /** Maximum split suggestions to return */
  MAX_SPLIT_SUGGESTIONS: 3,
} as const;
