/**
 * 用户画像 API 验证和业务逻辑测试
 *
 * 测试验证 Schema 和辅助函数
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { z } from "zod";
import { PERSONA_GROUP_MAP } from "@/lib/ai-agent/personas/types";
import type { PersonaType } from "@/lib/ai-agent/personas/types";
import {
  isUserInPersonaRollout,
  isPersonaFeatureEnabled,
  getCurrentPersonaStage,
} from "@/lib/ai-agent/config";

// =============================================================================
// 验证 Schema（从 route.ts 复制）
// =============================================================================

const PersonaPreferencesSchema = z.object({
  responseStyle: z.enum(["concise", "detailed", "auto"]),
  proactiveReminders: z.boolean(),
  academicCitations: z.boolean(),
  codeBlocks: z.boolean(),
  emojiStyle: z.enum(["none", "minimal", "rich"]),
  language: z.enum(["zh-CN", "en-US", "auto"]),
});

const UpdatePersonaSchema = z.object({
  primaryType: z.string(),
  group: z.string(),
  preferences: PersonaPreferencesSchema,
  source: z.enum(["registration", "settings", "inferred"]),
});

// =============================================================================
// 辅助函数
// =============================================================================

interface BookmarkData {
  ai_tags: string[] | null;
  platform: string | null;
  url: string | null;
  created_at: string | null;
}

interface UserBehaviorData {
  tags: string[];
  tagCounts: Record<string, number>;
  platforms: string[];
  platformCounts: Record<string, number>;
  contentTypes: string[];
  contentTypeCounts: Record<string, number>;
  folders: string[];
  folderCounts: Record<string, number>;
  domains: string[];
  domainCounts: Record<string, number>;
  timePatterns: {
    hourDistribution: number[];
    weekdayDistribution: number[];
  };
  activityMetrics: {
    totalBookmarks: number;
    recentWeekCount: number;
    recentMonthCount: number;
    avgDailyCount: number;
  };
}

function buildBehaviorData(bookmarks: BookmarkData[]): UserBehaviorData {
  const tags: string[] = [];
  const tagCounts: Record<string, number> = {};
  const platformCounts: Record<string, number> = {};
  const domainCounts: Record<string, number> = {};

  for (const bookmark of bookmarks) {
    if (bookmark.ai_tags) {
      for (const tag of bookmark.ai_tags) {
        tags.push(tag);
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    if (bookmark.platform) {
      platformCounts[bookmark.platform] =
        (platformCounts[bookmark.platform] || 0) + 1;
    }

    if (bookmark.url) {
      try {
        const domain = new URL(bookmark.url).hostname;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch {
        // 忽略无效 URL
      }
    }
  }

  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const recentWeekCount = bookmarks.filter(
    (b) => b.created_at && new Date(b.created_at).getTime() > oneWeekAgo,
  ).length;

  const recentMonthCount = bookmarks.filter(
    (b) => b.created_at && new Date(b.created_at).getTime() > oneMonthAgo,
  ).length;

  return {
    tags: [...new Set(tags)],
    tagCounts,
    platforms: Object.keys(platformCounts),
    platformCounts,
    contentTypes: [],
    contentTypeCounts: {},
    folders: [],
    folderCounts: {},
    domains: Object.keys(domainCounts),
    domainCounts,
    timePatterns: {
      hourDistribution: new Array(24).fill(0),
      weekdayDistribution: new Array(7).fill(0),
    },
    activityMetrics: {
      totalBookmarks: bookmarks.length,
      recentWeekCount,
      recentMonthCount,
      avgDailyCount: recentMonthCount / 30,
    },
  };
}

// =============================================================================
// 验证函数测试
// =============================================================================

describe("PersonaPreferencesSchema", () => {
  it("should validate valid preferences", () => {
    const validPreferences = {
      responseStyle: "detailed",
      proactiveReminders: true,
      academicCitations: false,
      codeBlocks: true,
      emojiStyle: "minimal",
      language: "zh-CN",
    };

    const result = PersonaPreferencesSchema.safeParse(validPreferences);
    expect(result.success).toBe(true);
  });

  it("should reject invalid responseStyle", () => {
    const invalidPreferences = {
      responseStyle: "invalid",
      proactiveReminders: true,
      academicCitations: false,
      codeBlocks: true,
      emojiStyle: "minimal",
      language: "zh-CN",
    };

    const result = PersonaPreferencesSchema.safeParse(invalidPreferences);
    expect(result.success).toBe(false);
  });

  it("should reject invalid emojiStyle", () => {
    const invalidPreferences = {
      responseStyle: "detailed",
      proactiveReminders: true,
      academicCitations: false,
      codeBlocks: true,
      emojiStyle: "super_rich",
      language: "zh-CN",
    };

    const result = PersonaPreferencesSchema.safeParse(invalidPreferences);
    expect(result.success).toBe(false);
  });

  it("should reject missing required fields", () => {
    const incompletePreferences = {
      responseStyle: "detailed",
    };

    const result = PersonaPreferencesSchema.safeParse(incompletePreferences);
    expect(result.success).toBe(false);
  });
});

describe("UpdatePersonaSchema", () => {
  const validPreferences = {
    responseStyle: "detailed" as const,
    proactiveReminders: true,
    academicCitations: false,
    codeBlocks: true,
    emojiStyle: "minimal" as const,
    language: "zh-CN" as const,
  };

  it("should validate valid update request", () => {
    const validUpdate = {
      primaryType: "pm",
      group: "tech",
      preferences: validPreferences,
      source: "settings",
    };

    const result = UpdatePersonaSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });

  it("should accept all valid source types", () => {
    const sources = ["registration", "settings", "inferred"];

    for (const source of sources) {
      const update = {
        primaryType: "pm",
        group: "tech",
        preferences: validPreferences,
        source,
      };

      const result = UpdatePersonaSchema.safeParse(update);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid source", () => {
    const invalidUpdate = {
      primaryType: "pm",
      group: "tech",
      preferences: validPreferences,
      source: "manual",
    };

    const result = UpdatePersonaSchema.safeParse(invalidUpdate);
    expect(result.success).toBe(false);
  });
});

describe("Persona Type and Group Validation", () => {
  it("should have valid group mappings for all persona types", () => {
    const knownPersonaTypes: PersonaType[] = [
      "pm",
      "indie_dev",
      "consultant",
      "phd",
      "master",
      "teacher",
      "knowledge_blogger",
    ];

    for (const personaType of knownPersonaTypes) {
      const group = PERSONA_GROUP_MAP[personaType];
      expect(group).toBeDefined();
      expect(typeof group).toBe("string");
    }
  });

  it("should validate pm belongs to design group", () => {
    expect(PERSONA_GROUP_MAP["pm"]).toBe("design");
  });

  it("should validate indie_dev belongs to tech group", () => {
    expect(PERSONA_GROUP_MAP["indie_dev"]).toBe("tech");
  });

  it("should validate phd belongs to academic group", () => {
    expect(PERSONA_GROUP_MAP["phd"]).toBe("academic");
  });

  it("should validate knowledge_blogger belongs to content group", () => {
    expect(PERSONA_GROUP_MAP["knowledge_blogger"]).toBe("content");
  });

  it("should validate consultant belongs to professional group", () => {
    expect(PERSONA_GROUP_MAP["consultant"]).toBe("professional");
  });
});

// =============================================================================
// 行为数据构建测试
// =============================================================================

describe("buildBehaviorData", () => {
  it("should build behavior data from bookmarks", () => {
    const bookmarks: BookmarkData[] = [
      {
        ai_tags: ["技术", "编程"],
        platform: "微信公众号",
        url: "https://mp.weixin.qq.com/s/abc123",
        created_at: new Date().toISOString(),
      },
      {
        ai_tags: ["技术", "AI"],
        platform: "知乎",
        url: "https://www.zhihu.com/question/123",
        created_at: new Date().toISOString(),
      },
    ];

    const result = buildBehaviorData(bookmarks);

    expect(result.tags).toContain("技术");
    expect(result.tags).toContain("编程");
    expect(result.tags).toContain("AI");
    expect(result.tagCounts["技术"]).toBe(2);
    expect(result.platforms).toContain("微信公众号");
    expect(result.platforms).toContain("知乎");
    expect(result.domains).toContain("mp.weixin.qq.com");
    expect(result.domains).toContain("www.zhihu.com");
    expect(result.activityMetrics.totalBookmarks).toBe(2);
  });

  it("should handle empty bookmarks", () => {
    const result = buildBehaviorData([]);

    expect(result.tags).toHaveLength(0);
    expect(result.platforms).toHaveLength(0);
    expect(result.domains).toHaveLength(0);
    expect(result.activityMetrics.totalBookmarks).toBe(0);
  });

  it("should handle bookmarks with null values", () => {
    const bookmarks: BookmarkData[] = [
      {
        ai_tags: null,
        platform: null,
        url: null,
        created_at: null,
      },
    ];

    const result = buildBehaviorData(bookmarks);

    expect(result.tags).toHaveLength(0);
    expect(result.platforms).toHaveLength(0);
    expect(result.domains).toHaveLength(0);
    expect(result.activityMetrics.totalBookmarks).toBe(1);
    expect(result.activityMetrics.recentWeekCount).toBe(0);
  });

  it("should handle invalid URLs gracefully", () => {
    const bookmarks: BookmarkData[] = [
      {
        ai_tags: ["test"],
        platform: "test",
        url: "not-a-valid-url",
        created_at: new Date().toISOString(),
      },
    ];

    // Should not throw
    const result = buildBehaviorData(bookmarks);
    expect(result.domains).toHaveLength(0);
    expect(result.tags).toContain("test");
  });

  it("should calculate recent activity correctly", () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const bookmarks: BookmarkData[] = [
      {
        ai_tags: null,
        platform: null,
        url: null,
        created_at: now.toISOString(),
      },
      {
        ai_tags: null,
        platform: null,
        url: null,
        created_at: yesterday.toISOString(),
      },
      {
        ai_tags: null,
        platform: null,
        url: null,
        created_at: twoWeeksAgo.toISOString(),
      },
      {
        ai_tags: null,
        platform: null,
        url: null,
        created_at: twoMonthsAgo.toISOString(),
      },
    ];

    const result = buildBehaviorData(bookmarks);

    expect(result.activityMetrics.totalBookmarks).toBe(4);
    expect(result.activityMetrics.recentWeekCount).toBe(2); // now + yesterday
    expect(result.activityMetrics.recentMonthCount).toBe(3); // now + yesterday + twoWeeksAgo
  });

  it("should deduplicate tags", () => {
    const bookmarks: BookmarkData[] = [
      {
        ai_tags: ["技术", "技术", "编程"],
        platform: null,
        url: null,
        created_at: null,
      },
      { ai_tags: ["技术"], platform: null, url: null, created_at: null },
    ];

    const result = buildBehaviorData(bookmarks);

    // tags array should be deduplicated
    expect(result.tags).toEqual(["技术", "编程"]);
    // but counts should reflect total occurrences
    expect(result.tagCounts["技术"]).toBe(3);
    expect(result.tagCounts["编程"]).toBe(1);
  });
});

// =============================================================================
// 灰度和回滚集成测试
// =============================================================================

describe("Persona Rollout Integration", () => {
  it("should export rollout functions from config", () => {
    expect(typeof isUserInPersonaRollout).toBe("function");
    expect(typeof isPersonaFeatureEnabled).toBe("function");
    expect(typeof getCurrentPersonaStage).toBe("function");
  });
});
