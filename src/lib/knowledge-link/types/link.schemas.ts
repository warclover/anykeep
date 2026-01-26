/**
 * Knowledge Link Schemas
 *
 * 知识关联模块 Zod Schema 定义
 * 用于运行时数据验证和类型安全
 *
 * @version 1.0.0
 * @since 2026-01-26
 */

import { z } from "zod";

// ============================================================================
// Enums & Constants
// ============================================================================

export const LinkTypeSchema = z.enum(["semantic", "entity", "tag", "topic"]);

// ============================================================================
// Evidence Schemas
// ============================================================================

export const LinkEvidenceDetailsSchema = z.object({
  sharedEntities: z.array(z.string()).optional(),
  similarityScore: z.number().optional(),
  sharedTags: z.array(z.string()).optional(),
  topicCluster: z.string().optional(),
});

export const LinkEvidenceSchema = z.object({
  type: LinkTypeSchema,
  score: z.number(),
  details: LinkEvidenceDetailsSchema,
});

// ============================================================================
// Link Schemas
// ============================================================================

export const KnowledgeLinkSchema = z.object({
  id: z.string(),
  userId: z.string(),
  sourceBookmarkId: z.number(),
  targetBookmarkId: z.number(),
  linkType: LinkTypeSchema,
  strength: z.number(),
  evidence: LinkEvidenceSchema,
  algorithm: z.string().optional(),
  createdAt: z.string(),
});

// ============================================================================
// Input Schemas
// ============================================================================

export const SaveLinkInputSchema = z.object({
  userId: z.string().uuid().or(z.string()), // 兼容 uuid 和普通字符串 ID
  bookmarkId1: z.number().int().positive(),
  bookmarkId2: z.number().int().positive(),
  linkType: LinkTypeSchema,
  strength: z.number().min(0).max(1),
  evidence: LinkEvidenceSchema,
  algorithm: z.string().optional(),
});

export const BatchSaveLinkInputSchema = z.object({
  userId: z.string().uuid().or(z.string()),
  links: z.array(
    z.object({
      bookmarkId1: z.number().int().positive(),
      bookmarkId2: z.number().int().positive(),
      linkType: LinkTypeSchema,
      strength: z.number().min(0).max(1),
      evidence: LinkEvidenceSchema,
      algorithm: z.string().optional(),
    }),
  ),
});

export const LinkQueryFilterSchema = z.object({
  userId: z.string().optional(),
  bookmarkId: z.number().int().positive().optional(),
  linkTypes: z.array(LinkTypeSchema).optional(),
  minStrength: z.number().min(0).max(1).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().min(0).optional(),
});
