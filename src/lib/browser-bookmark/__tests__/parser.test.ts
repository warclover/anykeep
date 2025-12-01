/**
 * 书签解析器测试
 * 测试 Netscape Bookmark HTML 格式的解析功能
 */

import {
  parseBookmarkHtml,
  flattenBookmarks,
  filterSelectedBookmarks,
  countNodes,
  countSelectedBookmarks,
  getMaxDepth,
  getFoldersExceedingDepth,
  isValidBookmarkFile,
} from "../parser";
import type { ParsedBookmarkNode } from "../types";

// Mock crypto.randomUUID for Jest environment
const mockUUID = "test-uuid-123";
let uuidCounter = 0;

// Setup crypto mock
if (typeof global.crypto === "undefined") {
  (global as typeof global & { crypto: Crypto }).crypto = {} as Crypto;
}
global.crypto.randomUUID = jest.fn(
  () => `${mockUUID}-${uuidCounter++}`,
) as () => `${string}-${string}-${string}-${string}-${string}`;

// 测试用的简单书签 HTML
const SIMPLE_BOOKMARK_HTML = `
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL>
  <DT><A HREF="https://example.com" ADD_DATE="1234567890">Example</A>
  <DT><A HREF="https://google.com" ADD_DATE="1234567891">Google</A>
</DL>
`;

// 带文件夹的书签 HTML
const FOLDER_BOOKMARK_HTML = `
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL>
  <DT><H3 ADD_DATE="1234567890" LAST_MODIFIED="1234567899">工作</H3>
  <DL>
    <DT><A HREF="https://github.com" ADD_DATE="1234567891">GitHub</A>
    <DT><A HREF="https://stackoverflow.com" ADD_DATE="1234567892">StackOverflow</A>
  </DL>
  <DT><H3 ADD_DATE="1234567893">娱乐</H3>
  <DL>
    <DT><A HREF="https://youtube.com" ADD_DATE="1234567894">YouTube</A>
  </DL>
</DL>
`;

// 嵌套文件夹的书签 HTML
const NESTED_FOLDER_HTML = `
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL>
  <DT><H3>Level 1</H3>
  <DL>
    <DT><H3>Level 2</H3>
    <DL>
      <DT><H3>Level 3</H3>
      <DL>
        <DT><A HREF="https://deep.com">Deep Bookmark</A>
      </DL>
    </DL>
  </DL>
</DL>
`;

// 带描述的书签 HTML
const BOOKMARK_WITH_DESCRIPTION = `
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL>
  <DT><A HREF="https://example.com">Example Site</A>
  <DD>This is a description of the example site
</DL>
`;

