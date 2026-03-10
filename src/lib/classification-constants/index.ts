/**
 * 分类系统常量桥接模块
 *
 * @deprecated 过渡模块，后续将内联化
 */

// limits 常量
export {
  CLASSIFICATION_WEIGHTS,
  CLASSIFICATION_THRESHOLDS,
  MATCHER_STRATEGY_CONFIG,
} from "@/lib/classification/constants/limits";

// universal-categories 常量
export {
  UNIVERSAL_CATEGORIES,
  CATEGORY_GROUP_NAMES,
} from "@/lib/classification/constants/universal-categories";

// universal-categories 类型
export type {
  CategoryGroup,
  UniversalCategory,
} from "@/lib/classification/constants/universal-categories";
