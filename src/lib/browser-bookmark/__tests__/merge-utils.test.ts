/**
 * 书签合并去重工具测试
 * 测试多文件导入时的合并和去重逻辑
 */

import { mergeBookmarkFiles, generateMergeSummary } from "../merge-utils";
import type { ParsedBookmarkFile, ParsedBookmarkNode } from "../types";

// 辅助函数：创建书签节点
function createBookmark(
  title: string,
  url: string,
  depth = 1,
): ParsedBookmarkNode {
  return {
    type: "bookmark",
    id: `bookmark-${title}`,
    title,
    url,
    path: [title],
    depth,
  };
}

// 辅助函数：创建文件夹节点
function createFolder(
  title: string,
  children: ParsedBookmarkNode[] = [],
  depth = 1,
): ParsedBookmarkNode {
  return {
    type: "folder",
    id: `folder-${title}`,
    title,
    children,
    path: [title],
    depth,
  };
}

// 辅助函数：创建书签文件对象
function createBookmarkFile(
  fileName: string,
  roots: ParsedBookmarkNode[],
): ParsedBookmarkFile {
  let totalBookmarks = 0;
  let totalFolders = 0;

  function count(nodes: ParsedBookmarkNode[]) {
    nodes.forEach((node) => {
      if (node.type === "bookmark") totalBookmarks++;
      else if (node.type === "folder") {
        totalFolders++;
        if (node.children) count(node.children);
      }
    });
  }

  count(roots);

  return {
    fileName,
    source: "chrome",
    platform: "chrome",
    roots,
    totalBookmarks,
    totalFolders,
    maxDepth: 1,
    parsedAt: new Date(),
  };
}

