/**
 * Repository Validation Schemas
 * Zod schemas for runtime validation of database query results
 *
 * Extracted from classification-v1 for independent usage.
 *
 * @module folder/profile
 * @version 1.0.0
 * @since 2026-03-11
 */

import { z } from "zod";

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
