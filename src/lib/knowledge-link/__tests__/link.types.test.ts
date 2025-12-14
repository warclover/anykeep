/**
 * Link Types Tests
 *
 * 验证知识关联类型定义和常量导出
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import {
  LINK_TYPE_LABELS,
  LINK_TYPE_ICONS,
  DEFAULT_DISCOVERY_OPTIONS,
  DEFAULT_LINK_SERVICE_CONFIG,
  type LinkType,
  type KnowledgeLink,
  type RelatedBookmark,
  type LinkEvidence,
  type KnowledgeGraphStats,
} from "../types/link.types";

// ============================================================================
// Tests: Constants
// ============================================================================

describe("Link Type Constants", () => {
  describe("LINK_TYPE_LABELS", () => {
    it("should have labels for all link types", () => {
      const linkTypes: LinkType[] = ["semantic", "entity", "tag", "topic"];

      for (const type of linkTypes) {
        expect(LINK_TYPE_LABELS[type]).toBeDefined();
        expect(typeof LINK_TYPE_LABELS[type]).toBe("string");
      }
    });

    it("should have correct Chinese labels", () => {
      expect(LINK_TYPE_LABELS.semantic).toBe("语义相似");
      expect(LINK_TYPE_LABELS.entity).toBe("共享实体");
      expect(LINK_TYPE_LABELS.tag).toBe("共享标签");
      expect(LINK_TYPE_LABELS.topic).toBe("同主题");
    });
  });

  describe("LINK_TYPE_ICONS", () => {
    it("should have icons for all link types", () => {
      const linkTypes: LinkType[] = ["semantic", "entity", "tag", "topic"];

      for (const type of linkTypes) {
        expect(LINK_TYPE_ICONS[type]).toBeDefined();
        expect(typeof LINK_TYPE_ICONS[type]).toBe("string");
      }
    });
  });
});

// ============================================================================
// Tests: Default Configs
// ============================================================================

describe("Default Configurations", () => {
  describe("DEFAULT_DISCOVERY_OPTIONS", () => {
    it("should have semantic config", () => {
      expect(DEFAULT_DISCOVERY_OPTIONS.semantic).toBeDefined();
      expect(DEFAULT_DISCOVERY_OPTIONS.semantic?.enabled).toBe(true);
      expect(DEFAULT_DISCOVERY_OPTIONS.semantic?.minSimilarity).toBeGreaterThan(
        0,
      );
      expect(DEFAULT_DISCOVERY_OPTIONS.semantic?.limit).toBeGreaterThan(0);
    });

    it("should have entity config", () => {
      expect(DEFAULT_DISCOVERY_OPTIONS.entity).toBeDefined();
      expect(DEFAULT_DISCOVERY_OPTIONS.entity?.enabled).toBe(true);
      expect(
        DEFAULT_DISCOVERY_OPTIONS.entity?.minShared,
      ).toBeGreaterThanOrEqual(1);
    });

    it("should have tag config", () => {
      expect(DEFAULT_DISCOVERY_OPTIONS.tag).toBeDefined();
      expect(DEFAULT_DISCOVERY_OPTIONS.tag?.enabled).toBe(true);
      expect(DEFAULT_DISCOVERY_OPTIONS.tag?.minShared).toBeGreaterThanOrEqual(
        1,
      );
    });
  });

  describe("DEFAULT_LINK_SERVICE_CONFIG", () => {
    it("should have all required fields", () => {
      expect(DEFAULT_LINK_SERVICE_CONFIG.enableSemantic).toBeDefined();
      expect(DEFAULT_LINK_SERVICE_CONFIG.enableEntity).toBeDefined();
      expect(DEFAULT_LINK_SERVICE_CONFIG.enableTag).toBeDefined();
      expect(DEFAULT_LINK_SERVICE_CONFIG.semanticThreshold).toBeDefined();
      expect(DEFAULT_LINK_SERVICE_CONFIG.entityMinShared).toBeDefined();
      expect(DEFAULT_LINK_SERVICE_CONFIG.tagMinShared).toBeDefined();
      expect(DEFAULT_LINK_SERVICE_CONFIG.maxLinksPerType).toBeDefined();
      expect(DEFAULT_LINK_SERVICE_CONFIG.emitEvents).toBeDefined();
    });

    it("should have sensible default values", () => {
      expect(DEFAULT_LINK_SERVICE_CONFIG.enableSemantic).toBe(true);
      expect(DEFAULT_LINK_SERVICE_CONFIG.enableEntity).toBe(true);
      expect(DEFAULT_LINK_SERVICE_CONFIG.enableTag).toBe(true);
      expect(DEFAULT_LINK_SERVICE_CONFIG.semanticThreshold).toBeGreaterThan(0);
      expect(DEFAULT_LINK_SERVICE_CONFIG.semanticThreshold).toBeLessThanOrEqual(
        1,
      );
    });
  });
});

// ============================================================================
// Tests: Type Shapes
// ============================================================================

describe("Type Shapes", () => {
  it("should create valid KnowledgeLink object", () => {
    const link: KnowledgeLink = {
      id: "link-123",
      userId: "user-uuid",
      sourceBookmarkId: 1,
      targetBookmarkId: 2,
      linkType: "entity",
      strength: 0.8,
      evidence: {
        type: "entity",
        score: 0.8,
        details: {
          sharedEntities: ["React", "TypeScript"],
        },
      },
      createdAt: new Date().toISOString(),
    };

    expect(link.id).toBe("link-123");
    expect(link.linkType).toBe("entity");
    expect(link.strength).toBe(0.8);
  });

  it("should create valid RelatedBookmark object", () => {
    const related: RelatedBookmark = {
      bookmark: {
        id: 456,
        title: "Test Bookmark",
        url: "https://example.com",
        favicon: "https://example.com/favicon.ico",
        platform: "article",
      },
      link: {
        type: "semantic",
        strength: 0.75,
        sharedItems: [],
      },
    };

    expect(related.bookmark.id).toBe(456);
    expect(related.link.type).toBe("semantic");
    expect(related.link.strength).toBe(0.75);
  });

  it("should create valid LinkEvidence object", () => {
    const evidence: LinkEvidence = {
      type: "tag",
      score: 0.6,
      details: {
        sharedTags: ["JavaScript", "前端"],
      },
    };

    expect(evidence.type).toBe("tag");
    expect(evidence.details.sharedTags).toContain("JavaScript");
  });

  it("should create valid KnowledgeGraphStats object", () => {
    const stats: KnowledgeGraphStats = {
      totalBookmarks: 100,
      totalLinks: 250,
      avgLinksPerBookmark: 5,
      linksByType: {
        semantic: 100,
        entity: 80,
        tag: 50,
        topic: 20,
      },
      linksByStrength: {
        strong: 50,
        medium: 120,
        weak: 80,
      },
    };

    expect(stats.totalBookmarks).toBe(100);
    expect(stats.linksByType.semantic).toBe(100);
    expect(stats.linksByStrength.strong).toBe(50);
  });
});
