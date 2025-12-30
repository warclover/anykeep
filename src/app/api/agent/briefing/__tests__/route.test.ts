/**
 * Proactive Briefing API Validation and Logic Tests
 *
 * Tests the validation schemas and business logic without
 * requiring Next.js request/response handlers.
 *
 * @since 2025-12-30
 */

import { z } from "zod";
import type {
  InsightType,
  ActionType,
} from "@/lib/ai-agent/proactive-briefing";

// =============================================================================
// Validation Schemas (extracted from route.ts)
// =============================================================================

/**
 * GET 查询参数 Schema
 */
const GetBriefingQuerySchema = z.object({
  insightsOnly: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  types: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : undefined)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 0)),
});

/**
 * POST 请求体 Schema
 */
const PostBriefingBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("markRead"),
    insightId: z.string().min(1),
  }),
  z.object({
    action: z.literal("markAllRead"),
  }),
  z.object({
    action: z.literal("dismiss"),
    insightId: z.string().min(1),
  }),
  z.object({
    action: z.literal("refresh"),
  }),
]);

// =============================================================================
// Type Definitions for Test
// =============================================================================

interface BriefingApiResponse {
  briefing: {
    enabled: boolean;
    lastVisit: string;
    daysSinceLastVisit: number;
    newCollectionsCount: number;
    topicChangeSummary?: string;
    pendingInsights: ProactiveInsight[];
    suggestedActions: SuggestedAction[];
    generatedAt: string;
  } | null;
  unreadCount: number;
  generationTimeMs?: number;
}

interface InsightsApiResponse {
  insights: ProactiveInsight[];
  total: number;
  hasMore: boolean;
}

interface ProactiveInsight {
  id: string;
  type: InsightType;
  title: string;
  summary: string;
  relatedBookmarkIds: number[];
  priority: number;
  createdAt: string;
  isRead: boolean;
}

interface SuggestedAction {
  id: string;
  type: ActionType;
  label: string;
  description: string;
  affectedCount?: number;
}

// =============================================================================
// Helper Functions (business logic extraction)
// =============================================================================

/**
 * 计算是否有更多数据
 */
function hasMoreResults(
  offset: number,
  currentLength: number,
  total: number,
): boolean {
  return offset + currentLength < total;
}

/**
 * 验证洞察类型列表
 */
function validateInsightTypes(
  types: string[] | undefined,
): InsightType[] | undefined {
  const validTypes: InsightType[] = [
    "topic_emergence",
    "pattern_detected",
    "recommendation",
    "knowledge_gap",
    "content_update",
    "link_health",
  ];

  if (!types || types.length === 0) {
    return undefined;
  }

  return types.filter((t): t is InsightType =>
    validTypes.includes(t as InsightType),
  );
}

// =============================================================================
// GetBriefingQuerySchema Tests
// =============================================================================

describe("GetBriefingQuerySchema", () => {
  describe("valid inputs", () => {
    it("should accept empty query params", () => {
      const input = {};
      const result = GetBriefingQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insightsOnly).toBe(false);
        expect(result.data.unreadOnly).toBe(false);
        expect(result.data.types).toBeUndefined();
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
      }
    });

    it("should parse insightsOnly=true correctly", () => {
      const input = { insightsOnly: "true" };
      const result = GetBriefingQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insightsOnly).toBe(true);
      }
    });

    it("should parse insightsOnly=false correctly", () => {
      const input = { insightsOnly: "false" };
      const result = GetBriefingQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insightsOnly).toBe(false);
      }
    });

    it("should parse unreadOnly=true correctly", () => {
      const input = { unreadOnly: "true" };
      const result = GetBriefingQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.unreadOnly).toBe(true);
      }
    });

    it("should parse types as comma-separated string", () => {
      const input = { types: "topic_emergence,recommendation" };
      const result = GetBriefingQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.types).toEqual([
          "topic_emergence",
          "recommendation",
        ]);
      }
    });

    it("should parse single type", () => {
      const input = { types: "pattern_detected" };
      const result = GetBriefingQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.types).toEqual(["pattern_detected"]);
      }
    });

    it("should parse limit as integer", () => {
      const input = { limit: "20" };
      const result = GetBriefingQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it("should parse offset as integer", () => {
      const input = { offset: "50" };
      const result = GetBriefingQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(50);
      }
    });

    it("should parse all params together", () => {
      const input = {
        insightsOnly: "true",
        unreadOnly: "true",
        types: "topic_emergence,knowledge_gap",
        limit: "25",
        offset: "10",
      };
      const result = GetBriefingQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insightsOnly).toBe(true);
        expect(result.data.unreadOnly).toBe(true);
        expect(result.data.types).toEqual(["topic_emergence", "knowledge_gap"]);
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(10);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle invalid limit by returning NaN", () => {
      const input = { limit: "abc" };
      const result = GetBriefingQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Number.isNaN(result.data.limit)).toBe(true);
      }
    });

    it("should handle empty types string", () => {
      const input = { types: "" };
      const result = GetBriefingQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.types).toBeUndefined();
      }
    });
  });
});

