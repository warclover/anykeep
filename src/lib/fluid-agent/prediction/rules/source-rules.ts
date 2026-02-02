import type { PredictionRule } from "../../types";

export const sourceRules: PredictionRule[] = [
  {
    id: "source_same_domain",
    name: "归档到来源文件夹",
    icon: "🗂️",
    priority: 82,
    category: "source",
    enabled: true,
    condition: (selection) => {
      if (selection.length < 2) return false;
      const domains = selection.map((b) => extractDomain(b.url));
      return new Set(domains).size === 1;
    },
    action: "archive_by_source",
    params: (selection) => ({
      domain: extractDomain(selection[0].url),
      bookmarkIds: selection.map((b) => b.id),
    }),
  },
  {
    id: "source_same_author",
    name: "创建作者合集",
    icon: "👤",
    priority: 78,
    category: "source",
    enabled: true,
    condition: (selection) => {
      if (selection.length < 2) return false;
      const authors = selection.map((b) => b.author).filter(Boolean);
      return authors.length > 0 && new Set(authors).size === 1;
    },
    action: "create_author_collection",
    params: (selection) => ({
      author: selection[0].author,
      bookmarkIds: selection.map((b) => b.id),
    }),
  },
  {
    id: "source_same_platform",
    name: "按平台整理",
    icon: "📱",
    priority: 75,
    category: "source",
    enabled: true,
    condition: (selection) => {
      if (selection.length < 2) return false;
      const platforms = selection.map((b) => b.platform).filter(Boolean);
      return platforms.length > 0 && new Set(platforms).size === 1;
    },
    action: "organize_by_platform",
  },
];

function extractDomain(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
