/**
 * JSON Schema 定义 (Story 3.1)
 * @module knowledge-studio/blueprint/structured-output
 *
 * 使用 JSON Schema Draft 7 格式定义各蓝图输出 Schema。
 */

import type { JSONSchemaType } from "ajv";
import type {
  StructuredOutputMeta,
  FeatureMatrixOutput,
  SwotOutput,
  ScriptTimelineOutput,
  SectionsOutput,
  ChecklistOutput,
  MarkdownOutput,
} from "./types";

// ============================================================
// Base Schema Components
// ============================================================

/**
 * 元数据 Schema
 */
export const metaSchema: JSONSchemaType<StructuredOutputMeta> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: [
        "feature_matrix",
        "swot",
        "script_timeline",
        "sections",
        "checklist",
        "comparison_table",
        "markdown",
      ],
    },
    version: { type: "string" },
    generatedAt: { type: "string" },
    blueprintId: { type: "string" },
    generationMode: { type: "string", enum: ["quick", "guided"] },
    isFallback: { type: "boolean" },
  },
  required: [
    "type",
    "version",
    "generatedAt",
    "blueprintId",
    "generationMode",
    "isFallback",
  ],
  additionalProperties: false,
};

// ============================================================
// Feature Matrix Schema (Story 3.4)
// ============================================================

export const featureMatrixSchema: JSONSchemaType<FeatureMatrixOutput> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    meta: metaSchema,
    title: { type: "string" },
    subjects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
        },
        required: ["id", "name"],
        additionalProperties: false,
      },
    },
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          feature: { type: "string" },
          category: { type: "string", nullable: true },
          support: {
            type: "object",
            additionalProperties: { type: "string" },
            required: [],
          },
          notes: { type: "string", nullable: true },
        },
        required: ["feature", "support"],
        additionalProperties: false,
      },
    },
    summary: { type: "string", nullable: true },
  },
  required: ["meta", "title", "subjects", "rows"],
  additionalProperties: false,
};

// ============================================================
// SWOT Schema (Story 3.5)
// ============================================================

const swotItemSchema = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const },
    description: { type: "string" as const },
    importance: { type: "number" as const, nullable: true },
    source: { type: "string" as const, nullable: true },
  },
  required: ["title", "description"] as const,
  additionalProperties: false,
};

export const swotSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    meta: metaSchema,
    subject: { type: "string" },
    overview: { type: "string", nullable: true },
    quadrants: {
      type: "object",
      properties: {
        strengths: { type: "array", items: swotItemSchema },
        weaknesses: { type: "array", items: swotItemSchema },
        opportunities: { type: "array", items: swotItemSchema },
        threats: { type: "array", items: swotItemSchema },
      },
      required: ["strengths", "weaknesses", "opportunities", "threats"],
      additionalProperties: false,
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
      nullable: true,
    },
  },
  required: ["meta", "subject", "quadrants"],
  additionalProperties: false,
} as unknown as JSONSchemaType<SwotOutput>;

// ============================================================
// Script Timeline Schema (Story 3.6)
// ============================================================

export const scriptTimelineSchema: JSONSchemaType<ScriptTimelineOutput> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    meta: metaSchema,
    title: { type: "string" },
    videoType: { type: "string", nullable: true },
    targetDuration: { type: "number" },
    shots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          sequence: { type: "number" },
          startTime: { type: "number" },
          duration: { type: "number" },
          visual: { type: "string" },
          narration: { type: "string", nullable: true },
          shotType: {
            type: "string",
            enum: ["opening", "content", "transition", "closing", "b-roll"],
            nullable: true,
          },
          bRollSuggestion: { type: "string", nullable: true },
          subtitle: { type: "string", nullable: true },
          musicCue: { type: "string", nullable: true },
        },
        required: ["id", "sequence", "startTime", "duration", "visual"],
        additionalProperties: false,
      },
    },
    openingHook: { type: "string", nullable: true },
    closingCta: { type: "string", nullable: true },
    totalDuration: { type: "number" },
  },
  required: ["meta", "title", "targetDuration", "shots", "totalDuration"],
  additionalProperties: false,
};

// ============================================================
// Sections Schema
// ============================================================

const sectionContentSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" as const },
    title: { type: "string" as const },
    level: { type: "number" as const, enum: [1, 2, 3] as const },
    content: { type: "string" as const },
    children: {
      type: "array" as const,
      items: { $ref: "#/definitions/sectionContent" },
      nullable: true,
    },
    citations: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          text: { type: "string" as const },
          source: { type: "string" as const },
        },
        required: ["id", "text", "source"] as const,
      },
      nullable: true,
    },
  },
  required: ["id", "title", "level", "content"] as const,
  additionalProperties: false,
};

export const sectionsSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  definitions: {
    sectionContent: sectionContentSchema,
  },
  properties: {
    meta: metaSchema,
    title: { type: "string" },
    summary: { type: "string", nullable: true },
    sections: {
      type: "array",
      items: { $ref: "#/definitions/sectionContent" },
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      nullable: true,
    },
  },
  required: ["meta", "title", "sections"],
  additionalProperties: false,
} as unknown as JSONSchemaType<SectionsOutput>;

// ============================================================
// Checklist Schema
// ============================================================

const checklistItemSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" as const },
    title: { type: "string" as const },
    description: { type: "string" as const, nullable: true },
    status: {
      type: "string" as const,
      enum: ["pending", "in_progress", "completed", "blocked"] as const,
    },
    priority: {
      type: "string" as const,
      enum: ["high", "medium", "low"] as const,
      nullable: true,
    },
    assignee: { type: "string" as const, nullable: true },
    dueDate: { type: "string" as const, nullable: true },
    children: {
      type: "array" as const,
      items: { $ref: "#/definitions/checklistItem" },
      nullable: true,
    },
  },
  required: ["id", "title", "status"] as const,
  additionalProperties: false,
};

export const checklistSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  definitions: {
    checklistItem: checklistItemSchema,
  },
  properties: {
    meta: metaSchema,
    title: { type: "string" },
    description: { type: "string", nullable: true },
    items: {
      type: "array",
      items: { $ref: "#/definitions/checklistItem" },
    },
    completionRate: { type: "number", nullable: true },
  },
  required: ["meta", "title", "items"],
  additionalProperties: false,
} as unknown as JSONSchemaType<ChecklistOutput>;

// ============================================================
// Markdown Schema (降级输出)
// ============================================================

export const markdownSchema: JSONSchemaType<MarkdownOutput> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    meta: metaSchema,
    content: { type: "string" },
    fallbackReason: { type: "string", nullable: true },
  },
  required: ["meta", "content"],
  additionalProperties: false,
};

// ============================================================
// Schema Registry
// ============================================================

import type { StructuredOutputType } from "./types";

/**
 * Schema 注册表
 */
export const schemaRegistry: Record<StructuredOutputType, object> = {
  feature_matrix: featureMatrixSchema,
  swot: swotSchema,
  script_timeline: scriptTimelineSchema,
  sections: sectionsSchema,
  checklist: checklistSchema,
  comparison_table: featureMatrixSchema, // 复用 feature_matrix
  markdown: markdownSchema,
};

/**
 * 获取指定类型的 Schema
 */
export function getSchemaForType(type: StructuredOutputType): object {
  return schemaRegistry[type];
}
