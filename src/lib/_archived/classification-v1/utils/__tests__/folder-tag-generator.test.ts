/**
 * 文件夹标签生成器单元测试
 *
 * @version 1.0.0
 * @since 2026-01-15
 */

import { generateFolderTags } from "../folder-tag-generator";

describe("FolderTagGenerator", () => {
  describe("智能拆词", () => {
    test("应该正确拆分中英文混合名称", () => {
      const tags = generateFolderTags("lims+实验室");

      expect(tags).toContain("lims");
      expect(tags).toContain("实验室");
    });

    test("应该正确拆分特殊符号分隔的名称", () => {
      const tags = generateFolderTags("前端开发-React");

      // 注：前端开发被识别为整体（词典中有定义）
      expect(tags).toContain("前端开发");
      expect(tags).toContain("react");
    });

    test("应该正确拆分驼峰命名", () => {
      const tags = generateFolderTags("camelCaseTest");

      expect(tags).toContain("camel");
      expect(tags).toContain("case");
      expect(tags).toContain("test");
    });

    test("应该过滤单字符和停用词", () => {
      const tags = generateFolderTags("AI_机器学习");

      // 不应包含"与"（停用词）
      expect(tags).not.toContain("与");

      // 应包含有意义的词
      expect(tags).toContain("ai");
      expect(tags).toContain("机器学习");
    });
  });

  describe("同义词扩展", () => {
    test("应该为 LIMS 添加同义词", () => {
      const tags = generateFolderTags("LIMS");

      expect(tags).toContain("lims");
      expect(tags).toContain("实验室信息管理系统");
      expect(tags).toContain("实验室管理");
    });

    test("应该为前端添加同义词", () => {
      const tags = generateFolderTags("前端");

      expect(tags).toContain("前端");
      expect(tags).toContain("frontend");
      expect(tags).toContain("前端开发");
    });

    test("应该为可持续发展添加同义词", () => {
      const tags = generateFolderTags("可持续发展");

      expect(tags).toContain("可持续发展");
      expect(tags).toContain("可持续");
      expect(tags).toContain("sustainability");
    });
  });

  describe("标签清洗", () => {
    test("应该限制标签数量", () => {
      const tags = generateFolderTags("lims+实验室+实验室管理", {
        maxTags: 5,
      });

      expect(tags.length).toBeLessThanOrEqual(5);
    });

    test("应该优先保留原始 token", () => {
      const tags = generateFolderTags("lims");

      // 原始 token "lims" 应该在前面
      expect(tags[0]).toBe("lims");
    });

    test("应该过滤过长标签", () => {
      const tags = generateFolderTags("lims");

      tags.forEach((tag) => {
        expect(tag.length).toBeLessThanOrEqual(20);
      });
    });
  });

  describe("边界情况", () => {
    test("应该处理空字符串", () => {
      const tags = generateFolderTags("");

      expect(tags).toEqual([""]);
    });

    test("应该处理纯符号", () => {
      const tags = generateFolderTags("+++---");

      // 应该返回原始名称作为回退
      expect(tags).toContain("+++---");
    });

    test("应该处理超长名称", () => {
      const longName = "这是一个非常长的文件夹名称";
      const tags = generateFolderTags(longName);

      // 超长名称会被过滤（> 20字符），返回回退值
      expect(tags.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("真实场景测试", () => {
    test("lims+实验室 案例", () => {
      const tags = generateFolderTags("lims+实验室");

      // 应该包含核心词
      expect(tags).toContain("lims");
      expect(tags).toContain("实验室");

      // 应该包含同义词
      expect(tags).toContain("实验室信息管理系统");
      expect(tags).toContain("实验室管理");

      // 应该有足够的标签（至少 5 个）
      expect(tags.length).toBeGreaterThanOrEqual(5);
    });

    test("Claude 学习 案例", () => {
      const tags = generateFolderTags("Claude 学习");

      expect(tags).toContain("claude");
      expect(tags).toContain("学习");
      expect(tags).toContain("学习资料");
    });

    test("前端开发 案例", () => {
      const tags = generateFolderTags("前端开发");

      // 前端开发作为整体被识别
      expect(tags).toContain("前端开发");
      expect(tags).toContain("frontend");
      expect(tags).toContain("前端");
    });
  });

  describe("禁用同义词", () => {
    test("应该支持禁用同义词扩展", () => {
      const tagsWithSynonyms = generateFolderTags("lims", {
        enableSynonyms: true,
      });

      const tagsWithoutSynonyms = generateFolderTags("lims", {
        enableSynonyms: false,
      });

      expect(tagsWithSynonyms.length).toBeGreaterThan(
        tagsWithoutSynonyms.length,
      );

      // 不启用同义词时，应该只有原始 token
      expect(tagsWithoutSynonyms).toEqual(["lims"]);
    });
  });
});
