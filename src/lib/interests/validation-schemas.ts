/**
 * Interest Validation Schemas
 *
 * Zod schemas for runtime validation of interest-related database results.
 * Extracted from classification-v1/repositories/validation-schemas.
 *
 * @module interests
 * @version 1.0.0
 * @since 2026-03-11
 */

import { z } from "zod";

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
