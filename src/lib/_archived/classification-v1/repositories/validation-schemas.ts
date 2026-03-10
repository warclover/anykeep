/**
 * Repository Validation Schemas
 * Zod schemas for runtime validation of database query results
 */

import { z } from "zod";

// ============================================
// Bookmark Schemas
// ============================================

/**
 * Schema for similar bookmark RPC result
 */
export const SimilarBookmarkRowSchema = z.object({
  bookmark_id: z.number(),
  bookmark_title: z.string(),
  folder_id: z.number().nullable(),
  folder_name: z.string().nullable(),
  similarity: z.number(),
});

export type SimilarBookmarkRow = z.infer<typeof SimilarBookmarkRowSchema>;

/**
 * Schema for bookmark classification data
 */
export const BookmarkClassificationRowSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string(),
  ai_summary: z.string().nullable(),
  ai_tags: z.array(z.string()).nullable(),
  embedding: z.array(z.number()).nullable(),
  folder_id: z.number().nullable(),
  created_at: z.string(),
});

export type BookmarkClassificationRow = z.infer<
  typeof BookmarkClassificationRowSchema
>;

// ============================================
// Folder Profile Schemas
// ============================================

/**
 * Schema for similar folder RPC result
 */
export const SimilarFolderRowSchema = z.object({
  folder_id: z.number(),
  folder_name: z.string(),
  bookmark_count: z.number(),
  top_tags: z.array(z.string()).nullable().default([]),
  sample_titles: z.array(z.string()).nullable().default([]),
  similarity: z.number(),
});

export type SimilarFolderRow = z.infer<typeof SimilarFolderRowSchema>;

// ============================================
// Interest Schemas
// ============================================

/**
 * Schema for custom interest row
 */
export const CustomInterestRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  icon: z.string(),
  keywords: z.array(z.string()).nullable().default([]),
  suggested_folders: z.array(z.string()).nullable().default([]),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CustomInterestRow = z.infer<typeof CustomInterestRowSchema>;

// ============================================
// Validation Utilities
// ============================================

/**
 * Safely parse an array of rows with a schema
 * Returns validated data or throws a descriptive error
 */
export function parseRows<T>(
  schema: z.ZodSchema<T>,
  data: unknown[],
  context: string,
): T[] {
  try {
    return data.map((row, index) => {
      const result = schema.safeParse(row);
      if (!result.success) {
        throw new Error(
          `Invalid row at index ${index}: ${result.error.message}`,
        );
      }
      return result.data;
    });
  } catch (error) {
    throw new Error(
      `${context}: ${error instanceof Error ? error.message : "Validation failed"}`,
    );
  }
}

/**
 * Safely parse a single row with a schema
 * Returns validated data or throws a descriptive error
 */
export function parseRow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}