// =============================================================================
// PostBriefingBodySchema Tests
// =============================================================================

describe("PostBriefingBodySchema", () => {
  describe("markRead action", () => {
    it("should accept valid markRead request", () => {
      const input = {
        action: "markRead",
        insightId: "insight-123",
      };
      const result = PostBriefingBodySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success && result.data.action === "markRead") {
        expect(result.data.action).toBe("markRead");
        expect(result.data.insightId).toBe("insight-123");
      }
    });

    it("should reject markRead without insightId", () => {
      const input = { action: "markRead" };
      const result = PostBriefingBodySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject markRead with empty insightId", () => {
      const input = { action: "markRead", insightId: "" };
      const result = PostBriefingBodySchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("markAllRead action", () => {
    it("should accept valid markAllRead request", () => {
      const input = { action: "markAllRead" };
      const result = PostBriefingBodySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("markAllRead");
      }
    });
  });

  describe("dismiss action", () => {
    it("should accept valid dismiss request", () => {
      const input = {
        action: "dismiss",
        insightId: "insight-456",
      };
      const result = PostBriefingBodySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success && result.data.action === "dismiss") {
        expect(result.data.action).toBe("dismiss");
        expect(result.data.insightId).toBe("insight-456");
      }
    });

    it("should reject dismiss without insightId", () => {
      const input = { action: "dismiss" };
      const result = PostBriefingBodySchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("refresh action", () => {
    it("should accept valid refresh request", () => {
      const input = { action: "refresh" };
      const result = PostBriefingBodySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("refresh");
      }
    });
  });

  describe("invalid actions", () => {
    it("should reject unknown action", () => {
      const input = { action: "unknownAction" };
      const result = PostBriefingBodySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject missing action", () => {
      const input = {};
      const result = PostBriefingBodySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject null action", () => {
      const input = { action: null };
      const result = PostBriefingBodySchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// Helper Functions Tests
// =============================================================================

describe("hasMoreResults", () => {
  it("should return true when there are more results", () => {
    expect(hasMoreResults(0, 10, 50)).toBe(true);
    expect(hasMoreResults(10, 10, 25)).toBe(true);
    expect(hasMoreResults(0, 5, 10)).toBe(true);
  });

  it("should return false when there are no more results", () => {
    expect(hasMoreResults(0, 10, 10)).toBe(false);
    expect(hasMoreResults(10, 10, 20)).toBe(false);
    expect(hasMoreResults(40, 10, 50)).toBe(false);
  });

  it("should handle edge cases", () => {
    expect(hasMoreResults(0, 0, 0)).toBe(false);
    expect(hasMoreResults(0, 0, 10)).toBe(true);
    expect(hasMoreResults(100, 0, 100)).toBe(false);
  });
});

describe("validateInsightTypes", () => {
  it("should return undefined for undefined input", () => {
    expect(validateInsightTypes(undefined)).toBeUndefined();
  });

  it("should return undefined for empty array", () => {
    expect(validateInsightTypes([])).toBeUndefined();
  });

  it("should filter valid insight types", () => {
    const input = ["topic_emergence", "recommendation"];
    const result = validateInsightTypes(input);
    expect(result).toEqual(["topic_emergence", "recommendation"]);
  });

  it("should filter out invalid types", () => {
    const input = ["topic_emergence", "invalid_type", "pattern_detected"];
    const result = validateInsightTypes(input);
    expect(result).toEqual(["topic_emergence", "pattern_detected"]);
  });

  it("should return empty array filtered from all invalid types", () => {
    const input = ["invalid1", "invalid2"];
    const result = validateInsightTypes(input);
    expect(result).toEqual([]);
  });

  it("should accept all valid insight types", () => {
    const validTypes = [
      "topic_emergence",
      "pattern_detected",
      "recommendation",
      "knowledge_gap",
      "content_update",
      "link_health",
    ];
    const result = validateInsightTypes(validTypes);
    expect(result).toEqual(validTypes);
  });
});

// =============================================================================
// API Response Type Tests
// =============================================================================

describe("API Response Types", () => {
  describe("BriefingApiResponse", () => {
    it("should match expected structure with briefing", () => {
      const response: BriefingApiResponse = {
        briefing: {
          enabled: true,
          lastVisit: "2025-12-27T00:00:00Z",
          daysSinceLastVisit: 3,
          newCollectionsCount: 5,
          topicChangeSummary: "离线 3 天期间，新增了 5 条收藏",
          pendingInsights: [],
          suggestedActions: [],
          generatedAt: "2025-12-30T00:00:00Z",
        },
        unreadCount: 2,
        generationTimeMs: 150,
      };

      expect(response.briefing).toBeDefined();
      expect(response.briefing?.enabled).toBe(true);
      expect(response.briefing?.daysSinceLastVisit).toBe(3);
      expect(response.unreadCount).toBe(2);
    });

    it("should match expected structure with null briefing", () => {
      const response: BriefingApiResponse = {
        briefing: null,
        unreadCount: 0,
        generationTimeMs: 50,
      };

      expect(response.briefing).toBeNull();
      expect(response.unreadCount).toBe(0);
    });
  });

  describe("InsightsApiResponse", () => {
    it("should match expected structure", () => {
      const response: InsightsApiResponse = {
        insights: [
          {
            id: "insight-1",
            type: "topic_emergence",
            title: "新主题发现",
            summary: "测试摘要",
            relatedBookmarkIds: [1, 2, 3],
            priority: 8,
            createdAt: "2025-12-30T00:00:00Z",
            isRead: false,
          },
        ],
        total: 10,
        hasMore: true,
      };

      expect(response.insights.length).toBe(1);
      expect(response.insights[0].type).toBe("topic_emergence");
      expect(response.total).toBe(10);
      expect(response.hasMore).toBe(true);
    });

    it("should match expected structure with empty insights", () => {
      const response: InsightsApiResponse = {
        insights: [],
        total: 0,
        hasMore: false,
      };

      expect(response.insights).toEqual([]);
      expect(response.total).toBe(0);
      expect(response.hasMore).toBe(false);
    });
  });
});

// =============================================================================
// Integration Scenario Tests
// =============================================================================

describe("API Integration Scenarios", () => {
  describe("pagination calculation", () => {
    it("should correctly calculate hasMore for first page", () => {
      const total = 25;
      const _limit = 10;
      const offset = 0;
      const fetchedCount = 10;

      expect(hasMoreResults(offset, fetchedCount, total)).toBe(true);
    });

    it("should correctly calculate hasMore for middle page", () => {
      const total = 25;
      const _limit = 10;
      const offset = 10;
      const fetchedCount = 10;

      expect(hasMoreResults(offset, fetchedCount, total)).toBe(true);
    });

    it("should correctly calculate hasMore for last page", () => {
      const total = 25;
      const _limit = 10;
      const offset = 20;
      const fetchedCount = 5;

      expect(hasMoreResults(offset, fetchedCount, total)).toBe(false);
    });
  });

  describe("query param parsing for common use cases", () => {
    it("should handle unread insights query", () => {
      const params = {
        insightsOnly: "true",
        unreadOnly: "true",
        limit: "20",
      };

      const result = GetBriefingQuerySchema.safeParse(params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insightsOnly).toBe(true);
        expect(result.data.unreadOnly).toBe(true);
        expect(result.data.limit).toBe(20);
      }
    });

    it("should handle filtered insights by type", () => {
      const params = {
        insightsOnly: "true",
        types: "topic_emergence,pattern_detected",
      };

      const result = GetBriefingQuerySchema.safeParse(params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.types).toEqual([
          "topic_emergence",
          "pattern_detected",
        ]);
      }
    });
  });
});
