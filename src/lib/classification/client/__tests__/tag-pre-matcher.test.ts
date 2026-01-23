/**
 * 客户端标签预匹配器单元测试
 *
 * @module @/lib/classification/client/__tests__/tag-pre-matcher.test
 */

import { TagPreMatcher, type CachedFolder } from "../tag-pre-matcher";

describe("TagPreMatcher", () => {
  let matcher: TagPreMatcher;

  beforeEach(() => {
    matcher = new TagPreMatcher();
  });

  describe("normalize", () => {
    it("should normalize Vue.js to vuejs", () => {
      expect(matcher.normalize("Vue.js")).toBe("vuejs");
      expect(matcher.normalize("VueJS")).toBe("vuejs");
      expect(matcher.normalize("vue.js")).toBe("vuejs");
    });

    it("should normalize Next.js to nextjs", () => {
      expect(matcher.normalize("Next.js")).toBe("nextjs");
      expect(matcher.normalize("NextJS")).toBe("nextjs");
    });

    it("should normalize C++ to cpp", () => {
      expect(matcher.normalize("C++")).toBe("cpp");
      expect(matcher.normalize("c++")).toBe("cpp");
    });

    it("should normalize C# to csharp", () => {
      expect(matcher.normalize("C#")).toBe("csharp");
      expect(matcher.normalize("c#")).toBe("csharp");
    });

    it("should handle Chinese characters", () => {
      expect(matcher.normalize("前端开发")).toBe("前端开发");
      expect(matcher.normalize("独立开发与产品策略")).toBe(
        "独立开发与产品策略",
      );
    });

    it("should remove special characters", () => {
      expect(matcher.normalize("Hello World!")).toBe("helloworld");
      expect(matcher.normalize("test@example")).toBe("testexample");
      expect(matcher.normalize("React-Native")).toBe("reactnative");
    });

    it("should handle empty and invalid input", () => {
      expect(matcher.normalize("")).toBe("");
      expect(matcher.normalize("   ")).toBe("");
      expect(matcher.normalize(null as any)).toBe("");
      expect(matcher.normalize(undefined as any)).toBe("");
    });
  });

  describe("expandTags", () => {
    it("should expand JavaScript to include js", () => {
      const expanded = matcher.expandTags(["javascript"]);
      expect(expanded).toContain("javascript");
      expect(expanded).toContain("js");
    });

    it("should expand TypeScript to include ts", () => {
      const expanded = matcher.expandTags(["typescript"]);
      expect(expanded).toContain("typescript");
      expect(expanded).toContain("ts");
    });

    it("should expand Golang to include go", () => {
      const expanded = matcher.expandTags(["golang"]);
      expect(expanded).toContain("golang");
      expect(expanded).toContain("go");
    });

    it("should handle multiple tags", () => {
      const expanded = matcher.expandTags(["javascript", "react"]);
      expect(expanded).toContain("javascript");
      expect(expanded).toContain("js");
      expect(expanded).toContain("react");
      expect(expanded).toContain("reactjs");
    });

    it("should normalize tags during expansion", () => {
      const expanded = matcher.expandTags(["Vue.js"]);
      expect(expanded).toContain("vuejs");
      expect(expanded).toContain("vue");
    });

    it("should handle empty input", () => {
      const expanded = matcher.expandTags([]);
      expect(expanded).toHaveLength(0);
    });
  });

  describe("match - exact matching", () => {
    const folders: CachedFolder[] = [
      {
        id: "1",
        name: "Vue.js",
        normalizedName: "vuejs",
        aliases: [],
        coreTags: [],
      },
      {
        id: "2",
        name: "React",
        normalizedName: "react",
        aliases: [],
        coreTags: [],
      },
      {
        id: "3",
        name: "前端开发",
        normalizedName: "前端开发",
        aliases: [],
        coreTags: [],
      },
    ];

    it("should exact match normalized folder name", () => {
      const result = matcher.match(["vuejs"], folders);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("1");
      expect(result.folderName).toBe("Vue.js");
      expect(result.matchMode).toBe("exact");
      expect(result.confidence).toBe(0.98);
      expect(result.needsServerValidation).toBe(false);
    });

    it("should match Vue.js variations", () => {
      const result1 = matcher.match(["Vue.js"], folders);
      expect(result1.matched).toBe(true);
      expect(result1.folderId).toBe("1");

      const result2 = matcher.match(["VueJS"], folders);
      expect(result2.matched).toBe(true);
      expect(result2.folderId).toBe("1");
    });

    it("should match Chinese folder names", () => {
      const result = matcher.match(["前端开发"], folders);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("3");
      expect(result.folderName).toBe("前端开发");
    });

    it("should return no match for non-matching tags", () => {
      const result = matcher.match(["angular"], folders);

      expect(result.matched).toBe(false);
      expect(result.folderId).toBeNull();
      expect(result.matchMode).toBe("none");
    });
  });

  describe("match - alias matching", () => {
    const folders: CachedFolder[] = [
      {
        id: "1",
        name: "JavaScript",
        normalizedName: "javascript",
        aliases: ["js", "ecmascript"],
        coreTags: [],
      },
      {
        id: "2",
        name: "TypeScript",
        normalizedName: "typescript",
        aliases: ["ts"],
        coreTags: [],
      },
    ];

    it("should match folder by alias", () => {
      const result = matcher.match(["js"], folders);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("1");
      expect(result.matchMode).toBe("normalized");
      expect(result.confidence).toBe(0.95);
    });

    it("should match ts alias to TypeScript", () => {
      const result = matcher.match(["ts"], folders);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("2");
      expect(result.folderName).toBe("TypeScript");
    });
  });

  describe("match - partial matching", () => {
    const folders: CachedFolder[] = [
      {
        id: "1",
        name: "ReactJS",
        normalizedName: "reactjs",
        aliases: [],
        coreTags: [],
      },
      {
        id: "2",
        name: "JavaScript",
        normalizedName: "javascript",
        aliases: [],
        coreTags: [],
      },
    ];

    it("should partial match React to ReactJS (ratio > 0.7)", () => {
      const result = matcher.match(["react"], folders);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("1");
      expect(result.matchMode).toBe("partial");
      expect(result.confidence).toBe(0.6);
      expect(result.needsServerValidation).toBe(true);
    });

    it("should NOT match Java to JavaScript (ratio < 0.7)", () => {
      // java (4 chars) vs javascript (10 chars) = 0.4 ratio
      const result = matcher.match(["java"], folders);

      // 由于同义词扩展，可能会有其他匹配
      // 但 Java 不应该匹配到 JavaScript
      if (result.matched && result.folderId === "2") {
        fail("Java should not match JavaScript");
      }
    });
  });

  describe("match - synonym expansion", () => {
    const folders: CachedFolder[] = [
      {
        id: "1",
        name: "JavaScript",
        normalizedName: "javascript",
        aliases: [],
        coreTags: [],
      },
      {
        id: "2",
        name: "Golang",
        normalizedName: "golang",
        aliases: ["go"],
        coreTags: [],
      },
    ];

    it("should match js to JavaScript via synonym expansion", () => {
      const result = matcher.match(["js"], folders);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("1");
    });

    it("should match go to Golang via synonym expansion", () => {
      const result = matcher.match(["go"], folders);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("2");
    });
  });

  describe("matchBatch", () => {
    const folders: CachedFolder[] = [
      {
        id: "1",
        name: "Vue.js",
        normalizedName: "vuejs",
        aliases: ["vue"],
        coreTags: [],
      },
      {
        id: "2",
        name: "React",
        normalizedName: "react",
        aliases: [],
        coreTags: [],
      },
    ];

    it("should batch match multiple items", () => {
      const items = [
        { id: "item1", tags: ["vuejs"] },
        { id: "item2", tags: ["react"] },
        { id: "item3", tags: ["angular"] },
      ];

      const results = matcher.matchBatch(items, folders);

      expect(results.size).toBe(3);
      expect(results.get("item1")?.matched).toBe(true);
      expect(results.get("item1")?.folderId).toBe("1");
      expect(results.get("item2")?.matched).toBe(true);
      expect(results.get("item2")?.folderId).toBe("2");
      expect(results.get("item3")?.matched).toBe(false);
    });
  });

  describe("getMatchStats", () => {
    it("should calculate correct stats", () => {
      const folders: CachedFolder[] = [
        {
          id: "1",
          name: "Vue.js",
          normalizedName: "vuejs",
          aliases: [],
          coreTags: [],
        },
      ];

      const items = [
        { id: "item1", tags: ["vuejs"] },
        { id: "item2", tags: ["react"] },
        { id: "item3", tags: ["angular"] },
      ];

      const results = matcher.matchBatch(items, folders);
      const stats = matcher.getMatchStats(results);

      expect(stats.total).toBe(3);
      expect(stats.matched).toBe(1);
      expect(stats.byMode["exact"]).toBe(1);
      expect(stats.needsServerValidation).toBe(2);
    });
  });

  describe("matchCoreTags", () => {
    const folders: CachedFolder[] = [
      {
        id: "1",
        name: "前端框架",
        normalizedName: "前端框架",
        aliases: [],
        coreTags: ["vuejs", "react", "angular"],
      },
      {
        id: "2",
        name: "后端技术",
        normalizedName: "后端技术",
        aliases: [],
        coreTags: ["nodejs", "python", "java"],
      },
    ];

    it("should match by core tags", () => {
      const result = matcher.matchCoreTags(["vuejs", "react"], folders);

      expect(result).not.toBeNull();
      expect(result?.folder.id).toBe("1");
      expect(result?.matchedTags).toContain("vuejs");
      expect(result?.matchedTags).toContain("react");
    });

    it("should return best match by score", () => {
      const result = matcher.matchCoreTags(["nodejs"], folders);

      expect(result).not.toBeNull();
      expect(result?.folder.id).toBe("2");
    });

    it("should return null when no core tags match", () => {
      const result = matcher.matchCoreTags(["rust"], folders);

      expect(result).toBeNull();
    });
  });

  describe("performance", () => {
    it("should match within 5ms for normal workload", () => {
      const folders: CachedFolder[] = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        name: `Folder ${i}`,
        normalizedName: `folder${i}`,
        aliases: [`alias${i}`],
        coreTags: [`tag${i}`],
      }));

      const result = matcher.match(["folder25"], folders);

      expect(result.latencyMs).toBeLessThan(5);
    });

    it("should batch match 100 items within 50ms", () => {
      const folders: CachedFolder[] = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        name: `Folder ${i}`,
        normalizedName: `folder${i}`,
        aliases: [],
        coreTags: [],
      }));

      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `item${i}`,
        tags: [`folder${i % 20}`],
      }));

      const startTime = performance.now();
      matcher.matchBatch(items, folders);
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("edge cases", () => {
    it("should handle empty folders list", () => {
      const result = matcher.match(["test"], []);

      expect(result.matched).toBe(false);
      expect(result.needsServerValidation).toBe(true);
    });

    it("should handle empty tags list", () => {
      const folders: CachedFolder[] = [
        {
          id: "1",
          name: "Test",
          normalizedName: "test",
          aliases: [],
          coreTags: [],
        },
      ];

      const result = matcher.match([], folders);

      expect(result.matched).toBe(false);
    });

    it("should handle very long tags", () => {
      const longTag = "a".repeat(1000);
      const result = matcher.match([longTag], []);

      expect(result.matched).toBe(false);
    });

    it("should handle special characters in tags", () => {
      const folders: CachedFolder[] = [
        {
          id: "1",
          name: "C++",
          normalizedName: "cpp",
          aliases: [],
          coreTags: [],
        },
      ];

      const result = matcher.match(["C++"], folders);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("1");
    });
  });

  describe("configuration", () => {
    it("should respect custom partialMatchMinRatio", () => {
      const strictMatcher = new TagPreMatcher({ partialMatchMinRatio: 0.9 });

      const folders: CachedFolder[] = [
        {
          id: "1",
          name: "ReactJS",
          normalizedName: "reactjs",
          aliases: [],
          coreTags: [],
        },
      ];

      // react (5) / reactjs (7) = 0.71, below 0.9
      const result = strictMatcher.match(["react"], folders);

      // Should not partial match with strict ratio
      expect(result.matchMode).not.toBe("partial");
    });

    it("should disable synonym expansion when configured", () => {
      const noSynonymMatcher = new TagPreMatcher({
        enableSynonymExpansion: false,
      });

      const expanded = noSynonymMatcher.expandTags(["javascript"]);

      expect(expanded).toContain("javascript");
      expect(expanded).not.toContain("js");
    });
  });
});
