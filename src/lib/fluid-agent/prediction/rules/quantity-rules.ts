import type { PredictionRule } from "../../types";

export const quantityRules: PredictionRule[] = [
  {
    id: "qty_gt_10",
    name: "批量整理",
    icon: "📦",
    priority: 70,
    category: "quantity",
    enabled: true,
    condition: (selection) => selection.length > 10,
    action: "batch_organize",
  },
  {
    id: "qty_gt_50",
    name: "智能分类",
    icon: "🏷️",
    priority: 72,
    category: "quantity",
    enabled: true,
    condition: (selection) => selection.length > 50,
    action: "smart_classify",
  },
];