describe("mergeBookmarkFiles()", () => {
  it("should return empty result for empty input", () => {
    const result = mergeBookmarkFiles([]);

    expect(result.roots).toEqual([]);
    expect(result.totalBookmarks).toBe(0);
    expect(result.totalFolders).toBe(0);
    expect(result.originalCount).toBe(0);
    expect(result.duplicateCount).toBe(0);
    expect(result.sourceFilesCount).toBe(0);
    expect(result.sourceBreakdown).toEqual([]);
  });

  it("should return unchanged result for single file", () => {
    const file = createBookmarkFile("test.html", [
      createBookmark("Bookmark 1", "https://example.com"),
      createBookmark("Bookmark 2", "https://google.com"),
    ]);

    const result = mergeBookmarkFiles([file]);

    expect(result.totalBookmarks).toBe(2);
    expect(result.totalFolders).toBe(0);
    expect(result.originalCount).toBe(2);
    expect(result.duplicateCount).toBe(0);
    expect(result.sourceFilesCount).toBe(1);
    expect(result.roots).toEqual(file.roots);
  });

  it("should merge multiple files without duplicates", () => {
    const file1 = createBookmarkFile("file1.html", [
      createBookmark("Bookmark 1", "https://example.com"),
      createBookmark("Bookmark 2", "https://google.com"),
    ]);

    const file2 = createBookmarkFile("file2.html", [
      createBookmark("Bookmark 3", "https://github.com"),
      createBookmark("Bookmark 4", "https://stackoverflow.com"),
    ]);

    const result = mergeBookmarkFiles([file1, file2]);

    expect(result.totalBookmarks).toBe(4);
    expect(result.duplicateCount).toBe(0);
    expect(result.originalCount).toBe(4);
    expect(result.sourceFilesCount).toBe(2);
  });

  it("should detect and remove duplicate bookmarks by URL", () => {
    const file1 = createBookmarkFile("file1.html", [
      createBookmark("Example", "https://example.com"),
      createBookmark("Google", "https://google.com"),
    ]);

    const file2 = createBookmarkFile("file2.html", [
      createBookmark("Example Duplicate", "https://example.com"), // 重复
      createBookmark("GitHub", "https://github.com"),
    ]);

    const result = mergeBookmarkFiles([file1, file2]);

    expect(result.totalBookmarks).toBe(3); // 去重后
    expect(result.duplicateCount).toBe(1);
    expect(result.originalCount).toBe(4); // 原始数量

    expect(result.sourceBreakdown[0].bookmarkCount).toBe(2);
    expect(result.sourceBreakdown[0].duplicateCount).toBe(0);
    expect(result.sourceBreakdown[1].bookmarkCount).toBe(1); // 第二个文件只有 1 个非重复
    expect(result.sourceBreakdown[1].duplicateCount).toBe(1);
  });

  it("should handle URL case insensitivity in deduplication", () => {
    const file1 = createBookmarkFile("file1.html", [
      createBookmark("Example", "https://EXAMPLE.com"),
    ]);

    const file2 = createBookmarkFile("file2.html", [
      createBookmark("Example Lowercase", "https://example.com"),
    ]);

    const result = mergeBookmarkFiles([file1, file2]);

    expect(result.totalBookmarks).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it("should trim URLs when comparing", () => {
    const file1 = createBookmarkFile("file1.html", [
      createBookmark("Example", "https://example.com  "),
    ]);

    const file2 = createBookmarkFile("file2.html", [
      createBookmark("Example Trimmed", "  https://example.com"),
    ]);

    const result = mergeBookmarkFiles([file1, file2]);

    expect(result.totalBookmarks).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it("should preserve folders and their structure", () => {
    const file1 = createBookmarkFile("file1.html", [
      createFolder("Folder 1", [
        createBookmark("Bookmark 1", "https://example.com", 2),
      ]),
    ]);

    const file2 = createBookmarkFile("file2.html", [
      createFolder("Folder 2", [
        createBookmark("Bookmark 2", "https://google.com", 2),
      ]),
    ]);

    const result = mergeBookmarkFiles([file1, file2]);

    expect(result.totalBookmarks).toBe(2);
    expect(result.totalFolders).toBe(2);
    expect(result.roots).toHaveLength(2);

    const folder1 = result.roots[0];
    expect(folder1.type).toBe("folder");
    expect(folder1.children).toHaveLength(1);
  });

  it("should remove empty folders after deduplication", () => {
    const file1 = createBookmarkFile("file1.html", [
      createFolder("Folder", [
        createBookmark("Bookmark", "https://example.com", 2),
      ]),
    ]);

    const file2 = createBookmarkFile("file2.html", [
      createFolder("Empty Folder", [
        createBookmark("Duplicate", "https://example.com", 2), // 会被去重
      ]),
    ]);

    const result = mergeBookmarkFiles([file1, file2]);

    expect(result.totalBookmarks).toBe(1);
    expect(result.totalFolders).toBe(1); // 空文件夹应该被移除
  });

  it("should handle nested folders correctly", () => {
    const file = createBookmarkFile("file.html", [
      createFolder(
        "Level 1",
        [
          createFolder(
            "Level 2",
            [createBookmark("Deep Bookmark", "https://deep.com", 3)],
            2,
          ),
        ],
        1,
      ),
    ]);

    const result = mergeBookmarkFiles([file]);

    expect(result.totalBookmarks).toBe(1);
    expect(result.totalFolders).toBe(2);

    const level1 = result.roots[0];
    const level2 = level1.children![0];
    const bookmark = level2.children![0];

    expect(level1.type).toBe("folder");
    expect(level2.type).toBe("folder");
    expect(bookmark.type).toBe("bookmark");
  });

  it("should generate correct source breakdown", () => {
    const file1 = createBookmarkFile("chrome.html", [
      createBookmark("A", "https://a.com"),
      createBookmark("B", "https://b.com"),
    ]);

    const file2 = createBookmarkFile("firefox.html", [
      createBookmark("A Duplicate", "https://a.com"), // 重复
      createBookmark("C", "https://c.com"),
      createBookmark("D", "https://d.com"),
    ]);

    const result = mergeBookmarkFiles([file1, file2]);

    expect(result.sourceBreakdown).toHaveLength(2);

    expect(result.sourceBreakdown[0].fileName).toBe("chrome.html");
    expect(result.sourceBreakdown[0].bookmarkCount).toBe(2);
    expect(result.sourceBreakdown[0].duplicateCount).toBe(0);

    expect(result.sourceBreakdown[1].fileName).toBe("firefox.html");
    expect(result.sourceBreakdown[1].bookmarkCount).toBe(2);
    expect(result.sourceBreakdown[1].duplicateCount).toBe(1);
  });

  it("should handle bookmarks without URLs", () => {
    const file = createBookmarkFile("file.html", [
      createBookmark("No URL", ""),
      createBookmark("Also No URL", ""),
      createBookmark("Valid", "https://example.com"),
    ]);

    const result = mergeBookmarkFiles([file]);

    // 无 URL 的书签会被保留，但不参与去重
    expect(result.totalBookmarks).toBe(3);
    expect(result.duplicateCount).toBe(0);
  });

  it("should handle large number of files", () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      createBookmarkFile(`file-${i}.html`, [
        createBookmark(`Bookmark ${i}`, `https://example${i}.com`),
      ]),
    );

    const result = mergeBookmarkFiles(files);

    expect(result.sourceFilesCount).toBe(10);
    expect(result.totalBookmarks).toBe(10);
    expect(result.duplicateCount).toBe(0);
  });
});

describe("generateMergeSummary()", () => {
  it("should generate summary for single file", () => {
    const file = createBookmarkFile("test.html", [
      createBookmark("A", "https://a.com"),
      createBookmark("B", "https://b.com"),
    ]);

    const result = mergeBookmarkFiles([file]);
    const summary = generateMergeSummary(result);

    expect(summary).toBe("共 2 个书签");
  });

  it("should generate summary for multiple files without duplicates", () => {
    const file1 = createBookmarkFile("file1.html", [
      createBookmark("A", "https://a.com"),
    ]);
    const file2 = createBookmarkFile("file2.html", [
      createBookmark("B", "https://b.com"),
    ]);

    const result = mergeBookmarkFiles([file1, file2]);
    const summary = generateMergeSummary(result);

    expect(summary).toBe("合并 2 个文件，共 2 个书签");
  });

  it("should include duplicate count when duplicates exist", () => {
    const file1 = createBookmarkFile("file1.html", [
      createBookmark("A", "https://example.com"),
    ]);
    const file2 = createBookmarkFile("file2.html", [
      createBookmark("A Duplicate", "https://example.com"),
    ]);

    const result = mergeBookmarkFiles([file1, file2]);
    const summary = generateMergeSummary(result);

    expect(summary).toBe("合并 2 个文件，共 1 个书签，已去除 1 个重复");
  });

  it("should handle multiple duplicates", () => {
    const file1 = createBookmarkFile("file1.html", [
      createBookmark("A", "https://a.com"),
      createBookmark("B", "https://b.com"),
    ]);
    const file2 = createBookmarkFile("file2.html", [
      createBookmark("A Dup", "https://a.com"),
      createBookmark("B Dup", "https://b.com"),
      createBookmark("C", "https://c.com"),
    ]);

    const result = mergeBookmarkFiles([file1, file2]);
    const summary = generateMergeSummary(result);

    expect(summary).toBe("合并 2 个文件，共 3 个书签，已去除 2 个重复");
  });

  it("should handle empty result", () => {
    const result = mergeBookmarkFiles([]);
    const summary = generateMergeSummary(result);

    // 空结果时 sourceFilesCount 为 0，会走 else 分支
    expect(summary).toBe("合并 0 个文件，共 0 个书签");
  });
});
