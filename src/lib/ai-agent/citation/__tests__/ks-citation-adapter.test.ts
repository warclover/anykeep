/**
 * KS Citation Adapter - 单元测试
 * @module ai-agent/citation
 */

import {
  toKSCitation,
  toAgentCitation,
  toKSCitations,
  toAgentCitations,
  formatCitationAsFootnote,
  generateReferencesSection,
  extractUsedCitationIndices,
  validateCitations,
  mergeCitations,
} from "../ks-citation-adapter";
import type { Citation as AgentCitation } from "../types";
import type { Citation as KSCitation } from "@/lib/knowledge-studio/types";

describe("KS Citation Adapter", () => {
  describe("toKSCitation", () => {
    it("should convert agent citation to KS format", () => {
      const agentCitation: AgentCitation = {
        index: 1,
        bookmarkId: 123,
        title: "Test Article",
        url: "https://example.com/article",
        summary: "This is a summary",
        platform: "web",
        relevanceScore: 0.85,
      };

      const ksCitation = toKSCitation(agentCitation);

      expect(ksCitation.bookmarkId).toBe("123");
      expect(ksCitation.title).toBe("Test Article");
      expect(ksCitation.url).toBe("https://example.com/article");
      expect(ksCitation.excerpt).toBe("This is a summary");
      expect(ksCitation.position).toBe(1);
    });

    it("should use custom position when provided", () => {
      const agentCitation: AgentCitation = {
        index: 1,
        bookmarkId: 123,
        title: "Test",
        url: "https://example.com",
      };

      const ksCitation = toKSCitation(agentCitation, 5);
      expect(ksCitation.position).toBe(5);
    });

    it("should handle missing summary", () => {
      const agentCitation: AgentCitation = {
        index: 2,
        bookmarkId: 456,
        title: "No Summary",
        url: "https://example.com",
      };

      const ksCitation = toKSCitation(agentCitation);
      expect(ksCitation.excerpt).toBe("");
    });
  });

  describe("toAgentCitation", () => {
    it("should convert KS citation to agent format", () => {
      const ksCitation: KSCitation = {
        bookmarkId: "789",
        title: "KS Article",
        url: "https://example.com/ks",
        excerpt: "An excerpt from the article",
        position: 3,
      };

      const agentCitation = toAgentCitation(ksCitation, 3);

      expect(agentCitation.index).toBe(3);
      expect(agentCitation.bookmarkId).toBe(789);
      expect(agentCitation.title).toBe("KS Article");
      expect(agentCitation.url).toBe("https://example.com/ks");
      expect(agentCitation.summary).toBe("An excerpt from the article");
    });
  });

  describe("toKSCitations / toAgentCitations", () => {
    it("should batch convert agent citations to KS format", () => {
      const agentCitations: AgentCitation[] = [
        { index: 1, bookmarkId: 1, title: "A", url: "https://a.com" },
        { index: 2, bookmarkId: 2, title: "B", url: "https://b.com" },
      ];

      const ksCitations = toKSCitations(agentCitations);

      expect(ksCitations).toHaveLength(2);
      expect(ksCitations[0].position).toBe(1);
      expect(ksCitations[1].position).toBe(2);
    });

    it("should batch convert KS citations to agent format", () => {
      const ksCitations: KSCitation[] = [
        {
          bookmarkId: "10",
          title: "X",
          url: "https://x.com",
          excerpt: "",
          position: 1,
        },
        {
          bookmarkId: "20",
          title: "Y",
          url: "https://y.com",
          excerpt: "",
          position: 2,
        },
      ];

      const agentCitations = toAgentCitations(ksCitations);

      expect(agentCitations).toHaveLength(2);
      expect(agentCitations[0].bookmarkId).toBe(10);
      expect(agentCitations[1].bookmarkId).toBe(20);
    });
  });

  describe("formatCitationAsFootnote", () => {
    it("should format citation as markdown footnote", () => {
      const citation: KSCitation = {
        bookmarkId: "1",
        title: "My Article",
        url: "https://example.com/my-article",
        excerpt: "",
        position: 1,
      };

      const footnote = formatCitationAsFootnote(citation);
      expect(footnote).toBe(
        "[^1]: My Article - https://example.com/my-article",
      );
    });
  });

  describe("generateReferencesSection", () => {
    it("should generate markdown references section", () => {
      const citations: KSCitation[] = [
        {
          bookmarkId: "1",
          title: "First",
          url: "https://a.com",
          excerpt: "",
          position: 1,
        },
        {
          bookmarkId: "2",
          title: "Second",
          url: "https://b.com",
          excerpt: "",
          position: 2,
        },
      ];

      const section = generateReferencesSection(citations);

      expect(section).toContain("## 参考来源");
      expect(section).toContain("[^1]: First - https://a.com");
      expect(section).toContain("[^2]: Second - https://b.com");
    });

    it("should return empty string for no citations", () => {
      const section = generateReferencesSection([]);
      expect(section).toBe("");
    });

    it("should use custom title", () => {
      const citations: KSCitation[] = [
        {
          bookmarkId: "1",
          title: "Test",
          url: "https://test.com",
          excerpt: "",
          position: 1,
        },
      ];

      const section = generateReferencesSection(citations, "引用来源");
      expect(section).toContain("## 引用来源");
    });
  });

  describe("extractUsedCitationIndices", () => {
    it("should extract citation indices from text", () => {
      const text = "This is some text[^1] with citations[^3] and more[^2].";
      const indices = extractUsedCitationIndices(text);

      expect(indices).toEqual([1, 2, 3]);
    });

    it("should return empty array for text without citations", () => {
      const text = "No citations here.";
      const indices = extractUsedCitationIndices(text);

      expect(indices).toEqual([]);
    });

    it("should deduplicate indices", () => {
      const text = "Same citation[^1] used twice[^1].";
      const indices = extractUsedCitationIndices(text);

      expect(indices).toEqual([1]);
    });
  });

  describe("validateCitations", () => {
    it("should return valid when all citations are present", () => {
      const text = "Text with[^1] citations[^2].";
      const citations: KSCitation[] = [
        {
          bookmarkId: "1",
          title: "A",
          url: "https://a.com",
          excerpt: "",
          position: 1,
        },
        {
          bookmarkId: "2",
          title: "B",
          url: "https://b.com",
          excerpt: "",
          position: 2,
        },
      ];

      const result = validateCitations(text, citations);

      expect(result.isValid).toBe(true);
      expect(result.missingIndices).toEqual([]);
    });

    it("should detect missing citations", () => {
      const text = "Text with[^1] and[^3].";
      const citations: KSCitation[] = [
        {
          bookmarkId: "1",
          title: "A",
          url: "https://a.com",
          excerpt: "",
          position: 1,
        },
      ];

      const result = validateCitations(text, citations);

      expect(result.isValid).toBe(false);
      expect(result.missingIndices).toEqual([3]);
    });

    it("should detect unused citations", () => {
      const text = "Only[^1] used.";
      const citations: KSCitation[] = [
        {
          bookmarkId: "1",
          title: "A",
          url: "https://a.com",
          excerpt: "",
          position: 1,
        },
        {
          bookmarkId: "2",
          title: "B",
          url: "https://b.com",
          excerpt: "",
          position: 2,
        },
      ];

      const result = validateCitations(text, citations);

      expect(result.unusedCitations).toHaveLength(1);
      expect(result.unusedCitations[0].bookmarkId).toBe("2");
    });
  });

  describe("mergeCitations", () => {
    it("should merge citations without duplicates", () => {
      const existing: KSCitation[] = [
        {
          bookmarkId: "1",
          title: "A",
          url: "https://a.com",
          excerpt: "",
          position: 1,
        },
      ];
      const newCitations: KSCitation[] = [
        {
          bookmarkId: "2",
          title: "B",
          url: "https://b.com",
          excerpt: "",
          position: 0,
        },
        {
          bookmarkId: "3",
          title: "C",
          url: "https://c.com",
          excerpt: "",
          position: 0,
        },
      ];

      const merged = mergeCitations(existing, newCitations);

      expect(merged).toHaveLength(3);
      expect(merged[1].position).toBe(2);
      expect(merged[2].position).toBe(3);
    });

    it("should skip duplicate URLs", () => {
      const existing: KSCitation[] = [
        {
          bookmarkId: "1",
          title: "A",
          url: "https://a.com",
          excerpt: "",
          position: 1,
        },
      ];
      const newCitations: KSCitation[] = [
        {
          bookmarkId: "1",
          title: "A Duplicate",
          url: "https://a.com",
          excerpt: "",
          position: 0,
        },
        {
          bookmarkId: "2",
          title: "B",
          url: "https://b.com",
          excerpt: "",
          position: 0,
        },
      ];

      const merged = mergeCitations(existing, newCitations);

      expect(merged).toHaveLength(2);
      expect(merged[0].title).toBe("A"); // Original kept
      expect(merged[1].url).toBe("https://b.com");
    });
  });
});
