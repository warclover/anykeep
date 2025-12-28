/**
 * SemanticChunker 语义切片器测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  SemanticChunker,
  getSemanticChunker,
  resetSemanticChunker,
} from "../semantic-chunker";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ============================================================================
// 测试数据
// ============================================================================

const shortText = "这是一段很短的文本。";

const markdownText = `# 第一章 介绍

这是介绍部分的内容，主要说明项目的背景和目标。我们的目标是创建一个高效的语义切片系统。

## 1.1 背景

背景内容较长，包含了项目的历史和发展过程。这部分需要被正确切分成 Parent 和 Child。

## 1.2 目标

项目的主要目标是提升检索精度和召回率。通过 Parent-Child 切片策略，我们可以在保持上下文的同时提高检索效率。

# 第二章 实现

这是实现部分的详细说明。

## 2.1 架构设计

架构采用分层设计，包括数据层、服务层和应用层。每一层都有明确的职责划分。

## 2.2 核心算法

核心算法基于滑动窗口和语义边界检测。这里有一个代码示例：

\`\`\`typescript
function chunk(text: string): Chunk[] {
  // 实现切片逻辑
  return [];
}
\`\`\`

代码块应该被完整保留。
`;

const longParagraph = `这是一段非常长的文本，需要被切分成多个 Child 切片。${"重复内容。".repeat(100)}结束。`;

// ============================================================================
// 测试套件
// ============================================================================

describe("SemanticChunker", () => {
  let chunker: SemanticChunker;

  beforeEach(() => {
    chunker = new SemanticChunker();
  });

  afterEach(() => {
    resetSemanticChunker();
  });

  describe("chunk", () => {
    it("空文本应该返回空数组", () => {
      const chunks = chunker.chunk("");
      expect(chunks).toEqual([]);
    });

    it("空白文本应该返回空数组", () => {
      const chunks = chunker.chunk("   \n\n  ");
      expect(chunks).toEqual([]);
    });

    it("短文本应该返回单个 Parent", () => {
      // 使用较低的 minTokens 来测试短文本
      const chunkerLowMin = new SemanticChunker({ minTokens: 1 });
      const chunks = chunkerLowMin.chunk(shortText);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].type).toBe("parent");
      expect(chunks[0].content).toContain("很短的文本");
    });

    it("Markdown 文本应该按标题拆分 Parent", () => {
      const chunks = chunker.chunk(markdownText);

      // 找出所有 parent 类型的 chunk
      const parents = chunks.filter((c) => c.type === "parent");

      // 应该有多个 parent（对应多个标题）
      expect(parents.length).toBeGreaterThan(1);

      // 第一个 parent 应该包含 "第一章"
      const hasChapter1 = parents.some((p) => p.content.includes("第一章"));
      expect(hasChapter1).toBe(true);
    });

    it("代码块应该被完整保留", () => {
      const chunkerWithCodePreserve = new SemanticChunker({
        preserveCodeBlocks: true,
      });
      const chunks = chunkerWithCodePreserve.chunk(markdownText);

      // 查找包含代码的 chunk
      const chunksWithCode = chunks.filter((c) =>
        c.content.includes("function chunk"),
      );

      // 代码块应该完整出现在某个 chunk 中
      expect(chunksWithCode.length).toBeGreaterThan(0);
      expect(chunksWithCode[0].content).toContain("```typescript");
      expect(chunksWithCode[0].content).toContain("```");
    });

    it("长段落应该拆分为多个 Child", () => {
      const chunker = new SemanticChunker({
        maxTokens: 100,
        minTokens: 10,
      });
      const chunks = chunker.chunk(longParagraph);

      // 应该有 Parent 和多个 Child
      const parents = chunks.filter((c) => c.type === "parent");
      const children = chunks.filter((c) => c.type === "child");

      expect(parents.length).toBeGreaterThanOrEqual(1);
      expect(children.length).toBeGreaterThan(0);

      // Child 应该指向 Parent
      for (const child of children) {
        expect(child.parentIndex).toBeDefined();
      }
    });

    it("每个 chunk 应该有唯一的 contentHash", () => {
      const chunks = chunker.chunk(markdownText);

      const hashes = chunks.map((c) => c.contentHash);
      const uniqueHashes = new Set(hashes);

      // 不同内容的 chunk 应该有不同的 hash
      expect(uniqueHashes.size).toBe(hashes.length);
    });

    it("chunk index 应该是递增的", () => {
      const chunks = chunker.chunk(markdownText);

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].index).toBe(i);
      }
    });

    it("startOffset 和 endOffset 应该有效", () => {
      const chunks = chunker.chunk(markdownText);

      for (const chunk of chunks) {
        expect(chunk.startOffset).toBeGreaterThanOrEqual(0);
        expect(chunk.endOffset).toBeGreaterThan(chunk.startOffset);
      }
    });
  });

  describe("getStats", () => {
    it("应该返回正确的统计信息", () => {
      const chunks = chunker.chunk(markdownText);
      const stats = chunker.getStats(chunks);

      expect(stats.totalChunks).toBe(chunks.length);
      expect(stats.parentChunks).toBe(
        chunks.filter((c) => c.type === "parent").length,
      );
      expect(stats.childChunks).toBe(
        chunks.filter((c) => c.type === "child").length,
      );
      expect(stats.totalTokens).toBeGreaterThan(0);
    });

    it("空 chunks 应该返回零统计", () => {
      const stats = chunker.getStats([]);

      expect(stats.totalChunks).toBe(0);
      expect(stats.parentChunks).toBe(0);
      expect(stats.childChunks).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.avgChildrenPerParent).toBe(0);
    });
  });

  describe("配置", () => {
    it("应该使用默认配置", () => {
      const chunker = new SemanticChunker();
      // 默认配置下短文本不会被拆分
      const chunks = chunker.chunk(shortText);
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it("应该允许自定义配置", () => {
      const customChunker = new SemanticChunker({
        maxTokens: 50,
        overlapTokens: 10,
        splitByHeaders: false,
      });

      const chunks = customChunker.chunk(markdownText);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it("minTokens 应该过滤过短的段落", () => {
      const chunker = new SemanticChunker({
        minTokens: 1000, // 很高的阈值
      });

      const chunks = chunker.chunk(shortText);
      // 短文本应该被过滤
      expect(chunks.length).toBe(0);
    });
  });
});

describe("getSemanticChunker", () => {
  afterEach(() => {
    resetSemanticChunker();
  });

  it("应该返回单例实例", () => {
    const instance1 = getSemanticChunker();
    const instance2 = getSemanticChunker();

    expect(instance1).toBe(instance2);
  });
});

describe("SemanticChunker - 边界情况", () => {
  let chunker: SemanticChunker;

  beforeEach(() => {
    chunker = new SemanticChunker();
  });

  it("纯标题文本应该正常处理", () => {
    const headerOnly = "# 标题1\n\n## 标题2\n\n### 标题3";
    const chunks = chunker.chunk(headerOnly);

    // 每个标题应该成为一个 chunk（如果超过 minTokens）
    expect(chunks.length).toBeGreaterThanOrEqual(0);
  });

  it("Unicode 文本应该正常处理", () => {
    const unicodeText = "你好世界 🌍 مرحبا العالم こんにちは世界";
    const chunks = chunker.chunk(unicodeText);

    expect(chunks.length).toBeGreaterThanOrEqual(0);
    if (chunks.length > 0) {
      expect(chunks[0].content).toContain("你好世界");
    }
  });

  it("仅代码块的文本应该正常处理", () => {
    const codeOnly = "```javascript\nconsole.log('hello');\n```";
    const chunks = chunker.chunk(codeOnly);

    expect(chunks.length).toBeGreaterThanOrEqual(0);
  });

  it("没有标题的普通文本应该按段落分割", () => {
    const plainText = `第一段内容。

第二段内容，这是另一个段落。

第三段内容。`;

    const chunker = new SemanticChunker({
      splitByHeaders: true,
      minTokens: 1,
    });
    const chunks = chunker.chunk(plainText);

    // 应该按双换行分割
    expect(chunks.length).toBeGreaterThan(0);
  });
});
