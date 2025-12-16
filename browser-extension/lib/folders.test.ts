/**
 * Folders Module Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getFolders,
  flattenFolders,
  findFolderById,
  getFolderPath,
  type FolderTreeNode,
} from "./folders";

// Mock the api module
vi.mock("./api", () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from "./api";

describe("folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Sample folder tree for testing
  const sampleFolderTree: FolderTreeNode[] = [
    {
      id: 1,
      name: "工作",
      parentId: null,
      children: [
        {
          id: 2,
          name: "项目A",
          parentId: 1,
          children: [],
          bookmarkCount: 5,
        },
        {
          id: 3,
          name: "项目B",
          parentId: 1,
          children: [
            {
              id: 4,
              name: "子项目",
              parentId: 3,
              children: [],
              bookmarkCount: 2,
            },
          ],
          bookmarkCount: 3,
        },
      ],
      bookmarkCount: 10,
    },
    {
      id: 5,
      name: "个人",
      parentId: null,
      children: [],
      bookmarkCount: 8,
    },
  ];

  describe("getFolders", () => {
    it("should return folders from API", async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: sampleFolderTree,
      });

      const result = await getFolders();

      expect(api.get).toHaveBeenCalledWith("/api/folders");
      expect(result).toEqual(sampleFolderTree);
    });

    it("should return empty array when API returns null data", async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: null,
      });

      const result = await getFolders();

      expect(result).toEqual([]);
    });

    it("should return empty array on API error", async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error("Network error"));

      const result = await getFolders();

      expect(result).toEqual([]);
    });
  });

  describe("flattenFolders", () => {
    it("should return empty array for empty input", () => {
      const result = flattenFolders([]);
      expect(result).toEqual([]);
    });

    it("should flatten single level folders", () => {
      const singleLevel: FolderTreeNode[] = [
        { id: 1, name: "Folder1", parentId: null, children: [] },
        { id: 2, name: "Folder2", parentId: null, children: [] },
      ];

      const result = flattenFolders(singleLevel);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        name: "Folder1",
        depth: 0,
        fullPath: "Folder1",
      });
      expect(result[1]).toEqual({
        id: 2,
        name: "Folder2",
        depth: 0,
        fullPath: "Folder2",
      });
    });

    it("should flatten nested folders with correct depth", () => {
      const result = flattenFolders(sampleFolderTree);

      expect(result).toHaveLength(5);

      // Check depths
      expect(result.find((f) => f.id === 1)?.depth).toBe(0);
      expect(result.find((f) => f.id === 2)?.depth).toBe(1);
      expect(result.find((f) => f.id === 3)?.depth).toBe(1);
      expect(result.find((f) => f.id === 4)?.depth).toBe(2);
      expect(result.find((f) => f.id === 5)?.depth).toBe(0);
    });

    it("should build correct full paths", () => {
      const result = flattenFolders(sampleFolderTree);

      expect(result.find((f) => f.id === 1)?.fullPath).toBe("工作");
      expect(result.find((f) => f.id === 2)?.fullPath).toBe("工作 / 项目A");
      expect(result.find((f) => f.id === 3)?.fullPath).toBe("工作 / 项目B");
      expect(result.find((f) => f.id === 4)?.fullPath).toBe(
        "工作 / 项目B / 子项目",
      );
      expect(result.find((f) => f.id === 5)?.fullPath).toBe("个人");
    });

    it("should preserve order (parent before children)", () => {
      const result = flattenFolders(sampleFolderTree);

      const ids = result.map((f) => f.id);
      // 工作(1) should come before its children 项目A(2), 项目B(3)
      expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(2));
      expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(3));
      // 项目B(3) should come before 子项目(4)
      expect(ids.indexOf(3)).toBeLessThan(ids.indexOf(4));
    });

    it("should handle custom initial depth", () => {
      const singleFolder: FolderTreeNode[] = [
        { id: 1, name: "Test", parentId: null, children: [] },
      ];

      const result = flattenFolders(singleFolder, 2);

      expect(result[0].depth).toBe(2);
    });

    it("should handle custom parent path", () => {
      const singleFolder: FolderTreeNode[] = [
        { id: 1, name: "Test", parentId: null, children: [] },
      ];

      const result = flattenFolders(singleFolder, 0, "Root");

      expect(result[0].fullPath).toBe("Root / Test");
    });
  });

  describe("findFolderById", () => {
    it("should return null for empty folders", () => {
      const result = findFolderById([], 1);
      expect(result).toBeNull();
    });

    it("should find root level folder", () => {
      const result = findFolderById(sampleFolderTree, 1);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("工作");
    });

    it("should find nested folder at depth 1", () => {
      const result = findFolderById(sampleFolderTree, 2);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("项目A");
    });

    it("should find deeply nested folder", () => {
      const result = findFolderById(sampleFolderTree, 4);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("子项目");
    });

    it("should return null for non-existent id", () => {
      const result = findFolderById(sampleFolderTree, 999);
      expect(result).toBeNull();
    });

    it("should return the complete folder object", () => {
      const result = findFolderById(sampleFolderTree, 3);

      expect(result).toEqual({
        id: 3,
        name: "项目B",
        parentId: 1,
        children: [
          {
            id: 4,
            name: "子项目",
            parentId: 3,
            children: [],
            bookmarkCount: 2,
          },
        ],
        bookmarkCount: 3,
      });
    });
  });

  describe("getFolderPath", () => {
    it("should return empty string for empty folders", () => {
      const result = getFolderPath([], 1);
      expect(result).toBe("");
    });

    it("should return root folder path", () => {
      const result = getFolderPath(sampleFolderTree, 1);
      expect(result).toBe("工作");
    });

    it("should return nested folder path", () => {
      const result = getFolderPath(sampleFolderTree, 2);
      expect(result).toBe("工作 / 项目A");
    });

    it("should return deeply nested folder path", () => {
      const result = getFolderPath(sampleFolderTree, 4);
      expect(result).toBe("工作 / 项目B / 子项目");
    });

    it("should return empty string for non-existent id", () => {
      const result = getFolderPath(sampleFolderTree, 999);
      expect(result).toBe("");
    });
  });
});
