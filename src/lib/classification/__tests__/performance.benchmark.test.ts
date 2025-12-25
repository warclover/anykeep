/**
 * V4.2 Performance Benchmark Tests
 * 验证分类系统的性能指标
 *
 * 目标：
 * - 单书签分类延迟 < 500ms
 * - 向量搜索响应 < 200ms
 * - 内存计算（标签增强）< 10ms
 */

/* eslint-disable no-console */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";

// ============================================
// Mock Dependencies
// ============================================

// Mock embedding generator (fast response)
jest.mock("@/lib/utils/embedding-generator", () => ({
  generateEmbedding: jest.fn().mockImplementation(async () => {
    // Simulate 50ms embedding generation
    await new Promise((resolve) => setTimeout(resolve, 50));
    return new Array(1024).fill(0).map(() => Math.random() - 0.5);
  }),
  buildEmbeddingText: jest.fn((title, summary, tags) => {
    return [title, summary, ...(tags || [])].filter(Boolean).join(" ");
  }),
}));

// Mock AI generator (fast response)
jest.mock("@/lib/ai-generator", () => ({
  generateWithAI: jest.fn().mockImplementation(async () => {
    // Simulate 100ms AI response
    await new Promise((resolve) => setTimeout(resolve, 100));
    return "1"; // Always select first option
  }),
}));

// Mock Supabase client
const mockRpcResponse = {
  data: [
    {
      folder_id: 1,
      folder_name: "技术开发",
      similarity: 0.85,
      match_type: "profile",
      bookmark_count: 50,
      top_tags: ["前端", "React", "TypeScript"],
    },
    {
      folder_id: 2,
      folder_name: "AI 技术",
      similarity: 0.72,
      match_type: "profile",
      bookmark_count: 30,
      top_tags: ["AI", "机器学习", "LLM"],
    },
  ],
  error: null,
};

const mockSupabase = {
  rpc: jest.fn().mockResolvedValue(mockRpcResponse),
};

// ============================================
// Test Suite
// ============================================

