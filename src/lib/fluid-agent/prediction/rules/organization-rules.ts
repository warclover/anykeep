import type { PredictionRule } from "../../types";

export const organizationRules: PredictionRule[] = [
  {
    id: "tag_none",
    name: "智能标签",
    icon: "🏷️",
    priority: 78,
    category: "tag",
    enabled: true,
    condition: (selection) => {
      return selection.every((b) => !b.ai_tags || b.ai_tags.length === 0);
    },
    action: "smart_tagging",
  },
  {
    id: "tag_same",
    name: "合并到文件夹",
    icon: "🗂️",
    priority: 70,
    category: "tag",
    enabled: true,
    condition: (selection) => {
      if (selection.length < 2) return false;
      const tagSets = selection.map((b) => new Set(b.ai_tags || []));
      if (tagSets.some((s) => s.size === 0)) return false;

      // 检查是否有共同标签
      const commonTags = [...tagSets[0]].filter((tag) =>
        tagSets.every((s) => s.has(tag)),
      );
      return commonTags.length > 0;
    },
    action: "merge_to_folder",
  },
  {
    id: "folder_none",
    name: "智能归档",
    icon: "📁",
    priority: 80,
    category: "folder",
    enabled: true,
    condition: (selection) => {
      return selection.every((b) => !b.folder_id);
    },
    action: "smart_archive",
  },
];