describe("parseBookmarkHtml()", () => {
  beforeEach(() => {
    uuidCounter = 0;
  });

  it("should parse simple bookmarks", () => {
    const result = parseBookmarkHtml("test.html", SIMPLE_BOOKMARK_HTML);

    expect(result.fileName).toBe("test.html");
    expect(result.totalBookmarks).toBe(2);
    expect(result.totalFolders).toBe(0);
    expect(result.roots).toHaveLength(2);

    const firstBookmark = result.roots[0];
    expect(firstBookmark.type).toBe("bookmark");
    expect(firstBookmark.title).toBe("Example");
    expect(firstBookmark.url).toBe("https://example.com");
    expect(firstBookmark.addDate).toBe(1234567890);
  });

  it("should parse bookmarks with folders", () => {
    const result = parseBookmarkHtml("test.html", FOLDER_BOOKMARK_HTML);

    expect(result.totalBookmarks).toBe(3);
    expect(result.totalFolders).toBe(2);
    expect(result.roots).toHaveLength(2);

    const workFolder = result.roots[0];
    expect(workFolder.type).toBe("folder");
    expect(workFolder.title).toBe("工作");
    expect(workFolder.children).toHaveLength(2);
    expect(workFolder.addDate).toBe(1234567890);
    expect(workFolder.lastModified).toBe(1234567899);

    const github = workFolder.children![0];
    expect(github.type).toBe("bookmark");
    expect(github.title).toBe("GitHub");
    expect(github.url).toBe("https://github.com");
  });

  it("should correctly track folder depth", () => {
    const result = parseBookmarkHtml("test.html", NESTED_FOLDER_HTML);

    expect(result.maxDepth).toBe(4);

    const level1 = result.roots[0];
    expect(level1.depth).toBe(1);

    const level2 = level1.children![0];
    expect(level2.depth).toBe(2);

    const level3 = level2.children![0];
    expect(level3.depth).toBe(3);

    const deepBookmark = level3.children![0];
    expect(deepBookmark.depth).toBe(4);
  });

  it("should preserve folder path correctly", () => {
    const result = parseBookmarkHtml("test.html", NESTED_FOLDER_HTML);

    const level1 = result.roots[0];
    expect(level1.path).toEqual(["Level 1"]);

    const level2 = level1.children![0];
    expect(level2.path).toEqual(["Level 1", "Level 2"]);

    const level3 = level2.children![0];
    expect(level3.path).toEqual(["Level 1", "Level 2", "Level 3"]);

    const bookmark = level3.children![0];
    expect(bookmark.path).toEqual([
      "Level 1",
      "Level 2",
      "Level 3",
      "Deep Bookmark",
    ]);
  });

  it("should parse bookmark descriptions", () => {
    const result = parseBookmarkHtml("test.html", BOOKMARK_WITH_DESCRIPTION);

    const bookmark = result.roots[0];
    expect(bookmark.type).toBe("bookmark");
    expect(bookmark.description).toBe(
      "This is a description of the example site",
    );
  });

  it("should throw error for invalid HTML (no DL element)", () => {
    const invalidHtml = "<html><body>Not a bookmark file</body></html>";

    expect(() => parseBookmarkHtml("test.html", invalidHtml)).toThrow(
      "无效的书签文件格式：未找到书签列表",
    );
  });

  it("should handle empty folder", () => {
    const emptyFolderHtml = `
      <!DOCTYPE NETSCAPE-Bookmark-file-1>
      <DL>
        <DT><H3>Empty Folder</H3>
      </DL>
    `;

    const result = parseBookmarkHtml("test.html", emptyFolderHtml);

    expect(result.totalFolders).toBe(1);
    expect(result.totalBookmarks).toBe(0);

    const folder = result.roots[0];
    expect(folder.type).toBe("folder");
    expect(folder.children).toEqual([]);
  });

  it("should assign unique IDs to each node", () => {
    const result = parseBookmarkHtml("test.html", FOLDER_BOOKMARK_HTML);

    const allNodes: ParsedBookmarkNode[] = [];
    function collectNodes(nodes: ParsedBookmarkNode[]) {
      nodes.forEach((node) => {
        allNodes.push(node);
        if (node.children) collectNodes(node.children);
      });
    }
    collectNodes(result.roots);

    const ids = allNodes.map((n) => n.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(allNodes.length);
  });
});

describe("flattenBookmarks()", () => {
  it("should flatten bookmarks from tree structure", () => {
    const result = parseBookmarkHtml("test.html", FOLDER_BOOKMARK_HTML);
    const flattened = flattenBookmarks(result.roots);

    expect(flattened).toHaveLength(3);
    flattened.forEach((node) => {
      expect(node.type).toBe("bookmark");
    });

    const titles = flattened.map((n) => n.title);
    expect(titles).toEqual(["GitHub", "StackOverflow", "YouTube"]);
  });

  it("should handle empty tree", () => {
    const flattened = flattenBookmarks([]);
    expect(flattened).toEqual([]);
  });

  it("should only return bookmark nodes, not folders", () => {
    const result = parseBookmarkHtml("test.html", NESTED_FOLDER_HTML);
    const flattened = flattenBookmarks(result.roots);

    expect(flattened).toHaveLength(1);
    expect(flattened[0].title).toBe("Deep Bookmark");
  });
});

describe("filterSelectedBookmarks()", () => {
  it("should filter bookmarks by selected IDs", () => {
    const result = parseBookmarkHtml("test.html", FOLDER_BOOKMARK_HTML);
    const allBookmarks = flattenBookmarks(result.roots);

    const selectedIds = new Set([allBookmarks[0].id, allBookmarks[2].id]);
    const filtered = filterSelectedBookmarks(result.roots, selectedIds);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe(allBookmarks[0].id);
    expect(filtered[1].id).toBe(allBookmarks[2].id);
  });

  it("should include all child bookmarks when folder is selected", () => {
    const result = parseBookmarkHtml("test.html", FOLDER_BOOKMARK_HTML);
    const workFolder = result.roots[0];

    const selectedIds = new Set([workFolder.id]);
    const filtered = filterSelectedBookmarks(result.roots, selectedIds);

    // 应该包含工作文件夹下的所有书签
    expect(filtered).toHaveLength(2);
    expect(filtered.map((b) => b.title)).toEqual(["GitHub", "StackOverflow"]);
  });

  it("should handle empty selection", () => {
    const result = parseBookmarkHtml("test.html", FOLDER_BOOKMARK_HTML);
    const filtered = filterSelectedBookmarks(result.roots, new Set());

    expect(filtered).toEqual([]);
  });
});

describe("countNodes()", () => {
  it("should count bookmarks and folders correctly", () => {
    const result = parseBookmarkHtml("test.html", FOLDER_BOOKMARK_HTML);
    const counts = countNodes(result.roots);

    expect(counts.bookmarks).toBe(3);
    expect(counts.folders).toBe(2);
  });

  it("should handle empty tree", () => {
    const counts = countNodes([]);
    expect(counts.bookmarks).toBe(0);
    expect(counts.folders).toBe(0);
  });

  it("should count nested structures correctly", () => {
    const result = parseBookmarkHtml("test.html", NESTED_FOLDER_HTML);
    const counts = countNodes(result.roots);

    expect(counts.folders).toBe(3); // Level 1, 2, 3
    expect(counts.bookmarks).toBe(1); // Deep Bookmark
  });
});

describe("countSelectedBookmarks()", () => {
  it("should count selected bookmarks", () => {
    const result = parseBookmarkHtml("test.html", FOLDER_BOOKMARK_HTML);
    const allBookmarks = flattenBookmarks(result.roots);

    const selectedIds = new Set([allBookmarks[0].id, allBookmarks[1].id]);
    const count = countSelectedBookmarks(result.roots, selectedIds);

    expect(count).toBe(2);
  });

  it("should count folder children when folder is selected", () => {
    const result = parseBookmarkHtml("test.html", FOLDER_BOOKMARK_HTML);
    const workFolder = result.roots[0];

    const selectedIds = new Set([workFolder.id]);
    const count = countSelectedBookmarks(result.roots, selectedIds);

    expect(count).toBe(2); // GitHub + StackOverflow
  });
});

describe("getMaxDepth()", () => {
  it("should return max depth correctly", () => {
    const result = parseBookmarkHtml("test.html", NESTED_FOLDER_HTML);
    const maxDepth = getMaxDepth(result.roots);

    expect(maxDepth).toBe(4);
  });

  it("should return 0 for empty tree", () => {
    const maxDepth = getMaxDepth([]);
    expect(maxDepth).toBe(0);
  });

  it("should return 1 for flat structure", () => {
    const result = parseBookmarkHtml("test.html", SIMPLE_BOOKMARK_HTML);
    const maxDepth = getMaxDepth(result.roots);

    expect(maxDepth).toBe(1);
  });
});

describe("getFoldersExceedingDepth()", () => {
  it("should find folders exceeding depth limit", () => {
    const result = parseBookmarkHtml("test.html", NESTED_FOLDER_HTML);
    const exceeding = getFoldersExceedingDepth(result.roots, 2);

    expect(exceeding).toHaveLength(1);
    expect(exceeding[0].path).toEqual(["Level 1", "Level 2", "Level 3"]);
    expect(exceeding[0].depth).toBe(3);
  });

  it("should return empty array if no folders exceed depth", () => {
    const result = parseBookmarkHtml("test.html", FOLDER_BOOKMARK_HTML);
    const exceeding = getFoldersExceedingDepth(result.roots, 10);

    expect(exceeding).toEqual([]);
  });

  it("should handle empty tree", () => {
    const exceeding = getFoldersExceedingDepth([], 2);
    expect(exceeding).toEqual([]);
  });
});

describe("isValidBookmarkFile()", () => {
  it("should validate correct Netscape bookmark file", () => {
    expect(isValidBookmarkFile(SIMPLE_BOOKMARK_HTML)).toBe(true);
    expect(isValidBookmarkFile(FOLDER_BOOKMARK_HTML)).toBe(true);
  });

  it("should validate file with DOCTYPE", () => {
    const html = "<!DOCTYPE NETSCAPE-Bookmark-file-1><html></html>";
    expect(isValidBookmarkFile(html)).toBe(true);
  });

  it("should validate file with DL element (case insensitive)", () => {
    const htmlUppercase = "<html><DL></DL></html>";
    const htmlLowercase = "<html><dl></dl></html>";

    expect(isValidBookmarkFile(htmlUppercase)).toBe(true);
    expect(isValidBookmarkFile(htmlLowercase)).toBe(true);
  });

  it("should reject invalid files", () => {
    const invalidHtml = "<html><body>Not a bookmark file</body></html>";
    expect(isValidBookmarkFile(invalidHtml)).toBe(false);
  });

  it("should reject empty string", () => {
    expect(isValidBookmarkFile("")).toBe(false);
  });
});