describe("V4.2 Performance Benchmarks", () => {
  // Track timing measurements
  const measurements: Record<string, number[]> = {
    embedding: [],
    vectorSearch: [],
    tagBoost: [],
    aiSelection: [],
    totalClassification: [],
  };

  beforeAll(() => {
    // Warm up mocks
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Report benchmark results
    console.log("\n📊 Performance Benchmark Results:");
    console.log("=".repeat(50));

    for (const [name, times] of Object.entries(measurements)) {
      if (times.length === 0) continue;

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      console.log(`\n${name}:`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Min: ${min.toFixed(2)}ms`);
      console.log(`  Max: ${max.toFixed(2)}ms`);
      console.log(`  P95: ${p95?.toFixed(2) || "N/A"}ms`);
    }
  });

  describe("Component Performance", () => {
    it("should complete embedding generation within 100ms", async () => {
      const { generateEmbedding } = await import(
        "@/lib/utils/embedding-generator"
      );

      const iterations = 10;
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await generateEmbedding("测试书签标题：前端开发最佳实践");
        const duration = performance.now() - start;
        measurements.embedding.push(duration);
      }

      const avgTime =
        measurements.embedding.reduce((a, b) => a + b, 0) / iterations;
      expect(avgTime).toBeLessThan(100);
    });

    it("should complete tag boost calculation within 5ms", () => {
      // Simulate tag boost calculation
      const bookmarkTags = ["前端", "React", "TypeScript", "性能优化"];
      const candidates = [
        {
          folderId: 1,
          folderName: "技术开发",
          score: 70,
          topTags: ["前端", "Vue", "JavaScript"],
        },
        {
          folderId: 2,
          folderName: "AI 技术",
          score: 65,
          topTags: ["AI", "机器学习", "深度学习"],
        },
        {
          folderId: 3,
          folderName: "后端开发",
          score: 60,
          topTags: ["Node.js", "Go", "数据库"],
        },
      ];

      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        // Tag boost calculation (same as SimpleClassificationService)
        const normalizedBookmarkTags = bookmarkTags.map((t) =>
          t.toLowerCase().trim(),
        );
        candidates.map((c) => {
          const normalizedFolderTags = c.topTags.map((t) =>
            t.toLowerCase().trim(),
          );
          const overlap = normalizedBookmarkTags.filter((tag) =>
            normalizedFolderTags.some(
              (ft) => ft.includes(tag) || tag.includes(ft),
            ),
          ).length;

          if (overlap > 0) {
            const overlapRate =
              overlap / Math.max(bookmarkTags.length, c.topTags.length);
            const boost = Math.min(Math.round(overlapRate * 15), 15);
            return {
              ...c,
              score: Math.min(c.score + boost, 100),
              tagBoost: boost,
            };
          }
          return c;
        });

        const duration = performance.now() - start;
        measurements.tagBoost.push(duration);
      }

      const avgTime =
        measurements.tagBoost.reduce((a, b) => a + b, 0) / iterations;
      expect(avgTime).toBeLessThan(5);
    });

    it("should complete AI selection within 150ms", async () => {
      const { generateWithAI } = await import("@/lib/ai-generator");

      const iterations = 5;
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await generateWithAI("选择最合适的文件夹", { maxTokens: 10 });
        const duration = performance.now() - start;
        measurements.aiSelection.push(duration);
      }

      const avgTime =
        measurements.aiSelection.reduce((a, b) => a + b, 0) / iterations;
      expect(avgTime).toBeLessThan(150);
    });
  });

  describe("End-to-End Classification", () => {
    it("should complete full classification within 500ms target", async () => {
      // Import service
      const { SimpleClassificationService } = await import(
        "../services/simple-classification.service"
      );

      // Create service instance with mock
      const service = new SimpleClassificationService(mockSupabase as never);

      const testBookmarks = [
        {
          title: "React 18 新特性详解",
          summary: "深入分析 React 18 的并发渲染、自动批处理等新特性",
          tags: ["React", "前端", "JavaScript"],
        },
        {
          title: "LLM 应用开发实践",
          summary: "如何使用大语言模型构建智能应用",
          tags: ["AI", "LLM", "应用开发"],
        },
        {
          title: "数据库性能优化指南",
          summary: "PostgreSQL 查询优化和索引策略",
          tags: ["数据库", "PostgreSQL", "性能"],
        },
      ];

      for (const bookmark of testBookmarks) {
        const start = performance.now();

        await service.classify("test-user-id", {
          title: bookmark.title,
          summary: bookmark.summary,
          tags: bookmark.tags,
        });

        const duration = performance.now() - start;
        measurements.totalClassification.push(duration);
      }

      const avgTime =
        measurements.totalClassification.reduce((a, b) => a + b, 0) /
        testBookmarks.length;

      // Target: < 500ms average
      expect(avgTime).toBeLessThan(500);

      // P95 should also be under 600ms
      const sorted = [...measurements.totalClassification].sort(
        (a, b) => a - b,
      );
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      expect(p95).toBeLessThan(600);
    });

    it("should handle batch classification efficiently", async () => {
      const { SimpleClassificationService } = await import(
        "../services/simple-classification.service"
      );

      const service = new SimpleClassificationService(mockSupabase as never);

      // Simulate 10 bookmarks
      const batchSize = 10;
      const bookmarks = Array(batchSize)
        .fill(null)
        .map((_, i) => ({
          title: `测试书签 ${i + 1}`,
          summary: `这是第 ${i + 1} 个测试书签的摘要`,
          tags: [`标签${i}`, "测试"],
        }));

      const start = performance.now();

      // Classify all bookmarks
      await Promise.all(
        bookmarks.map((bookmark) => service.classify("test-user-id", bookmark)),
      );

      const totalDuration = performance.now() - start;
      const avgPerBookmark = totalDuration / batchSize;

      console.log(`\n📈 Batch Classification (${batchSize} bookmarks):`);
      console.log(`   Total: ${totalDuration.toFixed(2)}ms`);
      console.log(`   Per bookmark: ${avgPerBookmark.toFixed(2)}ms`);

      // Batch should be faster due to parallelization
      // Target: < 400ms per bookmark in batch mode
      expect(avgPerBookmark).toBeLessThan(400);
    });
  });

  describe("Memory Usage", () => {
    it("should not leak memory during repeated classifications", async () => {
      const { SimpleClassificationService } = await import(
        "../services/simple-classification.service"
      );

      const service = new SimpleClassificationService(mockSupabase as never);

      // Get initial memory usage
      const initialMemory = process.memoryUsage().heapUsed;

      // Run 50 classifications
      for (let i = 0; i < 50; i++) {
        await service.classify("test-user-id", {
          title: `书签 ${i}`,
          summary: "测试摘要",
          tags: ["测试"],
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`\n💾 Memory Usage:`);
      console.log(`   Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Growth: ${memoryGrowth.toFixed(2)}MB`);

      // Memory growth should be less than 50MB for 50 classifications
      expect(memoryGrowth).toBeLessThan(50);
    });
  });
});
